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
    return {
      ...goal,
      targetAmount: goal.targetAmount.toNumber(),
      currentAmount: goal.currentAmount.toNumber(),
    }
  })

export const deleteUserGoal = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    await deleteGoal(data.id, session.user.id)
  })
