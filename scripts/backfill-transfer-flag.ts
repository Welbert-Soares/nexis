import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const result = await prisma.transaction.updateMany({
    where: {
      isTransfer: false,
      OR: [
        { description: { startsWith: 'Transferência →' } },
        { description: { startsWith: 'Transferência ←' } },
      ],
    },
    data: { isTransfer: true },
  })
  console.log(`isTransfer: ${result.count} transferência(s) antiga(s) marcada(s).`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
