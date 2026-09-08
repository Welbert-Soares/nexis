import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getCategoriesWithUsage } from '#/server/repositories/category.repository'

// Todas as categorias (globais + do usuário) com _count.transactions — pra o
// gerenciador de categorias no Perfil.
export const Route = createFileRoute('/api/mobile/categories/manage')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        return Response.json(await getCategoriesWithUsage(session.user.id))
      },
    },
  },
})
