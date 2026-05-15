import { useState, useRef, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import { LogOut, Plus, Tag, ChevronLeft, Bell, BellOff, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '#/lib/utils'
import { signOut } from '#/lib/auth-client'
import { Avatar } from '#/components/ui/avatar'
import { CATEGORY_ICONS } from '#/lib/category-icons'
import { getCategoriesManagement, removeCategory } from '#/server/services/category.service'
import { CategorySheet, type EditableCategory } from '#/components/categories/category-sheet'
import { usePushNotifications } from '#/hooks/use-push-notifications'
import { useInstallPrompt } from '#/hooks/use-install-prompt'
import { useHaptic } from '#/hooks/use-haptic'

interface Props {
  open: boolean
  onClose: () => void
  user: {
    name: string
    email: string
    image?: string | null
  }
}

type CatType = 'EXPENSE' | 'INCOME'
type Cat = Awaited<ReturnType<typeof getCategoriesManagement>>[0]

export function ProfileSheet({ open, onClose, user }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loggingOut, setLoggingOut] = useState(false)
  const [catType, setCatType] = useState<CatType>('EXPENSE')
  const [catOpen, setCatOpen] = useState(false)
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<Cat | null>(null)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<EditableCategory | undefined>()
  const catChipsRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (catChipsRef.current && !catChipsRef.current.contains(e.target as Node)) {
        setExpandedCatId(null)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [])

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories-management'],
    queryFn: () => getCategoriesManagement(),
    enabled: open,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeCategory({ data: { id } }),
    onSuccess: () => {
      setConfirmingDelete(null)
      queryClient.invalidateQueries({ queryKey: ['categories-management'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  async function handleLogout() {
    setLoggingOut(true)
    await signOut()
    await router.invalidate()
    router.navigate({ to: '/login' })
  }

  function openEdit(cat: Cat) {
    setExpandedCatId(null)
    setEditingCategory({
      id: cat.id,
      name: cat.name,
      color: cat.color ?? '#71717a',
      icon: cat.icon,
      type: cat.type,
      userId: cat.userId,
    })
    setCategorySheetOpen(true)
  }

  function startLongPress(cat: Cat) {
    if (!cat.userId) return
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setExpandedCatId(null)
      setConfirmingDelete(cat)
    }, 500)
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleChipClick(cat: Cat, isExpanded: boolean) {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    if (isExpanded) {
      if (!cat.userId) { setExpandedCatId(null); return }
      openEdit(cat)
    } else {
      setExpandedCatId(cat.id)
    }
  }

  const filtered = allCategories.filter((c) => c.type === catType)
  const { supported: notifSupported, permission, subscribed, loading: notifLoading, subscribe, unsubscribe } = usePushNotifications()
  const { showPrompt: canInstall, isIOS, install } = useInstallPrompt()
  const haptic = useHaptic()

  return (
    <>
      <Drawer.Root open={open} onClose={onClose}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl bg-zinc-900 outline-none">
            <Drawer.Title className="sr-only">Perfil</Drawer.Title>
            <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-zinc-700" />

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-6 space-y-6">
              {/* Avatar + info */}
              <div className="flex items-center gap-4">
                <Avatar name={user.name} src={user.image} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{user.name}</p>
                  <p className="truncate text-sm text-zinc-500">{user.email}</p>
                </div>
              </div>

              <div className="h-px bg-zinc-800" />

              {/* Categorias — acordeão */}
              <div>
                <button
                  onClick={() => { setCatOpen((o) => !o); setExpandedCatId(null) }}
                  className="flex w-full items-center gap-2"
                >
                  <Tag className={cn('h-4 w-4 transition-colors', catOpen ? 'text-white' : 'text-zinc-500')} strokeWidth={1.5} />
                  <span className={cn('flex-1 text-left text-sm font-medium transition-colors', catOpen ? 'text-white' : 'text-zinc-500')}>
                    Categorias
                  </span>
                  <motion.span
                    animate={{ rotate: catOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-600"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 -rotate-90" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {catOpen && (
                    <motion.div
                      key="cat-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-4">
                        {/* Toggle tipo */}
                        <div className="flex rounded-xl bg-zinc-800 p-1">
                          {(['EXPENSE', 'INCOME'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => { setCatType(t); setExpandedCatId(null) }}
                              className={cn(
                                'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                                catType === t
                                  ? t === 'EXPENSE' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                                  : 'text-zinc-500',
                              )}
                            >
                              {t === 'EXPENSE' ? 'Despesas' : 'Receitas'}
                            </button>
                          ))}
                        </div>

                        {/* Chips */}
                        {filtered.length === 0 ? (
                          <p className="py-2 text-center text-xs text-zinc-600">Nenhuma categoria</p>
                        ) : (
                          <div ref={catChipsRef} className="flex flex-wrap gap-2">
                            {filtered.map((cat) => {
                              const color = cat.color ?? '#71717a'
                              const Icon = cat.icon ? CATEGORY_ICONS[cat.icon] : null
                              const isExpanded = expandedCatId === cat.id

                              return (
                                <motion.button
                                  layout
                                  transition={{ layout: { duration: 0.18, ease: 'easeInOut' } }}
                                  key={cat.id}
                                  type="button"
                                  onClick={() => handleChipClick(cat, isExpanded)}
                                  onPointerDown={() => startLongPress(cat)}
                                  onPointerUp={cancelLongPress}
                                  onPointerLeave={cancelLongPress}
                                  onPointerCancel={cancelLongPress}
                                  className="flex select-none items-center rounded-full py-1.5 px-2.5 bg-zinc-800/60 transition-colors active:bg-zinc-700/60"
                                >
                                  {Icon
                                    ? <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} strokeWidth={1.75} />
                                    : <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                  }
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.span
                                        key="label"
                                        initial={{ maxWidth: 0, opacity: 0 }}
                                        animate={{ maxWidth: 200, opacity: 1 }}
                                        exit={{ maxWidth: 0, opacity: 0 }}
                                        transition={{ duration: 0.18, ease: 'easeInOut' }}
                                        className="ml-1.5 overflow-hidden whitespace-nowrap text-xs font-medium text-white"
                                      >
                                        {cat.name}
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </motion.button>
                              )
                            })}
                          </div>
                        )}

                        <p className="text-center text-xs text-zinc-700">
                          toque para ver · toque expandido para editar · segure para excluir
                        </p>

                        {/* Nova categoria */}
                        <button
                          onClick={() => { setEditingCategory(undefined); setCategorySheetOpen(true) }}
                          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-3 py-2.5 text-xs text-zinc-600 active:text-zinc-400 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Nova categoria
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-px bg-zinc-800" />

              {/* Instalar app — Android */}
              {canInstall && !isIOS && (
                <button
                  onClick={() => { haptic.success(); install() }}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2 active:opacity-70 transition-opacity"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                    <Download className="h-4 w-4 text-blue-400" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-medium text-white">Instalar app</p>
                    <p className="text-xs text-zinc-500">Adicionar à tela inicial</p>
                  </div>
                </button>
              )}

              {(canInstall && !isIOS) && <div className="h-px bg-zinc-800" />}

              {/* Notificações */}
              {notifSupported && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                    {subscribed
                      ? <Bell className="h-4 w-4 text-blue-400" strokeWidth={1.5} />
                      : <BellOff className="h-4 w-4 text-zinc-500" strokeWidth={1.5} />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">Notificações</p>
                    <p className="text-xs text-zinc-500">
                      {permission === 'denied'
                        ? 'Bloqueadas nas configurações do navegador'
                        : subscribed
                        ? 'Ativas'
                        : 'Desativadas'}
                    </p>
                  </div>
                  {permission !== 'denied' && (
                    <button
                      onClick={() => subscribed ? unsubscribe() : subscribe()}
                      disabled={notifLoading}
                      className={cn(
                        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
                        subscribed ? 'bg-blue-500' : 'bg-zinc-700',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                          subscribed ? 'left-[calc(100%-1.375rem)]' : 'left-0.5',
                        )}
                      />
                    </button>
                  )}
                </div>
              )}

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

      {/* Modal de confirmação de exclusão */}
      <Drawer.Root open={!!confirmingDelete} onClose={() => setConfirmingDelete(null)}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" onClick={() => setConfirmingDelete(null)} />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />
            <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
              {confirmingDelete && (() => {
                const color = confirmingDelete.color ?? '#71717a'
                const Icon = confirmingDelete.icon ? CATEGORY_ICONS[confirmingDelete.icon] : null
                return (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}20` }}>
                      {Icon
                        ? <Icon className="h-6 w-6" style={{ color }} strokeWidth={1.75} />
                        : <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                      }
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">Excluir "{confirmingDelete.name}"?</p>
                      <p className="text-xs text-zinc-500">Transações vinculadas perderão a categoria.</p>
                    </div>
                  </>
                )
              })()}
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setConfirmingDelete(null)}
                  className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm text-zinc-400"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmingDelete && deleteMutation.mutate(confirmingDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 rounded-xl bg-red-500/20 py-3 text-sm font-medium text-red-400 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <CategorySheet
        open={categorySheetOpen}
        category={editingCategory}
        defaultType={catType}
        onClose={() => {
          setCategorySheetOpen(false)
          setEditingCategory(undefined)
          queryClient.invalidateQueries({ queryKey: ['categories-management'] })
        }}
      />
    </>
  )
}
