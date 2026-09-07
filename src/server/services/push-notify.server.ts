import { getSubscriptionsByUser, deleteSubscriptionByEndpoint } from '#/server/repositories/push.repository'

async function getWebPush() {
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      '[push] VAPID_SUBJECT/VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas — notificações push não podem ser enviadas.',
    )
  }
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
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
          return
        }
        console.error(`[push] falha ao enviar para ${sub.endpoint}:`, err)
      }
    }),
  )
}
