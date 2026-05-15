import { prisma } from '#/db'

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
