import { prisma } from '#/db'

export async function getDashboardData(userId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [wallets, monthlyAgg, recent, categoryAgg] = await Promise.all([
    prisma.wallet.findMany({ where: { userId }, select: { balance: true } }),

    prisma.transaction.groupBy({
      by: ['type'],
      where: { wallet: { userId }, date: { gte: startOfMonth }, deletedAt: null },
      _sum: { amount: true },
    }),

    prisma.transaction.findMany({
      where: { wallet: { userId }, deletedAt: null },
      include: { category: true, wallet: { select: { id: true, name: true, color: true } } },
      orderBy: { date: 'desc' },
      take: 5,
    }),

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
      take: 5,
    }),
  ])

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance.toNumber(), 0)
  const income = monthlyAgg.find((r) => r.type === 'INCOME')?._sum.amount?.toNumber() ?? 0
  const expenses = monthlyAgg.find((r) => r.type === 'EXPENSE')?._sum.amount?.toNumber() ?? 0

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

  return {
    totalBalance,
    hasWallets: wallets.length > 0,
    monthly: { income, expenses },
    recent: recent.map((t) => ({ ...t, amount: t.amount.toNumber() })),
    categoryBreakdown,
  }
}
