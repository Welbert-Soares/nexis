# Nexis Mobile — Fatia 5 (Análise + Orçamentos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir a 5ª aba **Análise** no `nexis-mobile` espelhando `analytics.tsx` do PWA **menos Metas e Perfil**: Resumo do mês, Ritmo do mês, Tendência 6 meses, Gastos por categoria e **Orçamentos** (CRUD por categoria/mês).

**Architecture:** Backend aditivo — 3 rotas novas em `src/routes/api/mobile/` (`analytics`, `budgets`, `budgets.$id`) que reusam `getAnalyticsData` e os helpers de `budget.repository.ts`/`budget.service.ts` sem tocar em lógica existente. App — schemas + api layer novos, uma tela `analytics.tsx` registrada como aba depois de `wallets`, componentes de apresentação em `src/components/analytics/` e `src/components/budgets/`, um `budget-sheet` moldado no `wallet-sheet`. Gráficos por biblioteca (`react-native-gifted-charts`, SVG puro sobre o `react-native-svg` já no projeto).

**Tech Stack:** TanStack Start (SSR) + Prisma + zod + vitest (nexis); Expo Router + NativeWind/react-native-css + TanStack Query + zod + jest-expo (nexis-mobile). Deps novas no app: `react-native-gifted-charts` (pin exato) + `expo-linear-gradient` (peer da lib, Expo-managed).

**Spec:** `docs/superpowers/specs/2026-09-08-nexis-mobile-slice-5-analytics-budgets-design.md`

## Global Constraints

- **Dois repos.** Tasks 1–3 são no `nexis` (`/home/welbertbarbosa/projects/personal/nexis`). Tasks 4–11 são no `nexis-mobile` (`/home/welbertbarbosa/projects/personal/nexis-mobile`). Cada task diz o repo.
- **Branch.** `nexis`: `feat/mobile-slice-5-analytics-budgets-backend` a partir de `origin/main`. `nexis-mobile`: `feat/mobile-slice-5-analytics-budgets` a partir de `origin/main`.
- **Rotas mobile aditivas** — `auth.api.getSession({ headers: request.headers })` → `Response.json({ error: 'Unauthorized' }, { status: 401 })` sem sessão; querystring/body via `schema.safeParse(...)` → `400` com `{ error: parsed.error.message }`; `Error` conhecido do repo → `404` com `{ error }`; `DELETE` de sucesso → `Response.json(null)`.
- **`getAnalyticsData` é mês-corrente fixo** — a rota `analytics` NÃO tem querystring. Só `budgets` recebe `?year=&month=`.
- **Paridade com o `budget.service.ts`** — o `map` da resposta de `GET /api/mobile/budgets` é cópia literal do `getBudgets` do service (`{ id, categoryId, categoryName, categoryColor, categoryIcon, limit, spent }`), pra os dois não divergirem.
- **App UI** só de `#/tw` / `#/tw/image`. Exceções já em uso: `RefreshControl`, `ScrollView`/`SectionList` de `react-native`, `useSafeAreaInsets`, `@gorhom/bottom-sheet`, `Modal`, `Platform`, `Animated`, `Switch`, `@react-native-community/datetimepicker`. **Nova exceção:** os componentes de `react-native-gifted-charts` (importados direto da lib, não passam por `#/tw`).
- **Rótulos de mês** — sempre de `MONTHS_SHORT` de `src/lib/format.ts`, **nunca `Intl` com `month:'short'`** (divergência ICU Node×Hermes).
- **Testes de tela mobile** mockam `#/tw`, `#/tw/image`, `lucide-react-native` (objeto plano, nunca `Proxy`), `expo-router` (inclui `useFocusEffect`), `react-native-safe-area-context`, `#/api/*`, `#/components/ui/sheet`, **`react-native-gifted-charts` (`() => null` por export usado)**. Sem `fireEvent.press` que dispare `useMutation` + `waitFor` (trava o RNTL v13 nesse ambiente) — testes de sheet/tela verificam superfície de render e estado local.
- **`nexis-mobile` não tem prettier/eslint** — casar o estilo na mão (sem ponto-e-vírgula, aspas simples, 2 espaços). Não rodar `expo lint` / `prettier` (escrevem config + deps na árvore).
- **Barra por task que toca `.ts`/`.tsx`:** `npx tsc --noEmit` limpo. Jest do `nexis-mobile` sempre com `--forceExit`.
- **Commits:** terminar cada task com commit. Mensagens em pt-BR, escopo da task só.
- **`gh` CLI** está em `~/.local/bin/gh` e autenticado — PRs podem ser abertos direto ao fim de cada repo.

---

## File Structure

**nexis (backend):**
- `src/routes/api/mobile/analytics.ts` — NEW: `GET` → `getAnalyticsData`.
- `src/routes/api/mobile/analytics.test.ts` — NEW.
- `src/routes/api/mobile/budgets.ts` — NEW: `GET` (`?year&month`) + `POST` (upsert).
- `src/routes/api/mobile/budgets.test.ts` — NEW.
- `src/routes/api/mobile/budgets.$id.ts` — NEW: `DELETE`.
- `src/routes/api/mobile/budgets.$id.test.ts` — NEW.
- `src/routeTree.gen.ts` — REGEN (não editar à mão).

**nexis-mobile (app):**
- `package.json` / `package-lock.json` — MODIFY: `react-native-gifted-charts` + `expo-linear-gradient`.
- `src/schemas/analytics.ts` — NEW. `src/schemas/analytics.test.ts` — NEW.
- `src/schemas/budget.ts` — NEW. `src/schemas/budget.test.ts` — NEW.
- `src/api/analytics.ts` — NEW. `src/api/analytics.test.ts` — NEW.
- `src/api/budgets.ts` — NEW. `src/api/budgets.test.ts` — NEW.
- `src/lib/format.ts` — MODIFY: `fmtMonthKeyShort`, `fmtBudgetMonth`.
- `src/lib/analytics-calcs.ts` — NEW: `spendingPace`, `budgetBarColor`, `pct`. `src/lib/analytics-calcs.test.ts` — NEW.
- `src/components/analytics/summary-cards.tsx` — NEW.
- `src/components/analytics/spending-pace.tsx` — NEW.
- `src/components/analytics/monthly-trend.tsx` — NEW.
- `src/components/analytics/category-breakdown.tsx` — NEW.
- `src/components/analytics/analytics-skeleton.tsx` — NEW.
- `src/components/budgets/budget-row.tsx` — NEW.
- `src/components/budgets/budgets-section.tsx` — NEW.
- `src/components/budgets/budget-sheet.tsx` — NEW.
- `src/__tests__/budget-sheet.test.tsx` — NEW.
- `src/__tests__/analytics-screen.test.tsx` — NEW.
- `src/app/(app)/analytics.tsx` — NEW: tela da aba.
- `src/app/(app)/_layout.tsx` — MODIFY: `<Tabs.Screen name="analytics">` depois de `wallets`.

