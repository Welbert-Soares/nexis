import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Drawer } from 'vaul'
import { Check, Trash2, Wallet } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '#/lib/utils'
import { getUserWallets } from '#/server/services/wallet.service'
import { getCategories } from '#/server/services/category.service'
import { addTransaction, editTransaction, removeTransaction } from '#/server/services/transaction.service'
import { CurrencyInput } from '#/components/ui/currency-input'

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

      return addTransaction({
        data: { type, amount, walletId, categoryId: values.categoryId || undefined, description: values.description || undefined, date },
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
    onClose?.()
    navigate({ to: '/transactions' })
  }

  const hasWallets = wallets.length > 0
  const isBusy = saveMutation.isPending || deleteMutation.isPending || saved
  const canSubmit = hasWallets && !isBusy

  return (
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
                      onClick={() => { setType(t); form.setFieldValue('categoryId', '') }}
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
                  <p className="text-xs text-zinc-500">Categoria</p>
                  <form.Field name="categoryId">
                    {(field) => (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {categories.map((cat: { id: string; name: string }) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => field.handleChange(field.state.value === cat.id ? '' : cat.id)}
                            className={cn(
                              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                              field.state.value === cat.id
                                ? 'bg-zinc-100 text-zinc-900'
                                : 'bg-zinc-800 text-zinc-400',
                            )}
                          >
                            {cat.name}
                          </button>
                        ))}
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
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {wallets.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => field.handleChange(w.id)}
                              className={cn(
                                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                field.state.value === w.id
                                  ? 'bg-zinc-100 text-zinc-900'
                                  : 'bg-zinc-800 text-zinc-400',
                              )}
                            >
                              {w.name}
                            </button>
                          ))}
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
  )
}

