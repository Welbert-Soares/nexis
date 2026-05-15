import { useEffect } from 'react'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BottomNav } from '#/components/layout/bottom-nav'
import { ErrorBoundary } from '#/components/ui/error-boundary'
import { OfflineBanner } from '#/components/ui/offline-banner'
import { BudgetAlertsBanner } from '#/components/ui/budget-alerts-banner'
import { getSession } from '#/server/services/auth.service'
import { triggerRecurring } from '#/server/services/transaction.service'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const queryClient = useQueryClient()

  useEffect(() => {
    triggerRecurring().then((count) => {
      if (count > 0) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['wallets'] })
      }
    }).catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950">
      <OfflineBanner />
      <BudgetAlertsBanner />
      <main className="min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  )
}
