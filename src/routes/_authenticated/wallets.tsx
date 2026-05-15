import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Plus, Wallet, TrendingUp, Banknote, PiggyBank, CreditCard } from 'lucide-react'
import { CATEGORY_ICONS } from '#/lib/category-icons'
import { motion } from 'framer-motion'
import { getUserWallets } from '#/server/services/wallet.service'
import { WalletSheet, type EditableWallet } from '#/components/wallets/wallet-sheet'
import { TransferSheet } from '#/components/wallets/transfer-sheet'
import { PullToRefresh } from '#/components/ui/pull-to-refresh'
import { cn } from '#/lib/utils'
import { fadeUp, stagger } from '#/lib/motion'

export const Route = createFileRoute('/_authenticated/wallets')({
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery({ queryKey: ['wallets'], queryFn: () => getUserWallets() })
  },
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
  const [editing, setEditing] = useState<EditableWallet | undefined>()
  const [transferOpen, setTransferOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: wallets = [], isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => getUserWallets(),
  })

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: ['wallets'] })
  }

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0)

  return (
    <>
      <div className="flex h-full flex-col pt-10">
      <PullToRefresh onRefresh={handleRefresh} className="space-y-6 px-4 flex-1">
      <motion.div
        className="space-y-6"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-zinc-500">Saldo total</p>
            <p className="text-3xl font-bold tabular-nums text-white">
              {formatCurrency(totalBalance)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {wallets.length >= 2 && (
              <button
                onClick={() => setTransferOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 transition-colors active:bg-zinc-700"
              >
                <ArrowLeftRight className="h-4 w-4 text-zinc-300" />
              </button>
            )}
            <button
              onClick={() => setSheetOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 transition-colors active:bg-zinc-700"
            >
              <Plus className="h-5 w-5 text-zinc-300" />
            </button>
          </div>
        </motion.div>

        {/* Lista */}
        {isLoading ? (
          <WalletsSkeleton />
        ) : wallets.length === 0 ? (
          <EmptyState onAdd={() => setSheetOpen(true)} />
        ) : (
          <motion.div variants={stagger} className="space-y-3">
            {wallets.map((wallet) => {
              const meta = WALLET_META[wallet.type as WalletType]
              const Icon = (wallet.icon ? CATEGORY_ICONS[wallet.icon] : null) ?? meta.icon
              return (
                <motion.button
                  key={wallet.id}
                  variants={fadeUp}
                  onClick={() => {
                    setEditing({ id: wallet.id, name: wallet.name, type: wallet.type as WalletType, color: wallet.color, icon: wallet.icon, creditLimit: wallet.creditLimit, closingDay: wallet.closingDay, dueDay: wallet.dueDay })
                    setSheetOpen(true)
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 active:bg-zinc-800/50 transition-colors"
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
                  <div className="flex-1 min-w-0 text-left">
                    <p className="truncate text-sm font-medium text-white">{wallet.name}</p>
                    <p className="text-xs text-zinc-500">{meta.label}</p>
                  </div>
                  <div className="text-right">
                    {wallet.type === 'CREDIT' ? (() => {
                      const invoice = Math.abs(Math.min(wallet.balance, 0))
                      const limit = wallet.creditLimit ?? 0
                      const available = limit > 0 ? limit - invoice : null
                      const pct = limit > 0 ? invoice / limit : 0
                      return (
                        <>
                          <p className={cn('tabular-nums text-sm font-semibold', invoice > 0 ? 'text-red-400' : 'text-white')}>
                            {formatCurrency(invoice)}
                          </p>
                          <p className="text-[10px] text-zinc-600">
                            {available !== null
                              ? `de ${formatCurrency(limit)} · ${Math.round(pct * 100)}%`
                              : 'fatura atual'}
                          </p>
                        </>
                      )
                    })() : (
                      <p className={cn('tabular-nums text-sm font-semibold', wallet.balance >= 0 ? 'text-white' : 'text-red-400')}>
                        {formatCurrency(wallet.balance)}
                      </p>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </motion.div>
      </PullToRefresh>
      </div>

      <WalletSheet
        open={sheetOpen}
        wallet={editing}
        onClose={() => { setSheetOpen(false); setEditing(undefined) }}
      />
      <TransferSheet
        open={transferOpen}
        wallets={wallets}
        onClose={() => setTransferOpen(false)}
      />
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
        <div key={i} className="h-[72px] shimmer rounded-2xl" />
      ))}
    </div>
  )
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
