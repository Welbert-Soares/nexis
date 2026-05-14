import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { motion } from 'framer-motion'
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
      <main className="min-h-0 flex-1">
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </main>
      <BottomNav />
    </div>
  )
}
