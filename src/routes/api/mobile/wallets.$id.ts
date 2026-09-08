import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { deleteWallet, updateWallet } from '#/server/repositories/wallet.repository'

const creditFields = {
  creditLimit: z.number().positive().optional().nullable(),
  closingDay: z.number().int().min(1).max(28).optional().nullable(),
  dueDay: z.number().int().min(1).max(28).optional().nullable(),
}

// editWalletSchema de wallet.service.ts, sem o `id` (vem do path).
const editWalletSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'CREDIT']).optional(),
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
  ...creditFields,
})

function walletId(request: Request, params?: { id?: string }): string {
  // TanStack Start passa `params`; se algum runtime não passar, cai pra URL.
  return params?.id ?? new URL(request.url).pathname.split('/').filter(Boolean).pop()!
}

export const Route = createFileRoute('/api/mobile/wallets/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = editWalletSchema.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        try {
          const w = await updateWallet(walletId(request, params), session.user.id, parsed.data)
          return Response.json({
            ...w,
            balance: w.initialBalance.toNumber(),
            initialBalance: w.initialBalance.toNumber(),
            creditLimit: w.creditLimit?.toNumber() ?? null,
          })
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao editar carteira' },
            { status: 404 },
          )
        }
      },
      DELETE: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        try {
          await deleteWallet(walletId(request, params), session.user.id)
          return Response.json(null)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao excluir carteira' },
            { status: 404 },
          )
        }
      },
    },
  },
})
