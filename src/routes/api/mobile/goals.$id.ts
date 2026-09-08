import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { updateGoal, deleteGoal } from '#/server/repositories/goal.repository'

const editBody = z.object({
  name: z.string().min(1).optional(),
  targetAmount: z.number().positive().optional(),
  deadline: z.string().nullable().optional(),
  color: z.string().optional(),
})

function goalId(request: Request, params?: { id?: string }): string {
  return params?.id ?? new URL(request.url).pathname.split('/').filter(Boolean).pop()!
}

export const Route = createFileRoute('/api/mobile/goals/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = editBody.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        // `deadline` ausente = não mexe; `null` = limpa; string = data ao meio-dia.
        const { deadline, ...rest } = parsed.data
        const data: {
          name?: string
          targetAmount?: number
          color?: string
          deadline?: Date | null
        } = { ...rest }
        if (deadline !== undefined) {
          data.deadline = deadline ? new Date(`${deadline}T12:00:00`) : null
        }

        try {
          const g = await updateGoal(goalId(request, params), session.user.id, data)
          return Response.json({
            ...g,
            targetAmount: g.targetAmount.toNumber(),
            seedAmount: g.seedAmount.toNumber(),
          })
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao editar meta' },
            { status: 404 },
          )
        }
      },
      DELETE: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        try {
          await deleteGoal(goalId(request, params), session.user.id)
          return Response.json(null)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao excluir meta' },
            { status: 404 },
          )
        }
      },
    },
  },
})
