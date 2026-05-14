import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Drawer } from 'vaul'
import { LogOut } from 'lucide-react'
import { signOut } from '#/lib/auth-client'
import { Avatar } from '#/components/ui/avatar'

interface Props {
  open: boolean
  onClose: () => void
  user: {
    name: string
    email: string
    image?: string | null
  }
}

export function ProfileSheet({ open, onClose, user }: Props) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await signOut()
    await router.invalidate()
    router.navigate({ to: '/login' })
  }

  return (
    <Drawer.Root open={open} onClose={onClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          <div className="px-4 pb-10 pt-6 space-y-6">
            {/* Avatar + info */}
            <div className="flex items-center gap-4">
              <Avatar name={user.name} src={user.image} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{user.name}</p>
                <p className="truncate text-sm text-zinc-500">{user.email}</p>
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-red-400 active:opacity-70 disabled:opacity-50 transition-opacity"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-sm font-medium">
                {loggingOut ? 'Saindo...' : 'Sair da conta'}
              </span>
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
