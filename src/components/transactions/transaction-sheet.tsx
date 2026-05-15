import { useState, useEffect, useRef } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Drawer } from 'vaul'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Trash2, Wallet, Plus, Repeat2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '#/lib/utils'
import { CATEGORY_ICONS } from '#/lib/category-icons'
import { getUserWallets } from '#/server/services/wallet.service'
import { getCategories } from '#/server/services/category.service'
import { addTransaction, editTransaction, removeTransaction } from '#/server/services/transaction.service'
import { CurrencyInput } from '#/components/ui/currency-input'
import { CategorySheet, type EditableCategory } from '#/components/categories/category-sheet'


type TransactionType = 'EXPENSE' | 'INCOME'

export type EditableTransaction = {
  id: string
  type: TransactionType
  amount: number
  description: string | null
  date: Date
  walletId: string
  categoryId: string | null
}

interface Props {
  open: boolean
  transaction?: EditableTransaction
  onClose?: () => void
}

const INTERVALS = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quinzenal' },
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'YEARLY', label: 'Anual' },
] as const

function calcNextDue(from: Date, interval: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY') {
  const d = new Date(from)
  switch (interval) {
    case 'WEEKLY':   d.setDate(d.getDate() + 7); break
    case 'BIWEEKLY': d.setDate(d.getDate() + 14); break
    case 'MONTHLY':  d.setMonth(d.getMonth() + 1); break
    case 'YEARLY':   d.setFullYear(d.getFullYear() + 1); break
  }
  return d
}

