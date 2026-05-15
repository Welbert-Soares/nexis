import { prisma } from '#/db'

export function getCategoriesByType(type: 'INCOME' | 'EXPENSE', userId: string) {
  return prisma.category.findMany({
    where: { type, OR: [{ userId: null }, { userId }] },
    orderBy: [{ userId: 'asc' }, { name: 'asc' }],
  })
}

export function createCategory(data: {
  name: string
  color: string
  icon?: string
  type: 'INCOME' | 'EXPENSE'
  userId: string
}) {
  return prisma.category.create({ data })
}

export function updateCategory(id: string, userId: string, data: { name: string; color: string; icon?: string | null }) {
  return prisma.category.update({
    where: { id, userId },
    data,
  })
}

export async function deleteCategory(id: string, userId: string) {
  const inUse = await prisma.transaction.count({ where: { categoryId: id } })
  if (inUse > 0) throw new Error('Categoria em uso por transações')
  return prisma.category.delete({ where: { id, userId } })
}

export function getCategoriesWithUsage(userId: string) {
  return prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    include: { _count: { select: { transactions: true } } },
    orderBy: [{ type: 'asc' }, { userId: 'asc' }, { name: 'asc' }],
  })
}
