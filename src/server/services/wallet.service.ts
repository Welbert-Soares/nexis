import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { createWallet, getWalletsByUser } from '#/server/repositories/wallet.repository'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

export const getUserWallets = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionOrThrow()
  return getWalletsByUser(session.user.id)
})

const createWalletSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'CREDIT']),
  color: z.string().optional(),
  balance: z.number().min(0).optional(),
})

export const createUserWallet = createServerFn({ method: 'POST' })
  .inputValidator(createWalletSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const wallet = await createWallet({ userId: session.user.id, ...data })
    return { ...wallet, balance: wallet.balance.toNumber() }
  })
