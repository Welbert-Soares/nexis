import { useState, useRef, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, X, Repeat2, Trash2, SlidersHorizontal, TrendingUp, TrendingDown, Layers, Wallet, FilterX, UtensilsCrossed, Car, Home, Heart, BookOpen, Smile, ShoppingBag, MoreHorizontal, Briefcase, Laptop, type LucideIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Drawer } from 'vaul'
import { z } from 'zod'
import { cn } from '#/lib/utils'
import { fadeUp, stagger, scaleIn } from '#/lib/motion'
import { listTransactions, removeTransaction } from '#/server/services/transaction.service'
import { getUserWallets } from '#/server/services/wallet.service'
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

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed, Car, Home, Heart, BookOpen, Smile, ShoppingBag,
  MoreHorizontal, Briefcase, Laptop, TrendingUp, TrendingDown, Wallet,
}

type Filter = 'ALL' | 'INCOME' | 'EXPENSE'

const FILTERS: { value: Filter; label: string; icon: LucideIcon; iconClass?: string }[] = [
  { value: 'ALL', label: 'Tudo', icon: Layers },
  { value: 'INCOME', label: 'Receitas', icon: TrendingUp, iconClass: 'text-emerald-400' },
  { value: 'EXPENSE', label: 'Despesas', icon: TrendingDown, iconClass: 'text-red-400' },
]

type Tx = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  description: string | null
  date: Date
  walletId: string
  categoryId: string | null
  category: { name: string; color: string | null; icon: string | null } | null
  wallet: { id: string; name: string; color: string | null }
  recurring: boolean
  parentId: string | null
}

