import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const updateWallet = vi.fn()
const deleteWallet = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/wallet.repository', () => ({
  updateWallet: (...a: unknown[]) => updateWallet(...a),
  deleteWallet: (...a: unknown[]) => deleteWallet(...a),
}))

async function handlers() {
  const { Route } = await import('./wallets.$id')
  return (Route.options as any).server.handlers as {
    POST: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
    DELETE: (ctx: { request: Request; params: { id: string } }) => Promise<Response>
  }
}

function req(method: string, body?: unknown) {
  return new Request('http://x/api/mobile/wallets/w1', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/mobile/wallets/$id', () => {
  beforeEach(() => {
    getSession.mockReset()
    updateWallet.mockReset()
    deleteWallet.mockReset()
  })

  it('POST 200 edita a carteira do usuário', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateWallet.mockResolvedValue({
      id: 'w1',
      name: 'Novo nome',
      type: 'CHECKING',
      color: '#22c55e',
      icon: null,
      initialBalance: { toNumber: () => 100 },
      creditLimit: null,
      closingDay: null,
      dueDay: null,
    })
    const res = await (await handlers()).POST({
      request: req('POST', { name: 'Novo nome', color: '#22c55e' }),
      params: { id: 'w1' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'w1', name: 'Novo nome', balance: 100 })
    expect(updateWallet).toHaveBeenCalledWith('w1', 'u1', { name: 'Novo nome', color: '#22c55e' })
  })

  it('POST 404 quando a carteira não é do usuário', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    updateWallet.mockRejectedValue(new Error('Wallet not found'))
    const res = await (await handlers()).POST({
      request: req('POST', { name: 'X' }),
      params: { id: 'w1' },
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Wallet not found' })
  })

  it('DELETE 200 exclui a carteira do usuário', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    deleteWallet.mockResolvedValue(undefined)
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'w1' } })
    expect(res.status).toBe(200)
    expect(deleteWallet).toHaveBeenCalledWith('w1', 'u1')
  })

  it('DELETE 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).DELETE({ request: req('DELETE'), params: { id: 'w1' } })
    expect(res.status).toBe(401)
    expect(deleteWallet).not.toHaveBeenCalled()
  })
})