---

## Task 1: `nexis` — `GET /api/mobile/analytics`

**Repo:** `nexis`

**Files:**
- New: `src/routes/api/mobile/analytics.ts`
- New: `src/routes/api/mobile/analytics.test.ts`

**Interfaces:**
- Consumes: `getAnalyticsData` de `#/server/repositories/analytics.repository`; `auth` de `#/lib/auth`.
- Produces: `GET /api/mobile/analytics` → `200` com `{ monthly:{income,expenses}, categoryBreakdown[], trend[], dayOfMonth, daysInMonth }` (o retorno cru de `getAnalyticsData`), `401` sem sessão.

- [ ] **Step 1: Setup da branch**

```bash
cd /home/welbertbarbosa/projects/personal/nexis
git fetch origin -q && git checkout -b feat/mobile-slice-5-analytics-budgets-backend origin/main
```

- [ ] **Step 2: Teste que falha**

`src/routes/api/mobile/analytics.test.ts` — seguir o formato de `dashboard.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './analytics'

const getSession = vi.fn()
const getAnalyticsData = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/analytics.repository', () => ({
  getAnalyticsData: (...a: unknown[]) => getAnalyticsData(...a),
}))

const GET = () => (Route.options as any).server.handlers.GET({ request: new Request('http://x/api/mobile/analytics') })

beforeEach(() => { getSession.mockReset(); getAnalyticsData.mockReset() })

describe('GET /api/mobile/analytics', () => {
  it('401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('devolve o payload de getAnalyticsData pro usuário da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const payload = {
      monthly: { income: 100, expenses: 40 },
      categoryBreakdown: [{ id: 'c1', name: 'Mercado', color: '#fff', amount: 40 }],
      trend: [{ month: '2026-09', income: 100, expenses: 40 }],
      dayOfMonth: 8, daysInMonth: 30,
    }
    getAnalyticsData.mockResolvedValue(payload)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(payload)
    expect(getAnalyticsData).toHaveBeenCalledWith('u1')
  })
})
```

- [ ] **Step 3: Implementar `src/routes/api/mobile/analytics.ts`**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getAnalyticsData } from '#/server/repositories/analytics.repository'

// Snapshot do mês corrente (getAnalyticsData não recebe parâmetro de mês).
export const Route = createFileRoute('/api/mobile/analytics')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        return Response.json(await getAnalyticsData(session.user.id))
      },
    },
  },
})
```

- [ ] **Step 4: Verificar**

Run: `cd /home/welbertbarbosa/projects/personal/nexis && npx vitest run src/routes/api/mobile/analytics.test.ts && npx tsc --noEmit`
Expected: PASS; `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/mobile/analytics.ts src/routes/api/mobile/analytics.test.ts
git commit -m "feat: GET /api/mobile/analytics"
```

---

## Task 2: `nexis` — `GET` + `POST /api/mobile/budgets`

**Repo:** `nexis`

**Files:**
- New: `src/routes/api/mobile/budgets.ts`
- New: `src/routes/api/mobile/budgets.test.ts`

**Interfaces:**
- Consumes: `getBudgetsWithSpending`, `upsertBudget` de `#/server/repositories/budget.repository`.
- Produces:
  - `GET /api/mobile/budgets?year=&month=` → `200` com `{ id, categoryId, categoryName, categoryColor, categoryIcon, limit, spent }[]`; `400` querystring inválida; `401`.
  - `POST /api/mobile/budgets` body `{ categoryId, month(1..12), year, amount>0 }` → `200` com `{ ...budget, amount:number }`; `400` body inválido; `401`.

- [ ] **Step 1: Teste que falha**

`src/routes/api/mobile/budgets.test.ts` — cobrir:
- GET 401 sem sessão.
- GET 400 sem `month`/`year` ou `month` fora de 1..12.
- GET 200 mapeia as linhas de `getBudgetsWithSpending` (mock retorna 1 linha com `category.color = null` e `category.transactions = [{amount:{toNumber:()=>10}},{amount:{toNumber:()=>5}}]`; esperar `categoryColor === '#71717a'`, `spent === 15`, `limit` = `amount.toNumber()`); confere `getBudgetsWithSpending` chamado com `('u1', month, year)`.
- POST 401.
- POST 400 pra `amount: 0`, e pra body sem `categoryId`.
- POST 200 chama `upsertBudget('u1', categoryId, month, year, amount)` e devolve `amount` como number (mock retorna `{ id:'b1', amount:{ toNumber:()=>200 } }` → esperar `{ id:'b1', amount:200 }`).

Mock base:

```ts
const getSession = vi.fn()
const getBudgetsWithSpending = vi.fn()
const upsertBudget = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/budget.repository', () => ({
  getBudgetsWithSpending: (...a: unknown[]) => getBudgetsWithSpending(...a),
  upsertBudget: (...a: unknown[]) => upsertBudget(...a),
}))

const handlers = () => (Route.options as any).server.handlers
const GET = (qs: string) => handlers().GET({ request: new Request(`http://x/api/mobile/budgets${qs}`) })
const POST = (body: unknown) =>
  handlers().POST({ request: new Request('http://x/api/mobile/budgets', { method: 'POST', body: JSON.stringify(body) }) })
```

- [ ] **Step 2: Implementar `src/routes/api/mobile/budgets.ts`**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { getBudgetsWithSpending, upsertBudget } from '#/server/repositories/budget.repository'

const listQuery = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
})

// Cópia do saveBudget schema de budget.service.ts.
const createBody = z.object({
  categoryId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  amount: z.number().positive(),
})

export const Route = createFileRoute('/api/mobile/budgets')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const params = new URL(request.url).searchParams
        const parsed = listQuery.safeParse({ year: params.get('year'), month: params.get('month') })
        if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 })

        const rows = await getBudgetsWithSpending(session.user.id, parsed.data.month, parsed.data.year)
        // map idêntico ao getBudgets de budget.service.ts — mantém web e mobile em paridade.
        return Response.json(
          rows.map((b) => ({
            id: b.id,
            categoryId: b.categoryId,
            categoryName: b.category.name,
            categoryColor: b.category.color ?? '#71717a',
            categoryIcon: b.category.icon,
            limit: b.amount.toNumber(),
            spent: b.category.transactions.reduce((acc, t) => acc + t.amount.toNumber(), 0),
          })),
        )
      },
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const parsed = createBody.safeParse(await request.json())
        if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 })

        const { categoryId, month, year, amount } = parsed.data
        const b = await upsertBudget(session.user.id, categoryId, month, year, amount)
        return Response.json({ ...b, amount: b.amount.toNumber() })
      },
    },
  },
})
```

