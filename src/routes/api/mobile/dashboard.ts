import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getDashboardData } from '#/server/repositories/dashboard.repository'

export const Route = createFileRoute('/api/mobile/dashboard')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return Response.json(await getDashboardData(session.user.id))
      },
    },
  },
})
