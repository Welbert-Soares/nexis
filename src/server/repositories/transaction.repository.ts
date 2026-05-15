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

  return prisma.$transaction(async (tx) => {
    const installDate0 = new Date(date)
    const desc0 = description
      ? `${description} (1/${installments})`
      : `(1/${installments})`

    const root = await tx.transaction.create({
      data: { amount: perInstallment, type, walletId: data.walletId, categoryId: data.categoryId, description: desc0, date: installDate0 },
    })

    await Promise.all(
      Array.from({ length: installments - 1 }, (_, i) => {
        const installDate = new Date(date)
        installDate.setMonth(installDate.getMonth() + i + 1)
        const desc = description
          ? `${description} (${i + 2}/${installments})`
          : `(${i + 2}/${installments})`
        return tx.transaction.create({
          data: { amount: perInstallment, type, walletId: data.walletId, categoryId: data.categoryId, description: desc, date: installDate, parentId: root.id },
        })
      }),
    )

    return root
  })
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
      parent: { select: { recurring: true } },
      _count: { select: { children: true } },
    },
    orderBy: { date: 'desc' },
  })

  return rows.map((t) => {
    const isInstallmentChild = !!t.parentId && t.parent?.recurring === false
    const isInstallmentRoot = !t.parentId && !t.recurring && t._count.children > 0
    return {
      ...t,
      amount: t.amount.toNumber(),
      isInstallment: isInstallmentChild || isInstallmentRoot,
    }
  })
}

export async function deleteInstallmentGroup(
  id: string,
  userId: string,
  mode: 'this' | 'this-and-future' | 'all',
) {
  const tx = await prisma.transaction.findFirst({
    where: { id, wallet: { userId }, deletedAt: null },
  })
  if (!tx) throw new Error('Transaction not found')

  const rootId = tx.parentId ?? tx.id
  const now = new Date()

  if (mode === 'this') {
    await prisma.transaction.update({ where: { id }, data: { deletedAt: now } })
    return
  }

  if (mode === 'all') {
    await prisma.transaction.updateMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }], deletedAt: null },
      data: { deletedAt: now },
    })
    return
  }

  // 'this-and-future': delete this and all siblings with date >= this tx's date
  const siblings = await prisma.transaction.findMany({
    where: { OR: [{ id: rootId }, { parentId: rootId }], deletedAt: null },
    select: { id: true, date: true },
  })
  const txDate = new Date(tx.date)
  const toDelete = siblings.filter((s) => new Date(s.date) >= txDate).map((s) => s.id)
  await prisma.transaction.updateMany({
    where: { id: { in: toDelete } },
    data: { deletedAt: now },
  })
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

export async function getMaxTransactionDate(userId: string): Promise<Date | null> {
  const row = await prisma.transaction.findFirst({
    where: { wallet: { userId }, deletedAt: null },
    orderBy: { date: 'desc' },
    select: { date: true },
  })
  return row?.date ?? null
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
