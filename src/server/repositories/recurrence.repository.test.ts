import { describe, expect, it, vi, beforeEach } from 'vitest'

const txFindFirst = vi.fn()
const txFindMany = vi.fn()
const txUpdate = vi.fn()

vi.mock('#/db', () => ({
  prisma: {
    transaction: {
      findFirst: (...a: unknown[]) => txFindFirst(...a),
      findMany: (...a: unknown[]) => txFindMany(...a),
      update: (...a: unknown[]) => txUpdate(...a),
    },
  },
}))

async function load() {
  return import('./transaction.repository')
}

const dec = (n: number) => ({ toNumber: () => n })

beforeEach(() => {
  txFindFirst.mockReset()
  txFindMany.mockReset()
  txUpdate.mockReset()
  txUpdate.mockResolvedValue({})
})

describe('stopRecurrence', () => {
  it('na própria Recorrência → desliga ela e limpa nextDue', async () => {
    txFindFirst.mockResolvedValue({ id: 'r1', recurring: true, parent: null })
    const { stopRecurrence } = await load()
    expect(await stopRecurrence('r1', 'u1')).toEqual({ recurrenceId: 'r1' })
    expect(txUpdate).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { recurring: false, nextDue: null } })
  })

  it('numa Ocorrência → desliga a Recorrência que a gerou, sem tocar na Ocorrência', async () => {
    txFindFirst.mockResolvedValue({ id: 'o1', recurring: false, parent: { id: 'r1', recurring: true, deletedAt: null } })
    const { stopRecurrence } = await load()
    expect(await stopRecurrence('o1', 'u1')).toEqual({ recurrenceId: 'r1' })
    expect(txUpdate).toHaveBeenCalledTimes(1)
    expect(txUpdate.mock.calls[0][0].where).toEqual({ id: 'r1' })
  })

  it('busca a transação só entre as do usuário e não excluídas', async () => {
    txFindFirst.mockResolvedValue({ id: 'r1', recurring: true, parent: null })
    const { stopRecurrence } = await load()
    await stopRecurrence('r1', 'u1')
    expect(txFindFirst.mock.calls[0][0].where).toEqual({ id: 'r1', wallet: { userId: 'u1' }, deletedAt: null })
  })

  it('transação de outro usuário ou inexistente → "Transaction not found"', async () => {
    txFindFirst.mockResolvedValue(null)
    const { stopRecurrence } = await load()
    await expect(stopRecurrence('x', 'u1')).rejects.toThrow('Transaction not found')
    expect(txUpdate).not.toHaveBeenCalled()
  })

  it('transação avulsa, parcela ou Recorrência já parada → erro, sem gravar', async () => {
    const casos = [
      { id: 'a', recurring: false, parent: null },
      { id: 'p2', recurring: false, parent: { id: 'p1', recurring: false, deletedAt: null } },
      { id: 'o1', recurring: false, parent: { id: 'r1', recurring: true, deletedAt: new Date() } },
    ]
    const { stopRecurrence } = await load()
    for (const caso of casos) {
      txFindFirst.mockResolvedValueOnce(caso)
      await expect(stopRecurrence(caso.id, 'u1')).rejects.toThrow('não faz parte de uma recorrência ativa')
    }
    expect(txUpdate).not.toHaveBeenCalled()
  })
})

describe('getActiveRecurrences', () => {
  it('lista só Recorrências ligadas, não excluídas e do usuário, por próximo vencimento', async () => {
    txFindMany.mockResolvedValue([])
    const { getActiveRecurrences } = await load()
    await getActiveRecurrences('u1')
    const args = txFindMany.mock.calls[0][0]
    expect(args.where).toEqual({ wallet: { userId: 'u1' }, recurring: true, parentId: null, deletedAt: null })
    expect(args.orderBy).toEqual({ nextDue: 'asc' })
  })

  it('converte o valor para number', async () => {
    txFindMany.mockResolvedValue([
      { id: 'r1', type: 'EXPENSE', amount: dec(49.9), description: 'Academia', interval: 'MONTHLY', nextDue: new Date('2026-12-05'), date: new Date('2026-03-05'), wallet: { name: 'Nubank' }, category: null },
    ])
    const { getActiveRecurrences } = await load()
    const [r] = await getActiveRecurrences('u1')
    expect(r.amount).toBe(49.9)
    expect(r.since).toEqual(new Date('2026-03-05'))
  })
})

describe('getTransactionsByMonth — parcela × recorrência × transferência', () => {
  const base = { amount: dec(10), recurring: false, interval: null, isTransfer: false, parentId: null, parent: null, _count: { children: 0 } }

  async function classificar(rows: object[]) {
    txFindMany.mockResolvedValue(rows.map((r) => ({ ...base, ...r })))
    const { getTransactionsByMonth } = await load()
    return getTransactionsByMonth('u1', 2026, 11)
  }

  it('parcelas continuam sendo parcelas', async () => {
    const [raiz, filha] = await classificar([
      { id: 'p1', _count: { children: 2 } },
      { id: 'p2', parentId: 'p1', parent: { recurring: false, interval: null, deletedAt: null } },
    ])
    expect(raiz.isInstallment).toBe(true)
    expect(filha.isInstallment).toBe(true)
    expect(raiz.recurrenceId).toBeNull()
  })

  it('Ocorrência de Recorrência ativa aponta para a Recorrência', async () => {
    const [raiz, ocorrencia] = await classificar([
      { id: 'r1', recurring: true, interval: 'MONTHLY', _count: { children: 3 } },
      { id: 'o1', parentId: 'r1', parent: { recurring: true, interval: 'MONTHLY', deletedAt: null } },
    ])
    expect(raiz.recurrenceId).toBe('r1')
    expect(ocorrencia.recurrenceId).toBe('r1')
    expect(raiz.isInstallment).toBe(false)
    expect(ocorrencia.isInstallment).toBe(false)
  })

  it('depois de parar, Recorrência e Ocorrências não viram parcelas', async () => {
    const [raiz, ocorrencia] = await classificar([
      { id: 'r1', recurring: false, interval: 'MONTHLY', _count: { children: 3 } },
      { id: 'o1', parentId: 'r1', parent: { recurring: false, interval: 'MONTHLY', deletedAt: null } },
    ])
    expect(raiz.isInstallment).toBe(false)
    expect(ocorrencia.isInstallment).toBe(false)
    expect(ocorrencia.recurrenceId).toBeNull()
  })

  it('as duas pontas de uma transferência não são parcelas', async () => {
    const [saida, entrada] = await classificar([
      { id: 't1', type: 'EXPENSE', isTransfer: true, _count: { children: 1 } },
      { id: 't2', type: 'INCOME', isTransfer: true, parentId: 't1', parent: { recurring: false, interval: null, deletedAt: null } },
    ])
    expect(saida.isInstallment).toBe(false)
    expect(entrada.isInstallment).toBe(false)
  })
})
