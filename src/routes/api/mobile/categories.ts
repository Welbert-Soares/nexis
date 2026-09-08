import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { getCategoriesByType } from '#/server/repositories/category.repository'

const query = z.object({ type: z.enum(['INCOME', 'EXPENSE']) })

export const Route = createFileRoute('/api/mobile/categories')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = query.safeParse({
          type: new URL(request.url).searchParams.get('type'),
        })
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        return Response.json(await getCategoriesByType(parsed.data.type, session.user.id))
      },
    },
  },
})
