import { prisma } from '#/db'
import type { RecurrenceInterval } from '#/generated/prisma/enums'

export function createTransaction(data: {
  walletId: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  categoryId?: string
  description?: string
  date?: Date
  recurring?: boolean
  interval?: RecurrenceInterval
  nextDue?: Date
  parentId?: string
}) {
  const { amount, type, ...rest } = data
  return prisma.transaction.create({
    data: { amount, type, ...rest, date: rest.date ?? new Date() },
  })
}

function calcNextDue(from: Date, interval: RecurrenceInterval): Date {
  const d = new Date(from)
  switch (interval) {
    case 'WEEKLY':    d.setDate(d.getDate() + 7); break
    case 'BIWEEKLY':  d.setDate(d.getDate() + 14); break
    case 'MONTHLY':   d.setMonth(d.getMonth() + 1); break
    case 'YEARLY':    d.setFullYear(d.getFullYear() + 1); break
  }
  return d
}

export async function processDueRecurring(userId: string) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const due = await prisma.transaction.findMany({
    where: {
      wallet: { userId },
      recurring: true,
      parentId: null,
      nextDue: { lte: today },
      deletedAt: null,
    },
  })

  if (!due.length) return 0

  await prisma.$transaction(
    due.flatMap((t) => {
      const dueDate = t.nextDue!
      const next = calcNextDue(dueDate, t.interval!)
      return [
        prisma.transaction.create({
          data: {
            walletId: t.walletId,
            amount: t.amount,
            type: t.type,
            description: t.description,
            categoryId: t.categoryId,
            date: dueDate,
            parentId: t.id,
          },
        }),
        prisma.transaction.update({
          where: { id: t.id },
          data: { nextDue: next },
        }),
      ]
    }),
  )

  return due.length
}

export async function createInstallments(data: {
  walletId: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  categoryId?: string
  description?: string
  date: Date
  installments: number
}) {
  const { amount, type, installments, date, description } = data
  const perInstallment = Math.round((amount / installments) * 100) / 100

  const creates = Array.from({ length: installments }, (_, i) => {
    const installDate = new Date(date)
    installDate.setMonth(installDate.getMonth() + i)
    const desc = description
      ? `${description} (${i + 1}/${installments})`
      : `(${i + 1}/${installments})`
    return prisma.transaction.create({
      data: { amount: perInstallment, type, walletId: data.walletId, categoryId: data.categoryId, description: desc, date: installDate },
    })
  })

  return prisma.$transaction(creates)
}

export async function getTransactionsByMonth(
  userId: string,
  year: number,
  month: number,
  type?: 'INCOME' | 'EXPENSE',
  walletId?: string,
) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const rows = await prisma.transaction.findMany({
    where: {
      wallet: { userId },
      date: { gte: start, lt: end },
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(walletId ? { walletId } : {}),
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
    where: { id, wallet: { userId }, deletedAt: null },
  })
  if (!tx) throw new Error('Transaction not found')

  return prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } })
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: {
    amount: number
    type: 'INCOME' | 'EXPENSE'
    walletId?: string
    categoryId?: string | null
    description?: string | null
    date?: Date
    recurring?: boolean
    interval?: RecurrenceInterval
    nextDue?: Date
  },
) {
  const old = await prisma.transaction.findFirst({
    where: { id, wallet: { userId }, deletedAt: null },
  })
  if (!old) throw new Error('Transaction not found')

  const newWalletId = data.walletId ?? old.walletId

  return prisma.transaction.update({
    where: { id },
    data: {
      amount: data.amount,
      type: data.type,
      walletId: newWalletId,
      categoryId: data.categoryId ?? null,
      description: data.description ?? null,
      ...(data.date ? { date: data.date } : {}),
      ...(data.recurring !== undefined ? { recurring: data.recurring } : {}),
      ...(data.interval !== undefined ? { interval: data.interval } : {}),
      ...(data.nextDue !== undefined ? { nextDue: data.nextDue } : {}),
    },
  })
}

export async function getRecentTransactions(userId: string, limit = 10) {
  const rows = await prisma.transaction.findMany({
    where: { wallet: { userId }, deletedAt: null },
    include: {
      category: true,
      wallet: { select: { id: true, name: true, color: true, icon: true, type: true } },
    },
    orderBy: { date: 'desc' },
    take: limit,
  })
  return rows.map((t) => ({ ...t, amount: t.amount.toNumber() }))
}
