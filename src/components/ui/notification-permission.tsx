import { Bell, BellOff, X } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePushNotifications } from '#/hooks/use-push-notifications'
import { useHaptic } from '#/hooks/use-haptic'

export function NotificationPermission() {
  const { supported, permission, subscribed, loading, subscribe } = usePushNotifications()
  const haptic = useHaptic()
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('notif-prompt-dismissed') === '1',
  )

  const showBanner =
    supported && permission === 'default' && !subscribed && !dismissed

  function handleDismiss() {
    haptic.tap()
    localStorage.setItem('notif-prompt-dismissed', '1')
    setDismissed(true)
  }

  async function handleEnable() {
    haptic.success()
    await subscribe()
    setDismissed(true)
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 2 }}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-40"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/98 p-4 shadow-2xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/15">
                <Bell className="h-5 w-5 text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Ativar notificações</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Alertas de orçamento e transações recorrentes em tempo real
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1 text-zinc-600 transition-colors active:text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 transition-colors active:bg-zinc-800"
              >
                Agora não
              </button>
              <button
                onClick={handleEnable}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-400 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-50"
              >
                {loading ? (
                  <BellOff className="h-4 w-4 animate-pulse" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Ativar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
