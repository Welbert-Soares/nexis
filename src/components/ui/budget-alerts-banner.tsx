import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X, AlertTriangle, TrendingDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getBudgets } from '#/server/services/budget.service'

const now = new Date()
const MONTH = now.getMonth() + 1
const YEAR = now.getFullYear()

export function BudgetAlertsBanner() {
  const [dismissed, setDismissed] = useState(false)

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', MONTH, YEAR],
    queryFn: () => getBudgets({ data: { month: MONTH, year: YEAR } }),
    staleTime: 5 * 60 * 1000,
  })

  const alerts = budgets
    .map((b) => ({ ...b, pct: b.limit > 0 ? b.spent / b.limit : 0 }))
    .filter((b) => b.pct >= 0.8)
    .sort((a, b) => b.pct - a.pct)

  const exceeded = alerts.filter((b) => b.pct >= 1)
  const approaching = alerts.filter((b) => b.pct < 1)
  const isOver = exceeded.length > 0
  const top = alerts[0]

  return (
    <AnimatePresence>
      {!dismissed && alerts.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <Link
            to="/analytics"
            className={`flex items-center gap-2.5 px-4 py-2.5 ${isOver ? 'bg-red-500/10' : 'bg-orange-500/10'}`}
          >
            {isOver
              ? <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-400" />
              : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-400" />
            }
            <p className={`flex-1 text-xs ${isOver ? 'text-red-300' : 'text-orange-300'}`}>
              {isOver && exceeded.length === 1
                ? `Limite de ${top.categoryName} excedido`
                : isOver
                ? `${exceeded.length} orçamentos excedidos`
                : approaching.length === 1
                ? `${top.categoryName} com ${Math.round(top.pct * 100)}% do limite`
                : `${approaching.length} orçamentos próximos do limite`}
            </p>
            <button
              onClick={(e) => { e.preventDefault(); setDismissed(true) }}
              className="shrink-0 p-0.5"
            >
              <X className={`h-3.5 w-3.5 ${isOver ? 'text-red-500' : 'text-orange-500'}`} />
            </button>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
