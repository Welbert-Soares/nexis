import { Share, Download, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInstallPrompt } from '#/hooks/use-install-prompt'
import { useHaptic } from '#/hooks/use-haptic'

export function InstallPrompt() {
  const { showPrompt, isIOS, install, dismiss } = useInstallPrompt()
  const haptic = useHaptic()

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-50"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/98 p-4 shadow-2xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/15">
                {isIOS ? (
                  <Share className="h-5 w-5 text-blue-400" />
                ) : (
                  <Download className="h-5 w-5 text-blue-400" />
                )}
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
                onClick={() => { haptic.tap(); dismiss() }}
                className="shrink-0 p-1 text-zinc-600 transition-colors active:text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {!isIOS && (
              <button
                onClick={() => { haptic.success(); install() }}
                className="mt-3 w-full rounded-xl bg-blue-400 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80"
              >
                Instalar
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
