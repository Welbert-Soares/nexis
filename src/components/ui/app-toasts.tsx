import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Download, Share, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInstallPrompt } from '#/hooks/use-install-prompt'
import { usePushNotifications } from '#/hooks/use-push-notifications'
import { useHaptic } from '#/hooks/use-haptic'

type ToastId = 'install' | 'notif'

const TOAST_DURATION = 4000
const INITIAL_DELAY = 2500
const GAP_BETWEEN = 500

export function AppToasts() {
  const haptic = useHaptic()
  const { showAutoPrompt: showInstall, isIOS, install, dismiss: dismissInstall } = useInstallPrompt()
  const { supported, permission, subscribed, loading, subscribe } = usePushNotifications()
  const [notifDismissed, setNotifDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('notif-prompt-dismissed') === '1',
  )

  const showNotif = supported && permission === 'default' && !subscribed && !notifDismissed

  const [current, setCurrent] = useState<ToastId | null>(null)
  const [seen, setSeen] = useState<Set<ToastId>>(new Set())
  const [started, setStarted] = useState(false)

  // Build ordered queue from active toasts
  const queue: ToastId[] = []
  if (showInstall) queue.push('install')
  if (showNotif) queue.push('notif')

  const advance = useCallback((justSeen?: ToastId) => {
    setSeen((prev) => {
      const next = new Set(prev)
      if (justSeen) next.add(justSeen)
      return next
    })
    setCurrent(null)
  }, [])

  // Initial delay before first toast
  useEffect(() => {
    if (started || queue.length === 0) return
    const t = setTimeout(() => setStarted(true), INITIAL_DELAY)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, started])

  // Pick next toast from queue when current is empty
  useEffect(() => {
    if (!started || current) return
    const next = queue.find((id) => !seen.has(id))
    if (!next) return
    const t = setTimeout(() => setCurrent(next), GAP_BETWEEN)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, current, seen, queue.join(',')])

  // Auto-dismiss after TOAST_DURATION
  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => advance(current), TOAST_DURATION)
    return () => clearTimeout(t)
  }, [current, advance])

  function handleDismissInstall() {
    haptic.tap()
    dismissInstall()
    advance('install')
  }

  function handleInstall() {
    haptic.success()
    install()
    advance('install')
  }

  async function handleEnableNotif() {
    haptic.success()
    await subscribe()
    localStorage.setItem('notif-prompt-dismissed', '1')
    setNotifDismissed(true)
    advance('notif')
  }

  function handleDismissNotif() {
    haptic.tap()
    localStorage.setItem('notif-prompt-dismissed', '1')
    setNotifDismissed(true)
    advance('notif')
  }

  return (
    <AnimatePresence mode="wait">
      {current === 'install' && showInstall && (
        <motion.div
          key="install"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-50"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/98 p-4 shadow-2xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/15">
                {isIOS ? <Share className="h-5 w-5 text-blue-400" /> : <Download className="h-5 w-5 text-blue-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Instalar Nexis</p>
                {isIOS ? (
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Toque em <Share className="inline h-3 w-3" /> e depois{' '}
                    <span className="font-medium text-zinc-300">Adicionar à Tela de Início</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Adicione à tela inicial para acesso rápido e experiência nativa
                  </p>
                )}
              </div>
              <button
                onClick={handleDismissInstall}
                className="shrink-0 p-1 text-zinc-600 transition-colors active:text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="mt-3 w-full rounded-xl bg-blue-400 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80"
              >
                Instalar
              </button>
            )}
          </div>
        </motion.div>
      )}

      {current === 'notif' && showNotif && (
        <motion.div
          key="notif"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-50"
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
                onClick={handleDismissNotif}
                className="shrink-0 p-1 text-zinc-600 transition-colors active:text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleDismissNotif}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 transition-colors active:bg-zinc-800"
              >
                Agora não
              </button>
              <button
                onClick={handleEnableNotif}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-400 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-50"
              >
                {loading ? <BellOff className="h-4 w-4 animate-pulse" /> : <Bell className="h-4 w-4" />}
                Ativar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
