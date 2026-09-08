import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getCategoriesWithUsage = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/category.repository', () => ({
  getCategoriesWithUsage: (...a: unknown[]) => getCategoriesWithUsage(...a),
}))

async function GET(ctx: { request: Request }) {
  const { Route } = await import('./categories.manage')
  return (Route.options as any).server.handlers.GET(ctx)
}

describe('GET /api/mobile/categories/manage', () => {
  beforeEach(() => {
    getSession.mockReset()
    getCategoriesWithUsage.mockReset()
  })

  it('401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await GET({ request: new Request('http://x/api/mobile/categories/manage') })
    expect(res.status).toBe(401)
    expect(getCategoriesWithUsage).not.toHaveBeenCalled()
  })

  it('200 repassa getCategoriesWithUsage(userId)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const rows = [{ id: 'c1', name: 'X', type: 'EXPENSE', userId: 'u1', _count: { transactions: 3 } }]
    getCategoriesWithUsage.mockResolvedValue(rows)
    const res = await GET({ request: new Request('http://x/api/mobile/categories/manage') })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(rows)
    expect(getCategoriesWithUsage).toHaveBeenCalledWith('u1')
  })
})
