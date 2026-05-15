import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { createWallet, deleteWallet, getWalletsByUser, transferBetweenWallets, updateWallet } from '#/server/repositories/wallet.repository'

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
  icon: z.string().optional(),
  balance: z.number().min(0).optional(),
})

export const createUserWallet = createServerFn({ method: 'POST' })
  .inputValidator(createWalletSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const wallet = await createWallet({ userId: session.user.id, ...data })
    return { ...wallet, balance: wallet.balance.toNumber() }
  })

const editWalletSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  type: z.enum(['CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'CREDIT']).optional(),
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
})

export const editUserWallet = createServerFn({ method: 'POST' })
  .inputValidator(editWalletSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const { id, ...rest } = data
    const wallet = await updateWallet(id, session.user.id, rest)
    return { ...wallet, balance: wallet.balance.toNumber() }
  })

export const deleteUserWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    await deleteWallet(data.id, session.user.id)
  })

export const transferUserWallets = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    fromWalletId: z.string(),
    toWalletId: z.string(),
    amount: z.number().positive(),
  }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    await transferBetweenWallets(session.user.id, data.fromWalletId, data.toWalletId, data.amount)
  })
