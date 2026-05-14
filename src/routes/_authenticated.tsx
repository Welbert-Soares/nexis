import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
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
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="flex flex-col bg-zinc-950" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>
      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="absolute inset-0 overflow-hidden"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
