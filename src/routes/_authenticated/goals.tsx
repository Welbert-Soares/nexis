import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Plus, Target, PiggyBank } from 'lucide-react'
import { motion } from 'framer-motion'
import { Drawer } from 'vaul'
import { cn } from '#/lib/utils'
import { fadeUp, stagger } from '#/lib/motion'
import { getUserGoals, depositGoalFromWallet } from '#/server/services/goal.service'
import { getUserWallets } from '#/server/services/wallet.service'
import { GoalSheet, type EditableGoal } from '#/components/goals/goal-sheet'
import { PullToRefresh } from '#/components/ui/pull-to-refresh'
import { CurrencyInput } from '#/components/ui/currency-input'

export const Route = createFileRoute('/_authenticated/goals')({
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery({ queryKey: ['goals'], queryFn: () => getUserGoals() })
    queryClient.prefetchQuery({ queryKey: ['wallets'], queryFn: () => getUserWallets() })
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

type Wallet = {
  id: string
  name: string
  color: string | null
  balance: number
}

function GoalsPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<EditableGoal | undefined>()
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null)
  const [depositCents, setDepositCents] = useState(0)
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => getUserGoals(),
  })

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => getUserWallets(),
  })

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['goals'] }),
      queryClient.invalidateQueries({ queryKey: ['wallets'] }),
    ])
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

  function openDeposit(g: Goal) {
    setDepositGoal(g)
    setDepositCents(0)
    setSelectedWalletId(wallets.length === 1 ? wallets[0].id : null)
  }

  function closeDeposit() {
    setDepositGoal(null)
    setDepositCents(0)
    setSelectedWalletId(null)
  }

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) as Wallet | undefined
  const depositAmount = depositCents / 100
  const insufficientFunds = !!selectedWallet && depositAmount > selectedWallet.balance

  const depositMutation = useMutation({
    mutationFn: () => depositGoalFromWallet({
      data: { goalId: depositGoal!.id, walletId: selectedWalletId!, amount: depositAmount },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      closeDeposit()
    },
  })

  const canConfirm = depositCents > 0 && !!selectedWalletId && !insufficientFunds && !depositMutation.isPending

  return (
    <>
      <div className="flex h-full flex-col pt-10">
      <PullToRefresh onRefresh={handleRefresh} className="space-y-6 px-4 flex-1">
      <motion.div variants={stagger} initial="hidden" animate="show">
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
                <GoalCard goal={g} onTap={() => handleEdit(g)} onDeposit={() => openDeposit(g)} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
      </PullToRefresh>
      </div>

      <GoalSheet open={sheetOpen} goal={editing} onClose={handleClose} />

      {/* Drawer de aporte */}
      <Drawer.Root open={!!depositGoal} onClose={closeDeposit}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={closeDeposit} />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
            <Drawer.Title className="sr-only">Aportar na meta</Drawer.Title>
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />
            <div className="px-4 pb-8 pt-5 space-y-5">

              {/* Título */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                  <PiggyBank className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Aportar na meta</p>
                  {depositGoal && <p className="text-xs text-zinc-500">{depositGoal.name}</p>}
                </div>
              </div>

              {/* Seletor de carteira */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500">Debitar de</p>
                <div className="flex flex-wrap gap-2">
                  {(wallets as Wallet[]).map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWalletId(w.id)}
                      className={cn(
                        'flex flex-col rounded-xl border px-3 py-2 text-left transition-colors',
                        selectedWalletId === w.id
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-zinc-800 bg-zinc-800/50 active:bg-zinc-700/50',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color ?? '#71717a' }} />
                        <span className="text-xs font-medium text-zinc-200">{w.name}</span>
                      </div>
                      <span className="mt-0.5 text-[11px] tabular-nums text-zinc-500">{fmt(w.balance)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor */}
              <CurrencyInput cents={depositCents} onChange={setDepositCents} />

              {/* Aviso de saldo insuficiente */}
              {insufficientFunds && (
                <p className="text-xs text-red-400">
                  Saldo insuficiente — disponível {fmt(selectedWallet!.balance)}
                </p>
              )}

              <button
                onClick={() => depositMutation.mutate()}
                disabled={!canConfirm}
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
