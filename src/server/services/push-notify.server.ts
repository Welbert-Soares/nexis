import { getSubscriptionsByUser, deleteSubscriptionByEndpoint } from '#/server/repositories/push.repository'

async function getWebPush() {
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  return webpush
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
) {
  const webpush = await getWebPush()
  const subscriptions = await getSubscriptionsByUser(userId)
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          JSON.parse(sub.subscription) as Parameters<typeof webpush.sendNotification>[0],
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
