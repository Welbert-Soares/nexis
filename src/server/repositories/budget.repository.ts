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
              deletedAt: null,
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

export async function getExceededBudgets(userId: string) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const budgets = await getBudgetsWithSpending(userId, month, year)
  return budgets
    .map((b) => ({
      name: b.category.name,
      limit: b.amount.toNumber(),
      spent: b.category.transactions.reduce((acc, t) => acc + t.amount.toNumber(), 0),
    }))
    .map((b) => ({ ...b, pct: b.limit > 0 ? b.spent / b.limit : 0 }))
    .filter((b) => b.pct >= 0.8)
}
