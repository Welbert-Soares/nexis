import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { getBudgetsWithSpending, upsertBudget, deleteBudget } from '#/server/repositories/budget.repository'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

export const getBudgets = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ month: z.number().int(), year: z.number().int() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const rows = await getBudgetsWithSpending(session.user.id, data.month, data.year)
    return rows.map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category.name,
      categoryColor: b.category.color ?? '#71717a',
      categoryIcon: b.category.icon,
      limit: b.amount.toNumber(),
      spent: b.category.transactions.reduce((acc, t) => acc + t.amount.toNumber(), 0),
    }))
  })

export const saveBudget = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    categoryId: z.string(),
    month: z.number().int(),
    year: z.number().int(),
    amount: z.number().positive(),
  }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const b = await upsertBudget(session.user.id, data.categoryId, data.month, data.year, data.amount)
    return { ...b, amount: b.amount.toNumber() }
  })

export const removeBudget = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const b = await deleteBudget(data.id, session.user.id)
    return { ...b, amount: b.amount.toNumber() }
  })
