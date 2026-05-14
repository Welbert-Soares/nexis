import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '#/server/services/auth.service'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSession()
    throw redirect({ to: session ? '/dashboard' : '/login' })
  },
})
