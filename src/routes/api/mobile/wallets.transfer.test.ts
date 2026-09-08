import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const transferBetweenWallets = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/wallet.repository', () => ({
  transferBetweenWallets: (...a: unknown[]) => transferBetweenWallets(...a),
}))

async function post(body: unknown) {
  const { Route } = await import('./wallets.transfer')
  const handler = (Route.options as any).server.handlers.POST as (ctx: { request: Request }) => Promise<Response>
  return handler({
    request: new Request('http://x/api/mobile/wallets/transfer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
}

describe('POST /api/mobile/wallets/transfer', () => {
  beforeEach(() => {
    getSession.mockReset()
    transferBetweenWallets.mockReset()
  })

  it('200 chama o repository com os args da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    transferBetweenWallets.mockResolvedValue(undefined)
    const res = await post({ fromWalletId: 'a', toWalletId: 'b', amount: 30 })
    expect(res.status).toBe(200)
    expect(transferBetweenWallets).toHaveBeenCalledWith('u1', 'a', 'b', 30)
  })

  it('400 propaga a mensagem PT-BR do repository', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    transferBetweenWallets.mockRejectedValue(new Error('Saldo insuficiente na carteira de origem'))
    const res = await post({ fromWalletId: 'a', toWalletId: 'b', amount: 999 })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Saldo insuficiente na carteira de origem' })
  })

  it('400 com body inválido (amount negativo)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await post({ fromWalletId: 'a', toWalletId: 'b', amount: -1 })
    expect(res.status).toBe(400)
    expect(transferBetweenWallets).not.toHaveBeenCalled()
  })

  it('401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await post({ fromWalletId: 'a', toWalletId: 'b', amount: 30 })
    expect(res.status).toBe(401)
  })
})
