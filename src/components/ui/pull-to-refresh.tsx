import { useRef, useState, useCallback, type ReactNode } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

const THRESHOLD = 64
const MAX_PULL = 100

interface Props {
  onRefresh: () => Promise<void>
  children: ReactNode
  className?: string
}

export function PullToRefresh({ onRefresh, children, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const [refreshing, setRefreshing] = useState(false)

  const pullY = useSpring(0, { stiffness: 300, damping: 30 })
  const opacity = useTransform(pullY, [0, THRESHOLD], [0, 1])
  const rotate = useTransform(pullY, [0, MAX_PULL], [0, 180])
  const scale = useTransform(pullY, [0, THRESHOLD], [0.6, 1])

  const trigger = useCallback(async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      pullY.set(0)
    }
  }, [onRefresh, pullY])

  function onTouchStart(e: React.TouchEvent) {
    if (refreshing) return
    startYRef.current = e.touches[0].clientY
  }

  function onTouchMove(e: React.TouchEvent) {
    if (refreshing) return
    const el = scrollRef.current
    if (!el || el.scrollTop > 0) return

    const delta = e.touches[0].clientY - startYRef.current
    if (delta <= 0) return

    const clamped = Math.min(delta * 0.5, MAX_PULL)
    pullY.set(clamped)
  }

  async function onTouchEnd() {
    if (refreshing) return
    const current = pullY.get()
    if (current >= THRESHOLD) {
      await trigger()
    } else {
      pullY.set(0)
    }
  }

  return (
    <div className="relative flex flex-col overflow-hidden" style={{ height: '100%' }}>
      {/* Indicador */}
      <motion.div
        className="absolute left-0 right-0 top-0 z-10 flex justify-center pointer-events-none"
        style={{ y: useTransform(pullY, (v) => v - 36), opacity }}
      >
        <motion.div style={{ scale }} className="flex h-8 w-8 items-center justify-center">
          <motion.div style={{ rotate }}>
            <RefreshCw
              className={refreshing ? 'h-5 w-5 text-blue-400 animate-spin' : 'h-5 w-5 text-zinc-400'}
              strokeWidth={2}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Conteúdo deslocado pelo pull */}
      <motion.div
        ref={scrollRef}
        className={className}
        style={{ y: pullY, flex: 1, overflowY: 'auto' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </motion.div>
    </div>
  )
}
