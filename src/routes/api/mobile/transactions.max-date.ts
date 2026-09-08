import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getMaxTransactionDate } from '#/server/repositories/transaction.repository'

// Data da transação mais futura do usuário (inclui parcelas e ocorrências
// recorrentes já lançadas). O app usa isso pra liberar a navegação de mês
// além do mês atual — senão parcelas/recorrências futuras ficam inacessíveis.
export const Route = createFileRoute('/api/mobile/transactions/max-date')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const date = await getMaxTransactionDate(session.user.id)
        return Response.json({ date: date ? date.toISOString() : null })
      },
    },
  },
})
