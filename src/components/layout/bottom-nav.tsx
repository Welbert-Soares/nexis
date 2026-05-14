import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, List, Plus, Target, Wallet } from 'lucide-react'
import { cn } from '#/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { to: '/transactions', icon: List, label: 'Transações' },
  { to: '/wallets', icon: Wallet, label: 'Carteiras' },
  { to: '/goals', icon: Target, label: 'Metas' },
] as const

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
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
        'flex flex-col items-center gap-1 px-4 py-1 text-xs transition-colors',
        active ? 'text-blue-400' : 'text-zinc-500 active:text-zinc-300',
      )}
    >
      <item.icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
      <span>{item.label}</span>
    </Link>
  )
}
