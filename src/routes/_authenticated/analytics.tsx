import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { getAnalytics } from '#/server/services/analytics.service'
import { getUserGoals } from '#/server/services/goal.service'
import { getBudgets } from '#/server/services/budget.service'
import { GoalSheet, type EditableGoal } from '#/components/goals/goal-sheet'
import { BudgetSheet, type EditableBudget } from '#/components/budgets/budget-sheet'
import { fadeUp, stagger } from '#/lib/motion'
import { PullToRefresh } from '#/components/ui/pull-to-refresh'
import { cn } from '#/lib/utils'

const now = new Date()
const CURRENT_MONTH = now.getMonth() + 1
const CURRENT_YEAR = now.getFullYear()

export const Route = createFileRoute('/_authenticated/analytics')({
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery({ queryKey: ['analytics'], queryFn: () => getAnalytics() })
    queryClient.prefetchQuery({ queryKey: ['goals'], queryFn: () => getUserGoals() })
    queryClient.prefetchQuery({
      queryKey: ['budgets', CURRENT_MONTH, CURRENT_YEAR],
      queryFn: () => getBudgets({ data: { month: CURRENT_MONTH, year: CURRENT_YEAR } }),
    })
  },
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const queryClient = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<EditableGoal | undefined>()
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<EditableBudget | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => getAnalytics(),
  })

  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => getUserGoals(),
  })

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets', CURRENT_MONTH, CURRENT_YEAR],
    queryFn: () => getBudgets({ data: { month: CURRENT_MONTH, year: CURRENT_YEAR } }),
  })

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['goals'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
    ])
  }

  const income = data?.monthly.income ?? 0
  const expenses = data?.monthly.expenses ?? 0
  const net = income - expenses

  return (
    <div className="flex h-full flex-col pt-10">
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 px-4">
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 pb-6">

          {/* Header */}
          <motion.div variants={fadeUp}>
            <h1 className="text-2xl font-bold text-white">Análise</h1>
            <p className="text-xs text-zinc-500 mt-0.5">{fmtCurrentMonth()}</p>
          </motion.div>

          {/* Resumo do mês */}
          <motion.section variants={fadeUp} className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-600">Resumo do mês</h2>
            <div className="grid grid-cols-3 gap-2">
              <SummaryCard label="Receitas" value={income} color="text-emerald-400" loading={isLoading} />
              <SummaryCard label="Despesas" value={expenses} color="text-red-400" loading={isLoading} />
              <SummaryCard label="Saldo" value={net} color={net >= 0 ? 'text-blue-400' : 'text-red-400'} loading={isLoading} />
            </div>
          </motion.section>

          {/* Tendência 6 meses */}
          {!isLoading && !!data?.trend.length && (
            <motion.section variants={fadeUp} className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-600">Últimos 6 meses</h2>
              <MonthlyTrend trend={data.trend} />
            </motion.section>
          )}

          {/* Gastos por categoria */}
          {!isLoading && !!data?.categoryBreakdown.length && (
            <motion.section variants={fadeUp} className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-600">Gastos por categoria</h2>
              <CategoryBreakdown items={data.categoryBreakdown} />
            </motion.section>
          )}

          {/* Metas */}
          {!goalsLoading && (
            <motion.section variants={fadeUp} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-600">Metas</h2>
                <button
                  onClick={() => { setEditing(undefined); setSheetOpen(true) }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 active:bg-zinc-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-zinc-400" />
                </button>
              </div>
              {goals.length > 0
                ? <GoalsList goals={goals as Goal[]} onTap={(g) => { setEditing(g); setSheetOpen(true) }} />
                : <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 py-6 text-center">
                    <p className="text-xs text-zinc-600">Nenhuma meta ainda</p>
                  </div>
              }
            </motion.section>
          )}

          {/* Orçamentos */}
          {!budgetsLoading && (
            <motion.section variants={fadeUp} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-600">Orçamentos</h2>
                <button
                  onClick={() => { setEditingBudget(undefined); setBudgetSheetOpen(true) }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 active:bg-zinc-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-zinc-400" />
                </button>
              </div>
              {budgets.length > 0
                ? <BudgetsList budgets={budgets} onTap={(b) => { setEditingBudget(b); setBudgetSheetOpen(true) }} />
                : <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 py-6 text-center">
                    <p className="text-xs text-zinc-600">Nenhum orçamento definido</p>
                  </div>
              }
            </motion.section>
          )}

          {(isLoading || goalsLoading || budgetsLoading) && <AnalyticsSkeleton />}
        </motion.div>
      </PullToRefresh>

      <GoalSheet
        open={sheetOpen}
        goal={editing}
        onClose={() => { setSheetOpen(false); setEditing(undefined) }}
      />

      <BudgetSheet
        open={budgetSheetOpen}
        budget={editingBudget}
        month={CURRENT_MONTH}
        year={CURRENT_YEAR}
        onClose={() => { setBudgetSheetOpen(false); setEditingBudget(undefined) }}
      />
    </div>
  )
}

function SummaryCard({ label, value, color, loading }: { label: string; value: number; color: string; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-1.5">
      <p className="text-xs text-zinc-500">{label}</p>
      {loading ? (
        <div className="h-5 w-16 animate-pulse rounded bg-zinc-800" />
      ) : (
        <p className={cn('text-sm font-semibold tabular-nums', color)}>{fmt(value)}</p>
      )}
    </div>
  )
}

type TrendItem = { month: string; income: number; expenses: number }

function MonthlyTrend({ trend }: { trend: TrendItem[] }) {
  const maxVal = Math.max(...trend.flatMap((t) => [t.income, t.expenses]), 1)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-zinc-500">Receitas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-xs text-zinc-500">Despesas</span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-1.5 h-28">
        {trend.map((t) => (
          <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end gap-0.5 justify-center" style={{ height: 88 }}>
              <motion.div
                className="w-[45%] rounded-t bg-emerald-400/70"
                initial={{ height: 0 }}
                animate={{ height: `${(t.income / maxVal) * 88}px` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <motion.div
                className="w-[45%] rounded-t bg-red-400/70"
                initial={{ height: 0 }}
                animate={{ height: `${(t.expenses / maxVal) * 88}px` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] text-zinc-600">{fmtMonthShort(t.month)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type CategoryItem = { id: string; name: string; color: string; amount: number }

function DonutChart({ items }: { items: CategoryItem[] }) {
  const total = items.reduce((acc, i) => acc + i.amount, 0)
  const R = 40
  const C = 2 * Math.PI * R
  const cx = 60
  const cy = 60

  let accumulated = 0
  const segments = items.map((item) => {
    const fraction = item.amount / total
    const dash = fraction * C
    const offset = -accumulated * C
    accumulated += fraction
    return { ...item, dash, offset }
  })

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0 -rotate-90">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#27272a" strokeWidth="18" />
          {segments.map((s) => (
            <circle
              key={s.id}
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${s.dash} ${C}`}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="flex-1 space-y-2 min-w-0">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate text-xs text-zinc-400">{item.name}</span>
              </div>
              <span className="text-xs text-zinc-500 shrink-0">{pct(item.amount, total)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{item.name}</span>
            <span className="tabular-nums text-xs font-medium text-zinc-300">{fmt(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryBreakdown({ items }: { items: CategoryItem[] }) {
  return <DonutChart items={items} />
}

type Goal = {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: Date | null
  color: string | null
}

function GoalsList({ goals, onTap }: { goals: Goal[]; onTap: (g: EditableGoal) => void }) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      {goals.map((g) => {
        const progress = g.targetAmount > 0
          ? Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100)
          : 0
        const done = progress >= 100
        const color = g.color ?? '#3b82f6'

        return (
          <button
            key={g.id}
            onClick={() => onTap({ id: g.id, name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount, deadline: g.deadline ? new Date(g.deadline) : null, color: g.color })}
            className="w-full space-y-2 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="truncate text-xs text-zinc-300">{g.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-zinc-600">{fmt(g.currentAmount)}</span>
                <span className={cn('text-xs font-semibold tabular-nums', done ? 'text-emerald-400' : 'text-zinc-400')}>
                  {progress}%
                </span>
              </div>
            </div>
            <div className="h-1 w-full rounded-full bg-zinc-800">
              <motion.div
                className="h-1 rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

type BudgetItem = {
  id: string
  categoryId: string
  categoryName: string
  categoryColor: string
  limit: number
  spent: number
}

function BudgetsList({ budgets, onTap }: { budgets: BudgetItem[]; onTap: (b: EditableBudget) => void }) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      {budgets.map((b) => {
        const progress = b.limit > 0 ? Math.min((b.spent / b.limit) * 100, 100) : 0
        const over = b.spent > b.limit
        const barColor = over ? '#f87171' : progress >= 80 ? '#fb923c' : b.categoryColor

        return (
          <button key={b.id} onClick={() => onTap({ id: b.id, categoryId: b.categoryId, limit: b.limit })} className="w-full space-y-1.5 text-left">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                <span className="truncate text-xs text-zinc-300">{b.categoryName}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn('tabular-nums text-xs font-medium', over ? 'text-red-400' : 'text-zinc-300')}>{fmt(b.spent)}</span>
                <span className="text-xs text-zinc-600">/ {fmt(b.limit)}</span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800">
              <motion.div
                className="h-1.5 rounded-full transition-colors"
                style={{ backgroundColor: barColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            {over && (
              <p className="text-[10px] text-red-400">Limite excedido em {fmt(b.spent - b.limit)}</p>
            )}
          </button>
        )
      })}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-zinc-800/50" />
      ))}
    </div>
  )
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtCurrentMonth() {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function fmtMonthShort(key: string) {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

function pct(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}
