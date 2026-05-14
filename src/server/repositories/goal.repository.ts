import { prisma } from '#/db'

export async function getGoalsByUser(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  return goals.map((g) => ({
    ...g,
    targetAmount: g.targetAmount.toNumber(),
    currentAmount: g.currentAmount.toNumber(),
  }))
}

export function createGoal(data: {
  userId: string
  name: string
  targetAmount: number
  currentAmount?: number
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
    currentAmount?: number
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
