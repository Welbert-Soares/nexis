import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import { ArrowLeftRight, Check, FileUp, Undo2 } from 'lucide-react'
import { cn } from '#/lib/utils'
import { useHaptic } from '#/hooks/use-haptic'
import { getUserWallets } from '#/server/services/wallet.service'
import { getCategories } from '#/server/services/category.service'
import {
  confirmarImportacaoDoExtrato,
  desfazerImportacaoDoExtrato,
  getImportacoesDaCarteira,
  prepararImportacao,
} from '#/server/services/importacao.service'
import type { GrupoTransferencia, LinhaPrevia, Previa, SituacaoLinha } from '#/server/importacao/montar-previa'

type Escolhas = Partial<Record<GrupoTransferencia, string | null>>
/** Ajustes do usuário por linha, preservados quando a prévia é recalculada. */
type Ajuste = { marcada?: boolean; categoriaId?: string | null }

const NOME_GRUPO: Record<GrupoTransferencia, string> = {
  caixinhas: 'Caixinhas (RDB)',
  fatura_cartao: 'Pagamento de fatura',
  pix_proprio: 'Pix entre minhas contas',
}

const MOTIVO: Partial<Record<SituacaoLinha, string>> = {
  ja_importada: 'Já importada',
  possivel_duplicada: 'Possível duplicada',
  estorno: 'Estorno',
  anterior_a_carteira: 'Antes da criação da carteira',
}

const TRATAR_COMO_RECEITA_DESPESA = '__receita_despesa__'

interface Props {
  open: boolean
  /** Carteira já selecionada ao abrir (ex.: vindo da tela da carteira). */
  walletId?: string
  onClose: () => void
}

