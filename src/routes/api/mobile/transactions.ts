import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { createTransaction, getTransactionsByMonth } from '#/server/repositories/transaction.repository'

const listQuery = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
})

// Cópia do createTransactionSchema de transaction.service.ts, sem os campos de
// recorrência/parcelamento (fora do escopo da Fatia 3 do app mobile).
const createBody = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(), // 'YYYY-MM-DD'
})

// O app manda 'YYYY-MM-DD'; persistir como meio-dia local do servidor evita o
// valor virar o dia anterior quando o cliente está em BRT (mesmo truque do
// transaction-sheet.tsx web).
function toDate(ymd?: string): Date | undefined {
  return ymd ? new Date(`${ymd}T12:00:00`) : undefined
}

export const Route = createFileRoute('/api/mobile/transactions')({
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

        return Response.json(
          await getTransactionsByMonth(session.user.id, parsed.data.year, parsed.data.month),
        )
      },
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = createBody.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        const { date, ...rest } = parsed.data
        const t = await createTransaction({ ...rest, date: toDate(date) })
        return Response.json({ ...t, amount: t.amount.toNumber() })
      },
    },
  },
})
