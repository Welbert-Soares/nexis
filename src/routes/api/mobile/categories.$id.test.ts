import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const updateCategory = vi.fn()
const deleteCategory = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/category.repository', () => ({
  updateCategory: (...a: unknown[]) => updateCategory(...a),
  deleteCategory: (...a: unknown[]) => deleteCategory(...a),
}))

async function handlers() {
  const { Route } = await import('./categories.$id')
  return (Route.options as any).server.handlers as {
    POST: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
    DELETE: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
  }
}

function req(method: string, body?: unknown) {
  return new Request('http://x/api/mobile/categories/c1', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/mobile/categories/$id', () => {
  beforeEach(() => {
    getSession.mockReset()
    updateCategory.mockReset()
    deleteCategory.mockReset()
  })

  it('POST 200 chama updateCategory (id do path, userId, dados)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateCategory.mockResolvedValue({ id: 'c1', name: 'Novo', color: '#0f0', icon: null })
    const res = await (await handlers()).POST({
      request: req('POST', { name: 'Novo', color: '#0f0' }),
      params: { id: 'c1' },
    })
    expect(res.status).toBe(200)
    expect(updateCategory).toHaveBeenCalledWith('c1', 'u1', { name: 'Novo', color: '#0f0', icon: undefined })
  })

  it('POST 400 sem name; POST 401 sem sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const a = await (await handlers()).POST({ request: req('POST', { color: '#0f0' }), params: { id: 'c1' } })
    expect(a.status).toBe(400)
    getSession.mockResolvedValue(null)
    const b = await (await handlers()).POST({ request: req('POST', { name: 'X', color: '#0f0' }), params: { id: 'c1' } })
    expect(b.status).toBe(401)
  })

  it('POST 404 quando o repo lança (categoria global/alheia)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateCategory.mockRejectedValue(new Error('Record to update not found'))
    const res = await (await handlers()).POST({
      request: req('POST', { name: 'X', color: '#0f0' }),
      params: { id: 'c1' },
    })
    expect(res.status).toBe(404)
  })

  it('DELETE 200 (null) chama deleteCategory', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteCategory.mockResolvedValue(undefined)
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'c1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(deleteCategory).toHaveBeenCalledWith('c1', 'u1')
  })

  it('DELETE 409 quando a categoria está em uso', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteCategory.mockRejectedValue(new Error('Categoria em uso por transações'))
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'c1' } })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Categoria em uso por transações' })
  })

  it('DELETE 404 pra outros erros; DELETE 401 sem sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteCategory.mockRejectedValue(new Error('Record to delete does not exist'))
    const a = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'c1' } })
    expect(a.status).toBe(404)
    getSession.mockResolvedValue(null)
    const b = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'c1' } })
    expect(b.status).toBe(401)
  })
})
