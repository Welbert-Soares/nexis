import { createAuthClient } from 'better-auth/react'

const baseURL = typeof window !== 'undefined'
  ? window.location.origin
  : (import.meta.env.VITE_APP_URL as string | undefined)

export const authClient = createAuthClient({ baseURL })

export const { signIn, signOut, useSession } = authClient
