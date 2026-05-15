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
  currentAmount: z.number().min(0).optional(),
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
      currentAmount: goal.currentAmount.toNumber(),
    }
  })

const updateGoalSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  targetAmount: z.number().positive().optional(),
  currentAmount: z.number().min(0).optional(),
  deadline: z.coerce.date().optional().nullable(),
  color: z.string().optional(),
})

export const updateUserGoal = createServerFn({ method: 'POST' })
  .inputValidator(updateGoalSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const { id, ...rest } = data
    const goal = await updateGoal(id, session.user.id, rest)
    const current = goal.currentAmount.toNumber()
    const target = goal.targetAmount.toNumber()
    if (current >= target) {
      sendPushToUser(session.user.id, {
        title: 'Meta atingida! 🎉',
        body: `Você completou a meta "${goal.name}"`,
        url: '/analytics',
      }).catch(() => {})
    }
    return {
      ...goal,
      targetAmount: target,
      currentAmount: current,
    }
  })

export const deleteUserGoal = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    await deleteGoal(data.id, session.user.id)
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

    const updated = await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          amount,
          type: 'EXPENSE',
          walletId,
          description: `Aporte → ${goal.name}`,
          date: new Date(),
        },
      })
      return tx.goal.update({
        where: { id: goalId },
        data: { currentAmount: { increment: amount } },
      })
    })

    const current = updated.currentAmount.toNumber()
    const target = updated.targetAmount.toNumber()
    if (current >= target) {
      sendPushToUser(session.user.id, {
        title: 'Meta atingida! 🎉',
        body: `Você completou a meta "${goal.name}"`,
        url: '/goals',
      }).catch(() => {})
    }

    return { ...updated, targetAmount: target, currentAmount: current }
  })
