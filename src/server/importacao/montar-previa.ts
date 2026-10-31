export type TipoTransacao = 'INCOME' | 'EXPENSE'

export type SituacaoLinha = 'nova' | 'ja_importada' | 'possivel_duplicada' | 'estorno' | 'anterior_a_carteira'

export type GrupoTransferencia = 'caixinhas' | 'fatura_cartao' | 'pix_proprio'

export type ContextoPrevia = {
  carteira: { id: string; criadaEm: Date }
  nomeUsuario: string
  transacoesExistentes: Array<{ id: string; walletId: string; tipo: TipoTransacao; valor: number; data: Date }>
  externalIdsImportados: string[]
  categoriaPorDescricao: Record<string, string>
  /** Escolha salva por grupo: id da carteira da outra ponta, ou null = tratar como receita/despesa. */
  escolhasDeGrupo: Partial<Record<GrupoTransferencia, string | null>>
  categoriaOutrosReceitaId: string | null
}

export type LinhaPrevia = {
  externalId: string
  data: Date
  valor: number
  tipo: TipoTransacao
  descricao: string
  categoriaId: string | null
  grupo: GrupoTransferencia | null
  situacao: SituacaoLinha
  marcada: boolean
  /** Linha que anula esta (estorno ↔ compra), quando houver. */
  parExternalId: string | null
}

export type GrupoPrevia = {
  grupo: GrupoTransferencia
  quantidade: number
  carteiraOutraPontaId: string | null
  tratarComoReceitaDespesa: boolean
}

export type Previa = { linhas: LinhaPrevia[]; grupos: GrupoPrevia[] }

function lerData(texto: string): Date {
  const [dia, mes, ano] = texto.split('/').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia, 12))
}

// O usuário está no Brasil: o "dia" de criação da carteira é o dia em São Paulo.
function diaEmSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data)
}

function contraparte(resto: string): string {
  return resto.split(' - ')[0].replace(/\s*\(Transferência (enviada|recebida)\)$/i, '').trim()
}

function limparDescricao(bruta: string): string {
  const pix = bruta.match(/^Transferência (enviada|recebida) pelo Pix(?: via Open Banking)? - (.+)$/i)
  if (pix) return `Pix ${/enviada/i.test(pix[1]) ? 'enviado' : 'recebido'} · ${contraparte(pix[2])}`

  const ted = bruta.match(/^Transferência (Enviada|Recebida) - (.+)$/i)
  if (ted) return `Transferência ${ted[1].toLowerCase()} · ${contraparte(ted[2])}`

  const debito = bruta.match(/^Compra no débito(?: via NuPay)? - (.+)$/i)
  if (debito) return debito[1].trim()

  return bruta.trim()
}

const JANELA_DUPLICADA_DIAS = 3
const UM_DIA_MS = 24 * 60 * 60 * 1000

function diasEntre(diaA: string, diaB: string): number {
  return Math.abs(Date.parse(diaA) - Date.parse(diaB)) / UM_DIA_MS
}

function emCentavos(valor: number): number {
  return Math.round(valor * 100)
}

function descricaoBrutaDe(linhaBruta: string): string {
  return linhaBruta.split(',').slice(3).join(',').replace(/^"|"$/g, '')
}

function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function contraparteDeTransferencia(descricaoBruta: string): string | null {
  const m = descricaoBruta.match(/^Transferência (?:enviada|recebida)(?: pelo Pix(?: via Open Banking)?)? - (.+)$/i)
  return m ? contraparte(m[1]) : null
}

function ehOProprioUsuario(nomeContraparte: string, nomeUsuario: string): boolean {
  const usuario = normalizarNome(nomeUsuario)
  if (usuario === '') return false
  // Sequência inteira de palavras: "JOSE DA SILVA" casa com "JOSE DA SILVA SAUROS", não com "JOSEFA DA SILVA".
  return ` ${normalizarNome(nomeContraparte)} `.includes(` ${usuario} `)
}

function grupoDeTransferencia(descricaoBruta: string, nomeUsuario: string): GrupoTransferencia | null {
  if (/^(Aplicação|Resgate) RDB$/i.test(descricaoBruta)) return 'caixinhas'
  if (/^Pagamento de fatura$/i.test(descricaoBruta)) return 'fatura_cartao'
  const nomeContraparte = contraparteDeTransferencia(descricaoBruta)
  if (nomeContraparte && ehOProprioUsuario(nomeContraparte, nomeUsuario)) return 'pix_proprio'
  return null
}

const PREFIXO_ESTORNO = 'Estorno - '