- [ ] **Step 3: Verificar**

Run: `npx vitest run src/routes/api/mobile/budgets.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/mobile/budgets.ts src/routes/api/mobile/budgets.test.ts
git commit -m "feat: GET e POST /api/mobile/budgets"
```

---

## Task 3: `nexis` — `DELETE /api/mobile/budgets/$id`, routeTree, suíte, PR

**Repo:** `nexis`

**Files:**
- New: `src/routes/api/mobile/budgets.$id.ts`
- New: `src/routes/api/mobile/budgets.$id.test.ts`
- Regen: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `deleteBudget` de `#/server/repositories/budget.repository`.
- Produces: `DELETE /api/mobile/budgets/$id` → `200` `Response.json(null)`; `404` quando o repo lança; `401`.

- [ ] **Step 1: Teste que falha**

`src/routes/api/mobile/budgets.$id.test.ts` — mesma forma de `wallets.$id.test.ts`:
- DELETE 401 sem sessão.
- DELETE 200 chama `deleteBudget('b1', 'u1')` e responde corpo `null`.
- DELETE 404 quando `deleteBudget` rejeita (`new Error('Orçamento não encontrado')`) → `{ error: 'Orçamento não encontrado' }`.

Chamar `handlers().DELETE({ request: new Request('http://x/api/mobile/budgets/b1', { method: 'DELETE' }), params: { id: 'b1' } })`.

- [ ] **Step 2: Implementar `src/routes/api/mobile/budgets.$id.ts`** (molde de `wallets.$id.ts`, só DELETE)

```ts
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { deleteBudget } from '#/server/repositories/budget.repository'

function budgetId(request: Request, params?: { id?: string }): string {
  return params?.id ?? new URL(request.url).pathname.split('/').filter(Boolean).pop()!
}

export const Route = createFileRoute('/api/mobile/budgets/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }: { request: Request; params?: { id?: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        try {
          await deleteBudget(budgetId(request, params), session.user.id)
          return Response.json(null)
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : 'Erro ao excluir orçamento' },
            { status: 404 },
          )
        }
      },
    },
  },
})
```

- [ ] **Step 3: Regenerar `routeTree.gen.ts`**

```bash
cd /home/welbertbarbosa/projects/personal/nexis
node -e "const {Generator,getConfig}=require('@tanstack/router-generator');new Generator({config:getConfig({},process.cwd()),root:process.cwd()}).run()"
```
Conferir com `git diff src/routeTree.gen.ts` que só entraram as 3 rotas novas (`/api/mobile/analytics`, `/api/mobile/budgets`, `/api/mobile/budgets/$id`).

- [ ] **Step 4: Suíte inteira + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tudo verde.

- [ ] **Step 5: Commit + PR**

```bash
git add src/routes/api/mobile/budgets.$id.ts src/routes/api/mobile/budgets.$id.test.ts src/routeTree.gen.ts
git commit -m "feat: DELETE /api/mobile/budgets/\$id + routeTree"
git push -u origin feat/mobile-slice-5-analytics-budgets-backend
gh pr create --repo Welbert-Soares/nexis --base main \
  --title "feat: rotas /api/mobile/analytics e /api/mobile/budgets*" \
  --body "Fatia 5 do Nexis Mobile — backend. Rotas aditivas: GET /api/mobile/analytics (= getAnalyticsData), GET/POST /api/mobile/budgets (upsert), DELETE /api/mobile/budgets/\$id. Reusa os repositories existentes. Spec: docs/superpowers/specs/2026-09-08-nexis-mobile-slice-5-analytics-budgets-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Task 4: `nexis-mobile` — branch + biblioteca de gráficos

**Repo:** `nexis-mobile`

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `react-native-gifted-charts` importável (`BarChart`, `PieChart`); `expo-linear-gradient` instalado (peer da lib).

- [ ] **Step 1: Setup da branch**

```bash
cd /home/welbertbarbosa/projects/personal/nexis-mobile
git fetch origin -q && git checkout -b feat/mobile-slice-5-analytics-budgets origin/main
```

- [ ] **Step 2: Instalar as deps (pin exato — disciplina do pin do RNTL)**

```bash
npx expo install expo-linear-gradient
npm install --save-exact react-native-gifted-charts@1.4.78
```
`react-native-svg` já está em `15.15.4` — não mexer. Conferir que `expo-linear-gradient` entrou como `~15.0.x` (versão do SDK 57) e que `react-native-gifted-charts` ficou **sem** caret (`"1.4.78"`, não `"^1.4.78"`).

- [ ] **Step 3: Smoke de compilação**

Criar um arquivo scratch `src/_charts-smoke.ts`:
```ts
import { BarChart, PieChart } from 'react-native-gifted-charts'
export const _smoke = [BarChart, PieChart]
```
Run: `npx tsc --noEmit`
Expected: sem erro de tipo/resolução. Depois **apagar** `src/_charts-smoke.ts`.

> Se `tsc` ou o Metro reclamarem de `react-native-linear-gradient` (peer hard-required em algum transitório): a lib 1.4.78 aceita `expo-linear-gradient` como peer alternativo — garantir que nenhum código do app passa props de gradiente (barras/donut em cor sólida, como o PWA). **Fallback** (só se a lib não bundlar no Expo Go no device, Task 11): trocar por `npx expo install victory-native @shopify/react-native-skia` e reimplementar `monthly-trend`/`category-breakdown` com a API da victory-native XL — atualizar este plano e o spec (D6) se cair aqui.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adiciona react-native-gifted-charts + expo-linear-gradient"
```

---

## Task 5: `nexis-mobile` — schemas `analytics` e `budget`

**Repo:** `nexis-mobile`

**Files:**
- New: `src/schemas/analytics.ts`, `src/schemas/analytics.test.ts`
- New: `src/schemas/budget.ts`, `src/schemas/budget.test.ts`

**Interfaces:**
- Produces: `AnalyticsSchema` / `Analytics`; `BudgetSchema` / `BudgetsSchema` / `Budget` / `BudgetInput` / `BudgetInputData`.

