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

Run a single test file: `npx vitest run src/path/to/file.test.ts`

## Architecture

### Routing & SSR

TanStack Start with file-based routing. Routes live in `src/routes/`. The router is created in `src/router.tsx` and wired to TanStack Query via `setupRouterSsrQueryIntegration` — this enables SSR-safe query hydration without extra boilerplate.

`src/routes/__root.tsx` uses `createRootRouteWithContext<{ queryClient: QueryClient }>()` — the QueryClient is injected as router context, making it available to all route loaders.

**Route files can expose both UI and server handlers:**
```ts
// API route (no UI)
export const Route = createFileRoute('/api/foo')({
  server: { handlers: { GET: () => json({...}) } },
})

// Page route with loader
export const Route = createFileRoute('/dashboard')({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery()),
  component: Dashboard,
})
```

### Server Functions (backend layer)

Use `createServerFn` from `@tanstack/react-start` for all server-side logic. These are the "controllers" — they run only on the server and are callable from components or loaders.

```ts
import { createServerFn } from '@tanstack/react-start'

export const getTransactions = createServerFn({ method: 'GET' })
  .handler(async () => { /* prisma queries here */ })
```

Planned backend structure:
```
src/server/
  services/       # business logic (pure TS)
  repositories/   # Prisma queries
  validators/     # Zod schemas
  mappers/        # data transformations
  middleware/     # auth checks
```

### Database

Prisma client is a singleton in `src/db.ts`, using `@prisma/adapter-pg` (PgBouncer-compatible). Schema in `prisma/schema.prisma`. Generated client outputs to `src/generated/prisma/`.

Always import prisma as: `import { prisma } from '#/db'`

### UI Components

shadcn/ui components live in `src/components/ui/`. Add new ones with:
```bash
pnpm dlx shadcn@latest add <component>
```

Config: `components.json` — style `new-york`, base color `zinc`, CSS variables enabled.

Path aliases: `#/*` and `@/*` both resolve to `src/*`.

### Styling

Tailwind v4 (CSS-first config, no `tailwind.config.js`). Global styles in `src/styles.css`. Utility: `cn()` from `#/lib/utils` (clsx + tailwind-merge).

### Icons

Lucide React exclusively — no other icon libraries.

### MCP

`src/routes/mcp.ts` exposes an MCP server endpoint at `POST /mcp`. Register new tools on the `McpServer` instance there. Handler utility at `src/utils/mcp-handler.ts`.

## Key Constraints

- **Mobile-first PWA** — every UI decision defaults to thumb-friendly, scroll-based, bottom-sheet patterns.
- **Auth** — Google OAuth via Better Auth. All financial data routes must be protected via auth middleware in `beforeLoad`.
- **`Account` model** is used by Better Auth for OAuth accounts (`prisma.account`). Financial accounts use `Wallet` model. Never rename `Account` — the Better Auth Prisma adapter uses `db['account']` directly by string key.
- TypeScript strict mode is on (`noUnusedLocals`, `noUnusedParameters`). Fix all type errors before committing.
