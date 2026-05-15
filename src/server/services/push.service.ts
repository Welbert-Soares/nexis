import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { upsertSubscription, deleteSubscriptionByEndpoint } from '#/server/repositories/push.repository'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

export const subscribeToNotifications = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ endpoint: z.string(), subscription: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    await upsertSubscription(session.user.id, data.endpoint, data.subscription)
  })

export const unsubscribeFromNotifications = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ endpoint: z.string() }))
  .handler(async ({ data }) => {
    await deleteSubscriptionByEndpoint(data.endpoint)
  })

export const getVapidPublicKey = createServerFn({ method: 'GET' }).handler(() => {
  return process.env.VAPID_PUBLIC_KEY!
})
