import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const processDueRecurring = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  processDueRecurring: (...a: unknown[]) => processDueRecurring(...a),
}))

async function handlers() {
  const { Route } = await import('./transactions.trigger-recurring')
  return (Route.options as any).server.handlers as {
    POST: (ctx: { request: Request }) => Promise<Response>
  }
}

const req = () =>
  new Request('http://x/api/mobile/transactions/trigger-recurring', { method: 'POST' })

describe('/api/mobile/transactions/trigger-recurring', () => {
  beforeEach(() => {
    getSession.mockReset()
    processDueRecurring.mockReset()
  })

  it('401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).POST({ request: req() })
    expect(res.status).toBe(401)
    expect(processDueRecurring).not.toHaveBeenCalled()
  })

  it('processa as recorrências do usuário e responde { count }', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    processDueRecurring.mockResolvedValue(3)
    const res = await (await handlers()).POST({ request: req() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ count: 3 })
    expect(processDueRecurring).toHaveBeenCalledWith('u1')
  })

  it('count 0 quando não há nada vencido', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    processDueRecurring.mockResolvedValue(0)
    const res = await (await handlers()).POST({ request: req() })
    expect(await res.json()).toEqual({ count: 0 })
  })
})
