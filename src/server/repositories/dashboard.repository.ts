import { prisma } from '#/db'

export async function getDashboardData(userId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [wallets, monthlyAgg, recent] = await Promise.all([
    prisma.wallet.findMany({ where: { userId }, select: { balance: true } }),

    prisma.transaction.groupBy({
      by: ['type'],
      where: { wallet: { userId }, date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),

    prisma.transaction.findMany({
      where: { wallet: { userId } },
      include: { category: true, wallet: { select: { id: true, name: true, color: true } } },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ])

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance.toNumber(), 0)

  const income = monthlyAgg.find((r) => r.type === 'INCOME')?._sum.amount?.toNumber() ?? 0
  const expenses = monthlyAgg.find((r) => r.type === 'EXPENSE')?._sum.amount?.toNumber() ?? 0

  return {
    totalBalance,
    monthly: { income, expenses },
    recent: recent.map((t) => ({
      ...t,
      amount: t.amount.toNumber(),
    })),
  }
}
