import { useState, useEffect, useRef } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Trash2 } from 'lucide-react'
import { cn } from '#/lib/utils'
import { useHaptic } from '#/hooks/use-haptic'
import { CATEGORY_ICONS } from '#/lib/category-icons'
import { createUserWallet, editUserWallet, deleteUserWallet } from '#/server/services/wallet.service'
import { CurrencyInput } from '#/components/ui/currency-input'

type WalletType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT'

const WALLET_TYPES: { value: WalletType; label: string }[] = [
  { value: 'CHECKING', label: 'Conta corrente' },
  { value: 'SAVINGS', label: 'Poupança' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'INVESTMENT', label: 'Investimento' },
  { value: 'CREDIT', label: 'Crédito' },
]

const COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#71717a',
]

const ICON_OPTIONS = [
  'Wallet', 'CreditCard', 'Banknote', 'PiggyBank', 'TrendingUp', 'Briefcase',
  'Home', 'ShoppingCart', 'Coffee', 'Car', 'Plane', 'Gift',
  'Smartphone', 'Laptop', 'Zap', 'Heart', 'Star', 'MoreHorizontal',
].filter((name) => CATEGORY_ICONS[name]).map((name) => ({ name, icon: CATEGORY_ICONS[name] }))

export type EditableWallet = {
  id: string
  name: string
  type: WalletType
  color: string | null
  icon?: string | null
  creditLimit?: number | null
  closingDay?: number | null
  dueDay?: number | null
}

interface Props {
  open: boolean
  wallet?: EditableWallet
  onClose: () => void
}

