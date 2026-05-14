import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { BottomNav } from '#/components/layout/bottom-nav'
import { getSession } from '#/server/services/auth.service'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
