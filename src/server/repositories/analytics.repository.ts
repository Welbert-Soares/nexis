import { prisma } from '#/db'

export async function getAnalyticsData(userId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // Últimos 6 meses
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [monthlyAgg, categoryAgg] = await Promise.all([
    // Resumo do mês atual
    prisma.transaction.groupBy({
      by: ['type'],
      where: { wallet: { userId }, date: { gte: startOfMonth, lt: endOfMonth }, deletedAt: null },
      _sum: { amount: true },
    }),

    // Gastos por categoria no mês atual (top 8)
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        wallet: { userId },
        type: 'EXPENSE',
        date: { gte: startOfMonth, lt: endOfMonth },
        categoryId: { not: null },
        deletedAt: null,
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 8,
    }),

  ])

  // Tendência mensal: busca todas as transações dos últimos 6 meses e agrupa por mês no app
  const trendRows = await prisma.transaction.findMany({
    where: { wallet: { userId }, date: { gte: sixMonthsAgo }, deletedAt: null },
    select: { type: true, amount: true, date: true },
  })

  const trendMap = new Map<string, { income: number; expenses: number }>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    trendMap.set(key, { income: 0, expenses: 0 })
  }
  for (const row of trendRows) {
    const d = new Date(row.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!trendMap.has(key)) continue
    const entry = trendMap.get(key)!
    const val = row.amount.toNumber()
    if (row.type === 'INCOME') entry.income += val
    else entry.expenses += val
  }

  const trend = Array.from(trendMap.entries()).map(([month, data]) => ({
    month,
    ...data,
  }))

  // Categorias
  const categoryIds = categoryAgg.map((c) => c.categoryId!)
  const categories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
    : []

  const categoryBreakdown = categoryAgg.map((c) => {
    const cat = categories.find((x) => x.id === c.categoryId)
    return {
      id: c.categoryId!,
      name: cat?.name ?? 'Outros',
      color: cat?.color ?? '#71717a',
      amount: c._sum.amount?.toNumber() ?? 0,
    }
  })

  const income = monthlyAgg.find((r) => r.type === 'INCOME')?._sum.amount?.toNumber() ?? 0
  const expenses = monthlyAgg.find((r) => r.type === 'EXPENSE')?._sum.amount?.toNumber() ?? 0

  return { monthly: { income, expenses }, categoryBreakdown, trend }
}
