import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import { cn } from '#/lib/utils'
import { createUserWallet } from '#/server/services/wallet.service'
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

interface Props {
  open: boolean
  onClose: () => void
}

export function NewWalletSheet({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [selectedColor, setSelectedColor] = useState(COLORS[0])
  const [cents, setCents] = useState(0)

  const form = useForm({
    defaultValues: { name: '', type: 'CHECKING' as WalletType },
  })

  const mutation = useMutation({
    mutationFn: (values: { name: string; type: WalletType }) =>
      createUserWallet({ data: { ...values, color: selectedColor, balance: cents / 100 } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      form.reset()
      setSelectedColor(COLORS[0])
      setCents(0)
      onClose()
    },
  })

  return (
    <Drawer.Root open={open} onClose={onClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          <div className="px-4 pb-8 pt-4">
            <h2 className="mb-5 text-base font-semibold text-white">Nova carteira</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
              }}
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
                    className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
                    autoFocus
                  />
                )}
              </form.Field>

              {/* Saldo inicial */}
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">Saldo inicial</p>
                <CurrencyInput cents={cents} onChange={setCents} />
              </div>

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

              {/* Cor */}
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">Cor</p>
                <div className="flex gap-3">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        'h-7 w-7 rounded-full transition-transform',
                        selectedColor === color && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900',
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    name: form.getFieldValue('name'),
                    type: form.getFieldValue('type') as WalletType,
                  })
                }
                className="w-full rounded-xl bg-blue-400 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {mutation.isPending ? 'Criando...' : 'Criar carteira'}
              </button>
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
