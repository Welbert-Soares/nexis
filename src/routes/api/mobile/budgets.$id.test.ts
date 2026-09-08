import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const deleteBudget = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/budget.repository', () => ({
  deleteBudget: (...a: unknown[]) => deleteBudget(...a),
}))

async function handlers() {
  const { Route } = await import('./budgets.$id')
  return (Route.options as any).server.handlers as {
    DELETE: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
  }
}

function req(method: string) {
  return new Request('http://x/api/mobile/budgets/b1', { method })
}

describe('/api/mobile/budgets/$id', () => {
  beforeEach(() => {
    getSession.mockReset()
    deleteBudget.mockReset()
  })

  it('DELETE 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'b1' } })
    expect(res.status).toBe(401)
    expect(deleteBudget).not.toHaveBeenCalled()
  })

  it('DELETE 200 exclui o orçamento do usuário e responde null', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteBudget.mockResolvedValue(undefined)
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'b1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(deleteBudget).toHaveBeenCalledWith('b1', 'u1')
  })

  it('DELETE 404 quando o repo lança', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteBudget.mockRejectedValue(new Error('Orçamento não encontrado'))
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'b1' } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Orçamento não encontrado' })
  })
})
