import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const updateTransaction = vi.fn()
const deleteTransaction = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  updateTransaction: (...a: unknown[]) => updateTransaction(...a),
  deleteTransaction: (...a: unknown[]) => deleteTransaction(...a),
}))

async function handlers() {
  const { Route } = await import('./transactions.$id')
  return (Route.options as any).server.handlers as {
    POST: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
    DELETE: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
  }
}

function req(method: string, body?: unknown) {
  return new Request('http://x/api/mobile/transactions/t1', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/mobile/transactions/$id', () => {
  beforeEach(() => {
    getSession.mockReset()
    updateTransaction.mockReset()
    deleteTransaction.mockReset()
  })

  it('POST 200 edita a transação do usuário', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateTransaction.mockResolvedValue({
      id: 't1',
      type: 'INCOME',
      walletId: 'w1',
      categoryId: null,
      description: null,
      amount: { toNumber: () => 80 },
    })
    const res = await (await handlers()).POST({
      request: req('POST', { amount: 80, type: 'INCOME' }),
      params: { id: 't1' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 't1', amount: 80 })
    expect(updateTransaction).toHaveBeenCalledWith('t1', 'u1', { amount: 80, type: 'INCOME' })
  })

  it('POST normaliza date pro meio-dia local', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateTransaction.mockResolvedValue({ id: 't1', amount: { toNumber: () => 1 } })
    await (await handlers()).POST({
      request: req('POST', { amount: 1, type: 'EXPENSE', date: '2026-09-15' }),
      params: { id: 't1' },
    })
    const passed = updateTransaction.mock.calls[0][2].date as Date
    expect(passed.getMonth()).toBe(8)
    expect(passed.getDate()).toBe(15)
  })

  it('POST 404 quando a transação não é do usuário', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateTransaction.mockRejectedValue(new Error('Transaction not found'))
    const res = await (await handlers()).POST({
      request: req('POST', { amount: 10, type: 'EXPENSE' }),
      params: { id: 't1' },
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Transaction not found' })
  })

  it('POST 400 com body inválido', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).POST({
      request: req('POST', { amount: 0, type: 'EXPENSE' }),
      params: { id: 't1' },
    })
    expect(res.status).toBe(400)
    expect(updateTransaction).not.toHaveBeenCalled()
  })

  it('DELETE 200 exclui a transação do usuário', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteTransaction.mockResolvedValue(undefined)
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 't1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(deleteTransaction).toHaveBeenCalledWith('t1', 'u1')
  })

  it('DELETE 404 quando a transação é de outro usuário', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteTransaction.mockRejectedValue(new Error('Transaction not found'))
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 't1' } })
    expect(res.status).toBe(404)
  })

  it('DELETE 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 't1' } })
    expect(res.status).toBe(401)
    expect(deleteTransaction).not.toHaveBeenCalled()
  })
})
