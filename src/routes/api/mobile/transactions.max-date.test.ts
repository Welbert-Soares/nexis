import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getMaxTransactionDate = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/transaction.repository', () => ({
  getMaxTransactionDate: (...a: unknown[]) => getMaxTransactionDate(...a),
}))

async function handlers() {
  const { Route } = await import('./transactions.max-date')
  return (Route.options as any).server.handlers as {
    GET: (ctx: { request: Request }) => Promise<Response>
  }
}

const req = () => new Request('http://x/api/mobile/transactions/max-date', { method: 'GET' })

describe('/api/mobile/transactions/max-date', () => {
  beforeEach(() => {
    getSession.mockReset()
    getMaxTransactionDate.mockReset()
  })

  it('401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).GET({ request: req() })
    expect(res.status).toBe(401)
    expect(getMaxTransactionDate).not.toHaveBeenCalled()
  })

  it('200 com a data ISO da transação mais futura do usuário', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    getMaxTransactionDate.mockResolvedValue(new Date('2027-03-10T12:00:00.000Z'))
    const res = await (await handlers()).GET({ request: req() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ date: '2027-03-10T12:00:00.000Z' })
    expect(getMaxTransactionDate).toHaveBeenCalledWith('u1')
  })

  it('200 com date:null quando o usuário não tem transações', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    getMaxTransactionDate.mockResolvedValue(null)
    const res = await (await handlers()).GET({ request: req() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ date: null })
  })
})
