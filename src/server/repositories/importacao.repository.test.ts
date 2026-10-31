import { describe, expect, it, vi, beforeEach } from 'vitest'

const walletFindMany = vi.fn()
const txFindMany = vi.fn()
const txCreate = vi.fn()
const txUpdateMany = vi.fn()
const importCreate = vi.fn()
const importFindFirst = vi.fn()
const importUpdate = vi.fn()
const choiceUpsert = vi.fn()

const tx = {
  wallet: { findMany: (...a: unknown[]) => walletFindMany(...a) },
  transaction: {
    findMany: (...a: unknown[]) => txFindMany(...a),
    create: (...a: unknown[]) => txCreate(...a),
    updateMany: (...a: unknown[]) => txUpdateMany(...a),
  },
  statementImport: {
    create: (...a: unknown[]) => importCreate(...a),
    findFirst: (...a: unknown[]) => importFindFirst(...a),
    update: (...a: unknown[]) => importUpdate(...a),
  },
  importTransferChoice: { upsert: (...a: unknown[]) => choiceUpsert(...a) },
}

vi.mock('#/db', () => ({
  prisma: { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}))

async function load() {
  return import('./importacao.repository')
}

function carteirasDoUsuario(ids: string[]) {
  walletFindMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.filter((id) => ids.includes(id)).map((id) => ({ id })),
  )
}

const DIA = new Date('2026-10-09T12:00:00Z')

function criadas() {
  return txCreate.mock.calls.map(([arg]) => arg.data as Record<string, unknown>)
}

describe('confirmarImportacao', () => {
  beforeEach(() => {
    for (const m of [walletFindMany, txFindMany, txCreate, txUpdateMany, importCreate, importFindFirst, importUpdate, choiceUpsert]) m.mockReset()
    carteirasDoUsuario(['w-nubank', 'w-invest'])
    txFindMany.mockResolvedValue([])
    importCreate.mockResolvedValue({ id: 'imp-1' })
    let n = 0
    txCreate.mockImplementation(async () => ({ id: `tx-${++n}` }))
  })

  it('cria a Importação e as receitas/despesas ligadas a ela', async () => {
    const { confirmarImportacao } = await load()
    const resultado = await confirmarImportacao('u1', 'w-nubank', {
      linhas: [
        { externalId: 'id-1', data: DIA, valor: 17.5, tipo: 'EXPENSE', descricao: 'PADARIA', categoriaId: 'cat-alim', grupo: null },
        { externalId: 'id-2', data: DIA, valor: 200, tipo: 'INCOME', descricao: 'Pix recebido · CICLANO', categoriaId: null, grupo: null },
      ],
      escolhasDeGrupo: {},
    })

    expect(resultado).toEqual({ importId: 'imp-1', quantidade: 2 })
    expect(importCreate.mock.calls[0][0].data).toMatchObject({ userId: 'u1', walletId: 'w-nubank', format: 'nubank_conta', transactionCount: 2 })
    expect(criadas()).toEqual([
      { walletId: 'w-nubank', importId: 'imp-1', externalId: 'id-1', date: DIA, amount: 17.5, type: 'EXPENSE', description: 'PADARIA', categoryId: 'cat-alim' },
      { walletId: 'w-nubank', importId: 'imp-1', externalId: 'id-2', date: DIA, amount: 200, type: 'INCOME', description: 'Pix recebido · CICLANO', categoryId: null },
    ])
  })

  it('linha de grupo com carteira escolhida vira o par de Transferência', async () => {
    const { confirmarImportacao } = await load()
    await confirmarImportacao('u1', 'w-nubank', {
      linhas: [{ externalId: 'id-1', data: DIA, valor: 300, tipo: 'EXPENSE', descricao: 'Aplicação RDB', categoriaId: null, grupo: 'caixinhas' }],
      escolhasDeGrupo: { caixinhas: 'w-invest' },
    })

    expect(criadas()).toEqual([
      { walletId: 'w-nubank', importId: 'imp-1', externalId: 'id-1', date: DIA, amount: 300, type: 'EXPENSE', description: 'Aplicação RDB', categoryId: null, isTransfer: true },
      { walletId: 'w-invest', importId: 'imp-1', externalId: null, date: DIA, amount: 300, type: 'INCOME', description: 'Aplicação RDB', categoryId: null, isTransfer: true, parentId: 'tx-1' },
    ])
  })

  it('linha de grupo tratado como receita/despesa entra sem par', async () => {
    const { confirmarImportacao } = await load()
    await confirmarImportacao('u1', 'w-nubank', {
      linhas: [{ externalId: 'id-1', data: DIA, valor: 54.19, tipo: 'EXPENSE', descricao: 'Pagamento de fatura', categoriaId: 'cat-x', grupo: 'fatura_cartao' }],
      escolhasDeGrupo: { fatura_cartao: null },
    })

    expect(criadas()).toEqual([
      { walletId: 'w-nubank', importId: 'imp-1', externalId: 'id-1', date: DIA, amount: 54.19, type: 'EXPENSE', description: 'Pagamento de fatura', categoryId: 'cat-x' },
    ])
  })

  it('recusa carteira de destino ou da outra ponta que não é do usuário', async () => {
    const { confirmarImportacao } = await load()
    carteirasDoUsuario(['w-nubank'])

    await expect(
      confirmarImportacao('u1', 'w-nubank', {
        linhas: [{ externalId: 'id-1', data: DIA, valor: 300, tipo: 'EXPENSE', descricao: 'Aplicação RDB', categoriaId: null, grupo: 'caixinhas' }],
        escolhasDeGrupo: { caixinhas: 'w-de-outra-pessoa' },
      }),
    ).rejects.toThrow('Carteira não encontrada')
    expect(importCreate).not.toHaveBeenCalled()
    expect(txCreate).not.toHaveBeenCalled()
  })

  it('recusa linhas cujo identificador já foi importado (não excluído) na carteira', async () => {
    const { confirmarImportacao } = await load()
    txFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.walletId === 'w-nubank' && where.deletedAt === null ? [{ externalId: 'id-1' }] : [],
    )

    await expect(
      confirmarImportacao('u1', 'w-nubank', {
        linhas: [{ externalId: 'id-1', data: DIA, valor: 17.5, tipo: 'EXPENSE', descricao: 'PADARIA', categoriaId: null, grupo: null }],
        escolhasDeGrupo: {},
      }),
    ).rejects.toThrow('Parte do extrato já foi importada. Gere a prévia de novo.')
    expect(txCreate).not.toHaveBeenCalled()
  })

  it('guarda a escolha de cada grupo para as próximas importações nesta carteira', async () => {
    const { confirmarImportacao } = await load()
    await confirmarImportacao('u1', 'w-nubank', {
      linhas: [],
      escolhasDeGrupo: { caixinhas: 'w-invest', fatura_cartao: null },
    })

    const salvas = choiceUpsert.mock.calls.map(([arg]) => [arg.where.walletId_group, arg.create.outraPontaWalletId, arg.update.outraPontaWalletId])
    expect(salvas).toEqual([
      [{ walletId: 'w-nubank', group: 'caixinhas' }, 'w-invest', 'w-invest'],
      [{ walletId: 'w-nubank', group: 'fatura_cartao' }, null, null],
    ])
  })
})

