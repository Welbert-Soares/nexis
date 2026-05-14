import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import { Check, Trash2 } from 'lucide-react'
import { cn } from '#/lib/utils'
import { addCategory, editCategory, removeCategory } from '#/server/services/category.service'

export type EditableCategory = {
  id: string
  name: string
  color: string
  type: 'INCOME' | 'EXPENSE'
  userId: string | null
}

interface Props {
  open: boolean
  category?: EditableCategory
  defaultType?: 'INCOME' | 'EXPENSE'
  onClose: () => void
}

const COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#71717a',
  '#f97316', '#10b981', '#6366f1', '#84cc16',
]

export function CategorySheet({ open, category, defaultType = 'EXPENSE', onClose }: Props) {
  const isEdit = !!category
  const isGlobal = isEdit && !category.userId
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? COLORS[0])
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(category?.type ?? defaultType)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '')
      setColor(category?.color ?? COLORS[0])
      setType(category?.type ?? defaultType)
      setSaved(false)
      setConfirmDelete(false)
    }
  }, [open, category, defaultType])

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? editCategory({ data: { id: category.id, name, color } })
        : addCategory({ data: { name, color, type } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setSaved(true)
      setTimeout(onClose, 900)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => removeCategory({ data: { id: category!.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      onClose()
    },
  })

  const canSave = name.trim().length > 0 && !saveMutation.isPending && !saved

  return (
    <Drawer.Root open={open} onClose={onClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          <div className="overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4">
            <div className="mb-5 flex items-center justify-between">
              <Drawer.Title className="text-base font-semibold text-white">
                {isEdit ? 'Editar categoria' : 'Nova categoria'}
              </Drawer.Title>
              {isEdit && !isGlobal && !saved && (
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
                <p className="text-sm text-zinc-300">Excluir esta categoria?</p>
                <p className="text-xs text-zinc-600">Transações vinculadas perderão a categoria.</p>
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
            ) : saved ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-7 w-7 text-emerald-400" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-medium text-zinc-300">
                  {isEdit ? 'Categoria atualizada' : 'Categoria criada'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Tipo — só para criar */}
                {!isEdit && (
                  <div className="flex rounded-xl bg-zinc-800 p-1">
                    {(['EXPENSE', 'INCOME'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
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
                )}

                {/* Nome */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Nome</p>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Academia, Streaming..."
                    className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                </div>

                {/* Cor */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Cor</p>
                  <div className="grid grid-cols-6 gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="flex h-9 w-full items-center justify-center rounded-xl transition-transform active:scale-90"
                        style={{ backgroundColor: `${c}26`, border: `2px solid ${color === c ? c : 'transparent'}` }}
                      >
                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 rounded-xl bg-zinc-800/50 px-4 py-3">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm text-zinc-300">{name || 'Prévia da categoria'}</span>
                </div>

                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!canSave}
                  className="w-full rounded-2xl bg-zinc-100 py-3.5 text-sm font-semibold text-zinc-900 disabled:opacity-40 transition-opacity"
                >
                  {saveMutation.isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar categoria'}
                </button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
