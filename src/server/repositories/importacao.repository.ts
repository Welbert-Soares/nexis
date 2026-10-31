import { prisma } from '#/db'
import type { ContextoPrevia, GrupoTransferencia, TipoTransacao } from '#/server/importacao/montar-previa'

export type LinhaConfirmada = {
  externalId: string
  data: Date
  valor: number
  tipo: TipoTransacao
  descricao: string
  categoriaId: string | null
  grupo: GrupoTransferencia | null
}

export type ConfirmacaoImportacao = {
  linhas: LinhaConfirmada[]
  /** Por grupo: id da carteira da outra ponta, ou null = tratar como receita/despesa. */
  escolhasDeGrupo: Partial<Record<GrupoTransferencia, string | null>>
}

export async function confirmarImportacao(userId: string, walletId: string, confirmacao: ConfirmacaoImportacao) {
  return prisma.$transaction(async (tx) => {
    const escolhas = Object.entries(confirmacao.escolhasDeGrupo) as Array<[GrupoTransferencia, string | null]>
    const carteirasUsadas = new Set([walletId])
    for (const [, outraPonta] of escolhas) if (outraPonta) carteirasUsadas.add(outraPonta)
    const doUsuario = await tx.wallet.findMany({ where: { id: { in: [...carteirasUsadas] }, userId }, select: { id: true } })
    if (doUsuario.length !== carteirasUsadas.size) throw new Error('Carteira não encontrada')

    const jaImportadas = await tx.transaction.findMany({
      where: { walletId, deletedAt: null, externalId: { in: confirmacao.linhas.map((l) => l.externalId) } },
      select: { externalId: true },
    })
    if (jaImportadas.length > 0) throw new Error('Parte do extrato já foi importada. Gere a prévia de novo.')

    const importacao = await tx.statementImport.create({
      data: { userId, walletId, format: 'nubank_conta', transactionCount: confirmacao.linhas.length },
    })

    for (const linha of confirmacao.linhas) {
      const outraPonta = linha.grupo ? confirmacao.escolhasDeGrupo[linha.grupo] : null
      const base = {
        importId: importacao.id,
        date: linha.data,
        amount: linha.valor,
        description: linha.descricao,
      }

      if (!outraPonta) {
        await tx.transaction.create({
          data: { walletId, ...base, externalId: linha.externalId, type: linha.tipo, categoryId: linha.categoriaId },
        })
        continue
      }

      // Transferência: mesmo par de transações que transferBetweenWallets cria.
      const ladoImportado = await tx.transaction.create({
        data: { walletId, ...base, externalId: linha.externalId, type: linha.tipo, categoryId: null, isTransfer: true },
      })
      await tx.transaction.create({
        data: {
          walletId: outraPonta,
          ...base,
          externalId: null,
          type: linha.tipo === 'EXPENSE' ? 'INCOME' : 'EXPENSE',
          categoryId: null,
          isTransfer: true,
          parentId: ladoImportado.id,
        },
      })
    }

    for (const [group, outraPontaWalletId] of escolhas) {
      await tx.importTransferChoice.upsert({
        where: { walletId_group: { walletId, group } },
        create: { walletId, group, outraPontaWalletId },
        update: { outraPontaWalletId },
      })
    }

    return { importId: importacao.id, quantidade: confirmacao.linhas.length }
  })
}

export async function desfazerImportacao(userId: string, importId: string) {
  return prisma.$transaction(async (tx) => {
    const importacao = await tx.statementImport.findFirst({ where: { id: importId, userId } })
    if (!importacao) throw new Error('Importação não encontrada')
    if (importacao.undoneAt) throw new Error('Importação já foi desfeita')

    const agora = new Date()
    // Inclui a outra ponta das Transferências: as duas levam o importId.
    const { count } = await tx.transaction.updateMany({
      where: { importId, deletedAt: null },
      data: { deletedAt: agora },
    })
    await tx.statementImport.update({ where: { id: importId }, data: { undoneAt: agora } })
    return { excluidas: count }
  })
}

const MARGEM_CONTEXTO_MS = 4 * 24 * 60 * 60 * 1000

/** Carrega do banco tudo o que montarPrevia precisa (ver ContextoPrevia). */
export async function carregarContextoDaPrevia(
  userId: string,
  nomeUsuario: string,
  walletId: string,
  intervalo: { inicio: Date; fim: Date },
): Promise<ContextoPrevia> {
  const carteira = await prisma.wallet.findFirst({ where: { id: walletId, userId }, select: { id: true, createdAt: true } })
  if (!carteira) throw new Error('Carteira não encontrada')

  const janela = {
    gte: new Date(intervalo.inicio.getTime() - MARGEM_CONTEXTO_MS),
    lte: new Date(intervalo.fim.getTime() + MARGEM_CONTEXTO_MS),
  }
  const umAnoAtras = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  const [existentes, importadas, historico, escolhas, outrosReceita] = await Promise.all([
    // Todas as carteiras do usuário: a da outra ponta pode mudar na prévia.
    prisma.transaction.findMany({
      where: { wallet: { userId }, deletedAt: null, date: janela },
      select: { id: true, walletId: true, type: true, amount: true, date: true },
    }),
    prisma.transaction.findMany({
      where: { walletId, deletedAt: null, externalId: { not: null }, date: janela },
      select: { externalId: true },
    }),
    prisma.transaction.findMany({
      where: { wallet: { userId }, deletedAt: null, isTransfer: false, categoryId: { not: null }, description: { not: null }, date: { gte: umAnoAtras } },
      orderBy: { date: 'desc' },
      distinct: ['description'],
      select: { description: true, categoryId: true },
    }),
    prisma.importTransferChoice.findMany({ where: { walletId } }),
    prisma.category.findFirst({ where: { name: 'Outros', type: 'INCOME', userId: null }, select: { id: true } }),
  ])

  return {
    carteira: { id: carteira.id, criadaEm: carteira.createdAt },
    nomeUsuario,
    transacoesExistentes: existentes.map((t) => ({ id: t.id, walletId: t.walletId, tipo: t.type, valor: t.amount.toNumber(), data: t.date })),
    externalIdsImportados: importadas.map((t) => t.externalId!),
    categoriaPorDescricao: Object.fromEntries(historico.map((t) => [t.description!, t.categoryId!])),
    escolhasDeGrupo: Object.fromEntries(escolhas.map((e) => [e.group, e.outraPontaWalletId])),
    categoriaOutrosReceitaId: outrosReceita?.id ?? null,
  }
}

/** Importações ainda ativas de uma carteira, mais recentes primeiro, com o efeito no saldo dela. */
export async function listarImportacoes(userId: string, walletId: string) {
  const importacoes = await prisma.statementImport.findMany({
    where: { userId, walletId, undoneAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, createdAt: true, transactionCount: true },
  })
  if (importacoes.length === 0) return []

  const somas = await prisma.transaction.groupBy({
    by: ['importId', 'type'],
    where: { walletId, deletedAt: null, importId: { in: importacoes.map((i) => i.id) } },
    _sum: { amount: true },
  })
  const efeito = new Map<string, number>()
  for (const s of somas) {
    const valor = s._sum.amount?.toNumber() ?? 0
    efeito.set(s.importId!, (efeito.get(s.importId!) ?? 0) + (s.type === 'INCOME' ? valor : -valor))
  }

  return importacoes.map((i) => ({
    id: i.id,
    criadaEm: i.createdAt,
    quantidade: i.transactionCount,
    efeitoNoSaldo: Math.round((efeito.get(i.id) ?? 0) * 100) / 100,
  }))
}
