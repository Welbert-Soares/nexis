import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getTransactionsByMonth = vi.fn()
const createTransaction = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  getTransactionsByMonth: (...a: unknown[]) => getTransactionsByMonth(...a),
  createTransaction: (...a: unknown[]) => createTransaction(...a),
}))

async function handlers() {
  const { Route } = await import('./transactions')
  return (Route.options as any).server.handlers as {
    GET: (ctx: { request: Request }) => Promise<Response>
    POST: (ctx: { request: Request }) => Promise<Response>
  }
}

function req(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const TX_FIXTURE = [
  {
    id: 't1',
    type: 'EXPENSE',
    amount: 42.5,
    description: 'Almoço',
    date: '2026-09-15T12:00:00.000Z',
    walletId: 'w1',
    categoryId: 'c1',
    category: { name: 'Alimentação', color: '#f00', icon: 'Utensils' },
    wallet: { id: 'w1', name: 'Nubank', color: null },
    recurring: false,
    parentId: null,
    isInstallment: false,
    isTransfer: false,
  },
]

describe('/api/mobile/transactions', () => {
  beforeEach(() => {
    getSession.mockReset()
    getTransactionsByMonth.mockReset()
    createTransaction.mockReset()
  })

  it('GET 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).GET({
      request: req('http://x/api/mobile/transactions?year=2026&month=9', 'GET'),
    })
    expect(res.status).toBe(401)
    expect(getTransactionsByMonth).not.toHaveBeenCalled()
  })

  it('GET 200 com as transações do mês do usuário da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    getTransactionsByMonth.mockResolvedValue(TX_FIXTURE)
    const res = await (await handlers()).GET({
      request: req('http://x/api/mobile/transactions?year=2026&month=9', 'GET'),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(TX_FIXTURE)
    expect(getTransactionsByMonth).toHaveBeenCalledWith('u1', 2026, 9)
  })

  it('GET 400 sem month', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).GET({
      request: req('http://x/api/mobile/transactions?year=2026', 'GET'),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBeTruthy()
    expect(getTransactionsByMonth).not.toHaveBeenCalled()
  })

  it('GET 400 com month fora do range', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).GET({
      request: req('http://x/api/mobile/transactions?year=2026&month=13', 'GET'),
    })
    expect(res.status).toBe(400)
  })

  it('POST 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/transactions', 'POST', {
        walletId: 'w1',
        amount: 10,
        type: 'EXPENSE',
      }),
    })
    expect(res.status).toBe(401)
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it('POST 400 com amount negativo', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/transactions', 'POST', {
        walletId: 'w1',
        amount: -1,
        type: 'EXPENSE',
      }),
    })
    expect(res.status).toBe(400)
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it('POST 200 cria a transação e converte o amount', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createTransaction.mockResolvedValue({
      id: 't9',
      type: 'EXPENSE',
      walletId: 'w1',
      categoryId: null,
      description: null,
      amount: { toNumber: () => 25 },
    })
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/transactions', 'POST', {
        walletId: 'w1',
        amount: 25,
        type: 'EXPENSE',
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 't9', amount: 25 })
    expect(createTransaction).toHaveBeenCalledWith({
      walletId: 'w1',
      amount: 25,
      type: 'EXPENSE',
      date: undefined,
    })
  })

  it('POST normaliza date "YYYY-MM-DD" pro meio-dia local (sem pular de dia)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createTransaction.mockResolvedValue({ id: 't9', amount: { toNumber: () => 25 } })
    await (await handlers()).POST({
      request: req('http://x/api/mobile/transactions', 'POST', {
        walletId: 'w1',
        amount: 25,
        type: 'EXPENSE',
        date: '2026-09-15',
      }),
    })
    const passed = createTransaction.mock.calls[0][0].date as Date
    expect(passed).toBeInstanceOf(Date)
    expect(passed.getFullYear()).toBe(2026)
    expect(passed.getMonth()).toBe(8) // setembro
    expect(passed.getDate()).toBe(15)
  })
})
