import { prisma } from '#/db'
import type { GrupoTransferencia, TipoTransacao } from '#/server/importacao/montar-previa'

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
