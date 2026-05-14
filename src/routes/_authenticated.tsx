import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { BottomNav } from '#/components/layout/bottom-nav'
import { NavigationProgress } from '#/components/ui/navigation-progress'
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
    <div className="flex flex-col bg-zinc-950" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>
      <NavigationProgress />
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
