import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Plus, Target, PiggyBank } from 'lucide-react'
import { motion } from 'framer-motion'
import { Drawer } from 'vaul'
import { cn } from '#/lib/utils'
import { fadeUp, stagger } from '#/lib/motion'
import { getUserGoals, updateUserGoal } from '#/server/services/goal.service'
import { GoalSheet, type EditableGoal } from '#/components/goals/goal-sheet'
import { PullToRefresh } from '#/components/ui/pull-to-refresh'
import { CurrencyInput } from '#/components/ui/currency-input'

export const Route = createFileRoute('/_authenticated/goals')({
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery({ queryKey: ['goals'], queryFn: () => getUserGoals() })
  },
  component: GoalsPage,
})

type Goal = {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: Date | null
  color: string | null
}

function GoalsPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<EditableGoal | undefined>()
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null)
  const [depositCents, setDepositCents] = useState(0)
  const queryClient = useQueryClient()

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => getUserGoals(),
  })

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: ['goals'] })
  }

  const totalSaved = goals.reduce((acc, g) => acc + g.currentAmount, 0)
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0)

  function handleEdit(g: Goal) {
    setEditing({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      deadline: g.deadline ? new Date(g.deadline) : null,
      color: g.color,
    })
    setSheetOpen(true)
  }

  function handleClose() {
    setEditing(undefined)
    setSheetOpen(false)
  }

  const depositMutation = useMutation({
    mutationFn: (g: Goal) => updateUserGoal({
      data: { id: g.id, currentAmount: g.currentAmount + depositCents / 100 },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setDepositGoal(null)
      setDepositCents(0)
    },
  })

  return (
    <>
      <div className="flex h-full flex-col pt-10">
      <PullToRefresh onRefresh={handleRefresh} className="space-y-6 px-4 flex-1">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-zinc-500">Total guardado</p>
            <p className="text-3xl font-bold tabular-nums text-white">{fmt(totalSaved)}</p>
            {totalTarget > 0 && (
              <p className="text-xs text-zinc-600">de {fmt(totalTarget)} em metas</p>
            )}
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 transition-colors active:bg-zinc-700"
          >
            <Plus className="h-5 w-5 text-zinc-300" />
          </button>
        </motion.div>

        {/* Lista */}
        {isLoading ? (
          <GoalsSkeleton />
        ) : goals.length === 0 ? (
          <EmptyState onAdd={() => setSheetOpen(true)} />
        ) : (
          <motion.div variants={stagger} className="space-y-3 pb-4">
            {(goals as Goal[]).map((g) => (
              <motion.div key={g.id} variants={fadeUp}>
                <GoalCard goal={g} onTap={() => handleEdit(g)} onDeposit={() => { setDepositGoal(g); setDepositCents(0) }} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
      </PullToRefresh>
      </div>

      <GoalSheet open={sheetOpen} goal={editing} onClose={handleClose} />

      <Drawer.Root open={!!depositGoal} onClose={() => { setDepositGoal(null); setDepositCents(0) }}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={() => setDepositGoal(null)} />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
            <Drawer.Title className="sr-only">Aportar na meta</Drawer.Title>
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />
            <div className="px-4 pb-8 pt-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                  <PiggyBank className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Aportar na meta</p>
                  {depositGoal && <p className="text-xs text-zinc-500">{depositGoal.name}</p>}
                </div>
              </div>
              <CurrencyInput cents={depositCents} onChange={setDepositCents} />
              <button
                onClick={() => depositGoal && depositMutation.mutate(depositGoal)}
                disabled={depositCents === 0 || depositMutation.isPending}
                className="w-full rounded-xl bg-emerald-500 py-4 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
              >
                {depositMutation.isPending ? 'Salvando...' : 'Confirmar aporte'}
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}

function GoalCard({ goal: g, onTap, onDeposit }: { goal: Goal; onTap: () => void; onDeposit: () => void }) {
  const pct = g.targetAmount > 0
    ? Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100)
    : 0
  const done = pct >= 100
  const color = g.color ?? '#3b82f6'

  return (
    <button
      onClick={onTap}
      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-left space-y-3 active:bg-zinc-800/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <p className="truncate text-sm font-medium text-white">{g.name}</p>
        </div>
        <span className={cn('shrink-0 text-xs font-semibold tabular-nums', done ? 'text-emerald-400' : 'text-zinc-400')}>
          {pct}%
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 w-full rounded-full bg-zinc-800">
        <motion.div
          className="h-1.5 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="tabular-nums text-xs text-zinc-400">
          {fmt(g.currentAmount)}
          <span className="text-zinc-600"> / {fmt(g.targetAmount)}</span>
        </p>
        <div className="flex items-center gap-2">
          {g.deadline && (
            <p className="text-xs text-zinc-600">{fmtDeadline(new Date(g.deadline))}</p>
          )}
          {!done && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeposit() }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 active:bg-emerald-500/30 transition-colors"
            >
              <PiggyBank className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </button>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
        <Target className="h-6 w-6 text-zinc-500" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-300">Nenhuma meta ainda</p>
        <p className="text-xs text-zinc-600">Crie uma meta para começar a poupar</p>
      </div>
      <button
        onClick={onAdd}
        className="rounded-full bg-blue-400 px-5 py-2 text-sm font-medium text-white"
      >
        Criar meta
      </button>
    </div>
  )
}

function GoalsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-[104px] shimmer rounded-2xl" />
      ))}
    </div>
  )
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDeadline(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}
