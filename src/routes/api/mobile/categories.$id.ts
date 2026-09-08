import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { updateCategory, deleteCategory } from '#/server/repositories/category.repository'

// Cópia do editCategory schema de category.service.ts (sem o id, vem do path).
const editBody = z.object({
  name: z.string().min(1),
  color: z.string(),
  icon: z.string().nullable().optional(),
})

function categoryId(request: Request, params?: { id?: string }): string {
  return params?.id ?? new URL(request.url).pathname.split('/').filter(Boolean).pop()!
}

export const Route = createFileRoute('/api/mobile/categories/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = editBody.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 })
        }

        try {
          const c = await updateCategory(categoryId(request, params), session.user.id, {
            name: parsed.data.name,
            color: parsed.data.color,
            icon: parsed.data.icon ?? undefined,
          })
          return Response.json(c)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao editar categoria' },
            { status: 404 },
          )
        }
      },
      DELETE: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        try {
          await deleteCategory(categoryId(request, params), session.user.id)
          return Response.json(null)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erro ao excluir categoria'
          // "Categoria em uso por transações" → 409; alheia/global → 404.
          return Response.json({ error: msg }, { status: /em uso/i.test(msg) ? 409 : 404 })
        }
      },
    },
  },
})