export function ImportacaoSheet({ open, walletId: walletInicial, onClose }: Props) {
  const queryClient = useQueryClient()
  const haptic = useHaptic()
  const [walletId, setWalletId] = useState(walletInicial ?? '')
  const [texto, setTexto] = useState<string | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [escolhas, setEscolhas] = useState<Escolhas>({})
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({})
  const [importadas, setImportadas] = useState<number | null>(null)
  const [desfazendo, setDesfazendo] = useState<string | null>(null)

  useEffect(() => {
    if (open) setWalletId(walletInicial ?? '')
  }, [open, walletInicial])

  const { data: wallets = [] } = useQuery({ queryKey: ['wallets'], queryFn: () => getUserWallets(), enabled: open })
  const { data: catDespesa = [] } = useQuery({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => getCategories({ data: { type: 'EXPENSE' } }),
    enabled: open,
  })
  const { data: catReceita = [] } = useQuery({
    queryKey: ['categories', 'INCOME'],
    queryFn: () => getCategories({ data: { type: 'INCOME' } }),
    enabled: open,
  })
  const { data: anteriores = [] } = useQuery({
    queryKey: ['importacoes', walletId],
    queryFn: () => getImportacoesDaCarteira({ data: { walletId } }),
    enabled: open && !!walletId && !previa,
  })

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['wallets'] })
    queryClient.invalidateQueries({ queryKey: ['importacoes'] })
  }

  const preparar = useMutation({
    mutationFn: (args: { texto: string; escolhas?: Escolhas }) =>
      prepararImportacao({ data: { walletId, texto: args.texto, escolhasDeGrupo: args.escolhas } }),
    onSuccess: (resultado) => {
      setPrevia(resultado)
      const lembradas: Escolhas = {}
      for (const g of resultado.grupos) {
        if (g.carteiraOutraPontaId) lembradas[g.grupo] = g.carteiraOutraPontaId
        else if (g.tratarComoReceitaDespesa) lembradas[g.grupo] = null
      }
      setEscolhas((atuais) => ({ ...lembradas, ...atuais }))
    },
  })

  const linhasEfetivas = useMemo(() => {
    if (!previa) return []
    return previa.linhas.map((linha) => {
      const ajuste = ajustes[linha.externalId] ?? {}
      return {
        ...linha,
        marcada: linha.situacao === 'ja_importada' ? false : (ajuste.marcada ?? linha.marcada),
        categoriaId: ajuste.categoriaId !== undefined ? ajuste.categoriaId : linha.categoriaId,
      }
    })
  }, [previa, ajustes])

  const confirmar = useMutation({
    mutationFn: () =>
      confirmarImportacaoDoExtrato({
        data: {
          walletId,
          escolhasDeGrupo: escolhas,
          linhas: linhasEfetivas
            .filter((l) => l.marcada)
            .map((l) => ({
              externalId: l.externalId,
              data: l.data,
              valor: l.valor,
              tipo: l.tipo,
              descricao: l.descricao,
              categoriaId: l.grupo && escolhas[l.grupo] ? null : l.categoriaId,
              grupo: l.grupo,
            })),
        },
      }),
    onSuccess: (resultado) => {
      haptic.success()
      invalidar()
      setImportadas(resultado.quantidade)
      setTimeout(fechar, 1400)
    },
  })

  const desfazer = useMutation({
    mutationFn: (importId: string) => desfazerImportacaoDoExtrato({ data: { importId } }),
    onSuccess: () => {
      setDesfazendo(null)
      invalidar()
    },
  })

  function fechar() {
    setTexto(null)
    setPrevia(null)
    setEscolhas({})
    setAjustes({})
    setImportadas(null)
    setDesfazendo(null)
    preparar.reset()
    confirmar.reset()
    onClose()
  }

  async function escolherArquivo(file: File | undefined) {
    if (!file) return
    const conteudo = await file.text()
    setTexto(conteudo)
    setAjustes({})
    setEscolhas({})
    preparar.mutate({ texto: conteudo })
  }

  function escolherGrupo(grupo: GrupoTransferencia, valor: string) {
    const novas: Escolhas = { ...escolhas, [grupo]: valor === TRATAR_COMO_RECEITA_DESPESA ? null : valor }
    setEscolhas(novas)
    // Recalcula: possíveis duplicadas dependem da carteira da outra ponta.
    if (texto) preparar.mutate({ texto, escolhas: novas })
  }

  function alternar(linha: LinhaPrevia & { marcada: boolean }) {
    haptic.tap()
    const marcada = !linha.marcada
    setAjustes((a) => {
      const novo = { ...a, [linha.externalId]: { ...a[linha.externalId], marcada } }
      // Estorno e a compra que ele anula andam juntos.
      if (linha.parExternalId) novo[linha.parExternalId] = { ...a[linha.parExternalId], marcada }
      return novo
    })
  }

  const marcadas = linhasEfetivas.filter((l) => l.marcada)
  const ehTransferencia = (l: LinhaPrevia) => !!l.grupo && !!escolhas[l.grupo]
  const receitas = marcadas.filter((l) => !ehTransferencia(l) && l.tipo === 'INCOME').reduce((s, l) => s + l.valor, 0)
  const despesas = marcadas.filter((l) => !ehTransferencia(l) && l.tipo === 'EXPENSE').reduce((s, l) => s + l.valor, 0)
  const transferencias = marcadas.filter(ehTransferencia).length
  const gruposSemEscolha = (previa?.grupos ?? []).filter(
    (g) => !(g.grupo in escolhas) && marcadas.some((l) => l.grupo === g.grupo),
  )
  const outrasCarteiras = wallets.filter((w) => w.id !== walletId)
  const nomeCarteira = (id: string) => wallets.find((w) => w.id === id)?.name ?? 'carteira'

  return (
    <Drawer.Root open={open} onClose={fechar}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" onClick={fechar} />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[calc(100dvh-16px)] flex-col overflow-hidden rounded-t-2xl bg-zinc-900 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-zinc-700" />
          <Drawer.Title className="px-4 pb-3 pt-4 text-base font-semibold text-white">Importar extrato</Drawer.Title>

          {importadas !== null ? (
            <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 pb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-7 w-7 text-emerald-400" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-medium text-zinc-300">
                {importadas} {importadas === 1 ? 'transação importada' : 'transações importadas'}
              </p>
            </div>
          ) : !previa ? (
            <div className="space-y-5 overflow-y-auto px-4 pb-8">
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Carteira</p>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full appearance-none rounded-xl bg-zinc-800 px-3 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-600"
                >
                  <option value="" disabled>Selecionar</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <label
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-8 text-center',
                  walletId ? 'active:bg-zinc-800' : 'pointer-events-none opacity-40',
                )}
              >
                <FileUp className="h-6 w-6 text-zinc-400" />
                <span className="text-sm text-zinc-200">
                  {preparar.isPending ? 'Lendo extrato...' : 'Escolher extrato CSV da conta Nubank'}
                </span>
                <span className="text-xs text-zinc-500">No app do Nubank: Extrato › Exportar › CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  disabled={!walletId || preparar.isPending}
                  onChange={(e) => {
                    escolherArquivo(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>

              {preparar.isError && (
                <p className="text-center text-xs text-red-400">
                  {preparar.error instanceof Error ? preparar.error.message : 'Erro ao ler o extrato'}
                </p>
              )}

              {anteriores.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Importações desta carteira</p>
                  {anteriores.map((imp) => (
                    <div key={imp.id} className="rounded-xl bg-zinc-800/60 px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-zinc-200">{fmtData(new Date(imp.criadaEm))}</p>
                          <p className="text-xs text-zinc-500">
                            {imp.quantidade} linhas · <span className="tabular-nums">{fmt(imp.efeitoNoSaldo)}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setDesfazendo(imp.id)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-400 active:bg-zinc-700"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Desfazer
                        </button>
                      </div>
                      {desfazendo === imp.id && (
                        <div className="mt-3 space-y-2 border-t border-zinc-700 pt-3">
                          <p className="text-xs text-zinc-400">
                            Todas as transações desta importação serão excluídas, inclusive a outra ponta das
                            transferências e as que você editou depois.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDesfazendo(null)}
                              className="flex-1 rounded-lg bg-zinc-700 py-2 text-xs text-zinc-200"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => desfazer.mutate(imp.id)}
                              disabled={desfazer.isPending}
                              className="flex-1 rounded-lg bg-red-500/90 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {desfazer.isPending ? 'Desfazendo...' : 'Desfazer importação'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                {previa.grupos.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs text-zinc-500">Transferências entre suas contas</p>
                    {previa.grupos.map((g) => (
                      <div key={g.grupo} className="flex items-center gap-2 rounded-xl bg-zinc-800/60 px-3 py-2">
                        <ArrowLeftRight className="h-4 w-4 shrink-0 text-zinc-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-200">{NOME_GRUPO[g.grupo]}</p>
                          <p className="text-xs text-zinc-500">{g.quantidade} linhas</p>
                        </div>
                        <select
                          value={g.grupo in escolhas ? (escolhas[g.grupo] ?? TRATAR_COMO_RECEITA_DESPESA) : ''}
                          onChange={(e) => escolherGrupo(g.grupo, e.target.value)}
                          className="w-36 appearance-none truncate rounded-lg bg-zinc-800 px-2 py-2 text-xs text-white outline-none"
                        >
                          <option value="" disabled>Outra carteira…</option>
                          {outrasCarteiras.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                          <option value={TRATAR_COMO_RECEITA_DESPESA}>Não tenho: tratar como receita/despesa</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <ul className={cn('divide-y divide-zinc-800', preparar.isPending && 'opacity-50')}>
                  {linhasEfetivas.map((l) => {
                    const transferencia = ehTransferencia(l)
                    const categorias = l.tipo === 'INCOME' ? catReceita : catDespesa
                    const bloqueada = l.situacao === 'ja_importada'
                    return (
                      <li key={l.externalId} className={cn('flex gap-3 py-3', !l.marcada && 'opacity-50')}>
                        <button
                          onClick={() => alternar(l)}
                          disabled={bloqueada}
                          aria-label={l.marcada ? 'Desmarcar linha' : 'Marcar linha'}
                          className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                            l.marcada ? 'border-blue-400 bg-blue-400' : 'border-zinc-600',
                            bloqueada && 'opacity-40',
                          )}
                        >
                          {l.marcada && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm text-zinc-200">{l.descricao}</p>
                            <p
                              className={cn(
                                'shrink-0 text-sm tabular-nums',
                                transferencia ? 'text-zinc-400' : l.tipo === 'INCOME' ? 'text-emerald-400' : 'text-zinc-200',
                              )}
                            >
                              {l.tipo === 'INCOME' ? '+' : '−'}{fmt(l.valor)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span>{fmtDia(new Date(l.data))}</span>
                            {MOTIVO[l.situacao] && (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{MOTIVO[l.situacao]}</span>
                            )}
                          </div>
                          {transferencia ? (
                            <p className="text-xs text-zinc-500">
                              Transferência {l.tipo === 'EXPENSE' ? '→' : '←'} {nomeCarteira(escolhas[l.grupo!]!)}
                            </p>
                          ) : (
                            <select
                              value={l.categoriaId ?? ''}
                              disabled={bloqueada}
                              onChange={(e) =>
                                setAjustes((a) => ({
                                  ...a,
                                  [l.externalId]: { ...a[l.externalId], categoriaId: e.target.value || null },
                                }))
                              }
                              className="max-w-full appearance-none rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
                            >
                              <option value="">Sem categoria</option>
                              {categorias.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="shrink-0 space-y-3 border-t border-zinc-800 bg-zinc-900 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{marcadas.length} de {linhasEfetivas.length} linhas</span>
                  <span className="tabular-nums">
                    <span className="text-emerald-400">+{fmt(receitas)}</span> · −{fmt(despesas)}
                    {transferencias > 0 && ` · ${transferencias} transf.`}
                  </span>
                </div>
                {gruposSemEscolha.length > 0 && (
                  <p className="text-xs text-amber-300">
                    Escolha a outra carteira de: {gruposSemEscolha.map((g) => NOME_GRUPO[g.grupo]).join(', ')}
                  </p>
                )}
                {(confirmar.isError || preparar.isError) && (
                  <p className="text-center text-xs text-red-400">
                    {(confirmar.error ?? preparar.error) instanceof Error
                      ? (confirmar.error ?? preparar.error)!.message
                      : 'Erro ao importar'}
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={fechar} className="rounded-xl bg-zinc-800 px-4 py-4 text-sm text-zinc-300">
                    Cancelar
                  </button>
                  <button
                    onClick={() => confirmar.mutate()}
                    disabled={marcadas.length === 0 || gruposSemEscolha.length > 0 || confirmar.isPending || preparar.isPending}
                    className="flex-1 rounded-xl bg-blue-400 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                  >
                    {confirmar.isPending ? 'Importando...' : `Importar ${marcadas.length}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDia(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

function fmtData(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
