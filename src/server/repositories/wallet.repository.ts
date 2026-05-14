import { prisma } from '#/db'

export async function getWalletsByUser(userId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  return wallets.map((w) => ({ ...w, balance: w.balance.toNumber() }))
}

export function createWallet(data: {
  userId: string
  name: string
  type: 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT'
  color?: string
  balance?: number
}) {
  return prisma.wallet.create({ data })
}
