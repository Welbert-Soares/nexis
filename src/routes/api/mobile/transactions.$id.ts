import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { deleteTransaction, updateTransaction } from '#/server/repositories/transaction.repository'

// editTransactionSchema de transaction.service.ts, sem o `id` (vem do path) e sem
// os campos de recorrência (fora do escopo da Fatia 3 do app mobile).
const editBody = z.object({
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  walletId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.string().optional(), // 'YYYY-MM-DD'
})

function txId(request: Request, params?: { id?: string }): string {
  return params?.id ?? new URL(request.url).pathname.split('/').filter(Boolean).pop()!
}

// Mesma normalização do POST de criação: meio-dia local pra não pular de dia.
function toDate(ymd?: string): Date | undefined {
  return ymd ? new Date(`${ymd}T12:00:00`) : undefined
}

export const Route = createFileRoute('/api/mobile/transactions/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = editBody.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        const { date, ...rest } = parsed.data
        try {
          const t = await updateTransaction(txId(request, params), session.user.id, {
            ...rest,
            ...(date ? { date: toDate(date) } : {}),
          })
          return Response.json({ ...t, amount: t.amount.toNumber() })
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao editar transação' },
            { status: 404 },
          )
        }
      },
      DELETE: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        try {
          await deleteTransaction(txId(request, params), session.user.id)
          return Response.json(null)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao excluir transação' },
            { status: 404 },
          )
        }
      },
    },
  },
})
