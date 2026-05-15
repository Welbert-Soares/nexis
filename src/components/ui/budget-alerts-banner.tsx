import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X, AlertTriangle, TrendingDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getBudgets } from '#/server/services/budget.service'


export function BudgetAlertsBanner() {
  const [dismissed, setDismissed] = useState(false)
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', month, year],
    queryFn: () => getBudgets({ data: { month, year } }),
    staleTime: 5 * 60 * 1000,
  })

  const alerts = budgets
    .map((b) => ({ ...b, pct: b.limit > 0 ? b.spent / b.limit : 0 }))
    .filter((b) => b.pct >= 0.8)

  useEffect(() => {
    if (alerts.length === 0 || dismissed) return
    const timer = setTimeout(() => setDismissed(true), 4000)
    return () => clearTimeout(timer)
  }, [alerts.length, dismissed])

  const sortedAlerts = alerts.sort((a, b) => b.pct - a.pct)

  const exceeded = sortedAlerts.filter((b) => b.pct >= 1)
  const approaching = sortedAlerts.filter((b) => b.pct < 1)
  const isOver = exceeded.length > 0
  const top = sortedAlerts[0]

  const message = isOver && exceeded.length === 1
    ? `Limite de ${top.categoryName} excedido`
    : isOver
    ? `${exceeded.length} orçamentos excedidos`
    : approaching.length === 1
    ? `${top.categoryName} com ${Math.round(top.pct * 100)}% do limite`
    : `${approaching.length} orçamentos próximos do limite`

  return (
    <AnimatePresence>
      {!dismissed && sortedAlerts.length > 0 && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed left-4 right-4 z-50 overflow-hidden rounded-2xl shadow-xl"
          style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <Link
            to="/analytics"
            className="flex items-center gap-3 bg-zinc-800/95 px-4 py-3 backdrop-blur-sm"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isOver ? 'bg-red-500/15' : 'bg-orange-500/15'}`}>
              {isOver
                ? <TrendingDown className="h-4 w-4 text-red-400" />
                : <AlertTriangle className="h-4 w-4 text-orange-400" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">Alerta de orçamento</p>
              <p className={`truncate text-xs ${isOver ? 'text-red-400' : 'text-orange-400'}`}>
                {message}
              </p>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); setDismissed(true) }}
              className="shrink-0 p-1 text-zinc-500 active:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
