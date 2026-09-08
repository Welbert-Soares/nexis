import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const depositToGoal = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/goal.repository', () => ({
  depositToGoal: (...a: unknown[]) => depositToGoal(...a),
}))

async function POST(ctx: { request: Request; params?: { id?: string } }) {
  const { Route } = await import('./goals.$id.deposit')
  return (Route.options as any).server.handlers.POST(ctx)
}

function req(body?: unknown) {
  return new Request('http://x/api/mobile/goals/g1/deposit', {
    method: 'POST',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/mobile/goals/$id/deposit', () => {
  beforeEach(() => {
    getSession.mockReset()
    depositToGoal.mockReset()
  })

  it('401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST({ request: req({ walletId: 'w1', amount: 10 }), params: { id: 'g1' } })
    expect(res.status).toBe(401)
    expect(depositToGoal).not.toHaveBeenCalled()
  })

  it('400 body inválido (amount <= 0)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST({ request: req({ walletId: 'w1', amount: 0 }), params: { id: 'g1' } })
    expect(res.status).toBe(400)
  })

  it('200 chama depositToGoal com (userId, { goalId do path, walletId, amount })', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    depositToGoal.mockResolvedValue({ goalId: 'g1', name: 'X', currentAmount: 200, targetAmount: 1000 })
    const res = await POST({ request: req({ walletId: 'w1', amount: 200 }), params: { id: 'g1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ goalId: 'g1', currentAmount: 200 })
    expect(depositToGoal).toHaveBeenCalledWith('u1', { goalId: 'g1', walletId: 'w1', amount: 200 })
  })

  it('400 quando depositToGoal lança "Saldo insuficiente"', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    depositToGoal.mockRejectedValue(new Error('Saldo insuficiente na carteira selecionada'))
    const res = await POST({ request: req({ walletId: 'w1', amount: 999 }), params: { id: 'g1' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Saldo insuficiente na carteira selecionada' })
  })

  it('404 quando a mensagem diz "não encontrada"', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    depositToGoal.mockRejectedValue(new Error('Meta não encontrada'))
    const res = await POST({ request: req({ walletId: 'w1', amount: 10 }), params: { id: 'g1' } })
    expect(res.status).toBe(404)
  })

  it('cai pro id da URL quando params não vem', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    depositToGoal.mockResolvedValue({ goalId: 'g1' })
    await POST({ request: req({ walletId: 'w1', amount: 5 }) })
    expect(depositToGoal.mock.calls[0][1].goalId).toBe('g1')
  })
})
