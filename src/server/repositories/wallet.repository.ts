import { prisma } from '#/db'

export async function getWalletsByUser(userId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  return wallets.map((w) => ({ ...w, balance: w.balance.toNumber() }))
}

export async function updateWallet(
  id: string,
  userId: string,
  data: {
    name?: string
    type?: 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT'
    color?: string
    icon?: string | null
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
    await tx.wallet.update({ where: { id: fromWalletId }, data: { balance: { decrement: amount } } })
    await tx.wallet.update({ where: { id: toWalletId }, data: { balance: { increment: amount } } })
  })
}

export function createWallet(data: {
  userId: string
  name: string
  type: 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT'
  color?: string
  icon?: string
  balance?: number
}) {
  return prisma.wallet.create({ data })
}
