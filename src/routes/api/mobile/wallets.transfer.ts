import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { transferBetweenWallets } from '#/server/repositories/wallet.repository'

const transferSchema = z.object({
  fromWalletId: z.string(),
  toWalletId: z.string(),
  amount: z.number().positive(),
})

export const Route = createFileRoute('/api/mobile/wallets/transfer')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = transferSchema.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        try {
          await transferBetweenWallets(
            session.user.id,
            parsed.data.fromWalletId,
            parsed.data.toWalletId,
            parsed.data.amount,
          )
          return Response.json(null)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro na transferência' },
            { status: 400 },
          )
        }
      },
    },
  },
})
