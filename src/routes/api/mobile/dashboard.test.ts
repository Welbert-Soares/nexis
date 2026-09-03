import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getDashboardData = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/dashboard.repository', () => ({
  getDashboardData: (...a: unknown[]) => getDashboardData(...a),
}))

// A rota exporta `Route`; o handler está em Route.options.server.handlers.GET
async function callGet(headers: Record<string, string> = {}) {
  const { Route } = await import('./dashboard')
  const handler = (Route.options as any).server.handlers.GET as (ctx: { request: Request }) => Promise<Response>
  return handler({ request: new Request('http://x/api/mobile/dashboard', { headers }) })
}

const FIXTURE = {
  totalBalance: 100,
  hasWallets: true,
  monthly: { income: 50, expenses: 20 },
  recent: [],
  categoryBreakdown: [],
}

describe('GET /api/mobile/dashboard', () => {
  beforeEach(() => {
    getSession.mockReset()
    getDashboardData.mockReset()
  })

  it('responde 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await callGet()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(getDashboardData).not.toHaveBeenCalled()
  })

  it('responde 200 com o dashboard do usuário da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-42' } })
    getDashboardData.mockResolvedValue(FIXTURE)
    const res = await callGet({ cookie: 'better-auth.session_token=abc' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(FIXTURE)
    expect(getDashboardData).toHaveBeenCalledWith('user-42')
  })
})