- [ ] **Step 1: Testes que falham**

`analytics.test.ts` — `AnalyticsSchema.parse` aceita um payload completo (ver Task 1 Step 2); rejeita `trend` sem `month`; ignora campo extra no root.
`budget.test.ts` — `BudgetsSchema.parse` aceita `[{ id, categoryId, categoryName, categoryColor, categoryIcon:null, limit, spent }]`; `BudgetSchema.partial().parse({ id:'b1', amount:200 })` não quebra (resposta enxuta do POST — `amount` é campo extra, ignorado); `BudgetInput.parse` rejeita `amount:0` e `month:13`.

- [ ] **Step 2: `src/schemas/analytics.ts`**

```ts
import { z } from 'zod'

export const AnalyticsSchema = z.object({
  monthly: z.object({ income: z.number(), expenses: z.number() }),
  categoryBreakdown: z.array(
    z.object({ id: z.string(), name: z.string(), color: z.string(), amount: z.number() }),
  ),
  trend: z.array(
    z.object({ month: z.string(), income: z.number(), expenses: z.number() }),
  ),
  dayOfMonth: z.number(),
  daysInMonth: z.number(),
})
export type Analytics = z.infer<typeof AnalyticsSchema>
```

- [ ] **Step 3: `src/schemas/budget.ts`**

```ts
import { z } from 'zod'

export const BudgetSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  categoryColor: z.string(),
  categoryIcon: z.string().nullable(),
  limit: z.number(),
  spent: z.number(),
})
export const BudgetsSchema = z.array(BudgetSchema)
export type Budget = z.infer<typeof BudgetSchema>

export const BudgetInput = z.object({
  categoryId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  amount: z.number().positive(),
})
export type BudgetInputData = z.infer<typeof BudgetInput>
```

- [ ] **Step 4: Verificar** — `npx jest --forceExit src/schemas/analytics.test.ts src/schemas/budget.test.ts && npx tsc --noEmit`

- [ ] **Step 5: Commit** — `git commit -m "feat: schemas de analytics e budget"`

---

## Task 6: `nexis-mobile` — api layer `analytics` e `budgets`

**Repo:** `nexis-mobile`

**Files:**
- New: `src/api/analytics.ts`, `src/api/analytics.test.ts`
- New: `src/api/budgets.ts`, `src/api/budgets.test.ts`

**Interfaces:**
- Produces: `analyticsQuery` (key `['analytics']`); `budgetsQuery(year, month)` (key `['budgets', year, month]`); `saveBudget(body)`; `removeBudget(id)`.

- [ ] **Step 1: Testes que falham** (molde de `src/api/transactions.test.ts` — spy em `globalThis.fetch`)

- `analyticsQuery.queryFn()` faz `GET` em `/api/mobile/analytics` e passa o corpo por `AnalyticsSchema`.
- `budgetsQuery(2026, 9).queryKey` === `['budgets', 2026, 9]`; `.queryFn()` faz `GET` em `/api/mobile/budgets?year=2026&month=9`.
- `saveBudget({ categoryId:'c1', month:9, year:2026, amount:200 })` faz `POST` com esse corpo JSON; tolera resposta `{ id:'b1', amount:200 }`.
- `removeBudget('b1')` faz `DELETE` em `/api/mobile/budgets/b1`.

- [ ] **Step 2: `src/api/analytics.ts`**

```ts
import { apiGet } from './client'
import { AnalyticsSchema } from '#/schemas/analytics'

export const analyticsQuery = {
  queryKey: ['analytics'] as const,
  queryFn: () => apiGet('/api/mobile/analytics', (r) => AnalyticsSchema.parse(r)),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
}
```

- [ ] **Step 3: `src/api/budgets.ts`**

```ts
import { apiGet, apiPost, apiDelete } from './client'
import { BudgetsSchema, BudgetSchema, type BudgetInputData } from '#/schemas/budget'

export const budgetsQuery = (year: number, month: number) => ({
  queryKey: ['budgets', year, month] as const,
  queryFn: () =>
    apiGet(`/api/mobile/budgets?year=${year}&month=${month}`, (r) => BudgetsSchema.parse(r)),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
})

// O POST responde o registro cru do upsert (sem category expandida) — parse
// tolerante; a UI recarrega via invalidação de ['budgets'].
export const saveBudget = (body: BudgetInputData) =>
  apiPost('/api/mobile/budgets', body, (r) => BudgetSchema.partial().parse(r))

export const removeBudget = (id: string) => apiDelete(`/api/mobile/budgets/${id}`)
```

- [ ] **Step 4: Verificar** — jest dos 2 arquivos + `tsc`.

- [ ] **Step 5: Commit** — `git commit -m "feat: api de analytics e budgets"`

---

## Task 7: `nexis-mobile` — helpers de formato + cálculos puros

**Repo:** `nexis-mobile`

**Files:**
- Modify: `src/lib/format.ts`
- New: `src/lib/analytics-calcs.ts`, `src/lib/analytics-calcs.test.ts`
- Modify: `src/lib/format.test.ts` (se existir; senão criar os casos num `describe` novo)

**Interfaces:**
- `fmtMonthKeyShort(key: string): string` — `'2026-09'` → `'set'` (via `MONTHS_SHORT`).
- `fmtBudgetMonth(year: number, month: number): string` — `(2025, 9)` → `'set/25'`.
- `spendingPace(income, expenses, dayOfMonth, daysInMonth)` → `{ pctMonthElapsed, pctIncomeSpent, aheadOfPace, daysLeft, remaining, dailyBudget, barColor, tone }` — porta a lógica do `SpendingPace` do PWA.
- `budgetBarColor(pctClamped: number): string` — faixas `>90 #ef4444`, `>80 #f87171`, `>60 #fb923c`, `>30 #eab308`, else `#22c55e`.
- `pct(value: number, total: number): number` — `round(value/total*100)`, `0` se `total === 0`.

- [ ] **Step 1: Testes que falham**

