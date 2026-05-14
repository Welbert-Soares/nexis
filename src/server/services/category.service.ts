import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCategoriesByType } from '#/server/repositories/category.repository'

const schema = z.object({ type: z.enum(['INCOME', 'EXPENSE']) })

export const getCategories = createServerFn({ method: 'GET' })
  .inputValidator(schema)
  .handler(({ data }) => getCategoriesByType(data.type))
