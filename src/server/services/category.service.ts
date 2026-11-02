import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import {
  getCategoriesByType,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoriesWithUsage,
} from '#/server/repositories/category.repository'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

export const getCategories = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ type: z.enum(['INCOME', 'EXPENSE']) }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    return getCategoriesByType(data.type, session.user.id)
  })

export const addCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    name: z.string().min(1),
    color: z.string(),
    icon: z.string().optional(),
    type: z.enum(['INCOME', 'EXPENSE']),
  }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    return createCategory({ ...data, userId: session.user.id })
  })

export const editCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    id: z.string(),
    name: z.string().min(1),
    color: z.string(),
    icon: z.string().nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    return updateCategory(data.id, session.user.id, { name: data.name, color: data.color, icon: data.icon })
  })

export const getCategoriesManagement = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionOrThrow()
  return getCategoriesWithUsage(session.user.id)
})

export const removeCategory = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    return deleteCategory(data.id, session.user.id)
  })
