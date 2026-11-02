import { sendPushToUser } from '#/server/services/push-notify.server'
import { getExceededBudgets } from '#/server/repositories/budget.repository'
import { shouldSendNotification } from '#/server/repositories/push.repository'

/** Verifica orçamentos estourados e manda no máximo um push por alerta por dia. Não bloqueia quem chama. */
export function checkBudgetsAndNotify(userId: string) {
  getExceededBudgets(userId).then(async (alerts) => {
    if (alerts.length === 0) return
    const exceeded = alerts.filter((a) => a.pct >= 1)
    const top = alerts[0]
    const entityId = exceeded.length > 0 ? `exceeded:${exceeded.map((a) => a.name).join(',')}` : `warning:${top.name}`
    const canSend = await shouldSendNotification(userId, 'budget', entityId)
    if (!canSend) return
    const title = exceeded.length > 0 ? 'Limite de orçamento excedido' : 'Orçamento próximo do limite'
    const body = exceeded.length === 1
      ? `${top.name} ultrapassou o limite mensal`
      : exceeded.length > 1
      ? `${exceeded.length} orçamentos ultrapassados este mês`
      : `${top.name} está em ${Math.round(top.pct * 100)}% do limite`
    sendPushToUser(userId, { title, body, url: '/analytics' }).catch((err) => {
      console.error('[push] falha ao enviar notificação de orçamento:', err)
    })
  }).catch((err) => {
    console.error('[push] checkBudgetsAndNotify falhou:', err)
  })
}
