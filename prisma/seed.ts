import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const CATEGORIES = [
  { name: 'Alimentação', icon: 'UtensilsCrossed', color: '#f97316', type: 'EXPENSE' },
  { name: 'Transporte', icon: 'Car', color: '#3b82f6', type: 'EXPENSE' },
  { name: 'Moradia', icon: 'Home', color: '#8b5cf6', type: 'EXPENSE' },
  { name: 'Saúde', icon: 'Heart', color: '#ef4444', type: 'EXPENSE' },
  { name: 'Educação', icon: 'BookOpen', color: '#06b6d4', type: 'EXPENSE' },
  { name: 'Lazer', icon: 'Smile', color: '#ec4899', type: 'EXPENSE' },
  { name: 'Compras', icon: 'ShoppingBag', color: '#f59e0b', type: 'EXPENSE' },
  { name: 'Outros', icon: 'MoreHorizontal', color: '#71717a', type: 'EXPENSE' },
  { name: 'Salário', icon: 'Briefcase', color: '#22c55e', type: 'INCOME' },
  { name: 'Freelance', icon: 'Laptop', color: '#10b981', type: 'INCOME' },
  { name: 'Investimentos', icon: 'TrendingUp', color: '#6366f1', type: 'INCOME' },
  { name: 'Outros', icon: 'MoreHorizontal', color: '#71717a', type: 'INCOME' },
] as const

async function main() {
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: `seed-${cat.type}-${cat.name}` },
      update: {},
      create: { id: `seed-${cat.type}-${cat.name}`, ...cat },
    })
  }
  console.log('Seed concluído.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
