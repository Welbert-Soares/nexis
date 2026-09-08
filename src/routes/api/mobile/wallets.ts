import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { createWallet, getWalletsByUser } from '#/server/repositories/wallet.repository'

const creditFields = {
  creditLimit: z.number().positive().optional().nullable(),
  closingDay: z.number().int().min(1).max(28).optional().nullable(),
  dueDay: z.number().int().min(1).max(28).optional().nullable(),
}

// Cópia do createWalletSchema de src/server/services/wallet.service.ts.
const createWalletSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'CREDIT']),
  color: z.string().optional(),
  icon: z.string().optional(),
  balance: z.number().min(0).optional(),
  ...creditFields,
})

export const Route = createFileRoute('/api/mobile/wallets')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        return Response.json(await getWalletsByUser(session.user.id))
      },
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = createWalletSchema.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        const w = await createWallet({ userId: session.user.id, ...parsed.data })
        return Response.json({
          ...w,
          balance: w.initialBalance.toNumber(),
          initialBalance: w.initialBalance.toNumber(),
          creditLimit: w.creditLimit?.toNumber() ?? null,
        })
      },
    },
  },
})
