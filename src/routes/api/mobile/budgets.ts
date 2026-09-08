import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { getBudgetsWithSpending, upsertBudget } from '#/server/repositories/budget.repository'

const listQuery = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
})

// Cópia do saveBudget schema de budget.service.ts.
const createBody = z.object({
  categoryId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  amount: z.number().positive(),
})

export const Route = createFileRoute('/api/mobile/budgets')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const params = new URL(request.url).searchParams
        const parsed = listQuery.safeParse({
          year: params.get('year'),
          month: params.get('month'),
        })
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        const rows = await getBudgetsWithSpending(
          session.user.id,
          parsed.data.month,
          parsed.data.year,
        )
        // map idêntico ao getBudgets de budget.service.ts — mantém web e mobile em paridade.
        return Response.json(
          rows.map((b) => ({
            id: b.id,
            categoryId: b.categoryId,
            categoryName: b.category.name,
            categoryColor: b.category.color ?? '#71717a',
            categoryIcon: b.category.icon,
            limit: b.amount.toNumber(),
            spent: b.category.transactions.reduce((acc, t) => acc + t.amount.toNumber(), 0),
          })),
        )
      },
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = createBody.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        const { categoryId, month, year, amount } = parsed.data
        const b = await upsertBudget(session.user.id, categoryId, month, year, amount)
        return Response.json({ ...b, amount: b.amount.toNumber() })
      },
    },
  },
})
