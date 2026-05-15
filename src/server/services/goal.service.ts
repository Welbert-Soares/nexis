import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import {
  createGoal,
  deleteGoal,
  getGoalsByUser,
  updateGoal,
} from '#/server/repositories/goal.repository'
import { sendPushToUser } from '#/server/services/push-notify.server'
import { prisma } from '#/db'
import { getWalletBalance } from '#/server/repositories/wallet.repository'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

export const getUserGoals = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionOrThrow()
  return getGoalsByUser(session.user.id)
})

const goalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  seedAmount: z.number().min(0).optional(),
  deadline: z.coerce.date().optional().nullable(),
  color: z.string().optional(),
})

export const createUserGoal = createServerFn({ method: 'POST' })
  .inputValidator(goalSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const goal = await createGoal({ userId: session.user.id, ...data })
    return {
      ...goal,
      targetAmount: goal.targetAmount.toNumber(),
      seedAmount: goal.seedAmount.toNumber(),
      currentAmount: goal.seedAmount.toNumber(),
    }
  })

const updateGoalSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  targetAmount: z.number().positive().optional(),
  deadline: z.coerce.date().optional().nullable(),
  color: z.string().optional(),
})

export const updateUserGoal = createServerFn({ method: 'POST' })
  .inputValidator(updateGoalSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const { id, ...rest } = data
    const goal = await updateGoal(id, session.user.id, rest)
    return {
      ...goal,
      targetAmount: goal.targetAmount.toNumber(),
      seedAmount: goal.seedAmount.toNumber(),
      currentAmount: goal.seedAmount.toNumber(),
    }
  })

export const deleteUserGoal = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    await deleteGoal(data.id, session.user.id)
  })

export const withdrawFromGoal = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    goalId: z.string(),
    walletId: z.string(),
    amount: z.number().positive(),
  }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const { goalId, walletId, amount } = data

    const [goal, wallet] = await Promise.all([
      prisma.goal.findFirst({ where: { id: goalId, userId: session.user.id } }),
      prisma.wallet.findFirst({ where: { id: walletId, userId: session.user.id } }),
    ])
    if (!goal) throw new Error('Meta não encontrada')
    if (!wallet) throw new Error('Carteira não encontrada')

    // calcula currentAmount atual
    const txs = await prisma.transaction.findMany({
      where: { goalId, deletedAt: null },
      select: { amount: true, type: true },
    })
    const net = txs.reduce((acc, t) =>
      acc + (t.type === 'EXPENSE' ? t.amount.toNumber() : -t.amount.toNumber()), 0)
    const currentAmount = goal.seedAmount.toNumber() + net

    if (amount > currentAmount) throw new Error('Valor excede o saldo guardado na meta')

    await prisma.transaction.create({
      data: { amount, type: 'INCOME', walletId, goalId, description: `Resgate ← ${goal.name}`, date: new Date() },
    })

    return { goalId, currentAmount: currentAmount - amount }
  })

export const depositGoalFromWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    goalId: z.string(),
    walletId: z.string(),
    amount: z.number().positive(),
  }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const { goalId, walletId, amount } = data

    const [goal, wallet] = await Promise.all([
      prisma.goal.findFirst({ where: { id: goalId, userId: session.user.id } }),
      prisma.wallet.findFirst({ where: { id: walletId, userId: session.user.id } }),
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
    const current = goal.seedAmount.toNumber() + (depositsAgg._sum.amount?.toNumber() ?? 0)
    const target = goal.targetAmount.toNumber()

    if (current >= target) {
      sendPushToUser(session.user.id, {
        title: 'Meta atingida! 🎉',
        body: `Você completou a meta "${goal.name}"`,
        url: '/goals',
      }).catch(() => {})
    }

    return { goalId, currentAmount: current, targetAmount: target }
  })
