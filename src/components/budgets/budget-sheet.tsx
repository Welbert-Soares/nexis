import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import { Check, Trash2 } from 'lucide-react'
import { cn } from '#/lib/utils'
import { getCategories } from '#/server/services/category.service'
import { saveBudget, removeBudget } from '#/server/services/budget.service'
import { CurrencyInput } from '#/components/ui/currency-input'

export type EditableBudget = {
  id: string
  categoryId: string
  limit: number
}

interface Props {
  open: boolean
  budget?: EditableBudget
  month: number
  year: number
  onClose: () => void
}

export function BudgetSheet({ open, budget, month, year, onClose }: Props) {
  const isEdit = !!budget
  const queryClient = useQueryClient()
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? '')
  const [cents, setCents] = useState(() => Math.round((budget?.limit ?? 0) * 100))
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => getCategories({ data: { type: 'EXPENSE' } }),
  })

  useEffect(() => {
    if (open) {
      setCategoryId(budget?.categoryId ?? '')
      setCents(Math.round((budget?.limit ?? 0) * 100))
      setSaved(false)
      setConfirmDelete(false)
    }
  }, [open, budget])

  const saveMutation = useMutation({
    mutationFn: () => saveBudget({ data: { categoryId, month, year, amount: cents / 100 } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      setSaved(true)
      setTimeout(onClose, 900)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => removeBudget({ data: { id: budget!.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      onClose()
    },
  })

  const canSave = categoryId && cents > 0 && !saveMutation.isPending && !saved

  return (
    <Drawer.Root open={open} onClose={onClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 top-4 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4">
            <div className="mb-5 flex items-center justify-between">
              <Drawer.Title className="text-base font-semibold text-white">
                {isEdit ? 'Editar orçamento' : 'Novo orçamento'}
              </Drawer.Title>
              {isEdit && !saved && (
                <button type="button" onClick={() => setConfirmDelete(true)} className="p-1 text-zinc-600 active:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {confirmDelete ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm text-zinc-300">Remover este orçamento?</p>
                <div className="flex w-full gap-3">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm text-zinc-400">Cancelar</button>
                  <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="flex-1 rounded-xl bg-red-500/20 py-3 text-sm font-medium text-red-400 disabled:opacity-50">
                    {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
                  </button>
                </div>
              </div>
            ) : saved ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-7 w-7 text-emerald-400" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-medium text-zinc-300">{isEdit ? 'Orçamento atualizado' : 'Orçamento criado'}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Limite */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Limite mensal</p>
                  <CurrencyInput cents={cents} onChange={setCents} autoFocus />
                </div>

                {/* Categoria */}
                {!isEdit && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">Categoria</p>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryId(cat.id)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                            categoryId === cat.id ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400',
                          )}
                        >
                          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: categoryId === cat.id ? '#18181b' : (cat.color ?? '#71717a') }} />
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!canSave}
                  className="w-full rounded-2xl bg-zinc-100 py-3.5 text-sm font-semibold text-zinc-900 disabled:opacity-40 transition-opacity"
                >
                  {saveMutation.isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar orçamento'}
                </button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
