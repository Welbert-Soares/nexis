import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import { ArrowRight, Check } from 'lucide-react'
import { transferUserWallets } from '#/server/services/wallet.service'
import { CurrencyInput } from '#/components/ui/currency-input'

type Wallet = { id: string; name: string; color: string | null; balance: number }

interface Props {
  open: boolean
  wallets: Wallet[]
  onClose: () => void
}

export function TransferSheet({ open, wallets, onClose }: Props) {
  const queryClient = useQueryClient()
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [cents, setCents] = useState(0)
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      transferUserWallets({
        data: { fromWalletId: fromId, toWalletId: toId, amount: cents / 100 },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setSaved(true)
      setTimeout(() => { setSaved(false); handleClose() }, 900)
    },
  })

  function handleClose() {
    setFromId('')
    setToId('')
    setCents(0)
    setSaved(false)
    onClose()
  }

  const fromWallet = wallets.find((w) => w.id === fromId)
  const amount = cents / 100
  const insufficientFunds = !!fromWallet && amount > fromWallet.balance
  const canSubmit = fromId && toId && fromId !== toId && cents > 0 && !insufficientFunds

  return (
    <Drawer.Root open={open} onClose={handleClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={handleClose} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 top-4 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
            <Drawer.Title className="mb-5 text-base font-semibold text-white">Transferir</Drawer.Title>

            {saved ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-7 w-7 text-emerald-400" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-medium text-zinc-300">Transferência realizada</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* De → Para */}
                <div className="flex items-center gap-2">
                  <WalletSelect
                    label="De"
                    value={fromId}
                    onChange={setFromId}
                    wallets={wallets}
                    exclude={toId}
                  />
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
                  <WalletSelect
                    label="Para"
                    value={toId}
                    onChange={setToId}
                    wallets={wallets}
                    exclude={fromId}
                  />
                </div>

                {/* Saldo disponível */}
                {fromWallet && (
                  <p className="text-xs text-zinc-500">
                    Disponível: <span className="tabular-nums text-zinc-300">{fmt(fromWallet.balance)}</span>
                  </p>
                )}

                {/* Valor */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Valor</p>
                  <CurrencyInput cents={cents} onChange={setCents} error={insufficientFunds} />
                </div>

                {mutation.isError && (
                  <p className="text-center text-xs text-red-400">
                    {mutation.error instanceof Error ? mutation.error.message : 'Erro ao transferir'}
                  </p>
                )}

                <button
                  onClick={() => mutation.mutate()}
                  disabled={!canSubmit || mutation.isPending}
                  className="w-full rounded-xl bg-blue-400 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                >
                  {mutation.isPending ? 'Transferindo...' : 'Transferir'}
                </button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function WalletSelect({
  label, value, onChange, wallets, exclude,
}: {
  label: string
  value: string
  onChange: (id: string) => void
  wallets: Wallet[]
  exclude: string
}) {
  const available = wallets.filter((w) => w.id !== exclude)

  return (
    <div className="flex-1 space-y-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl bg-zinc-800 px-3 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-600"
      >
        <option value="" disabled>Selecionar</option>
        {available.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
    </div>
  )
}
