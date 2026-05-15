import { prisma } from '#/db'

export async function getWalletBalance(walletId: string): Promise<number> {
  const wallet = await prisma.wallet.findFirst({ where: { id: walletId }, select: { initialBalance: true } })
  if (!wallet) throw new Error('Wallet not found')
  return computeBalance(walletId, wallet.initialBalance.toNumber())
}

async function computeBalance(walletId: string, initialBalance: number): Promise<number> {
  const [income, expense] = await Promise.all([
    prisma.transaction.aggregate({
      where: { walletId, type: 'INCOME', deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { walletId, type: 'EXPENSE', deletedAt: null },
      _sum: { amount: true },
    }),
  ])
  return initialBalance + (income._sum.amount?.toNumber() ?? 0) - (expense._sum.amount?.toNumber() ?? 0)
}

export async function updateWallet(
  id: string,
  userId: string,
  data: {
    name?: string
    type?: 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT'
    color?: string
    icon?: string | null
    creditLimit?: number | null
    closingDay?: number | null
    dueDay?: number | null
  },
) {
  const wallet = await prisma.wallet.findFirst({ where: { id, userId } })
  if (!wallet) throw new Error('Wallet not found')
  return prisma.wallet.update({ where: { id }, data })
}

export async function deleteWallet(id: string, userId: string) {
  const wallet = await prisma.wallet.findFirst({ where: { id, userId } })
  if (!wallet) throw new Error('Wallet not found')
  return prisma.wallet.delete({ where: { id } })
}

export async function transferBetweenWallets(
  userId: string,
  fromWalletId: string,
  toWalletId: string,
  amount: number,
) {
  const [from, to] = await Promise.all([
    prisma.wallet.findFirst({ where: { id: fromWalletId, userId } }),
    prisma.wallet.findFirst({ where: { id: toWalletId, userId } }),
  ])
  if (!from) throw new Error('Carteira de origem não encontrada')
  if (!to) throw new Error('Carteira de destino não encontrada')
  if (fromWalletId === toWalletId) throw new Error('Carteiras devem ser diferentes')

  const fromBalance = await computeBalance(fromWalletId, from.initialBalance.toNumber())
  if (amount > fromBalance) throw new Error('Saldo insuficiente na carteira de origem')

  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const expense = await tx.transaction.create({
      data: {
        amount,
        type: 'EXPENSE',
        walletId: fromWalletId,
        description: `Transferência → ${to.name}`,
        date: now,
      },
    })
    await tx.transaction.create({
      data: {
        amount,
        type: 'INCOME',
        walletId: toWalletId,
        description: `Transferência ← ${from.name}`,
        date: now,
        parentId: expense.id,
      },
    })
  })
}

export function createWallet(data: {
  userId: string
  name: string
  type: 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT'
  color?: string
  icon?: string
  balance?: number
  creditLimit?: number | null
  closingDay?: number | null
  dueDay?: number | null
}) {
  const { balance, ...rest } = data
  return prisma.wallet.create({ data: { ...rest, initialBalance: balance ?? 0 } })
}

export async function getWalletsByUser(userId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })

  const walletIds = wallets.map((w) => w.id)
  if (!walletIds.length) return []

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['walletId'],
      where: { walletId: { in: walletIds }, type: 'INCOME', deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['walletId'],
      where: { walletId: { in: walletIds }, type: 'EXPENSE', deletedAt: null },
      _sum: { amount: true },
    }),
  ])

  const incomeMap = new Map(incomeAgg.map((r) => [r.walletId, r._sum.amount?.toNumber() ?? 0]))
  const expenseMap = new Map(expenseAgg.map((r) => [r.walletId, r._sum.amount?.toNumber() ?? 0]))

  return wallets.map((w) => ({
    ...w,
    balance: w.initialBalance.toNumber() + (incomeMap.get(w.id) ?? 0) - (expenseMap.get(w.id) ?? 0),
    initialBalance: w.initialBalance.toNumber(),
    creditLimit: w.creditLimit?.toNumber() ?? null,
  }))
}
