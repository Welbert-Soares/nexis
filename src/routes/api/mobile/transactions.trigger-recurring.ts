import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { processDueRecurring } from '#/server/repositories/transaction.repository'

// Espelha o `triggerRecurring` do PWA (transaction.service.ts) sem a parte de
// push (web-only). O app chama isso ao abrir; `count > 0` → invalida as queries.
export const Route = createFileRoute('/api/mobile/transactions/trigger-recurring')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const count = await processDueRecurring(session.user.id)
        return Response.json({ count })
      },
    },
  },
})
