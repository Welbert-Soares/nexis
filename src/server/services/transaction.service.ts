import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import {
  createTransaction,
  createInstallments,
  deleteTransaction,
  getRecentTransactions,
  getTransactionsByMonth,
  updateTransaction,
  processDueRecurring,
} from '#/server/repositories/transaction.repository'
import { sendPushToUser } from '#/server/services/push-notify.server'
import { getExceededBudgets } from '#/server/repositories/budget.repository'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

function checkBudgetsAndNotify(userId: string) {
  getExceededBudgets(userId).then((alerts) => {
    if (alerts.length === 0) return
    const exceeded = alerts.filter((a) => a.pct >= 1)
    const top = alerts[0]
    const title = exceeded.length > 0 ? 'Limite de orçamento excedido' : 'Orçamento próximo do limite'
    const body = exceeded.length === 1
      ? `${top.name} ultrapassou o limite mensal`
      : exceeded.length > 1
      ? `${exceeded.length} orçamentos ultrapassados este mês`
      : `${top.name} está em ${Math.round(top.pct * 100)}% do limite`
    sendPushToUser(userId, { title, body, url: '/analytics' }).catch(() => {})
  }).catch(() => {})
}

const createTransactionSchema = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  recurring: z.boolean().optional(),
  interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  nextDue: z.coerce.date().optional(),
  installments: z.number().int().min(2).max(24).optional(),
})

export const addTransaction = createServerFn({ method: 'POST' })
  .inputValidator(createTransactionSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    if (data.installments && data.installments >= 2) {
      await createInstallments({
        walletId: data.walletId,
        amount: data.amount,
        type: data.type,
        categoryId: data.categoryId,
        description: data.description,
        date: data.date ?? new Date(),
        installments: data.installments,
      })
      if (data.type === 'EXPENSE') {
        checkBudgetsAndNotify(session.user.id)
      }
      return null
    }
    const [transaction] = await createTransaction(data)
    if (data.type === 'EXPENSE') {
      checkBudgetsAndNotify(session.user.id)
    }
    return { ...transaction, amount: transaction.amount.toNumber() }
  })

const editTransactionSchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  walletId: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  date: z.coerce.date().optional(),
  recurring: z.boolean().optional(),
  interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  nextDue: z.coerce.date().optional(),
})

export const editTransaction = createServerFn({ method: 'POST' })
  .inputValidator(editTransactionSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const { id, ...rest } = data
    const [transaction] = await updateTransaction(id, session.user.id, rest)
    return { ...transaction, amount: transaction.amount.toNumber() }
  })

export const removeTransaction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    await deleteTransaction(data.id, session.user.id)
  })

export const getRecentUserTransactions = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionOrThrow()
  return getRecentTransactions(session.user.id)
})

const listSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  walletId: z.string().optional(),
})

export const listTransactions = createServerFn({ method: 'GET' })
  .inputValidator(listSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    return getTransactionsByMonth(session.user.id, data.year, data.month, data.type, data.walletId)
  })

export const triggerRecurring = createServerFn({ method: 'POST' })
  .handler(async () => {
    const session = await getSessionOrThrow()
    const count = await processDueRecurring(session.user.id)
    if (count > 0) {
      sendPushToUser(session.user.id, {
        title: 'Transações recorrentes',
        body: count === 1
          ? '1 transação recorrente foi lançada automaticamente'
          : `${count} transações recorrentes foram lançadas automaticamente`,
        url: '/transactions',
      }).catch(() => {})
    }
    return count
  })
