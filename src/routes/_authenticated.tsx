import { useEffect } from 'react'
import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { BottomNav } from '#/components/layout/bottom-nav'
import { ErrorBoundary } from '#/components/ui/error-boundary'
import { OfflineBanner } from '#/components/ui/offline-banner'
import { BudgetAlertsBanner } from '#/components/ui/budget-alerts-banner'
import { AppToasts } from '#/components/ui/app-toasts'
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
  const location = useLocation()

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
      <main className="min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </main>
      <BottomNav />
      <BudgetAlertsBanner />
      <AppToasts />
    </div>
  )
}
