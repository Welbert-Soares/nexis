import { describe, expect, it, vi, beforeEach } from 'vitest'

const goalFindFirst = vi.fn()
const walletFindFirst = vi.fn()
const txCreate = vi.fn()
const txFindMany = vi.fn()
const txAggregate = vi.fn()
const getWalletBalance = vi.fn()

vi.mock('#/db', () => ({
  prisma: {
    goal: { findFirst: (...a: unknown[]) => goalFindFirst(...a) },
    wallet: { findFirst: (...a: unknown[]) => walletFindFirst(...a) },
    transaction: {
      create: (...a: unknown[]) => txCreate(...a),
      findMany: (...a: unknown[]) => txFindMany(...a),
      aggregate: (...a: unknown[]) => txAggregate(...a),
    },
  },
}))
vi.mock('#/server/repositories/wallet.repository', () => ({
  getWalletBalance: (...a: unknown[]) => getWalletBalance(...a),
}))

const dec = (n: number) => ({ toNumber: () => n })

async function load() {
  return import('./goal.repository')
}

describe('depositToGoal', () => {
  beforeEach(() => {
    goalFindFirst.mockReset()
    walletFindFirst.mockReset()
    txCreate.mockReset()
    txAggregate.mockReset()
    getWalletBalance.mockReset()
  })

  it('cria uma transação EXPENSE tagueada com a meta quando amount <= saldo', async () => {
    goalFindFirst.mockResolvedValue({ id: 'g1', name: 'Viagem', seedAmount: dec(0), targetAmount: dec(1000) })
    walletFindFirst.mockResolvedValue({ id: 'w1' })
    getWalletBalance.mockResolvedValue(500)
    txAggregate.mockResolvedValue({ _sum: { amount: dec(200) } })

    const { depositToGoal } = await load()
    const res = await depositToGoal('u1', { goalId: 'g1', walletId: 'w1', amount: 200 })

    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 200,
        type: 'EXPENSE',
        walletId: 'w1',
        goalId: 'g1',
        description: 'Aporte → Viagem',
      }),
    })
    expect(res).toEqual({ goalId: 'g1', name: 'Viagem', currentAmount: 200, targetAmount: 1000 })
  })

  it('lança "Saldo insuficiente" quando amount > saldo', async () => {
    goalFindFirst.mockResolvedValue({ id: 'g1', name: 'X', seedAmount: dec(0), targetAmount: dec(1000) })
    walletFindFirst.mockResolvedValue({ id: 'w1' })
    getWalletBalance.mockResolvedValue(50)

    const { depositToGoal } = await load()
    await expect(depositToGoal('u1', { goalId: 'g1', walletId: 'w1', amount: 200 })).rejects.toThrow(
      'Saldo insuficiente na carteira selecionada',
    )
    expect(txCreate).not.toHaveBeenCalled()
  })

  it('lança "Meta não encontrada" / "Carteira não encontrada"', async () => {
    const { depositToGoal } = await load()
    goalFindFirst.mockResolvedValue(null)
    walletFindFirst.mockResolvedValue({ id: 'w1' })
    await expect(depositToGoal('u1', { goalId: 'g', walletId: 'w', amount: 1 })).rejects.toThrow(
      'Meta não encontrada',
    )
    goalFindFirst.mockResolvedValue({ id: 'g1', name: 'X', seedAmount: dec(0), targetAmount: dec(1) })
    walletFindFirst.mockResolvedValue(null)
    await expect(depositToGoal('u1', { goalId: 'g', walletId: 'w', amount: 1 })).rejects.toThrow(
      'Carteira não encontrada',
    )
  })
})

describe('withdrawFromGoal', () => {
  beforeEach(() => {
    goalFindFirst.mockReset()
    walletFindFirst.mockReset()
    txCreate.mockReset()
    txFindMany.mockReset()
  })

  it('cria uma transação INCOME quando amount <= guardado', async () => {
    goalFindFirst.mockResolvedValue({ id: 'g1', name: 'Viagem', seedAmount: dec(100) })
    walletFindFirst.mockResolvedValue({ id: 'w1' })
    txFindMany.mockResolvedValue([{ amount: dec(300), type: 'EXPENSE' }]) // net +300 → current 400

    const { withdrawFromGoal } = await load()
    const res = await withdrawFromGoal('u1', { goalId: 'g1', walletId: 'w1', amount: 150 })

    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 150,
        type: 'INCOME',
        goalId: 'g1',
        description: 'Resgate ← Viagem',
      }),
    })
    expect(res).toEqual({ goalId: 'g1', currentAmount: 250 })
  })

  it('lança "Valor excede o saldo guardado na meta" quando amount > guardado', async () => {
    goalFindFirst.mockResolvedValue({ id: 'g1', name: 'X', seedAmount: dec(0) })
    walletFindFirst.mockResolvedValue({ id: 'w1' })
    txFindMany.mockResolvedValue([{ amount: dec(50), type: 'EXPENSE' }]) // current 50

    const { withdrawFromGoal } = await load()
    await expect(withdrawFromGoal('u1', { goalId: 'g1', walletId: 'w1', amount: 200 })).rejects.toThrow(
      'Valor excede o saldo guardado na meta',
    )
    expect(txCreate).not.toHaveBeenCalled()
  })
})
