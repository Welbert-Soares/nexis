import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getBudgetsWithSpending = vi.fn()
const upsertBudget = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/budget.repository', () => ({
  getBudgetsWithSpending: (...a: unknown[]) => getBudgetsWithSpending(...a),
  upsertBudget: (...a: unknown[]) => upsertBudget(...a),
}))

async function handlers() {
  const { Route } = await import('./budgets')
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

// Linha crua de getBudgetsWithSpending (category incluída, transactions com Decimal).
const ROW = {
  id: 'b1',
  categoryId: 'c1',
  amount: { toNumber: () => 500 },
  category: {
    name: 'Mercado',
    color: null,
    icon: 'ShoppingCart',
    transactions: [{ amount: { toNumber: () => 10 } }, { amount: { toNumber: () => 5 } }],
  },
}

describe('/api/mobile/budgets', () => {
  beforeEach(() => {
    getSession.mockReset()
    getBudgetsWithSpending.mockReset()
    upsertBudget.mockReset()
  })

  it('GET 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).GET({
      request: req('http://x/api/mobile/budgets?year=2026&month=9', 'GET'),
    })
    expect(res.status).toBe(401)
    expect(getBudgetsWithSpending).not.toHaveBeenCalled()
  })

  it('GET 400 sem month', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).GET({
      request: req('http://x/api/mobile/budgets?year=2026', 'GET'),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBeTruthy()
    expect(getBudgetsWithSpending).not.toHaveBeenCalled()
  })

  it('GET 400 com month fora do range', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).GET({
      request: req('http://x/api/mobile/budgets?year=2026&month=13', 'GET'),
    })
    expect(res.status).toBe(400)
  })

  it('GET 200 mapeia as linhas (cor default, spent somado) pro (userId, month, year)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    getBudgetsWithSpending.mockResolvedValue([ROW])
    const res = await (await handlers()).GET({
      request: req('http://x/api/mobile/budgets?year=2026&month=9', 'GET'),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        id: 'b1',
        categoryId: 'c1',
        categoryName: 'Mercado',
        categoryColor: '#71717a',
        categoryIcon: 'ShoppingCart',
        limit: 500,
        spent: 15,
      },
    ])
    expect(getBudgetsWithSpending).toHaveBeenCalledWith('u1', 9, 2026)
  })

  it('POST 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/budgets', 'POST', {
        categoryId: 'c1',
        month: 9,
        year: 2026,
        amount: 200,
      }),
    })
    expect(res.status).toBe(401)
    expect(upsertBudget).not.toHaveBeenCalled()
  })

  it('POST 400 com amount <= 0', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/budgets', 'POST', {
        categoryId: 'c1',
        month: 9,
        year: 2026,
        amount: 0,
      }),
    })
    expect(res.status).toBe(400)
    expect(upsertBudget).not.toHaveBeenCalled()
  })

  it('POST 400 sem categoryId', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/budgets', 'POST', { month: 9, year: 2026, amount: 200 }),
    })
    expect(res.status).toBe(400)
    expect(upsertBudget).not.toHaveBeenCalled()
  })

  it('POST 200 faz upsert e converte o amount', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    upsertBudget.mockResolvedValue({ id: 'b1', categoryId: 'c1', amount: { toNumber: () => 200 } })
    const res = await (await handlers()).POST({
      request: req('http://x/api/mobile/budgets', 'POST', {
        categoryId: 'c1',
        month: 9,
        year: 2026,
        amount: 200,
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'b1', amount: 200 })
    expect(upsertBudget).toHaveBeenCalledWith('u1', 'c1', 9, 2026, 200)
  })
})