`analytics-calcs.test.ts`:
- `spendingPace(1000, 500, 15, 30)` → `pctMonthElapsed 50`, `pctIncomeSpent 50`, `aheadOfPace false`, `barColor '#22c55e'`, `daysLeft 15`, `dailyBudget` ≈ `33.33`.
- `spendingPace(1000, 1200, 10, 30)` → `pctIncomeSpent 120`, `barColor '#ef4444'`.
- `spendingPace(1000, 800, 10, 30)` → `aheadOfPace true` (`80 > 33`), `barColor '#f97316'` (laranja do ritmo — atenção: o "laranja do ritmo" é `#f97316`, diferente do `#fb923c` das faixas de orçamento).
- `spendingPace(0, ...)` não é chamado pela tela, mas a função deve não dividir-por-zero (retorna `pctIncomeSpent 0`).
- `budgetBarColor`: 95→`#ef4444`, 85→`#f87171`, 70→`#fb923c`, 40→`#eab308`, 10→`#22c55e`.
- `pct(40, 0)` → `0`; `pct(25, 200)` → `13` (round).
- `fmtMonthKeyShort('2026-09')` → `'set'`; `fmtBudgetMonth(2025, 9)` → `'set/25'`.

- [ ] **Step 2: `src/lib/format.ts`** — adicionar ao fim (usando o `MONTHS_SHORT` já no arquivo):

```ts
/** `'YYYY-MM'` → rótulo curto do mês (`'set'`). Tabela fixa, sem Intl. */
export function fmtMonthKeyShort(key: string): string {
  const m = Number(key.split('-')[1])
  return MONTHS_SHORT[m - 1] ?? key
}

/** `(2025, 9)` → `'set/25'` — rótulo da navegação de mês dos orçamentos. */
export function fmtBudgetMonth(year: number, month: number): string {
  return `${MONTHS_SHORT[month - 1]}/${String(year).slice(-2)}`
}
```

- [ ] **Step 3: `src/lib/analytics-calcs.ts`**

```ts
// Lógica pura das seções da tela Análise — porta do analytics.tsx do PWA.
// Mantida fora dos componentes pra ser testável sem render (gotcha do RNTL).

export type SpendingPace = {
  pctMonthElapsed: number
  pctIncomeSpent: number
  aheadOfPace: boolean
  daysLeft: number
  remaining: number
  dailyBudget: number
  barColor: string
  tone: 'over' | 'ahead' | 'ok'
}

export function spendingPace(
  income: number,
  expenses: number,
  dayOfMonth: number,
  daysInMonth: number,
): SpendingPace {
  const pctMonthElapsed = Math.min(Math.round((dayOfMonth / daysInMonth) * 100), 100)
  const pctIncomeSpent = income > 0 ? Math.min(Math.round((expenses / income) * 100), 999) : 0
  const aheadOfPace = pctIncomeSpent > pctMonthElapsed
  const daysLeft = Math.max(daysInMonth - dayOfMonth, 0)
  const remaining = income - expenses
  const dailyBudget = daysLeft > 0 ? remaining / daysLeft : remaining
  const tone = pctIncomeSpent > 100 ? 'over' : aheadOfPace ? 'ahead' : 'ok'
  const barColor = tone === 'over' ? '#ef4444' : tone === 'ahead' ? '#f97316' : '#22c55e'
  return { pctMonthElapsed, pctIncomeSpent, aheadOfPace, daysLeft, remaining, dailyBudget, barColor, tone }
}

export function budgetBarColor(pctClamped: number): string {
  if (pctClamped > 90) return '#ef4444'
  if (pctClamped > 80) return '#f87171'
  if (pctClamped > 60) return '#fb923c'
  if (pctClamped > 30) return '#eab308'
  return '#22c55e'
}

export function pct(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}
```

- [ ] **Step 4: Verificar** — jest + `tsc`.

- [ ] **Step 5: Commit** — `git commit -m "feat: helpers de mês e cálculos da Análise"`

---

## Task 8: `nexis-mobile` — componentes de apresentação da Análise

**Repo:** `nexis-mobile`

**Files:**
- New: `src/components/analytics/summary-cards.tsx`
- New: `src/components/analytics/spending-pace.tsx`
- New: `src/components/analytics/monthly-trend.tsx`
- New: `src/components/analytics/category-breakdown.tsx`
- New: `src/components/analytics/analytics-skeleton.tsx`

**Interfaces (props):**
- `SummaryCards({ income, expenses, loading }: { income: number; expenses: number; loading: boolean })`.
- `SpendingPaceCard({ income, expenses, dayOfMonth, daysInMonth }: …)` — renderiza `null` se `income <= 0`.
- `MonthlyTrend({ trend }: { trend: { month: string; income: number; expenses: number }[] })`.
- `CategoryBreakdown({ items }: { items: { id: string; name: string; color: string; amount: number }[] })` — renderiza `null` se `items.length === 0 || total === 0`.
- `AnalyticsSkeleton()`.

- [ ] **Step 1: `summary-cards.tsx`**

`View className="flex-row gap-2"`; 3 `View className="flex-1 rounded-2xl bg-card border border-border p-3"` com gap. Rótulo (`Receitas`/`Despesas`/`Saldo`) `text-xs text-muted`; valor `Text` `text-sm font-semibold` + `style={tabularNums}` com `fmtBRL`. Cores por `className`: `text-positive`, `text-negative`, e Saldo = `net >= 0 ? 'text-accent' : 'text-negative'` (`net = income - expenses`). `loading` → um bloco `h-5 w-16 rounded bg-border` no lugar do valor.

- [ ] **Step 2: `spending-pace.tsx`**

`const p = spendingPace(income, expenses, dayOfMonth, daysInMonth)` (Task 7). `if (income <= 0) return null`. Card `rounded-2xl bg-card border border-border p-4` com `gap-3`:
- Trilho: `View className="h-2.5 w-full rounded-full bg-border"` com filho `Animated.View` largura animada até `Math.min(p.pctIncomeSpent, 100)%`, `backgroundColor: p.barColor`; e um `View` absoluto `w-0.5 h-2.5 bg-white/70` em `left: ${p.pctMonthElapsed}%` (usar `style`, não `className`, pro `left` dinâmico). Primeiro run sem timer (padrão do `wallet-sheet`).
- Linha `flex-row justify-between`: esquerda `Text` com `p.pctIncomeSpent%` (cor por `p.tone`: over→`text-negative`, ahead→`text-orange-400`? — o app não tem token laranja; usar `style={{ color: p.barColor }}`) + `" da renda gasta"` em `text-muted`; direita `mês {p.pctMonthElapsed}% andado` em `text-muted`.
- `Text` `text-[11px] text-muted`: `p.tone === 'over'` → "Você já gastou mais do que recebeu esse mês." / `'ahead'` → "Ritmo de gastos acima do ideal pra durar o mês inteiro." / `'ok'` → "Ritmo de gastos dentro do esperado pro dia do mês."
- Se `p.remaining > 0 && p.daysLeft > 0`: `Text` "Restam **{fmtBRL(p.dailyBudget)}**/dia pelos próximos {p.daysLeft} dias pra fechar o mês no azul." (o valor em `text-fg`, resto `text-muted`).

