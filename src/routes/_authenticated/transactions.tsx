import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { z } from 'zod'
import { cn } from '#/lib/utils'
import { fadeUp, stagger, scaleIn } from '#/lib/motion'
import { listTransactions } from '#/server/services/transaction.service'
import { TransactionSheet, type EditableTransaction } from '#/components/transactions/transaction-sheet'
import { PullToRefresh } from '#/components/ui/pull-to-refresh'

const searchSchema = z.object({
  action: z.enum(['new']).optional(),
})

export const Route = createFileRoute('/_authenticated/transactions')({
  validateSearch: searchSchema,
  loader: ({ context: { queryClient } }) => {
    const now = new Date()
    queryClient.prefetchQuery({
      queryKey: ['transactions', now.getFullYear(), now.getMonth() + 1, 'ALL'],
      queryFn: () => listTransactions({ data: { year: now.getFullYear(), month: now.getMonth() + 1 } }),
    })
  },
  component: TransactionsPage,
})

type Filter = 'ALL' | 'INCOME' | 'EXPENSE'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Tudo' },
  { value: 'INCOME', label: 'Receitas' },
  { value: 'EXPENSE', label: 'Despesas' },
]

type Tx = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  description: string | null
  date: Date
  walletId: string
  categoryId: string | null
  category: { name: string; color: string | null } | null
  wallet: { id: string; name: string; color: string | null }
}

function TransactionsPage() {
  const { action } = Route.useSearch()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EditableTransaction | undefined>()
  const queryClient = useQueryClient()

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', year, month, filter],
    queryFn: () =>
      listTransactions({
        data: { year, month, type: filter === 'ALL' ? undefined : filter },
      }),
  })

  const income = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((acc, t) => acc + t.amount, 0)
  const expenses = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amount, 0)

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    if (isCurrentMonth) return
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
  }

  function handleRowTap(t: Tx) {
    setEditing({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      date: new Date(t.date),
      walletId: t.walletId,
      categoryId: t.categoryId,
    })
  }

  const filtered = search.trim()
    ? (transactions as Tx[]).filter((t) => {
        const q = search.toLowerCase()
        return (
          t.description?.toLowerCase().includes(q) ||
          t.category?.name.toLowerCase().includes(q) ||
          t.wallet.name.toLowerCase().includes(q)
        )
      })
    : (transactions as Tx[])

  const grouped = groupByDate(filtered)
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1
  const sheetOpen = action === 'new' || !!editing

  return (
    <>
      <div className="flex h-full flex-col pt-10">
        {/* Cabeçalho fixo */}
        <div className="space-y-4 px-4 pb-3">
          {/* Navegação de mês */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-1 text-zinc-500 active:text-zinc-300">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-sm font-medium text-white capitalize">
              {fmtMonth(year, month)}
            </p>
            <button
              onClick={nextMonth}
              className={cn('p-1 transition-colors', isCurrent ? 'text-zinc-700' : 'text-zinc-500 active:text-zinc-300')}
              disabled={isCurrent}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Receitas</p>
              <p className="mt-1 tabular-nums text-base font-semibold text-emerald-400">
                {fmt(income)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Despesas</p>
              <p className="mt-1 tabular-nums text-base font-semibold text-red-400">
                {fmt(expenses)}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                  filter === f.value
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição, categoria..."
              className="w-full rounded-xl bg-zinc-800/60 py-2.5 pl-8 pr-8 text-xs text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-zinc-500" />
              </button>
            )}
          </div>
        </div>

        {/* Lista com scroll próprio */}
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 px-4">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <ListSkeleton />
            ) : !filtered.length ? (
              <EmptyState hasSearch={!!search} />
            ) : (
              <motion.div
                key={`${year}-${month}-${filter}`}
                variants={stagger}
                initial="hidden"
                animate="show"
                className="space-y-5 pb-4"
              >
                {grouped.map(({ label, items }) => (
                  <motion.div key={label} variants={fadeUp} className="space-y-1">
                    <p className="mb-2 text-xs font-medium text-zinc-600">{label}</p>
                    {items.map((t) => (
                      <motion.div key={t.id} variants={scaleIn}>
                        <TransactionRow transaction={t} onTap={() => handleRowTap(t)} />
                      </motion.div>
                    ))}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </PullToRefresh>
      </div>

      <TransactionSheet
        open={sheetOpen}
        transaction={editing}
        onClose={() => setEditing(undefined)}
      />
    </>
  )
}

function TransactionRow({ transaction: t, onTap }: { transaction: Tx; onTap: () => void }) {
  const isExpense = t.type === 'EXPENSE'
  const label = t.description ?? t.category?.name ?? 'Sem descrição'
  const dot = t.category?.color ?? t.wallet.color ?? '#71717a'

  return (
    <button
      onClick={onTap}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 active:bg-zinc-800/50 transition-colors"
    >
      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
      <div className="flex-1 min-w-0 text-left">
        <p className="truncate text-sm text-white">{label}</p>
        <p className="text-xs text-zinc-600">{t.wallet.name}</p>
      </div>
      <p className={cn('shrink-0 tabular-nums text-sm font-medium', isExpense ? 'text-red-400' : 'text-emerald-400')}>
        {isExpense ? '-' : '+'}{fmt(t.amount)}
      </p>
    </button>
  )
}

function EmptyState({ hasSearch }: { hasSearch?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 py-12 text-center">
      <p className="text-sm text-zinc-500">
        {hasSearch ? 'Nenhum resultado encontrado' : 'Nenhuma transação neste período'}
      </p>
      <p className="text-xs text-zinc-700">
        {hasSearch ? 'Tente outros termos' : 'Toque em + para adicionar'}
      </p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-1">
          <div className="h-2 w-2 rounded-full bg-zinc-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-800/60" />
          </div>
          <div className="h-3.5 w-16 animate-pulse rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  )
}

function groupByDate(transactions: Tx[]) {
  const map = new Map<string, Tx[]>()
  for (const t of transactions) {
    const key = fmtDay(new Date(t.date))
    const group = map.get(key) ?? []
    group.push(t)
    map.set(key, group)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtMonth(year: number, month: number) {
  const date = new Date(year, month - 1, 1)
  const m = date.toLocaleDateString('pt-BR', { month: 'long' })
  return `${m} / ${year}`
}

function fmtDay(date: Date) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })
}
