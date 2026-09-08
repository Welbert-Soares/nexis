import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getGoalsByUser = vi.fn()
const createGoal = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/goal.repository', () => ({
  getGoalsByUser: (...a: unknown[]) => getGoalsByUser(...a),
  createGoal: (...a: unknown[]) => createGoal(...a),
}))

async function handlers() {
  const { Route } = await import('./goals')
  return (Route.options as any).server.handlers as {
    GET: (ctx: { request: Request }) => Promise<Response>
    POST: (ctx: { request: Request }) => Promise<Response>
  }
}

function req(method: string, body?: unknown) {
  return new Request('http://x/api/mobile/goals', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/mobile/goals', () => {
  beforeEach(() => {
    getSession.mockReset()
    getGoalsByUser.mockReset()
    createGoal.mockReset()
  })

  it('GET 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).GET({ request: req('GET') })
    expect(res.status).toBe(401)
    expect(getGoalsByUser).not.toHaveBeenCalled()
  })

  it('GET 200 repassa getGoalsByUser', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    getGoalsByUser.mockResolvedValue([{ id: 'g1', name: 'Viagem' }])
    const res = await (await handlers()).GET({ request: req('GET') })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'g1', name: 'Viagem' }])
    expect(getGoalsByUser).toHaveBeenCalledWith('u1')
  })

  it('POST 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).POST({
      request: req('POST', { name: 'X', targetAmount: 100 }),
    })
    expect(res.status).toBe(401)
    expect(createGoal).not.toHaveBeenCalled()
  })

  it('POST 400 com targetAmount <= 0 ou sem name', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const a = await (await handlers()).POST({ request: req('POST', { name: 'X', targetAmount: 0 }) })
    expect(a.status).toBe(400)
    const b = await (await handlers()).POST({ request: req('POST', { targetAmount: 100 }) })
    expect(b.status).toBe(400)
    expect(createGoal).not.toHaveBeenCalled()
  })

  it('POST 200 converte a deadline string pro meio-dia local e os Decimals', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createGoal.mockResolvedValue({
      id: 'g1',
      targetAmount: { toNumber: () => 1000 },
      seedAmount: { toNumber: () => 50 },
    })
    const res = await (await handlers()).POST({
      request: req('POST', {
        name: 'Viagem',
        targetAmount: 1000,
        seedAmount: 50,
        deadline: '2026-12-31',
        color: '#3b82f6',
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'g1', targetAmount: 1000, seedAmount: 50 })
    const passed = createGoal.mock.calls[0][0]
    expect(passed.userId).toBe('u1')
    expect(passed.deadline).toBeInstanceOf(Date)
    expect(passed.deadline.getFullYear()).toBe(2026)
    expect(passed.deadline.getMonth()).toBe(11)
    expect(passed.deadline.getDate()).toBe(31)
  })

  it('POST sem deadline manda null pro createGoal', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createGoal.mockResolvedValue({
      id: 'g1',
      targetAmount: { toNumber: () => 1000 },
      seedAmount: { toNumber: () => 0 },
    })
    await (await handlers()).POST({ request: req('POST', { name: 'X', targetAmount: 1000 }) })
    expect(createGoal.mock.calls[0][0].deadline).toBeNull()
  })
})