- [ ] **Step 3: `monthly-trend.tsx`**

Card `rounded-2xl bg-card border border-border p-4` `gap-4`:
- Legenda `flex-row gap-4`: ponto `h-2 w-2 rounded-full` (`bg-positive` / `bg-negative`) + `Text text-xs text-muted` (`Receitas` / `Despesas`).
- `BarChart` de `react-native-gifted-charts`:
  ```tsx
  const max = Math.max(...trend.flatMap((t) => [t.income, t.expenses]), 1)
  const data = trend.flatMap((t) => [
    { value: t.income, frontColor: colors.positive, spacing: 2, label: fmtMonthKeyShort(t.month), labelTextStyle: { color: colors.muted, fontSize: 10 } },
    { value: t.expenses, frontColor: colors.negative },
  ])
  <BarChart
    data={data}
    maxValue={max}
    height={112}
    barWidth={10}
    initialSpacing={8}
    spacing={16}
    hideRules
    hideYAxisText
    yAxisThickness={0}
    xAxisThickness={0}
    disableScroll
    isAnimated
  />
  ```
  (props exatas podem precisar de ajuste fino no device — Task 11. Sem props de gradiente.)

- [ ] **Step 4: `category-breakdown.tsx`**

`const total = items.reduce((a, i) => a + i.amount, 0); if (!items.length || !total) return null`.
`const [expanded, setExpanded] = useState(false)`. Card `rounded-2xl bg-card border border-border overflow-hidden`:
- `Pressable` (`onPress` alterna `expanded`) `flex-row items-center gap-4 p-4`:
  - `PieChart` `donut` da lib: `data = items.map((i) => ({ value: i.amount, color: i.color }))`, `radius={56}`, `innerRadius={34}`, `innerCircleColor={colors.card}`, `isAnimated`. (sem `showText`.)
  - `View className="flex-1"` `gap-2`: `items.slice(0, 5).map` → linha `flex-row items-center justify-between`: ponto da cor + `Text text-xs text-muted` truncado (`numberOfLines={1}`) + `Text text-xs text-muted` `{pct(i.amount, total)}%`.
  - Chevron `ChevronDown` de `lucide-react-native` num `Animated.View` com `rotate` `0↔180`.
- Bloco expansível: `Animated.View` de altura (driver 0/1, primeiro run sem timer, padrão `wallet-sheet`) — `items.map` → `flex-row justify-between` ponto+nome (esq) e `Text text-xs text-fg` `style={tabularNums}` `{fmtBRL(i.amount)}` (dir). `px-4 pb-3 gap-2.5`.

- [ ] **Step 5: `analytics-skeleton.tsx`** — `View gap-3` com 2–3 `View className="h-40 rounded-2xl bg-card border border-border"`.

- [ ] **Step 6: Verificar** — `npx tsc --noEmit` limpo (sem testes de componente isolado aqui; a cobertura vem no teste de tela da Task 10).

- [ ] **Step 7: Commit** — `git commit -m "feat: componentes da aba Análise"`

---

## Task 9: `nexis-mobile` — componentes de Orçamentos

**Repo:** `nexis-mobile`

**Files:**
- New: `src/components/budgets/budget-row.tsx`
- New: `src/components/budgets/budgets-section.tsx`
- New: `src/components/budgets/budget-sheet.tsx`
- New: `src/__tests__/budget-sheet.test.tsx`

**Interfaces:**
- `BudgetRow({ budget, onPress }: { budget: Budget; onPress: (b: Budget) => void })`.
- `BudgetsSection({ year, month, isCurrentMonth, onPrev, onNext, onNew, budgets, loading, onEdit }: …)` — só apresentação; o estado de mês vive na tela.
- `BudgetSheet` — `forwardRef<SheetRef, { budget?: EditableBudget; month: number; year: number; onClose?: () => void }>`; `EditableBudget = { id: string; categoryId: string; limit: number }`.

- [ ] **Step 1: `budget-row.tsx`**

`Pressable onPress={() => onPress(budget)}` `gap-1.5`:
- `flex-row items-center justify-between`: ponto `h-2 w-2 rounded-full` `style={{ backgroundColor: budget.categoryColor }}` + `Text text-xs text-fg` `numberOfLines={1}` `{budget.categoryName}`; direita `flex-row gap-1.5`: `Text` `style={tabularNums}` `text-xs font-medium` (`text-negative` se `spent > limit`, senão `text-fg`) `{fmtBRL(budget.spent)}` + `Text text-xs text-muted` `/ {fmtBRL(budget.limit)}`.
- Trilho `h-1.5 w-full rounded-full bg-border` + `Animated.View` altura fixa, largura animada até `Math.min(budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0, 100)%`, `backgroundColor: budgetBarColor(progressClamped)`.
- Se `spent > limit`: `Text text-[10px] text-negative` "Limite excedido em {fmtBRL(spent - limit)}".

- [ ] **Step 2: `budgets-section.tsx`**

`View gap-3`:
- Header `flex-row items-center justify-between`: `Text text-xs uppercase tracking-widest text-muted` "Orçamentos"; cluster `flex-row items-center gap-1`:
  - `Pressable` redondo `h-7 w-7 rounded-full bg-border items-center justify-center` `onPress={onPrev}` → `ChevronLeft` 14 `colors.muted`.
  - `Text className="text-xs text-muted text-center" style={{ minWidth: 72 }}` `{fmtBudgetMonth(year, month)}`.
  - `Pressable` idem `onPress={onNext}` `disabled={isCurrentMonth}` (`style={{ opacity: isCurrentMonth ? 0.3 : 1 }}`) → `ChevronRight`.
  - `isCurrentMonth && <Pressable … onPress={onNew}>` → `Plus` 14.
- Corpo: `loading && !budgets.length` → nada (a tela mostra o skeleton geral). `budgets.length` → `View className="rounded-2xl bg-card border border-border p-4 gap-3"` com `budgets.map((b) => <BudgetRow key={b.id} budget={b} onPress={onEdit} />)`. Vazio → `View className="rounded-2xl bg-card border border-border py-6 items-center"` + `Text text-xs text-muted` "Nenhum orçamento definido".

- [ ] **Step 3: `budget-sheet.tsx`** (molde de `wallet-sheet.tsx`)

