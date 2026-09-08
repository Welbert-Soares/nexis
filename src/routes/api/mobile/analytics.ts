import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getAnalyticsData } from '#/server/repositories/analytics.repository'

// Snapshot da Análise do mês corrente (getAnalyticsData não recebe parâmetro de
// mês — só a rota de orçamentos aceita ?year=&month=).
export const Route = createFileRoute('/api/mobile/analytics')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return Response.json(await getAnalyticsData(session.user.id))
      },
    },
  },
})
