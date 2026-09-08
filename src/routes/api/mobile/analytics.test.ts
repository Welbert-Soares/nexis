import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getAnalyticsData = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/analytics.repository', () => ({
  getAnalyticsData: (...a: unknown[]) => getAnalyticsData(...a),
}))

// A rota exporta `Route`; o handler está em Route.options.server.handlers.GET
async function callGet(headers: Record<string, string> = {}) {
  const { Route } = await import('./analytics')
  const handler = (Route.options as any).server.handlers.GET as (ctx: { request: Request }) => Promise<Response>
  return handler({ request: new Request('http://x/api/mobile/analytics', { headers }) })
}

const FIXTURE = {
  monthly: { income: 100, expenses: 40 },
  categoryBreakdown: [{ id: 'c1', name: 'Mercado', color: '#fff', amount: 40 }],
  trend: [{ month: '2026-09', income: 100, expenses: 40 }],
  dayOfMonth: 8,
  daysInMonth: 30,
}

describe('GET /api/mobile/analytics', () => {
  beforeEach(() => {
    getSession.mockReset()
    getAnalyticsData.mockReset()
  })

  it('responde 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await callGet()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(getAnalyticsData).not.toHaveBeenCalled()
  })

  it('responde 200 com o payload de getAnalyticsData pro usuário da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-42' } })
    getAnalyticsData.mockResolvedValue(FIXTURE)
    const res = await callGet({ cookie: 'better-auth.session_token=abc' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(FIXTURE)
    expect(getAnalyticsData).toHaveBeenCalledWith('user-42')
  })
})