- `forwardRef<SheetRef, Props>`; `isEdit = !!budget`.
- Estado: `cents` (init `Math.round((budget?.limit ?? 0) * 100)`), `categoryId` (init `budget?.categoryId ?? ''`), `saved`, `confirmDelete`.
- `categoriesQuery('EXPENSE')` via `useQuery`.
- `reset()` amarrado no `onDismiss` do `<Sheet>` (repõe os inits; **sem** `onChange`).
- `<BottomSheetScrollView>` com título "Novo orçamento" / "Editar orçamento"; `Trash2` no topo se `isEdit && !saved` → `confirmDelete` inline (Cancelar / Remover).
- `saved` → check verde (`Check` em círculo `bg-positive/20`) + "Orçamento criado" / "Orçamento atualizado".
- Form (quando `!confirmDelete && !saved`):
  - `Text text-xs text-muted` "Limite mensal" + `<CurrencyInput cents={cents} onChange={setCents} autoFocus />`.
  - `!isEdit` → `Text text-xs text-muted` "Categoria" + `View flex-row flex-wrap gap-2` de `Pressable` chip por categoria EXPENSE: `flex-row items-center gap-1.5 rounded-full px-3 py-1.5`; selecionado = `bg-fg` + `text-bg`, senão `bg-border` + `text-muted`; ícone via `CATEGORY_ICONS[cat.icon ?? '']` (12, cor = selecionado ? `colors.bg` : `cat.color ?? colors.muted`) + `Text text-xs font-medium`.
- Botão: `Pressable` `bg-fg rounded-2xl py-3.5` `Text text-bg text-sm font-semibold` "Criar orçamento" / "Salvar". `disabled` quando `!canSave`:
  `canSave = !!categoryId && cents > 0 && !save.isPending && !saved && (!isEdit || cents / 100 !== budget!.limit)`.
- `save = useMutation({ mutationFn: () => saveBudget({ categoryId, month, year, amount: cents / 100 }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); setSaved(true); setTimeout(() => ref…dismiss?, 900) } })`. Seguir exatamente o padrão de fechamento do `wallet-sheet` (chama `onClose?.()` + `dismiss`).
- `del = useMutation({ mutationFn: () => removeBudget(budget!.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); onClose?.(); dismiss() } })`.

- [ ] **Step 4: `src/__tests__/budget-sheet.test.tsx`**

Mocks: `#/tw`, `#/tw/image`, `lucide-react-native`, `#/components/ui/sheet` (children passthrough + `BottomSheetTextInput: RN.TextInput` + `BottomSheetScrollView: RN.ScrollView`), `#/components/ui/currency-input` (`CurrencyInput: () => null`), `#/api/budgets` (`mockSaveBudget`, `mockRemoveBudget`), `@tanstack/react-query` `useQuery` → `{ data: [{ id:'c1', name:'Mercado', color:'#f00', icon:'ShoppingCart', type:'EXPENSE', userId:null }] }`, `useMutation` → objeto inerte (`mutate: jest.fn()`, `isPending:false`), `useQueryClient`.
Casos (só superfície + estado local; **nada de `press`+`waitFor` de mutation**):
- Modo criação: renderiza "Novo orçamento", mostra os chips de categoria, botão "Criar orçamento".
- Modo edição (`budget={{ id:'b1', categoryId:'c1', limit:200 }}`): renderiza "Editar orçamento", **sem** chips de categoria, lixeira visível, botão "Salvar".
- Tocar a lixeira → aparece "Remover este orçamento?" (troca de `confirmDelete`, é `setState` puro).

- [ ] **Step 5: Verificar** — jest do arquivo + `tsc`.

- [ ] **Step 6: Commit** — `git commit -m "feat: componentes e sheet de Orçamentos"`

---

## Task 10: `nexis-mobile` — tela `analytics.tsx` + registro da aba

**Repo:** `nexis-mobile`

**Files:**
- New: `src/app/(app)/analytics.tsx`
- Modify: `src/app/(app)/_layout.tsx`
- New: `src/__tests__/analytics-screen.test.tsx`

**Interfaces:**
- Consumes: `analyticsQuery`, `budgetsQuery`, `saveBudget`/`removeBudget` (via sheet); componentes das Tasks 8–9.
- Produces: rota/aba `analytics` visível depois de `wallets`.

- [ ] **Step 1: `_layout.tsx` — registrar a aba**

Importar `ChartColumnBig` de `lucide-react-native`. Adicionar **depois** do `<Tabs.Screen name="wallets" …>`:

```tsx
<Tabs.Screen
  name="analytics"
  options={{
    title: 'Análise',
    tabBarIcon: ({ color, size }) => <ChartColumnBig color={color} size={size} />,
  }}
/>
```
(Ordem final dos slots: `index`, `transactions`, `new` [FAB], `wallets`, `analytics`.)

- [ ] **Step 2: `analytics.tsx`**

```tsx
export default function AnalyticsScreen() {
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const { data, isLoading, isFetching } = useQuery(analyticsQuery)

  const now = useMemo(() => new Date(), [])          // não module-level (gotcha da Fatia 3)
  const [budgetYear, setBudgetYear] = useState(now.getFullYear())
  const [budgetMonth, setBudgetMonth] = useState(now.getMonth() + 1)
  const isCurrentMonth =
    budgetYear === now.getFullYear() && budgetMonth === now.getMonth() + 1

  const budgets = useQuery(budgetsQuery(budgetYear, budgetMonth))

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['budgets'] })
    }, [qc]),
  )

  const sheetRef = useRef<SheetRef>(null)
  const [editing, setEditing] = useState<EditableBudget | undefined>()

  function prevMonth() {
    setBudgetMonth((m) => (m === 1 ? (setBudgetYear((y) => y - 1), 12) : m - 1))
  }
  function nextMonth() {
    if (isCurrentMonth) return
    setBudgetMonth((m) => (m === 12 ? (setBudgetYear((y) => y + 1), 1) : m + 1))
  }
  function openNew()  { setEditing(undefined); sheetRef.current?.present() }
  function openEdit(b: Budget) {
    setEditing({ id: b.id, categoryId: b.categoryId, limit: b.limit })
    sheetRef.current?.present()
  }

  const cold = isLoading && !data
  const income = data?.monthly.income ?? 0
  const expenses = data?.monthly.expenses ?? 0
  // ...ScrollView igual ao index.tsx (paddingTop insets.top+16, gap 24, RefreshControl
  //    invalidando ['analytics'] + ['budgets'])
}
```

