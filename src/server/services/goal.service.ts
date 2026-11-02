import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import {
  createGoal,
  deleteGoal,
  getGoalsByUser,
  updateGoal,
  depositToGoal,
  withdrawFromGoal as withdrawFromGoalRepo,
} from '#/server/repositories/goal.repository'
import { sendPushToUser } from '#/server/services/push-notify.server'
import { shouldSendNotification } from '#/server/repositories/push.repository'
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

export const checkGoalDeadlines = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getSessionOrThrow()
  const now = new Date()
  const in7days = new Date(now)
  in7days.setDate(in7days.getDate() + 7)

  const goals = await prisma.goal.findMany({
    where: {
      userId: session.user.id,
      deadline: { gte: now, lte: in7days },
    },
    select: { id: true, name: true, deadline: true, targetAmount: true, seedAmount: true },
  })
  if (!goals.length) return 0

  const goalIds = goals.map((g) => g.id)
  const txs = await prisma.transaction.findMany({
    where: { goalId: { in: goalIds }, deletedAt: null },
    select: { goalId: true, amount: true, type: true },
  })

  const netMap = new Map<string, number>()
  for (const t of txs) {
    if (!t.goalId) continue
    const delta = t.type === 'EXPENSE' ? t.amount.toNumber() : -t.amount.toNumber()
    netMap.set(t.goalId, (netMap.get(t.goalId) ?? 0) + delta)
  }

  let sent = 0
  for (const g of goals) {
    const current = g.seedAmount.toNumber() + (netMap.get(g.id) ?? 0)
    const target = g.targetAmount.toNumber()
    if (current >= target) continue  // meta já atingida, sem aviso

    const daysLeft = Math.ceil((new Date(g.deadline!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const pct = Math.round((current / target) * 100)
    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const canSend = await shouldSendNotification(session.user.id, 'goal-deadline', g.id)
    if (!canSend) continue

    sendPushToUser(session.user.id, {
      title: `Meta "${g.name}" vence em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}`,
      body: `${pct}% concluída · faltam ${fmtBRL(target - current)}`,
      url: '/goals',
    }).catch(() => {})
    sent++
  }
  return sent
})

export const withdrawFromGoal = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    goalId: z.string(),
    walletId: z.string(),
    amount: z.number().positive(),
  }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    return withdrawFromGoalRepo(session.user.id, data)
  })

export const depositGoalFromWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    goalId: z.string(),
    walletId: z.string(),
    amount: z.number().positive(),
  }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const res = await depositToGoal(session.user.id, data)

    // Aviso "meta atingida" fica no service (o mobile não dispara push).
    if (res.currentAmount >= res.targetAmount) {
      shouldSendNotification(session.user.id, 'goal-completed', data.goalId).then((canSend) => {
        if (canSend) {
          sendPushToUser(session.user.id, {
            title: 'Meta atingida! 🎉',
            body: `Você completou a meta "${res.name}"`,
            url: '/goals',
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    return res
  })
