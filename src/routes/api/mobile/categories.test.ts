import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getCategoriesByType = vi.fn()
const createCategory = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/category.repository', () => ({
  getCategoriesByType: (...a: unknown[]) => getCategoriesByType(...a),
  createCategory: (...a: unknown[]) => createCategory(...a),
}))

async function handler() {
  const { Route } = await import('./categories')
  return (Route.options as any).server.handlers.GET as (ctx: { request: Request }) => Promise<Response>
}

async function postHandler() {
  const { Route } = await import('./categories')
  return (Route.options as any).server.handlers.POST as (ctx: { request: Request }) => Promise<Response>
}

function req(url: string) {
  return new Request(url, { method: 'GET' })
}

function postReq(body?: unknown) {
  return new Request('http://x/api/mobile/categories', {
    method: 'POST',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const CAT_FIXTURE = [
  { id: 'c1', name: 'Alimentação', color: '#f00', icon: 'Utensils', type: 'EXPENSE', userId: null },
  { id: 'c2', name: 'Mercado', color: null, icon: null, type: 'EXPENSE', userId: 'u1' },
]

describe('GET /api/mobile/categories', () => {
  beforeEach(() => {
    getSession.mockReset()
    getCategoriesByType.mockReset()
    createCategory.mockReset()
  })

  it('401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handler())({ request: req('http://x/api/mobile/categories?type=EXPENSE') })
    expect(res.status).toBe(401)
    expect(getCategoriesByType).not.toHaveBeenCalled()
  })

  it('200 com as categorias do tipo pedido', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    getCategoriesByType.mockResolvedValue(CAT_FIXTURE)
    const res = await (await handler())({ request: req('http://x/api/mobile/categories?type=EXPENSE') })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(CAT_FIXTURE)
    expect(getCategoriesByType).toHaveBeenCalledWith('EXPENSE', 'u1')
  })

  it('400 sem type', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handler())({ request: req('http://x/api/mobile/categories') })
    expect(res.status).toBe(400)
    expect(getCategoriesByType).not.toHaveBeenCalled()
  })

  it('400 com type inválido', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handler())({ request: req('http://x/api/mobile/categories?type=FOO') })
    expect(res.status).toBe(400)
  })

  it('POST 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await postHandler())({ request: postReq({ name: 'X', color: '#f00', type: 'EXPENSE' }) })
    expect(res.status).toBe(401)
    expect(createCategory).not.toHaveBeenCalled()
  })

  it('POST 400 sem name', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await postHandler())({ request: postReq({ color: '#f00', type: 'EXPENSE' }) })
    expect(res.status).toBe(400)
    expect(createCategory).not.toHaveBeenCalled()
  })

  it('POST 200 chama createCategory com o userId da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createCategory.mockResolvedValue({ id: 'c9', name: 'Pets', color: '#f00', icon: 'Dog', type: 'EXPENSE', userId: 'u1' })
    const res = await (await postHandler())({
      request: postReq({ name: 'Pets', color: '#f00', icon: 'Dog', type: 'EXPENSE' }),
    })
    expect(res.status).toBe(200)
    expect(createCategory).toHaveBeenCalledWith({ name: 'Pets', color: '#f00', icon: 'Dog', type: 'EXPENSE', userId: 'u1' })
  })
})
