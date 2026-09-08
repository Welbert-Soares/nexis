import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getWalletsByUser = vi.fn()
const createWallet = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/wallet.repository', () => ({
  getWalletsByUser: (...a: unknown[]) => getWalletsByUser(...a),
  createWallet: (...a: unknown[]) => createWallet(...a),
}))

async function handlers() {
  const { Route } = await import('./wallets')
  return (Route.options as any).server.handlers as {
    GET: (ctx: { request: Request }) => Promise<Response>
    POST: (ctx: { request: Request }) => Promise<Response>
  }
}

function req(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request('http://x/api/mobile/wallets', {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const WALLET_FIXTURE = [
  { id: 'w1', name: 'Nubank', type: 'CHECKING', color: null, icon: null, balance: 250, initialBalance: 100, creditLimit: null, closingDay: null, dueDay: null },
]

describe('/api/mobile/wallets', () => {
  beforeEach(() => {
    getSession.mockReset()
    getWalletsByUser.mockReset()
    createWallet.mockReset()
  })

  it('GET 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).GET({ request: req('GET') })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(getWalletsByUser).not.toHaveBeenCalled()
  })

  it('GET 200 com as carteiras do usuário da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    getWalletsByUser.mockResolvedValue(WALLET_FIXTURE)
    const res = await (await handlers()).GET({ request: req('GET') })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(WALLET_FIXTURE)
    expect(getWalletsByUser).toHaveBeenCalledWith('u1')
  })

  it('POST 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await (await handlers()).POST({ request: req('POST', { name: 'X', type: 'CASH' }) })
    expect(res.status).toBe(401)
    expect(createWallet).not.toHaveBeenCalled()
  })

  it('POST 400 com body inválido', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await (await handlers()).POST({ request: req('POST', { name: '', type: 'CASH' }) })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBeTruthy()
    expect(createWallet).not.toHaveBeenCalled()
  })

  it('POST 200 cria a carteira com o userId da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    createWallet.mockResolvedValue({
      id: 'w9',
      name: 'Carteira',
      type: 'CASH',
      color: null,
      icon: null,
      initialBalance: { toNumber: () => 50 },
      creditLimit: null,
      closingDay: null,
      dueDay: null,
    })
    const res = await (await handlers()).POST({
      request: req('POST', { name: 'Carteira', type: 'CASH', balance: 50 }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ id: 'w9', name: 'Carteira', balance: 50, initialBalance: 50, creditLimit: null })
    expect(createWallet).toHaveBeenCalledWith({ userId: 'u1', name: 'Carteira', type: 'CASH', balance: 50 })
  })
})
