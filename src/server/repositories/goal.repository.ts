import { prisma } from '#/db'

export async function getGoalsByUser(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })

  const goalIds = goals.map((g) => g.id)
  const deposits = goalIds.length
    ? await prisma.transaction.findMany({
        where: { goalId: { in: goalIds }, deletedAt: null },
        select: { goalId: true, amount: true },
      })
    : []

  const depositMap = new Map<string, number>()
  for (const d of deposits) {
    if (!d.goalId) continue
    depositMap.set(d.goalId, (depositMap.get(d.goalId) ?? 0) + d.amount.toNumber())
  }

  return goals.map((g) => ({
    ...g,
    targetAmount: g.targetAmount.toNumber(),
    seedAmount: g.seedAmount.toNumber(),
    currentAmount: g.seedAmount.toNumber() + (depositMap.get(g.id) ?? 0),
  }))
}

export function createGoal(data: {
  userId: string
  name: string
  targetAmount: number
  seedAmount?: number
  deadline?: Date | null
  color?: string
}) {
  return prisma.goal.create({ data })
}

export async function updateGoal(
  id: string,
  userId: string,
  data: {
    name?: string
    targetAmount?: number
    deadline?: Date | null
    color?: string
  },
) {
  const goal = await prisma.goal.findFirst({ where: { id, userId } })
  if (!goal) throw new Error('Goal not found')
  return prisma.goal.update({ where: { id }, data })
}

export async function deleteGoal(id: string, userId: string) {
  const goal = await prisma.goal.findFirst({ where: { id, userId } })
  if (!goal) throw new Error('Goal not found')
  return prisma.goal.delete({ where: { id } })
}
