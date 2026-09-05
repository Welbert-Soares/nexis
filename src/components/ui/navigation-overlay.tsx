import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'

export function NavigationOverlay() {
  const isLoading = useRouterState({ select: (s) => s.status === 'pending' })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout>
    let hideTimer: ReturnType<typeof setTimeout>

    if (isLoading) {
      // só mostra se demorar mais de 80ms — navegações rápidas não piscam
      showTimer = setTimeout(() => setVisible(true), 80)
    } else {
      clearTimeout(showTimer!)
      // mantém visível por um instante para o conteúdo ter tempo de renderizar
      hideTimer = setTimeout(() => setVisible(false), 50)
    }

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [isLoading])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950"
        >
          <motion.img
            src="/logo-nexis.webp"
            alt="Nexis"
            className="h-12 w-12"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
