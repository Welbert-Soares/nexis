import { prisma } from '#/db'

export function getCategoriesByType(type: 'INCOME' | 'EXPENSE') {
  return prisma.category.findMany({
    where: { type },
    orderBy: { name: 'asc' },
  })
}
