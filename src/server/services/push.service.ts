import webpush from 'web-push'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import {
  upsertSubscription,
  deleteSubscriptionByEndpoint,
  getSubscriptionsByUser,
} from '#/server/repositories/push.repository'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

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

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
) {
  const subscriptions = await getSubscriptionsByUser(userId)
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          JSON.parse(sub.subscription) as webpush.PushSubscription,
          JSON.stringify(payload),
        )
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await deleteSubscriptionByEndpoint(sub.endpoint)
        }
      }
    }),
  )
}