function toDateInput(d: Date) {
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function TransactionSheet({ open, transaction, onClose }: Props) {
  const isEdit = !!transaction
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'EXPENSE')
  const [cents, setCents] = useState(() => Math.round((transaction?.amount ?? 0) * 100))
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<EditableCategory | undefined>()
  const [recurring, setRecurring] = useState(false)
  const [interval, setInterval] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)
  const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null)
  const catChipsRef = useRef<HTMLDivElement>(null)
  const walletChipsRef = useRef<HTMLDivElement>(null)

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => getUserWallets(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', type],
    queryFn: () => getCategories({ data: { type } }),
  })

  const form = useForm({
    defaultValues: {
      walletId: transaction?.walletId ?? '',
      categoryId: transaction?.categoryId ?? '',
      description: transaction?.description ?? '',
      date: transaction ? toDateInput(new Date(transaction.date)) : toDateInput(new Date()),
    },
  })

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (catChipsRef.current && !catChipsRef.current.contains(target)) {
        setExpandedCatId(null)
      }
      if (walletChipsRef.current && !walletChipsRef.current.contains(target)) {
        setExpandedWalletId(null)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => {
      document.removeEventListener('pointerdown', handleOutside)
    }
  }, [])

  useEffect(() => {
    if (wallets.length > 0 && !form.getFieldValue('walletId')) {
      form.setFieldValue('walletId', wallets[0].id)
    }
  }, [wallets])

  useEffect(() => {
    if (transaction) {
      setType(transaction.type)
      setCents(Math.round(transaction.amount * 100))
      form.setFieldValue('walletId', transaction.walletId)
      form.setFieldValue('categoryId', transaction.categoryId ?? '')
      form.setFieldValue('description', transaction.description ?? '')
      form.setFieldValue('date', toDateInput(new Date(transaction.date)))
    }
  }, [transaction?.id])

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: { walletId: string; categoryId: string; description: string; date: string }) => {
      const amount = cents / 100
      if (!amount || amount <= 0) throw new Error('Valor inválido')
      const walletId = values.walletId || wallets[0]?.id
      if (!walletId) throw new Error('Selecione uma carteira')
      const date = values.date ? new Date(values.date + 'T12:00:00') : new Date()

      if (isEdit) {
        return editTransaction({
          data: {
            id: transaction!.id,
            type,
            amount,
            walletId: values.walletId || undefined,
            categoryId: values.categoryId || null,
            description: values.description || null,
            date,
          },
        })
      }

      const nextDue = recurring ? calcNextDue(date, interval) : undefined
      return addTransaction({
        data: {
          type, amount, walletId,
          categoryId: values.categoryId || undefined,
          description: values.description || undefined,
          date,
          recurring: recurring || undefined,
          interval: recurring ? interval : undefined,
          nextDue,
        },
      })
    },
    onSuccess: () => {
      invalidateAll()
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        handleClose()
      }, 900)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => removeTransaction({ data: { id: transaction!.id } }),
    onSuccess: () => {
      invalidateAll()
      handleClose()
    },
  })

  function handleClose() {
    form.reset()
    setType('EXPENSE')
    setCents(0)
    setConfirmDelete(false)
    setExpandedCatId(null)
    setExpandedWalletId(null)
    onClose?.()
    navigate({ to: '/transactions' })
  }

  const hasWallets = wallets.length > 0
  const isBusy = saveMutation.isPending || deleteMutation.isPending || saved
  const canSubmit = hasWallets && !isBusy

  return (
    <>
    <Drawer.Root open={open} onClose={handleClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={handleClose} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          <div className="overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4">
            <div className="mb-5 flex items-center justify-between">
              <Drawer.Title className="text-base font-semibold text-white">
                {isEdit ? 'Editar transação' : 'Nova transação'}
              </Drawer.Title>
              {isEdit && !saved && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-1 text-zinc-600 active:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {confirmDelete ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm text-zinc-300">Excluir esta transação?</p>
                <p className="text-xs text-zinc-600">O saldo da carteira será revertido.</p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm text-zinc-400"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="flex-1 rounded-xl bg-red-500/20 py-3 text-sm font-medium text-red-400 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ) : !hasWallets ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                  <Wallet className="h-6 w-6 text-zinc-500" strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-300">Nenhuma carteira criada</p>
                  <p className="text-xs text-zinc-600">Crie uma carteira antes de registrar transações</p>
                </div>
                <Link to="/wallets" className="rounded-full bg-blue-400 px-5 py-2 text-sm font-medium text-white">
                  Criar carteira
                </Link>
              </div>
            ) : saved ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-7 w-7 text-emerald-400" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-medium text-zinc-300">
                  {isEdit ? 'Transação atualizada' : 'Transação salva'}
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
                className="space-y-5"
              >
                {/* Tipo */}
                <div className="flex rounded-xl bg-zinc-800 p-1">
                  {(['EXPENSE', 'INCOME'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setType(t); form.setFieldValue('categoryId', ''); setExpandedCatId(null) }}
                      className={cn(
                        'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                        type === t
                          ? t === 'EXPENSE' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                          : 'text-zinc-500',
                      )}
                    >
                      {t === 'EXPENSE' ? 'Despesa' : 'Receita'}
                    </button>
                  ))}
                </div>

                {/* Valor com máscara */}
                <CurrencyInput cents={cents} onChange={setCents} autoFocus={!isEdit} />

                {/* Data */}
                <form.Field name="date">
                  {(field) => (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500">Data</p>
                      <div className="overflow-hidden rounded-xl bg-zinc-800 focus-within:ring-1 focus-within:ring-zinc-600">
                        <input
                          type="date"
                          value={field.state.value}
                          max={toDateInput(new Date())}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className="w-full min-w-0 bg-transparent px-4 py-3 text-sm text-white outline-none [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  )}
                </form.Field>

                {/* Categorias */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Categoria</p>
                    <button
                      type="button"
                      onClick={() => { setEditingCategory(undefined); setCategorySheetOpen(true) }}
                      className="flex items-center gap-1 text-xs text-zinc-600 active:text-zinc-400 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Nova
                    </button>
                  </div>
                  <form.Field name="categoryId">
                    {(field) => (
                      <div ref={catChipsRef} className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {categories.map((cat: { id: string; name: string; color: string | null; icon: string | null; userId: string | null }) => {
                          const isSelected = field.state.value === cat.id
                          const isExpanded = expandedCatId === cat.id
                          const color = cat.color ?? '#71717a'
                          const Icon = cat.icon ? CATEGORY_ICONS[cat.icon] : null
                          return (
                            <motion.button
                              layout
                              transition={{ layout: { duration: 0.18, ease: 'easeInOut' } }}
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setExpandedCatId(isExpanded ? null : cat.id)
                                if (!isSelected) {
                                  field.handleChange(cat.id)
                                  if (cat.userId) {
                                    setEditingCategory({ id: cat.id, name: cat.name, color, icon: cat.icon, type, userId: cat.userId })
                                  }
                                }
                              }}
                              className={cn(
                                'shrink-0 flex items-center rounded-full py-1.5 px-2.5 transition-colors',
                                isSelected ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400',
                              )}
                            >
                              {Icon
                                ? <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: isSelected ? '#18181b' : color }} strokeWidth={2} />
                                : <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: isSelected ? '#18181b' : color }} />
                              }
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
                                    {cat.name}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </motion.button>
                          )
                        })}
                      </div>
                    )}
                  </form.Field>
                </div>

                {/* Carteira */}
                {wallets.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">Carteira</p>
                    <form.Field name="walletId">
                      {(field) => (
                        <div ref={walletChipsRef} className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {wallets.map((w) => {
                            const isSelected = field.state.value === w.id
                            const isExpanded = expandedWalletId === w.id
                            return (
                              <motion.button
                                layout
                                transition={{ layout: { duration: 0.18, ease: 'easeInOut' } }}
                                key={w.id}
                                type="button"
                                onClick={() => {
                                  field.handleChange(w.id)
                                  setExpandedWalletId(isExpanded ? null : w.id)
                                }}
                                className={cn(
                                  'shrink-0 flex items-center rounded-full py-1.5 px-2.5 transition-colors',
                                  isSelected ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400',
                                )}
                              >
                                <Wallet
                                  className="h-3.5 w-3.5 shrink-0"
                                  style={{ color: isSelected ? '#18181b' : (w.color ?? undefined) }}
                                  strokeWidth={2}
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
                        </div>
                      )}
                    </form.Field>
                  </div>
                )}

                {/* Descrição */}
                <form.Field name="description">
                  {(field) => (
                    <input
                      type="text"
                      placeholder="Descrição (opcional)"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                  )}
                </form.Field>

                {/* Recorrência — só para novas transações */}
                {!isEdit && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setRecurring((r) => !r)}
                      className="flex w-full items-center justify-between rounded-xl bg-zinc-800 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <Repeat2 className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm text-zinc-300">Repetir</span>
                      </div>
                      <div className={cn('h-5 w-9 rounded-full transition-colors', recurring ? 'bg-blue-400' : 'bg-zinc-700')}>
                        <div className={cn('m-0.5 h-4 w-4 rounded-full bg-white transition-transform', recurring ? 'translate-x-4' : 'translate-x-0')} />
                      </div>
                    </button>
                    {recurring && (
                      <div className="flex gap-2">
                        {INTERVALS.map((i) => (
                          <button
                            key={i.value}
                            type="button"
                            onClick={() => setInterval(i.value)}
                            className={cn(
                              'flex-1 rounded-full py-1.5 text-xs font-medium transition-colors',
                              interval === i.value ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400',
                            )}
                          >
                            {i.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {saveMutation.isError && (
                  <p className="text-center text-xs text-red-400">
                    {saveMutation.error instanceof Error ? saveMutation.error.message : 'Erro ao salvar'}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  onClick={() => saveMutation.mutate(form.state.values)}
                  className="w-full rounded-xl bg-blue-400 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Salvar'}
                </button>
              </form>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>

    <CategorySheet
      open={categorySheetOpen}
      category={editingCategory}
      defaultType={type}
      onClose={() => { setCategorySheetOpen(false); setEditingCategory(undefined) }}
    />
    </>
  )
}

