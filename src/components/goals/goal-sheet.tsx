import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import { Check, Trash2 } from 'lucide-react'
import { cn } from '#/lib/utils'
import { createUserGoal, updateUserGoal, deleteUserGoal } from '#/server/services/goal.service'
import { CurrencyInput } from '#/components/ui/currency-input'

export type EditableGoal = {
  id: string
  name: string
  targetAmount: number
  currentAmount: number  // computed, display only
  deadline: Date | null
  color: string | null
}

interface Props {
  open: boolean
  goal?: EditableGoal
  onClose: () => void
}

const COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#71717a',
]

function toDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function GoalSheet({ open, goal, onClose }: Props) {
  const isEdit = !!goal
  const queryClient = useQueryClient()
  const [targetCents, setTargetCents] = useState(() => Math.round((goal?.targetAmount ?? 0) * 100))
  const [seedCents, setSeedCents] = useState(0)
  const [color, setColor] = useState(goal?.color ?? COLORS[0])
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm({
    defaultValues: {
      name: goal?.name ?? '',
      deadline: goal?.deadline ? toDateInput(new Date(goal.deadline)) : '',
    },
  })

  useEffect(() => {
    if (goal) {
      setTargetCents(Math.round(goal.targetAmount * 100))
      setColor(goal.color ?? COLORS[0])
      form.setFieldValue('name', goal.name)
      form.setFieldValue('deadline', goal.deadline ? toDateInput(new Date(goal.deadline)) : '')
    }
  }, [goal?.id])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['goals'] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: { name: string; deadline: string }) => {
      const targetAmount = targetCents / 100
      if (!targetAmount) throw new Error('Defina um valor da meta')
      if (!values.name.trim()) throw new Error('Dê um nome para a meta')
      const deadline = values.deadline ? new Date(values.deadline + 'T12:00:00') : null

      if (isEdit) {
        return updateUserGoal({
          data: { id: goal!.id, name: values.name, targetAmount, deadline, color },
        })
      }

      return createUserGoal({
        data: {
          name: values.name,
          targetAmount,
          seedAmount: seedCents / 100 || undefined,
          deadline,
          color,
        },
      })
    },
    onSuccess: () => {
      invalidate()
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        handleClose()
      }, 900)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteUserGoal({ data: { id: goal!.id } }),
    onSuccess: () => {
      invalidate()
      handleClose()
    },
  })

  function handleClose() {
    form.reset()
    setTargetCents(0)
    setSeedCents(0)
    setColor(COLORS[0])
    setConfirmDelete(false)
    onClose()
  }

  const isBusy = saveMutation.isPending || deleteMutation.isPending || saved

  return (
    <Drawer.Root open={open} onClose={handleClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={handleClose} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 top-4 z-50 flex flex-col rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
            <div className="mb-5 flex items-center justify-between">
              <Drawer.Title className="text-base font-semibold text-white">
                {isEdit ? 'Editar meta' : 'Nova meta'}
              </Drawer.Title>
              {isEdit && !saved && (
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
                <p className="text-sm text-zinc-300">Excluir esta meta?</p>
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
                  {isEdit ? 'Meta atualizada' : 'Meta criada'}
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
                className="space-y-5"
              >
                {/* Nome */}
                <form.Field name="name">
                  {(field) => (
                    <input
                      type="text"
                      placeholder="Nome da meta"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      autoFocus={!isEdit}
                      className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                  )}
                </form.Field>

                {/* Valor da meta */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Valor da meta</p>
                  <CurrencyInput cents={targetCents} onChange={setTargetCents} />
                </div>

                {/* Já guardei — só na criação */}
                {!isEdit && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">Já guardei (opcional)</p>
                    <CurrencyInput cents={seedCents} onChange={setSeedCents} />
                  </div>
                )}

                {/* Prazo */}
                <form.Field name="deadline">
                  {(field) => (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500">Prazo (opcional)</p>
                      <input
                        type="date"
                        value={field.state.value}
                        min={toDateInput(new Date())}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="w-full max-w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-600 [color-scheme:dark] [appearance:none]"
                      />
                    </div>
                  )}
                </form.Field>

                {/* Cor */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Cor</p>
                  <div className="flex gap-3">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={cn(
                          'h-7 w-7 rounded-full transition-transform',
                          color === c && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {saveMutation.isError && (
                  <p className="text-center text-xs text-red-400">
                    {saveMutation.error instanceof Error ? saveMutation.error.message : 'Erro ao salvar'}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  onClick={() => saveMutation.mutate(form.state.values)}
                  className="w-full rounded-xl bg-blue-400 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar meta'}
                </button>
              </form>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
