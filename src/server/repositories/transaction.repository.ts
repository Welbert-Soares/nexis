import { prisma } from '#/db'

export function createTransaction(data: {
  walletId: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  categoryId?: string
  description?: string
  date?: Date
}) {
  const { amount, type, ...rest } = data
  const delta = type === 'EXPENSE' ? -amount : amount

  return prisma.$transaction([
    prisma.transaction.create({
      data: { amount, type, ...rest, date: rest.date ?? new Date() },
    }),
    prisma.wallet.update({
      where: { id: data.walletId },
      data: { balance: { increment: delta } },
    }),
  ])
}

export async function getTransactionsByMonth(
  userId: string,
  year: number,
  month: number,
  type?: 'INCOME' | 'EXPENSE',
) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const rows = await prisma.transaction.findMany({
    where: {
      wallet: { userId },
      date: { gte: start, lt: end },
      ...(type ? { type } : {}),
    },
    include: {
      category: true,
      wallet: { select: { id: true, name: true, color: true } },
    },
    orderBy: { date: 'desc' },
  })

  return rows.map((t) => ({ ...t, amount: t.amount.toNumber() }))
}

export async function deleteTransaction(id: string, userId: string) {
  const tx = await prisma.transaction.findFirst({
    where: { id, wallet: { userId } },
  })
  if (!tx) throw new Error('Transaction not found')

  const delta = tx.type === 'EXPENSE' ? tx.amount : tx.amount.neg()

  return prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    prisma.wallet.update({
      where: { id: tx.walletId },
      data: { balance: { increment: delta } },
    }),
  ])
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: {
    amount: number
    type: 'INCOME' | 'EXPENSE'
    categoryId?: string | null
    description?: string | null
    date?: Date
  },
) {
  const old = await prisma.transaction.findFirst({
    where: { id, wallet: { userId } },
  })
  if (!old) throw new Error('Transaction not found')

  const oldDelta = old.type === 'EXPENSE' ? -old.amount.toNumber() : old.amount.toNumber()
  const newDelta = data.type === 'EXPENSE' ? -data.amount : data.amount
  const balanceDiff = newDelta - oldDelta

  return prisma.$transaction([
    prisma.transaction.update({
      where: { id },
      data: {
        amount: data.amount,
        type: data.type,
        categoryId: data.categoryId ?? null,
        description: data.description ?? null,
        ...(data.date ? { date: data.date } : {}),
      },
    }),
    prisma.wallet.update({
      where: { id: old.walletId },
      data: { balance: { increment: balanceDiff } },
    }),
  ])
}

export async function getRecentTransactions(userId: string, limit = 10) {
  const rows = await prisma.transaction.findMany({
    where: { wallet: { userId } },
    include: { category: true, wallet: true },
    orderBy: { date: 'desc' },
    take: limit,
  })
  return rows.map((t) => ({
    ...t,
    amount: t.amount.toNumber(),
    wallet: { ...t.wallet, balance: t.wallet.balance.toNumber() },
  }))
}