Corpo da `ScrollView` (`gap: 24`):
1. Header: `Text text-2xl font-bold text-fg` "Análise" + `Text text-xs text-muted` = `MONTHS_SHORT[now.getMonth()]` + ` ` + ano.
2. `cold` → `<AnalyticsSkeleton />` e **para aqui**. Senão, as seções:
3. Secão "Resumo do mês" (título + `<SummaryCards income={income} expenses={expenses} loading={isLoading} />`).
4. `<SpendingPaceCard income={income} expenses={expenses} dayOfMonth={data?.dayOfMonth ?? 1} daysInMonth={data?.daysInMonth ?? 30} />` sob o título "Ritmo do mês" — o componente já retorna `null` se `income <= 0`; envolver o título junto num fragmento que só renderiza se `income > 0`.
5. `!!data?.trend.length &&` seção "Últimos 6 meses" + `<MonthlyTrend trend={data.trend} />`.
6. `!!data?.categoryBreakdown.length &&` seção "Gastos por categoria" + `<CategoryBreakdown items={data.categoryBreakdown} />`.
7. `<BudgetsSection year={budgetYear} month={budgetMonth} isCurrentMonth={isCurrentMonth} onPrev={prevMonth} onNext={nextMonth} onNew={openNew} onEdit={openEdit} budgets={budgets.data ?? []} loading={budgets.isLoading} />`.

Fora da `ScrollView`, no fim do componente: `<BudgetSheet ref={sheetRef} budget={editing} month={budgetMonth} year={budgetYear} onClose={() => setEditing(undefined)} />`.

> Títulos de seção: helper local `Section({ title, children })` → `View gap-3` + `Text text-xs uppercase tracking-widest text-muted`.

- [ ] **Step 3: `src/__tests__/analytics-screen.test.tsx`**

Mocks: `#/tw`, `#/tw/image`, `expo-router` (`useFocusEffect: (cb) => cb()`), `lucide-react-native`, `react-native-safe-area-context`, `react-native-gifted-charts` (`{ BarChart: () => null, PieChart: () => null }`), `#/components/ui/sheet`, `#/components/ui/currency-input`, `#/api/analytics` + `#/api/budgets` (queries retornando objetos com `queryKey`/`queryFn` inertes), `#/components/budgets/budget-sheet` (`() => null`).
Render com um `QueryClient` de teste e `queryClient.setQueryData(['analytics'], fixture)` / `setQueryData(['budgets', y, m], [...])`. Casos:
- Com `fixture.monthly.income > 0`: aparece "Resumo do mês", "Ritmo do mês", "Últimos 6 meses", "Gastos por categoria", "Orçamentos".
- Com `income = 0`: **não** aparece "Ritmo do mês".
- Com `budgets = []`: aparece "Nenhum orçamento definido".
- `data` ausente + `isLoading` (não setar query data): não quebra (skeleton).

- [ ] **Step 4: Verificar** — `npx jest --forceExit src/__tests__/analytics-screen.test.tsx && npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git commit -m "feat: aba Análise (gráficos + orçamentos)"`

---

## Task 11: `nexis-mobile` — suíte completa, checklist de device, PR

**Repo:** `nexis-mobile`

- [ ] **Step 1: Suíte + tipos**

```bash
cd /home/welbertbarbosa/projects/personal/nexis-mobile
npx tsc --noEmit
npx jest --forceExit
```
Expected: `tsc` limpo; todas as suítes verdes (total esperado ~92–98).

- [ ] **Step 2: Checklist manual no device** (o usuário roda — `npx expo start --tunnel`, Expo Go no iPhone; **backend precisa da branch `feat/mobile-slice-5-analytics-budgets-backend` no ar ou o PR do `nexis` já mergeado**)

- [ ] 5ª aba "Análise" aparece com ícone `ChartColumnBig`; tab bar com 5 slots + FAB não quebra; label não trunca (checar iPhone SE se disponível).
- [ ] **Charts bundlam no Expo Go** (o risco principal) — `MonthlyTrend` e `CategoryBreakdown` renderizam sem crash no Hermes. Se a lib não bundlar por causa de `react-native-linear-gradient`: aplicar o **fallback** da Task 4 Step 3 (victory-native + skia) e reabrir as Tasks 8.3/8.4.
- [ ] Resumo do mês bate com a tela Análise do PWA (mesma conta).
- [ ] Ritmo do mês: só com receita > 0; marcador branco na % do dia; cor verde/laranja/vermelho conforme o ritmo; frase "Restam R$ X/dia…" só quando há saldo e dias.
- [ ] Tendência 6m: 6 grupos, rótulos `jan`…`dez` sem ponto, receita verde / despesa vermelha, alturas proporcionais, anima na entrada.
- [ ] Gastos por categoria: donut nas cores das categorias; legenda top-5 com %; tocar expande a lista completa (valores em R$) e recolhe; % somam ~100.
- [ ] Orçamentos: ‹ sempre anda; › trava no mês atual; ＋ só no mês atual. Criar (categoria + limite → check → some sozinho); a linha nova aparece com a barra na cor da faixa; estourar → "Limite excedido em R$ X" + `spent` vermelho; editar (categoria travada, só o limite; botão só habilita se mudou); excluir (confirm inline).
- [ ] Lançar despesa em Transações e voltar pra Análise → Resumo, Tendência, Categorias e `spent` do orçamento atualizam ao focar.
- [ ] Offline: a aba abre do cache; `OfflineBanner` aparece; refresh reconecta.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/mobile-slice-5-analytics-budgets
gh pr create --repo Welbert-Soares/nexis-mobile --base main \
  --title "feat: Fatia 5 — aba Análise (gráficos) + Orçamentos" \
  --body "Nova 5ª aba Análise espelhando analytics.tsx do PWA menos Metas/Perfil: Resumo do mês, Ritmo do mês, Tendência 6 meses e Gastos por categoria (react-native-gifted-charts), + Orçamentos CRUD por categoria/mês. Consome GET /api/mobile/analytics e GET/POST/DELETE /api/mobile/budgets*. Spec: nexis/docs/superpowers/specs/2026-09-08-nexis-mobile-slice-5-analytics-budgets-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Ordem de merge

1. PR do `nexis` (Tasks 1–3) primeiro — o app depende das rotas.
2. PR do `nexis-mobile` (Tasks 4–11) depois, com o checklist de device feito.

## Rollback

- `nexis`: as 3 rotas são puramente aditivas; reverter o PR não afeta web nem as fatias anteriores.
- `nexis-mobile`: reverter o PR tira a aba e as 2 deps; nada mais referencia `react-native-gifted-charts` / `expo-linear-gradient`.