describe('desfazerImportacao', () => {
  beforeEach(() => {
    for (const m of [txUpdateMany, importFindFirst, importUpdate]) m.mockReset()
    txUpdateMany.mockResolvedValue({ count: 4 })
  })

  it('exclui só as transações daquela Importação e a marca como desfeita', async () => {
    const { desfazerImportacao } = await load()
    importFindFirst.mockResolvedValue({ id: 'imp-1', undoneAt: null })

    const resultado = await desfazerImportacao('u1', 'imp-1')

    expect(importFindFirst.mock.calls[0][0].where).toEqual({ id: 'imp-1', userId: 'u1' })
    const exclusao = txUpdateMany.mock.calls[0][0]
    expect(exclusao.where).toEqual({ importId: 'imp-1', deletedAt: null })
    expect(exclusao.data.deletedAt).toBeInstanceOf(Date)
    expect(importUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 'imp-1' }, data: { undoneAt: expect.any(Date) } })
    expect(resultado).toEqual({ excluidas: 4 })
  })

  it('recusa importação de outro usuário ou já desfeita', async () => {
    const { desfazerImportacao } = await load()
    importFindFirst.mockResolvedValue(null)
    await expect(desfazerImportacao('u1', 'imp-x')).rejects.toThrow('Importação não encontrada')

    importFindFirst.mockResolvedValue({ id: 'imp-1', undoneAt: new Date() })
    await expect(desfazerImportacao('u1', 'imp-1')).rejects.toThrow('Importação já foi desfeita')
    expect(txUpdateMany).not.toHaveBeenCalled()
  })
})
