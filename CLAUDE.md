# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Nexis** — Personal finance OS, mobile-first PWA. UX inspired by Nubank + Stripe + Linear. Stack: TanStack Start (SSR) + Prisma + NeonDB (PostgreSQL) + Tailwind v4 + shadcn/ui.

## Commands

```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm run test         # vitest run (all tests)
npm run db:generate  # prisma generate (after schema changes)
npm run db:push      # push schema to DB without migration
npm run db:migrate   # create and run migration
npm run db:studio    # Prisma Studio UI
npm run db:seed      # seed database
npm run storybook    # component explorer on :6006
```

All `db:*` commands read from `.env.local` via `dotenv-cli`.  
Run a single test: `npx vitest run src/path/to/file.test.ts`

---

## Architecture

### Routing & SSR

TanStack Start with file-based routing. Routes live in `src/routes/`. The router (`src/router.tsx`) is wired to TanStack Query via `setupRouterSsrQueryIntegration` for SSR-safe hydration.

`src/routes/__root.tsx` — `createRootRouteWithContext<{ queryClient: QueryClient }>()`. Uses `shellComponent: RootDocument` (renders the full `html/body` shell — no extra wrapper div). QueryClient available in all route loaders via context.

```
src/routes/
  __root.tsx                    # HTML shell, PWA meta tags
  _authenticated.tsx            # layout: flex-col 100dvh, BottomNav, auth guard
  _authenticated/
    dashboard.tsx
    transactions.tsx
    wallets.tsx
    analytics.tsx
    goals.tsx
  login.tsx
  index.tsx                     # redirects to /dashboard
  api/auth/$.ts                 # Better Auth catch-all
  mcp.ts                        # MCP server endpoint POST /mcp
```

**Route patterns:**
```ts
// Page with prefetch
export const Route = createFileRoute('/_authenticated/dashboard')({
  loader: ({ context: { queryClient } }) =>
    queryClient.prefetchQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard() }),
  component: DashboardPage,
})

// API route (no UI)
export const Route = createFileRoute('/api/foo')({
  server: { handlers: { GET: () => json({...}) } },
})
```

### PWA Layout

`src/routes/_authenticated.tsx` — authenticated layout shell:

```tsx
<div className="flex flex-col bg-zinc-950"
     style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>
  <OfflineBanner />
  <main className="min-h-0 flex-1 overflow-hidden">
    <Outlet />
  </main>
  <BottomNav />   {/* pb-[env(safe-area-inset-bottom)] handles home indicator */}
</div>
```

Page components fill `main` with `h-full` and scroll via `PullToRefresh` (`overflow-y: auto`).  
`BottomNav` — `src/components/layout/bottom-nav.tsx`: Dashboard, Transações, +(FAB), Carteiras, Análise.

### Server Layer

```
src/server/
  services/      # createServerFn handlers — auth + business logic
  repositories/  # raw Prisma queries, return plain objects (Decimal → number)
  middleware/    # authMiddleware via createMiddleware
```

**Pattern — every service function:**
```ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) throw new Error('Unauthorized')
  return session
}

export const getUserWallets = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionOrThrow()
  return getWalletsByUser(session.user.id)   // repository call
})

export const createUserWallet = createServerFn({ method: 'POST' })
  .inputValidator(createWalletSchema)        // Zod schema inline in service file
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    return createWallet({ userId: session.user.id, ...data })
  })
```

Repositories always convert `Decimal` to `number` before returning: `{ ...w, balance: w.balance.toNumber() }`.

### Database

Singleton in `src/db.ts` using `@prisma/adapter-pg` (PgBouncer-compatible).  
Schema: `prisma/schema.prisma`. Generated client: `src/generated/prisma/`.

**Always import as:** `import { prisma } from '#/db'`

**Domain models:**

| Model | Key fields |
|-------|-----------|
| `Wallet` | `type: WalletType`, `balance: Decimal`, `userId` |
| `Transaction` | `type: INCOME\|EXPENSE`, `walletId`, `categoryId?`, `recurring`, `interval?`, `nextDue?`, `parentId?` |
| `Category` | `type: INCOME\|EXPENSE`, `userId?` (null = global default) |
| `Budget` | `amount`, `month`, `year`, `userId`, `categoryId` — unique on `(userId, categoryId, month, year)` |
| `Goal` | `targetAmount`, `currentAmount`, `deadline?`, `userId` |

Auth models (Better Auth): `User`, `Session`, `Account`, `Verification` — never rename `Account`.

**Enums:** `WalletType` (CHECKING, SAVINGS, CASH, INVESTMENT, CREDIT), `TransactionType` (INCOME, EXPENSE), `RecurrenceInterval` (WEEKLY, BIWEEKLY, MONTHLY, YEARLY).

### UI Components

shadcn/ui in `src/components/ui/`. Add: `pnpm dlx shadcn@latest add <component>`  
Config: `components.json` — style `new-york`, base color `zinc`, CSS variables.

**Custom components:**
- `PullToRefresh` — wraps scrollable content, `height: 100%` + `overflowY: auto` internally
- `CurrencyInput` — BRL-formatted number input
- `OfflineBanner` — animated, shows only when offline
- `ErrorBoundary` — class component, renders children passthrough when no error

**Feature sheets** (bottom-sheet drawers):
```
src/components/
  transactions/transaction-sheet.tsx
  wallets/wallet-sheet.tsx, new-wallet-sheet.tsx, transfer-sheet.tsx
  budgets/budget-sheet.tsx
  categories/category-sheet.tsx
  goals/goal-sheet.tsx
  profile/profile-sheet.tsx
```

### Styling

Tailwind v4 (CSS-first, no `tailwind.config.js`). Config in `src/styles.css` via `@import 'tailwindcss'`.  
`cn()` from `#/lib/utils` — clsx + tailwind-merge.  
Icons: **Lucide React exclusively**.

**Motion variants** (`src/lib/motion.ts`): `fadeUp`, `fadeIn`, `stagger`, `scaleIn` — import and use with framer-motion `motion` components.

### Auth

Better Auth via Google OAuth. Client: `src/lib/auth-client.ts`. Server: `src/lib/auth.ts`.

Route guard pattern (in `_authenticated.tsx`):
```ts
beforeLoad: async () => {
  const session = await getSession()
  if (!session) throw redirect({ to: '/login' })
  return { session }
}
```

`getSession` is a `createServerFn` in `src/server/services/auth.service.ts`.  
Services call `auth.api.getSession({ headers: getRequest().headers })` directly.

### MCP

`src/routes/mcp.ts` — MCP server at `POST /mcp`. Register tools on the `McpServer` instance.  
Handler utility: `src/utils/mcp-handler.ts`.

---

## Key Constraints

- **Mobile-first PWA** — thumb-friendly, scroll-based, bottom-sheet patterns everywhere.
- **`Account` model** is Better Auth's OAuth table (`prisma.account`). Never rename it — Better Auth accesses it by string key `db['account']`.
- **`Wallet`** = financial account. Never confuse with Better Auth's `Account`.
- **TypeScript strict** (`noUnusedLocals`, `noUnusedParameters`) — fix all type errors before committing.
- **`Decimal` fields** (`balance`, `amount`) — always call `.toNumber()` before returning from repositories.
- **Recurring transactions** — `triggerRecurring()` is called on mount in `_authenticated.tsx` to auto-generate due transactions; invalidates `transactions`, `dashboard`, `wallets` query keys on count > 0.
- **Path aliases** — `#/*` and `@/*` both resolve to `src/*`.
