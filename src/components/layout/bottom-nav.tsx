import { Link, useRouterState } from '@tanstack/react-router'
import { BarChart2, LayoutDashboard, List, Plus, Wallet } from 'lucide-react'
import { cn } from '#/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { to: '/transactions', icon: List, label: 'Transações' },
  { to: '/wallets', icon: Wallet, label: 'Carteiras' },
  { to: '/analytics', icon: BarChart2, label: 'Análise' },
] as const

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center justify-around px-2">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavLink key={item.to} item={item} active={pathname === item.to} />
        ))}

        <Link
          to="/transactions"
          search={{ action: 'new' }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-400 transition-colors active:bg-blue-500"
          aria-label="Nova transação"
        >
          <Plus className="h-6 w-6 text-white" strokeWidth={2} />
        </Link>

        {NAV_ITEMS.slice(2).map((item) => (
          <NavLink key={item.to} item={item} active={pathname === item.to} />
        ))}
      </div>
    </nav>
  )
}

function NavLink({
  item,
  active,
}: {
  item: (typeof NAV_ITEMS)[number]
  active: boolean
}) {
  return (
    <Link
      to={item.to}
      className={cn(
        'flex flex-col items-center gap-1 px-4 py-1 text-xs transition-all active:scale-90 active:opacity-70',
        active ? 'text-white' : 'text-zinc-600',
      )}
    >
      <div className={cn(
        'flex items-center justify-center rounded-full transition-all',
        active ? 'bg-zinc-800 px-3 py-1' : 'px-3 py-1',
      )}>
        <item.icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
      </div>
      <span className={cn(active ? 'font-medium' : '')}>{item.label}</span>
    </Link>
  )
}
