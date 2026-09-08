import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { getGoalsByUser, createGoal } from '#/server/repositories/goal.repository'

// Cópia do goalSchema de goal.service.ts, mas deadline como string 'YYYY-MM-DD'
// (o app não manda Date).
const createBody = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  seedAmount: z.number().min(0).optional(),
  deadline: z.string().nullable().optional(),
  color: z.string().optional(),
})

function toDate(ymd?: string | null): Date | null {
  return ymd ? new Date(`${ymd}T12:00:00`) : null
}

export const Route = createFileRoute('/api/mobile/goals')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        return Response.json(await getGoalsByUser(session.user.id))
      },
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = createBody.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        const { name, targetAmount, seedAmount, deadline, color } = parsed.data
        const g = await createGoal({
          userId: session.user.id,
          name,
          targetAmount,
          seedAmount,
          deadline: toDate(deadline),
          color,
        })
        return Response.json({
          ...g,
          targetAmount: g.targetAmount.toNumber(),
          seedAmount: g.seedAmount.toNumber(),
        })
      },
    },
  },
})
