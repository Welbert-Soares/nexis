import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const updateTransaction = vi.fn()
const deleteTransaction = vi.fn()
const deleteInstallmentGroup = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  updateTransaction: (...a: unknown[]) => updateTransaction(...a),
  deleteTransaction: (...a: unknown[]) => deleteTransaction(...a),
  deleteInstallmentGroup: (...a: unknown[]) => deleteInstallmentGroup(...a),
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
    deleteInstallmentGroup.mockReset()
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

  it('POST 200 com recurring/interval repassa pro updateTransaction', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateTransaction.mockResolvedValue({ id: 't1', amount: { toNumber: () => 10 } })
    await (await handlers()).POST({
      request: req('POST', { amount: 10, type: 'EXPENSE', recurring: true, interval: 'WEEKLY' }),
      params: { id: 't1' },
    })
    expect(updateTransaction).toHaveBeenCalledWith(
      't1',
      'u1',
      expect.objectContaining({ recurring: true, interval: 'WEEKLY' }),
    )
  })

  it('POST 200 com recurring:false repassa o desligamento', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateTransaction.mockResolvedValue({ id: 't1', amount: { toNumber: () => 10 } })
    await (await handlers()).POST({
      request: req('POST', { amount: 10, type: 'EXPENSE', recurring: false }),
      params: { id: 't1' },
    })
    expect(updateTransaction.mock.calls[0][2].recurring).toBe(false)
  })

  it('POST 400 com interval fora do enum', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).POST({
      request: req('POST', { amount: 10, type: 'EXPENSE', recurring: true, interval: 'DAILY' }),
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

  function delReq(qs = '') {
    return new Request(`http://x/api/mobile/transactions/t1${qs}`, { method: 'DELETE' })
  }

  it('DELETE ?mode=all chama deleteInstallmentGroup', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteInstallmentGroup.mockResolvedValue(undefined)
    const res = await (await handlers()).DELETE({ request: delReq('?mode=all'), params: { id: 't1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(deleteInstallmentGroup).toHaveBeenCalledWith('t1', 'u1', 'all')
    expect(deleteTransaction).not.toHaveBeenCalled()
  })

  it('DELETE ?mode=this-and-future chama deleteInstallmentGroup', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteInstallmentGroup.mockResolvedValue(undefined)
    await (await handlers()).DELETE({ request: delReq('?mode=this-and-future'), params: { id: 't1' } })
    expect(deleteInstallmentGroup).toHaveBeenCalledWith('t1', 'u1', 'this-and-future')
  })

  it('DELETE sem mode chama deleteTransaction', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteTransaction.mockResolvedValue(undefined)
    await (await handlers()).DELETE({ request: delReq(), params: { id: 't1' } })
    expect(deleteTransaction).toHaveBeenCalledWith('t1', 'u1')
    expect(deleteInstallmentGroup).not.toHaveBeenCalled()
  })

  it('DELETE ?mode=foo (inválido) cai no deleteTransaction', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteTransaction.mockResolvedValue(undefined)
    await (await handlers()).DELETE({ request: delReq('?mode=foo'), params: { id: 't1' } })
    expect(deleteTransaction).toHaveBeenCalledWith('t1', 'u1')
  })

  it('DELETE ?mode=all com erro do repo → 404', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteInstallmentGroup.mockRejectedValue(new Error('Transaction not found'))
    const res = await (await handlers()).DELETE({ request: delReq('?mode=all'), params: { id: 't1' } })
    expect(res.status).toBe(404)
  })
})
