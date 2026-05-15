import { prisma } from '#/db'

export async function shouldSendNotification(userId: string, type: string, entityId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const key = `${type}:${entityId}:${today}`
  try {
    await prisma.notificationLog.create({ data: { userId, key } })
    return true
  } catch {
    // unique constraint = already sent today
    return false
  }
}

export async function upsertSubscription(userId: string, endpoint: string, subscription: string) {
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { subscription },
    create: { userId, endpoint, subscription },
  })
}

export async function deleteSubscriptionByEndpoint(endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint } })
}

export async function getSubscriptionsByUser(userId: string) {
  return prisma.pushSubscription.findMany({ where: { userId } })
}
