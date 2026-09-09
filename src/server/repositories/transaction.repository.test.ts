import { describe, expect, it, vi, beforeEach } from 'vitest'

const txFindFirst = vi.fn()
const txUpdate = vi.fn()

vi.mock('#/db', () => ({
  prisma: {
    transaction: {
      findFirst: (...a: unknown[]) => txFindFirst(...a),
      update: (...a: unknown[]) => txUpdate(...a),
    },
  },
}))

async function load() {
  return import('./transaction.repository')
}

const OLD = {
  id: 't1',
  walletId: 'w1',
  date: new Date('2026-09-10T12:00:00.000Z'),
  interval: null,
  recurring: false,
}

function updateData() {
  return txUpdate.mock.calls[0][0].data as Record<string, unknown>
}

describe('updateTransaction — nextDue derivado', () => {
  beforeEach(() => {
    txFindFirst.mockReset()
    txUpdate.mockReset()
    txFindFirst.mockResolvedValue(OLD)
    txUpdate.mockResolvedValue({ id: 't1', amount: { toNumber: () => 10 } })
  })

  it('recurring:true sem nextDue e interval WEEKLY → grava nextDue = +7 dias', async () => {
    const { updateTransaction } = await load()
    await updateTransaction('t1', 'u1', {
      amount: 10,
      type: 'EXPENSE',
      date: new Date('2026-09-10T12:00:00.000Z'),
      recurring: true,
      interval: 'WEEKLY',
    })
    const nextDue = updateData().nextDue as Date
    expect(nextDue).toBeInstanceOf(Date)
    expect(nextDue.toISOString().slice(0, 10)).toBe('2026-09-17')
  })

  it('recurring:true trocando pra MONTHLY, sem date → usa old.date + 1 mês', async () => {
    const { updateTransaction } = await load()
    await updateTransaction('t1', 'u1', {
      amount: 10,
      type: 'EXPENSE',
      recurring: true,
      interval: 'MONTHLY',
    })
    const nextDue = updateData().nextDue as Date
    expect(nextDue.toISOString().slice(0, 10)).toBe('2026-10-10')
  })

  it('recurring:false → grava nextDue: null', async () => {
    const { updateTransaction } = await load()
    await updateTransaction('t1', 'u1', { amount: 10, type: 'EXPENSE', recurring: false })
    expect(updateData().nextDue).toBeNull()
  })

  it('sem a chave recurring → não mexe em nextDue', async () => {
    const { updateTransaction } = await load()
    await updateTransaction('t1', 'u1', { amount: 10, type: 'EXPENSE', description: 'x' })
    expect('nextDue' in updateData()).toBe(false)
  })

  it('recurring:true COM nextDue explícito → respeita o explícito', async () => {
    const { updateTransaction } = await load()
    const explicit = new Date('2099-01-01T12:00:00.000Z')
    await updateTransaction('t1', 'u1', {
      amount: 10,
      type: 'EXPENSE',
      recurring: true,
      interval: 'WEEKLY',
      nextDue: explicit,
    })
    expect((updateData().nextDue as Date).toISOString()).toBe(explicit.toISOString())
  })

  it('lança "Transaction not found" quando old não existe', async () => {
    txFindFirst.mockResolvedValue(null)
    const { updateTransaction } = await load()
    await expect(
      updateTransaction('t1', 'u1', { amount: 1, type: 'EXPENSE' }),
    ).rejects.toThrow('Transaction not found')
  })
})