export function WalletSheet({ open, wallet, onClose }: Props) {
  const isEdit = !!wallet
  const queryClient = useQueryClient()
  const haptic = useHaptic()
  const [color, setColor] = useState(wallet?.color ?? COLORS[0])
  const [icon, setIcon] = useState<string | null>(wallet?.icon ?? null)
  const [iconsExpanded, setIconsExpanded] = useState(false)
  const [cents, setCents] = useState(0)
  const [creditLimitCents, setCreditLimitCents] = useState(Math.round((wallet?.creditLimit ?? 0) * 100))
  const [closingDay, setClosingDay] = useState<string>(wallet?.closingDay?.toString() ?? '')
  const [dueDay, setDueDay] = useState<string>(wallet?.dueDay?.toString() ?? '')
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const iconsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (iconsRef.current && !iconsRef.current.contains(e.target as Node)) {
        setIconsExpanded(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [])

  const form = useForm({
    defaultValues: {
      name: wallet?.name ?? '',
      type: (wallet?.type ?? 'CHECKING') as WalletType,
    },
  })

  useEffect(() => {
    if (open) {
      form.setFieldValue('name', wallet?.name ?? '')
      form.setFieldValue('type', (wallet?.type ?? 'CHECKING') as WalletType)
      setColor(wallet?.color ?? COLORS[0])
      setIcon(wallet?.icon ?? null)
      setCents(0)
      setCreditLimitCents(Math.round((wallet?.creditLimit ?? 0) * 100))
      setClosingDay(wallet?.closingDay?.toString() ?? '')
      setDueDay(wallet?.dueDay?.toString() ?? '')
      setSaved(false)
      setConfirmDelete(false)
      setIconsExpanded(false)
    }
  }, [open, wallet?.id])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const creditData = (type: WalletType) => type === 'CREDIT' ? {
    creditLimit: creditLimitCents > 0 ? creditLimitCents / 100 : null,
    closingDay: closingDay ? parseInt(closingDay) : null,
    dueDay: dueDay ? parseInt(dueDay) : null,
  } : { creditLimit: null, closingDay: null, dueDay: null }

  const saveMutation = useMutation({
    mutationFn: (values: { name: string; type: WalletType }) => {
      if (isEdit) {
        return editUserWallet({
          data: { id: wallet!.id, name: values.name, type: values.type, color, icon, ...creditData(values.type) },
        })
      }
      return createUserWallet({
        data: { name: values.name, type: values.type, color, icon: icon ?? undefined, balance: cents / 100, ...creditData(values.type) },
      })
    },
    onSuccess: () => {
      invalidate()
      setSaved(true)
      setTimeout(() => { setSaved(false); handleClose() }, 900)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteUserWallet({ data: { id: wallet!.id } }),
    onSuccess: () => { haptic.success(); invalidate(); handleClose() },
  })

  function handleClose() {
    form.reset()
    setColor(COLORS[0])
    setIcon(null)
    setCents(0)
    setConfirmDelete(false)
    onClose()
  }

  const isBusy = saveMutation.isPending || deleteMutation.isPending || saved

  const isDirty = !isEdit || (
    form.state.values.name !== wallet!.name ||
    form.state.values.type !== wallet!.type ||
    color !== (wallet!.color ?? COLORS[0]) ||
    icon !== (wallet!.icon ?? null)
  )

  return (
    <Drawer.Root open={open} onClose={handleClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={handleClose} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[calc(100dvh-16px)] overflow-hidden rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 pt-4">
            <div className="mb-5 flex items-center justify-between">
              <Drawer.Title className="text-base font-semibold text-white">
                {isEdit ? 'Editar carteira' : 'Nova carteira'}
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
                <p className="text-sm text-zinc-300">Excluir esta carteira?</p>
                <p className="text-xs text-zinc-600">
                  Todas as transações vinculadas serão removidas permanentemente.
                </p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm text-zinc-400"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { haptic.error(); deleteMutation.mutate() }}
                    disabled={deleteMutation.isPending}
                    className="flex-1 rounded-xl bg-red-500/20 py-3 text-sm font-medium text-red-400 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ) : saved ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-7 w-7 text-emerald-400" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-medium text-zinc-300">
                  {isEdit ? 'Carteira atualizada' : 'Carteira criada'}
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
                className="space-y-5"
              >
                {/* Nome */}
                <form.Field name="name">
                  {(field) => (
                    <input
                      type="text"
                      placeholder="Nome da carteira"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      autoFocus={!isEdit}
                      className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                  )}
                </form.Field>

                {/* Saldo inicial — só na criação */}
                {!isEdit && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">Saldo inicial</p>
                    <CurrencyInput cents={cents} onChange={setCents} />
                  </div>
                )}

                {/* Tipo */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Tipo</p>
                  <form.Field name="type">
                    {(field) => (
                      <div className="flex flex-wrap gap-2">
                        {WALLET_TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => field.handleChange(t.value)}
                            className={cn(
                              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                              field.state.value === t.value
                                ? 'bg-zinc-100 text-zinc-900'
                                : 'bg-zinc-800 text-zinc-400',
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </form.Field>
                </div>

                {/* Campos de crédito */}
                <form.Subscribe selector={(s) => s.values.type}>
                  {(type) => type === 'CREDIT' && (
                    <div className="space-y-3 rounded-xl bg-zinc-800/50 p-4">
                      <p className="text-xs font-medium text-zinc-400">Configurações do cartão</p>
                      <div className="space-y-1.5">
                        <p className="text-xs text-zinc-500">Limite</p>
                        <CurrencyInput cents={creditLimitCents} onChange={setCreditLimitCents} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-xs text-zinc-500">Fechamento (dia)</p>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            placeholder="ex: 5"
                            value={closingDay}
                            onChange={(e) => setClosingDay(e.target.value)}
                            className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs text-zinc-500">Vencimento (dia)</p>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            placeholder="ex: 15"
                            value={dueDay}
                            onChange={(e) => setDueDay(e.target.value)}
                            className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </form.Subscribe>

                {/* Ícone */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Ícone</p>
                  <div ref={iconsRef} className="relative">
                    <div
                      className={cn('grid grid-cols-6 gap-2', !iconsExpanded && 'cursor-pointer')}
                      onClick={() => !iconsExpanded && setIconsExpanded(true)}
                    >
                      {ICON_OPTIONS.slice(0, 12).map((opt) => {
                        const isSelected = icon === opt.name
                        return (
                          <button
                            key={opt.name}
                            type="button"
                            onClick={() => {
                              if (!iconsExpanded) { setIconsExpanded(true); return }
                              setIcon(isSelected ? null : opt.name)
                              setIconsExpanded(false)
                            }}
                            className="flex h-10 w-full items-center justify-center rounded-xl transition-colors"
                            style={{
                              backgroundColor: isSelected ? `${color}26` : '#27272a',
                              border: `2px solid ${isSelected ? color : 'transparent'}`,
                            }}
                          >
                            <opt.icon className="h-4 w-4" style={{ color: isSelected ? color : '#71717a' }} strokeWidth={1.75} />
                          </button>
                        )
                      })}
                    </div>

                    <AnimatePresence>
                      {iconsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-6 gap-2 pt-2">
                            {ICON_OPTIONS.slice(12).map((opt) => {
                              const isSelected = icon === opt.name
                              return (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onClick={() => {
                                    if (!iconsExpanded) { setIconsExpanded(true); return }
                                    setIcon(isSelected ? null : opt.name)
                                    setIconsExpanded(false)
                                  }}
                                  className="flex h-10 w-full items-center justify-center rounded-xl transition-colors"
                                  style={{
                                    backgroundColor: isSelected ? `${color}26` : '#27272a',
                                    border: `2px solid ${isSelected ? color : 'transparent'}`,
                                  }}
                                >
                                  <opt.icon className="h-4 w-4" style={{ color: isSelected ? color : '#71717a' }} strokeWidth={1.75} />
                                </button>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {!iconsExpanded && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-900 to-transparent"
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Cor */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Cor</p>
                  <div className="flex gap-3">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={cn(
                          'h-7 w-7 rounded-full transition-transform',
                          color === c && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {saveMutation.isError && (
                  <p className="text-center text-xs text-red-400">
                    {saveMutation.error instanceof Error ? saveMutation.error.message : 'Erro ao salvar'}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isBusy || !isDirty}
                  onClick={() => saveMutation.mutate(form.state.values)}
                  className="w-full rounded-xl bg-blue-400 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                >
                  {saveMutation.isPending
                    ? 'Salvando...'
                    : isEdit ? 'Salvar alterações' : 'Criar carteira'}
                </button>
              </form>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
