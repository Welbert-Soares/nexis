import { useEffect, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'

export function NavigationProgress() {
  const isLoading = useRouterState({ select: (s) => s.status === 'pending' })
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      setVisible(true)
      timerRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 85) { clearInterval(timerRef.current!); return 85 }
          return p + (85 - p) * 0.12
        })
      }, 80)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setProgress(100)
      const t = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(t)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isLoading])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-50 h-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full bg-blue-400"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.08, ease: 'linear' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
