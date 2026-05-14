import { createMiddleware } from '@tanstack/react-start'
import { auth } from '#/lib/auth'

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next, context }) => {
    const session = await auth.api.getSession({
      headers: (context as unknown as { request?: Request }).request?.headers ?? new Headers(),
    })

    if (!session) {
      throw new Error('Unauthorized')
    }

    return next({ context: { session } })
  },
)
