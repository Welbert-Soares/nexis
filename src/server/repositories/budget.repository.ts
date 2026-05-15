import { prisma } from '#/db'

export function getBudgetsWithSpending(userId: string, month: number, year: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  return prisma.budget.findMany({
    where: { userId, month, year },
    include: {
      category: {
        include: {
          transactions: {
            where: {
              wallet: { userId },
              type: 'EXPENSE',
              date: { gte: start, lt: end },
            },
            select: { amount: true },
          },
        },
      },
    },
    orderBy: { category: { name: 'asc' } },
  })
}

export function upsertBudget(userId: string, categoryId: string, month: number, year: number, amount: number) {
  return prisma.budget.upsert({
    where: { userId_categoryId_month_year: { userId, categoryId, month, year } },
    create: { userId, categoryId, month, year, amount },
    update: { amount },
  })
}

export function deleteBudget(id: string, userId: string) {
  return prisma.budget.delete({ where: { id, userId } })
}
