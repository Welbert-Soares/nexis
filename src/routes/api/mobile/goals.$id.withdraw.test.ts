import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const withdrawFromGoal = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/goal.repository', () => ({
  withdrawFromGoal: (...a: unknown[]) => withdrawFromGoal(...a),
}))

async function POST(ctx: { request: Request; params?: { id?: string } }) {
  const { Route } = await import('./goals.$id.withdraw')
  return (Route.options as any).server.handlers.POST(ctx)
}

function req(body?: unknown) {
  return new Request('http://x/api/mobile/goals/g1/withdraw', {
    method: 'POST',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/mobile/goals/$id/withdraw', () => {
  beforeEach(() => {
    getSession.mockReset()
    withdrawFromGoal.mockReset()
  })

  it('401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST({ request: req({ walletId: 'w1', amount: 10 }), params: { id: 'g1' } })
    expect(res.status).toBe(401)
  })

  it('200 chama withdrawFromGoal com o goalId do path', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    withdrawFromGoal.mockResolvedValue({ goalId: 'g1', currentAmount: 50 })
    const res = await POST({ request: req({ walletId: 'w1', amount: 100 }), params: { id: 'g1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ goalId: 'g1', currentAmount: 50 })
    expect(withdrawFromGoal).toHaveBeenCalledWith('u1', { goalId: 'g1', walletId: 'w1', amount: 100 })
  })

  it('400 quando lança "Valor excede o saldo guardado na meta"', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    withdrawFromGoal.mockRejectedValue(new Error('Valor excede o saldo guardado na meta'))
    const res = await POST({ request: req({ walletId: 'w1', amount: 999 }), params: { id: 'g1' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Valor excede o saldo guardado na meta' })
  })
})
