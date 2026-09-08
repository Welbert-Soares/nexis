import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { depositToGoal } from '#/server/repositories/goal.repository'

const body = z.object({ walletId: z.string(), amount: z.number().positive() })

function goalId(request: Request, params?: { id?: string }): string {
  if (params?.id) return params.id
  const parts = new URL(request.url).pathname.split('/').filter(Boolean)
  return parts[parts.length - 2]! // .../goals/<id>/deposit
}

export const Route = createFileRoute('/api/mobile/goals/$id/deposit')({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = body.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        try {
          const res = await depositToGoal(session.user.id, {
            goalId: goalId(request, params),
            walletId: parsed.data.walletId,
            amount: parsed.data.amount,
          })
          return Response.json(res)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erro no aporte'
          return Response.json({ error: msg }, { status: /não encontrad/i.test(msg) ? 404 : 400 })
        }
      },
    },
  },
})