function TransactionsPage() {
  const { action } = Route.useSearch()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [walletFilter, setWalletFilter] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedChip, setExpandedChip] = useState<string | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EditableTransaction | undefined>()
  const [confirmingTx, setConfirmingTx] = useState<Tx | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Tx | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (chipsRef.current && !chipsRef.current.contains(e.target as Node)) {
        setExpandedChip(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  const { mutate: execDelete } = useMutation({
    mutationFn: (id: string) => removeTransaction({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
  })

  function handleSwipeDelete(tx: Tx) {
    setConfirmingTx(tx)
  }

  function handleConfirmDelete() {
    if (!confirmingTx) return
    const tx = confirmingTx
    setConfirmingTx(null)
    setPendingDelete(tx)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => {
      execDelete(tx.id)
      setPendingDelete(null)
    }, 5000)
  }

  function handleUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setPendingDelete(null)
  }

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => getUserWallets(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', year, month, filter, walletFilter],
    queryFn: () =>
      listTransactions({
        data: {
          year,
          month,
          type: filter === 'ALL' ? undefined : filter,
          walletId: walletFilter ?? undefined,
        },
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

  const displayed = pendingDelete ? filtered.filter((t) => t.id !== pendingDelete.id) : filtered
  const grouped = groupByDate(displayed)
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

          {/* Filtros — colapsável */}
          {(() => {
            const hasActiveFilter = filter !== 'ALL' || walletFilter !== null
            const activeWallet = wallets.find((w) => w.id === walletFilter)
            const activeLabel = [
              filter !== 'ALL' ? FILTERS.find((f) => f.value === filter)?.label : null,
              activeWallet ? activeWallet.name : null,
            ].filter(Boolean).join(' · ') || 'Filtros'

            return (
              <div>
                {/* Gatilho */}
                <div className="flex items-center gap-3">
                <button
                  onClick={() => { setFiltersOpen((o) => !o); setExpandedChip(null) }}
                  className="flex items-center gap-2"
                >
                  <div className="relative">
                    <SlidersHorizontal className={cn('h-4 w-4 transition-colors', hasActiveFilter ? 'text-white' : 'text-zinc-500')} />
                    {hasActiveFilter && (
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-blue-400" />
                    )}
                  </div>
                  <span className={cn('text-xs font-medium transition-colors', hasActiveFilter ? 'text-white' : 'text-zinc-500')}>
                    {activeLabel}
                  </span>
                  <motion.span
                    animate={{ rotate: filtersOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-600"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 -rotate-90" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {hasActiveFilter && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => { setFilter('ALL'); setWalletFilter(null); setExpandedChip(null) }}
                      className="text-zinc-500 active:text-zinc-300 transition-colors"
                    >
                      <FilterX className="h-3.5 w-3.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
                </div>

                {/* Chips expansíveis */}
                <AnimatePresence initial={false}>
                  {filtersOpen && (
                    <motion.div
                      key="filter-chips"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div ref={chipsRef} className="flex gap-2 overflow-x-auto pb-0.5 pt-3 no-scrollbar">
                        {FILTERS.map((f) => {
                          const isSelected = filter === f.value
                          const chipId = `type-${f.value}`
                          const isExpanded = expandedChip === chipId
                          return (
                            <motion.button
                              layout
                              transition={{ layout: { duration: 0.18, ease: 'easeInOut' } }}
                              key={f.value}
                              onClick={() => {
                                setFilter(f.value)
                                setExpandedChip(isExpanded ? null : chipId)
                              }}
                              className={cn(
                                'shrink-0 flex items-center rounded-full py-1.5 px-2.5 transition-colors',
                                isSelected ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800/60 text-zinc-500',
                              )}
                            >
                              <f.icon className={cn('h-3.5 w-3.5 shrink-0', f.iconClass)} />
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.span
                                    key="label"
                                    initial={{ maxWidth: 0, opacity: 0 }}
                                    animate={{ maxWidth: 200, opacity: 1 }}
                                    exit={{ maxWidth: 0, opacity: 0 }}
                                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                                    className="ml-1.5 overflow-hidden whitespace-nowrap text-xs font-medium"
                                  >
                                    {f.label}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </motion.button>
                          )
                        })}

                        {wallets.length > 1 && (
                          <>
                            <div className="my-1 w-px shrink-0 bg-zinc-700" />
                            {(() => {
                              const isSelected = walletFilter === null
                              const chipId = 'wallet-all'
                              const isExpanded = expandedChip === chipId
                              return (
                                <motion.button
                                  layout
                                  transition={{ layout: { duration: 0.18, ease: 'easeInOut' } }}
                                  key={chipId}
                                  onClick={() => {
                                    setWalletFilter(null)
                                    setExpandedChip(isExpanded ? null : chipId)
                                  }}
                                  className={cn(
                                    'shrink-0 flex items-center rounded-full py-1.5 px-2.5 transition-colors',
                                    isSelected ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800/60 text-zinc-500',
                                  )}
                                >
                                  <Wallet className="h-3.5 w-3.5 shrink-0" />
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.span
                                        key="label"
                                        initial={{ maxWidth: 0, opacity: 0 }}
                                        animate={{ maxWidth: 200, opacity: 1 }}
                                        exit={{ maxWidth: 0, opacity: 0 }}
                                        transition={{ duration: 0.18, ease: 'easeInOut' }}
                                        className="ml-1.5 overflow-hidden whitespace-nowrap text-xs font-medium"
                                      >
                                        Todas
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </motion.button>
                              )
                            })()}
                            {wallets.map((w) => {
                              const isSelected = walletFilter === w.id
                              const chipId = `wallet-${w.id}`
                              const isExpanded = expandedChip === chipId
                              return (
                                <motion.button
                                  layout
                                  transition={{ layout: { duration: 0.18, ease: 'easeInOut' } }}
                                  key={w.id}
                                  onClick={() => {
                                    setWalletFilter(w.id === walletFilter ? null : w.id)
                                    setExpandedChip(isExpanded ? null : chipId)
                                  }}
                                  className={cn(
                                    'shrink-0 flex items-center rounded-full py-1.5 px-2.5 transition-colors',
                                    isSelected ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800/60 text-zinc-500',
                                  )}
                                >
                                  <Wallet
                                    className="h-3.5 w-3.5 shrink-0"
                                    style={w.color ? { color: w.color } : undefined}
                                  />
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.span
                                        key="label"
                                        initial={{ maxWidth: 0, opacity: 0 }}
                                        animate={{ maxWidth: 200, opacity: 1 }}
                                        exit={{ maxWidth: 0, opacity: 0 }}
                                        transition={{ duration: 0.18, ease: 'easeInOut' }}
                                        className="ml-1.5 overflow-hidden whitespace-nowrap text-xs font-medium"
                                      >
                                        {w.name}
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </motion.button>
                              )
                            })}
                          </>
                        )}

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })()}

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
                        <SwipeableRow transaction={t} onTap={() => handleRowTap(t)} onDelete={() => handleSwipeDelete(t)} />
                      </motion.div>
                    ))}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </PullToRefresh>
      </div>

      <Drawer.Root open={!!confirmingTx} onClose={() => setConfirmingTx(null)}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={() => setConfirmingTx(null)} />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />
            <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">Excluir transação?</p>
                <p className="text-xs text-zinc-500">Você terá 5 segundos para desfazer.</p>
              </div>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setConfirmingTx(null)}
                  className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm text-zinc-400"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 rounded-xl bg-red-500/20 py-3 text-sm font-medium text-red-400"
                >
                  Excluir
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            key="undo-toast"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed bottom-24 left-4 right-4 z-50 overflow-hidden rounded-2xl bg-zinc-800 shadow-xl"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-zinc-300">Transação excluída</p>
              <button onClick={handleUndo} className="text-sm font-semibold text-blue-400 active:opacity-70">
                Desfazer
              </button>
            </div>
            <div className="h-0.5 bg-zinc-700">
              <motion.div
                className="h-full origin-left bg-blue-400"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TransactionSheet
        open={sheetOpen}
        transaction={editing}
        onClose={() => setEditing(undefined)}
      />
    </>
  )
}

const SWIPE_THRESHOLD = -110

function SwipeableRow({ transaction, onTap, onDelete }: { transaction: Tx; onTap: () => void; onDelete: () => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const currentX = useRef(0)
  const direction = useRef<'horizontal' | 'vertical' | null>(null)

  function updateDOM(x: number) {
    const pct = Math.min(Math.abs(x) / 110, 1)
    if (rowRef.current) rowRef.current.style.transform = `translateX(${x}px)`
    if (bgRef.current) bgRef.current.style.opacity = String(pct)
    if (trashRef.current) trashRef.current.style.transform = `scale(${0.7 + pct * 0.3})`
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    currentX.current = 0
    direction.current = null
    if (rowRef.current) rowRef.current.style.transition = 'none'
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    if (direction.current === null) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      direction.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
    }

    if (direction.current !== 'horizontal' || dx > 0) return

    e.stopPropagation()
    const resistant = dx * 0.55
    currentX.current = Math.max(resistant, -140)
    updateDOM(currentX.current)
  }

  function onTouchEnd() {
    if (direction.current !== 'horizontal') return

    if (currentX.current < SWIPE_THRESHOLD) {
      if (rowRef.current) {
        rowRef.current.style.transition = 'transform 0.3s cubic-bezier(0.25,1,0.5,1)'
      }
      updateDOM(0)
      onDelete()
    } else {
      if (rowRef.current) {
        rowRef.current.style.transition = 'transform 0.3s cubic-bezier(0.25,1,0.5,1)'
      }
      updateDOM(0)
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        ref={bgRef}
        className="absolute inset-0 flex items-center justify-end rounded-xl bg-red-500/15 pr-4"
        style={{ opacity: 0 }}
      >
        <div ref={trashRef} style={{ transform: 'scale(0.7)' }}>
          <Trash2 className="h-4 w-4 text-red-400" />
        </div>
      </div>
      <div ref={rowRef} style={{ transform: 'translateX(0px)' }}>
        <TransactionRow transaction={transaction} onTap={onTap} />
      </div>
    </div>
  )
}

function TransactionRow({ transaction: t, onTap }: { transaction: Tx; onTap: () => void }) {
  const isExpense = t.type === 'EXPENSE'
  const label = t.description ?? t.category?.name ?? 'Sem descrição'
  const color = t.category?.color ?? t.wallet.color ?? '#71717a'
  const CategoryIcon = t.category?.icon ? CATEGORY_ICONS[t.category.icon] : null

  return (
    <button
      onClick={onTap}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 active:bg-zinc-800/50 transition-colors"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}20` }}
      >
        {CategoryIcon
          ? <CategoryIcon className="h-4 w-4" style={{ color }} />
          : <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        }
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="truncate text-sm text-white">{label}</p>
          {(t.recurring || t.parentId) && (
            <Repeat2 className="h-3 w-3 shrink-0 text-zinc-600" />
          )}
        </div>
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
