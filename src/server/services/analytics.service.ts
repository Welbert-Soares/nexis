import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { getAnalyticsData } from '#/server/repositories/analytics.repository'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

export const getAnalytics = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionOrThrow()
  return getAnalyticsData(session.user.id)
})