function parearEstornos(linhas: LinhaPrevia[], descricoesBrutas: string[]) {
  descricoesBrutas.forEach((descricao, iEstorno) => {
    if (!descricao.startsWith(PREFIXO_ESTORNO)) return
    const estorno = linhas[iEstorno]
    if (estorno.situacao === 'ja_importada') return

    const original = descricao.slice(PREFIXO_ESTORNO.length)
    const candidatas = linhas
      .map((linha, i) => ({ linha, i }))
      .filter(
        ({ linha, i }) =>
          i !== iEstorno &&
          descricoesBrutas[i] === original &&
          linha.tipo === 'EXPENSE' &&
          linha.situacao !== 'ja_importada' &&
          linha.parExternalId === null &&
          emCentavos(linha.valor) === emCentavos(estorno.valor) &&
          linha.data.getTime() <= estorno.data.getTime(),
      )
    // Prefere a compra mais próxima antes do estorno no extrato.
    const escolhida = candidatas.filter(({ i }) => i < iEstorno).at(-1) ?? candidatas[0]
    if (!escolhida) return

    for (const [linha, par] of [
      [estorno, escolhida.linha],
      [escolhida.linha, estorno],
    ]) {
      linha.situacao = 'estorno'
      linha.marcada = false
      linha.parExternalId = par.externalId
    }
  })
}

const MAX_LINHAS = 2000

const CABECALHO_CONTA_NUBANK ='Data,Valor,Identificador,Descrição'

/** Primeiro e último dia do extrato, para carregar só o contexto necessário. Null se não houver datas. */
export function intervaloDoExtrato(textoDoExtrato: string): { inicio: Date; fim: Date } | null {
  const datas = textoDoExtrato
    .split(/\r?\n/)
    .map((l) => l.match(/^(\d{2}\/\d{2}\/\d{4}),/)?.[1])
    .filter((d): d is string => !!d)
    .map(lerData)
  if (datas.length === 0) return null
  const tempos = datas.map((d) => d.getTime())
  return { inicio: new Date(Math.min(...tempos)), fim: new Date(Math.max(...tempos)) }
}

export function montarPrevia(textoDoExtrato: string, contexto: ContextoPrevia): Previa {
  const [cabecalho, ...linhasBrutas] = textoDoExtrato
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')

  if (cabecalho?.trim() !== CABECALHO_CONTA_NUBANK) {
    throw new Error('Arquivo não reconhecido como extrato da conta Nubank')
  }
  if (linhasBrutas.length === 0) {
    throw new Error('O extrato não tem nenhuma movimentação')
  }
  if (linhasBrutas.length > MAX_LINHAS) {
    throw new Error('O extrato tem mais de 2.000 movimentações')
  }

  const jaImportados = new Set(contexto.externalIdsImportados)
  const diaCriacaoCarteira = diaEmSaoPaulo(contexto.carteira.criadaEm)
  const existentesConsumidas = new Set<string>()

  function encontrarParecida(walletId: string, tipo: TipoTransacao, valor: number, dia: string) {
    const parecida = contexto.transacoesExistentes.find(
      (t) =>
        !existentesConsumidas.has(t.id) &&
        t.walletId === walletId &&
        t.tipo === tipo &&
        emCentavos(t.valor) === emCentavos(valor) &&
        diasEntre(diaEmSaoPaulo(t.data), dia) <= JANELA_DUPLICADA_DIAS,
    )
    if (parecida) existentesConsumidas.add(parecida.id)
    return parecida
  }

  const linhas = linhasBrutas.map((bruta): LinhaPrevia => {
    const [data, valorTexto, externalId] = bruta.split(',')
    const descricaoBruta = descricaoBrutaDe(bruta)
    const numero = Number(valorTexto)
    const valor = Math.abs(numero)
    const tipo: TipoTransacao = numero < 0 ? 'EXPENSE' : 'INCOME'
    const descricao = limparDescricao(descricaoBruta)
    const dataLinha = lerData(data)
    const dia = dataLinha.toISOString().slice(0, 10)

    const grupo = grupoDeTransferencia(descricaoBruta, contexto.nomeUsuario)
    const carteiraOutraPonta = grupo ? contexto.escolhasDeGrupo[grupo] : null
    const tipoInvertido: TipoTransacao = tipo === 'EXPENSE' ? 'INCOME' : 'EXPENSE'

    let situacao: SituacaoLinha = 'nova'
    if (jaImportados.has(externalId)) situacao = 'ja_importada'
    else if (dia < diaCriacaoCarteira) situacao = 'anterior_a_carteira'
    else if (
      encontrarParecida(contexto.carteira.id, tipo, valor, dia) ||
      (carteiraOutraPonta && encontrarParecida(carteiraOutraPonta, tipoInvertido, valor, dia))
    )
      situacao = 'possivel_duplicada'

    return {
      externalId,
      data: dataLinha,
      valor,
      tipo,
      descricao,
      grupo,
      categoriaId: carteiraOutraPonta
        ? null
        : /^Depósito de empréstimo$/i.test(descricao)
          ? contexto.categoriaOutrosReceitaId
          : (contexto.categoriaPorDescricao[descricao] ?? null),
      situacao,
      marcada: situacao === 'nova',
      parExternalId: null,
    }
  })

  parearEstornos(linhas, linhasBrutas.map(descricaoBrutaDe))

  const grupos: GrupoPrevia[] = []
  for (const { grupo } of linhas) {
    if (!grupo) continue
    const existente = grupos.find((g) => g.grupo === grupo)
    if (existente) existente.quantidade++
    else {
      const escolha = contexto.escolhasDeGrupo[grupo]
      grupos.push({
        grupo,
        quantidade: 1,
        carteiraOutraPontaId: escolha ?? null,
        tratarComoReceitaDespesa: escolha === null,
      })
    }
  }

  return { linhas, grupos }
}
