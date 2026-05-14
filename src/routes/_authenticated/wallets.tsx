import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Wallet, TrendingUp, Banknote, PiggyBank, CreditCard } from 'lucide-react'
import { getUserWallets } from '#/server/services/wallet.service'
import { NewWalletSheet } from '#/components/wallets/new-wallet-sheet'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_authenticated/wallets')({
  component: WalletsPage,
})

type WalletType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT'

const WALLET_META: Record<WalletType, { label: string; icon: React.ElementType }> = {
  CHECKING: { label: 'Conta corrente', icon: Wallet },
  SAVINGS:  { label: 'Poupança',       icon: PiggyBank },
  CASH:     { label: 'Dinheiro',       icon: Banknote },
  INVESTMENT:{ label: 'Investimento',  icon: TrendingUp },
  CREDIT:   { label: 'Crédito',        icon: CreditCard },
}

function WalletsPage() {
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data: wallets = [], isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => getUserWallets(),
  })

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0)

  return (
    <>
      <div className="flex h-full flex-col pt-10">
      <div className="space-y-6 px-4 overflow-y-auto flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-zinc-500">Saldo total</p>
            <p className="text-3xl font-bold tabular-nums text-white">
              {formatCurrency(totalBalance)}
            </p>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 transition-colors active:bg-zinc-700"
          >
            <Plus className="h-5 w-5 text-zinc-300" />
          </button>
        </div>

        {/* Lista */}
        {isLoading ? (
          <WalletsSkeleton />
        ) : wallets.length === 0 ? (
          <EmptyState onAdd={() => setSheetOpen(true)} />
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => {
              const meta = WALLET_META[wallet.type as WalletType]
              const Icon = meta.icon
              return (
                <div
                  key={wallet.id}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${wallet.color ?? '#3b82f6'}26` }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: wallet.color ?? '#3b82f6' }}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-white">{wallet.name}</p>
                    <p className="text-xs text-zinc-500">{meta.label}</p>
                  </div>
                  <p
                    className={cn(
                      'tabular-nums text-sm font-semibold',
                      wallet.balance >= 0 ? 'text-white' : 'text-red-400',
                    )}
                  >
                    {formatCurrency(wallet.balance)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </div>

      <NewWalletSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
        <Wallet className="h-6 w-6 text-zinc-500" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-300">Nenhuma carteira ainda</p>
        <p className="text-xs text-zinc-600">Crie uma para começar a registrar transações</p>
      </div>
      <button
        onClick={onAdd}
        className="rounded-full bg-blue-400 px-5 py-2 text-sm font-medium text-white"
      >
        Criar carteira
      </button>
    </div>
  )
}

function WalletsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-zinc-800/50" />
      ))}
    </div>
  )
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
