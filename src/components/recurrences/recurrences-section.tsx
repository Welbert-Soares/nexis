import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Repeat2, ChevronLeft } from 'lucide-react'
import { cn } from '#/lib/utils'
import { useHaptic } from '#/hooks/use-haptic'
import { listActiveRecurrences, stopRecurring } from '#/server/services/transaction.service'

const INTERVAL_LABEL: Record<string, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
}

const fmtMoney = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

/** Recorrências ativas do usuário, com "Parar" em cada uma. Fica no Perfil. */
export function RecurrencesSection() {
  const queryClient = useQueryClient()
  const haptic = useHaptic()
  const [open, setOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const { data: recurrences = [], isLoading } = useQuery({
    queryKey: ['recurrences'],
    queryFn: () => listActiveRecurrences(),
  })

  const stop = useMutation({
    mutationFn: (id: string) => stopRecurring({ data: { id } }),
    onSuccess: () => {
      haptic.success()
      setConfirmingId(null)
      queryClient.invalidateQueries({ queryKey: ['recurrences'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  return (
    <div>
      <button onClick={() => { setOpen((o) => !o); setConfirmingId(null) }} className="flex w-full items-center gap-2">
        <Repeat2 className={cn('h-4 w-4 transition-colors', open ? 'text-white' : 'text-zinc-500')} strokeWidth={1.5} />
        <span className={cn('flex-1 text-left text-sm font-medium transition-colors', open ? 'text-white' : 'text-zinc-500')}>
          Recorrências
        </span>
        {recurrences.length > 0 && (
          <span className="text-xs text-zinc-600">{recurrences.length} ativa{recurrences.length > 1 ? 's' : ''}</span>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-zinc-600">
          <ChevronLeft className="h-3.5 w-3.5 -rotate-90" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="rec-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-4">
              {isLoading ? (
                <p className="py-2 text-center text-xs text-zinc-600">Carregando...</p>
              ) : recurrences.length === 0 ? (
                <p className="py-2 text-center text-xs text-zinc-600">Nada está se repetindo</p>
              ) : (
                recurrences.map((r) => {
                  const isExpense = r.type === 'EXPENSE'
                  const confirming = confirmingId === r.id
                  return (
                    <div key={r.id} className="rounded-xl bg-zinc-800/60 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">{r.description || r.category?.name || 'Sem descrição'}</p>
                          <p className="truncate text-xs text-zinc-500">
                            {INTERVAL_LABEL[r.interval ?? 'MONTHLY']} · {r.wallet.name}
                            {r.nextDue && ` · próxima ${fmtDate(r.nextDue)}`}
                          </p>
                        </div>
                        <p className={cn('shrink-0 tabular-nums text-sm font-medium', isExpense ? 'text-red-400' : 'text-emerald-400')}>
                          {isExpense ? '-' : '+'}{fmtMoney(r.amount)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {confirming ? (
                          <>
                            <span className="flex-1 text-xs text-zinc-500">Os meses já lançados continuam.</span>
                            <button
                              onClick={() => setConfirmingId(null)}
                              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 active:text-zinc-200"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => stop.mutate(r.id)}
                              disabled={stop.isPending}
                              className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 active:bg-red-500/25 disabled:opacity-50"
                            >
                              {stop.isPending ? 'Parando...' : 'Confirmar'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmingId(r.id)}
                            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 active:bg-zinc-700"
                          >
                            Parar de repetir
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              {stop.isError && <p className="text-center text-xs text-red-400">Não foi possível parar. Tente de novo.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
