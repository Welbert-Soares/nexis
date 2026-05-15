import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingDown, TrendingUp, Wallet, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { getDashboard } from '#/server/services/dashboard.service'
import { cn } from '#/lib/utils'
import { fadeUp, stagger, scaleIn } from '#/lib/motion'
import { ProfileSheet } from '#/components/profile/profile-sheet'
import { Avatar } from '#/components/ui/avatar'
import { PullToRefresh } from '#/components/ui/pull-to-refresh'
import { CATEGORY_ICONS } from '#/lib/category-icons'


export const Route = createFileRoute('/_authenticated/dashboard')({
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard() })
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { session } = Route.useRouteContext()
  const firstName = session.user.name.split(' ')[0]
  const [profileOpen, setProfileOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(),
  })

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return (
    <div className="h-full">
      <PullToRefresh onRefresh={handleRefresh} className="h-full overflow-y-auto">
      <motion.div
        className="space-y-6 px-4 pt-10 pb-4"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.header variants={fadeUp} className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-zinc-500">Olá, {firstName}</p>
            {isLoading ? (
              <div className="h-10 w-40 animate-pulse rounded-lg bg-zinc-800" />
            ) : (
              <h1 className="text-4xl font-bold tabular-nums text-white">
                {fmt(data?.totalBalance ?? 0)}
              </h1>
            )}
            <p className="text-xs text-zinc-600">Saldo total · todas as carteiras</p>
          </div>

          <button
            onClick={() => setProfileOpen(true)}
            className="shrink-0 active:opacity-70 transition-opacity"
          >
            <Avatar name={session.user.name} src={session.user.image} size="sm" />
          </button>
        </motion.header>

        <ProfileSheet
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={session.user}
        />

        {/* Onboarding — sem carteiras */}
        {!isLoading && !data?.hasWallets && (
          <motion.section variants={fadeUp}>
            <OnboardingCard />
          </motion.section>
        )}

        {/* Resumo mensal */}
        {(isLoading || data?.hasWallets) && (
          <motion.section variants={fadeUp} className="grid grid-cols-2 gap-3">
            <SummaryCard
              label="Receitas"
              value={data?.monthly.income ?? 0}
              icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
              color="text-emerald-400"
              loading={isLoading}
            />
            <SummaryCard
              label="Despesas"
              value={data?.monthly.expenses ?? 0}
              icon={<TrendingDown className="h-4 w-4 text-red-400" />}
              color="text-red-400"
              loading={isLoading}
            />
          </motion.section>
        )}

        {/* Transações recentes */}
        {(isLoading || data?.hasWallets) && (
          <motion.section variants={fadeUp} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-600">
                Recentes
              </h2>
              <Link to="/transactions" className="text-xs text-zinc-500 active:text-zinc-300">
                Ver todas
              </Link>
            </div>

            {isLoading ? (
              <TransactionsSkeleton />
            ) : !data?.recent.length ? (
              <EmptyTransactions />
            ) : (
              <motion.div variants={stagger} className="space-y-1">
                {data.recent.map((t) => (
                  <motion.div key={t.id} variants={scaleIn}>
                    <TransactionRow transaction={t} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.section>
        )}
      </motion.div>
      </PullToRefresh>
    </div>
  )
}

function SummaryCard({
  label, value, icon, color, loading,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      {loading ? (
        <div className="h-6 w-24 animate-pulse rounded bg-zinc-800" />
      ) : (
        <p className={cn('text-lg font-semibold tabular-nums', color)}>{fmt(value)}</p>
      )}
    </div>
  )
}

type Transaction = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  description: string | null
  date: Date
  category: { name: string; color: string | null; icon: string | null } | null
  wallet: { name: string; color: string | null }
}

function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  const isExpense = t.type === 'EXPENSE'
  const label = t.description ?? t.category?.name ?? 'Sem descrição'
  const color = t.category?.color ?? t.wallet.color ?? '#71717a'
  const CategoryIcon = t.category?.icon ? CATEGORY_ICONS[t.category.icon] : null

  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}20` }}
      >
        {CategoryIcon
          ? <CategoryIcon className="h-4 w-4" style={{ color }} />
          : <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-white">{label}</p>
        <p className="text-xs text-zinc-600">
          {t.wallet.name} · {fmtDate(new Date(t.date))}
        </p>
      </div>
      <p className={cn('tabular-nums text-sm font-medium shrink-0', isExpense ? 'text-red-400' : 'text-emerald-400')}>
        {isExpense ? '-' : '+'}{fmt(t.amount)}
      </p>
    </div>
  )
}

function OnboardingCard() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-400/10">
            <Wallet className="h-5 w-5 text-blue-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Bem-vindo ao Nexis</p>
            <p className="text-xs text-zinc-500">Comece criando sua primeira carteira</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Crie uma carteira (conta corrente, dinheiro...)' },
            { step: '2', text: 'Registre suas receitas e despesas' },
            { step: '3', text: 'Acompanhe seu saldo em tempo real' },
          ].map((s) => (
            <div key={s.step} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                {s.step}
              </span>
              <p className="text-xs text-zinc-500">{s.text}</p>
            </div>
          ))}
        </div>
        <Link
          to="/wallets"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-400 py-3 text-sm font-semibold text-white active:bg-blue-500 transition-colors"
        >
          Criar carteira
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

function EmptyTransactions() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 py-10 text-center">
      <p className="text-sm text-zinc-500">Nenhuma transação ainda</p>
      <p className="text-xs text-zinc-700">Toque em + para adicionar</p>
    </div>
  )
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
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


function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(date: Date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
