import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const updateGoal = vi.fn()
const deleteGoal = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/goal.repository', () => ({
  updateGoal: (...a: unknown[]) => updateGoal(...a),
  deleteGoal: (...a: unknown[]) => deleteGoal(...a),
}))

async function handlers() {
  const { Route } = await import('./goals.$id')
  return (Route.options as any).server.handlers as {
    POST: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
    DELETE: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
  }
}

function req(method: string, body?: unknown) {
  return new Request('http://x/api/mobile/goals/g1', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const OK_GOAL = { id: 'g1', targetAmount: { toNumber: () => 1000 }, seedAmount: { toNumber: () => 0 } }

describe('/api/mobile/goals/$id', () => {
  beforeEach(() => {
    getSession.mockReset()
    updateGoal.mockReset()
    deleteGoal.mockReset()
  })

  it('POST 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).POST({ request: req('POST', { name: 'X' }), params: { id: 'g1' } })
    expect(res.status).toBe(401)
    expect(updateGoal).not.toHaveBeenCalled()
  })

  it('POST 200 chama updateGoal e converte Decimals', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateGoal.mockResolvedValue(OK_GOAL)
    const res = await (await handlers()).POST({
      request: req('POST', { name: 'Nova', targetAmount: 1000 }),
      params: { id: 'g1' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'g1', targetAmount: 1000, seedAmount: 0 })
    expect(updateGoal).toHaveBeenCalledWith('g1', 'u1', { name: 'Nova', targetAmount: 1000 })
  })

  it('POST com deadline null limpa; sem deadline não mexe na chave', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateGoal.mockResolvedValue(OK_GOAL)

    await (await handlers()).POST({ request: req('POST', { deadline: null }), params: { id: 'g1' } })
    expect(updateGoal.mock.calls[0][2]).toEqual({ deadline: null })

    updateGoal.mockClear()
    await (await handlers()).POST({ request: req('POST', { name: 'X' }), params: { id: 'g1' } })
    expect(updateGoal.mock.calls[0][2]).toEqual({ name: 'X' })
    expect('deadline' in updateGoal.mock.calls[0][2]).toBe(false)
  })

  it('POST com deadline string vira Date ao meio-dia', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateGoal.mockResolvedValue(OK_GOAL)
    await (await handlers()).POST({ request: req('POST', { deadline: '2027-01-15' }), params: { id: 'g1' } })
    const d = updateGoal.mock.calls[0][2].deadline as Date
    expect(d).toBeInstanceOf(Date)
    expect(d.getFullYear()).toBe(2027)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(15)
  })

  it('POST 404 quando o repo lança', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateGoal.mockRejectedValue(new Error('Goal not found'))
    const res = await (await handlers()).POST({ request: req('POST', { name: 'X' }), params: { id: 'g1' } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Goal not found' })
  })

  it('DELETE 200 (null) chama deleteGoal', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteGoal.mockResolvedValue(undefined)
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'g1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(deleteGoal).toHaveBeenCalledWith('g1', 'u1')
  })

  it('DELETE 404 quando o repo lança; DELETE 401 sem sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteGoal.mockRejectedValue(new Error('Goal not found'))
    const a = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'g1' } })
    expect(a.status).toBe(404)

    getSession.mockResolvedValue(null)
    const b = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'g1' } })
    expect(b.status).toBe(401)
  })
})
