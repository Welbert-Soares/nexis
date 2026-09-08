import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { deleteBudget } from '#/server/repositories/budget.repository'

function budgetId(request: Request, params?: { id?: string }): string {
  // TanStack Start passa `params`; se algum runtime não passar, cai pra URL.
  return params?.id ?? new URL(request.url).pathname.split('/').filter(Boolean).pop()!
}

export const Route = createFileRoute('/api/mobile/budgets/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        try {
          await deleteBudget(budgetId(request, params), session.user.id)
          return Response.json(null)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao excluir orçamento' },
            { status: 404 },
          )
        }
      },
    },
  },
})
