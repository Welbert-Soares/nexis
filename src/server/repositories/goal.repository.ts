import { prisma } from '#/db'
import { getWalletBalance } from '#/server/repositories/wallet.repository'

export async function getGoalsByUser(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })

  const goalIds = goals.map((g) => g.id)
  const deposits = goalIds.length
    ? await prisma.transaction.findMany({
        where: { goalId: { in: goalIds }, deletedAt: null },
        select: { goalId: true, amount: true, type: true },
      })
    : []

  const depositMap = new Map<string, number>()
  for (const d of deposits) {
    if (!d.goalId) continue
    // EXPENSE = aporte (+), INCOME = resgate (-)
    const delta = d.type === 'EXPENSE' ? d.amount.toNumber() : -d.amount.toNumber()
    depositMap.set(d.goalId, (depositMap.get(d.goalId) ?? 0) + delta)
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

type GoalMove = { goalId: string; walletId: string; amount: number }

/**
 * Aporte: cria uma transação EXPENSE na carteira, tagueada com a meta. Sem
 * efeito colateral de push — quem quiser o aviso "meta atingida" trata no
 * caller (goal.service). Extraída do handler de depositGoalFromWallet.
 */
export async function depositToGoal(userId: string, { goalId, walletId, amount }: GoalMove) {
  const [goal, wallet] = await Promise.all([
    prisma.goal.findFirst({ where: { id: goalId, userId } }),
    prisma.wallet.findFirst({ where: { id: walletId, userId } }),
  ])
  if (!goal) throw new Error('Meta não encontrada')
  if (!wallet) throw new Error('Carteira não encontrada')

  const balance = await getWalletBalance(walletId)
  if (amount > balance) throw new Error('Saldo insuficiente na carteira selecionada')

  await prisma.transaction.create({
    data: { amount, type: 'EXPENSE', walletId, goalId, description: `Aporte → ${goal.name}`, date: new Date() },
  })

  const depositsAgg = await prisma.transaction.aggregate({
    where: { goalId, deletedAt: null },
    _sum: { amount: true },
  })
  const currentAmount = goal.seedAmount.toNumber() + (depositsAgg._sum.amount?.toNumber() ?? 0)
  const targetAmount = goal.targetAmount.toNumber()

  return { goalId, name: goal.name, currentAmount, targetAmount }
}

/**
 * Resgate: cria uma transação INCOME na carteira, tagueada com a meta.
 * Extraída do handler de withdrawFromGoal (service).
 */
export async function withdrawFromGoal(userId: string, { goalId, walletId, amount }: GoalMove) {
  const [goal, wallet] = await Promise.all([
    prisma.goal.findFirst({ where: { id: goalId, userId } }),
    prisma.wallet.findFirst({ where: { id: walletId, userId } }),
  ])
  if (!goal) throw new Error('Meta não encontrada')
  if (!wallet) throw new Error('Carteira não encontrada')

  const txs = await prisma.transaction.findMany({
    where: { goalId, deletedAt: null },
    select: { amount: true, type: true },
  })
  const net = txs.reduce(
    (acc, t) => acc + (t.type === 'EXPENSE' ? t.amount.toNumber() : -t.amount.toNumber()),
    0,
  )
  const currentAmount = goal.seedAmount.toNumber() + net

  if (amount > currentAmount) throw new Error('Valor excede o saldo guardado na meta')

  await prisma.transaction.create({
    data: { amount, type: 'INCOME', walletId, goalId, description: `Resgate ← ${goal.name}`, date: new Date() },
  })

  return { goalId, currentAmount: currentAmount - amount }
}
