import { prisma } from '#/db'
import { Prisma } from '#/generated/prisma/client.js'

export async function shouldSendNotification(userId: string, type: string, entityId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)
  const key = `${type}:${entityId}:${today}`
  try {
    await prisma.notificationLog.create({ data: { userId, key } })
    return true
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // já enviado hoje (constraint única userId+key)
      return false
    }
    console.error('[push] falha ao registrar NotificationLog:', err)
    throw err
  }
}

export async function pruneOldNotificationLogs() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  await prisma.notificationLog.deleteMany({ where: { sentAt: { lt: cutoff } } })
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
