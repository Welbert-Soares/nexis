# Nexis Mobile — Fatia 5: Análise + Orçamentos — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D12) — plano a ser derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-5-analytics-budgets.md`
**Sub-projeto:** 5 de ~6 da versão React Native / Expo do Nexis

---

## Contexto

As Fatias 1–4 entregaram Dashboard (read-only), Carteiras (CRUD + transferência) e Transações (CRUD + recorrência + parcelamento + filtros). O que falta pra paridade com o PWA: **Análise** (gráficos), **Orçamentos** (CRUD), **Metas** (CRUD + aporte/resgate) e **Perfil** (logout).

A Fatia 5 abre a **5ª aba — Análise** — espelhando a tela `analytics.tsx` do PWA: resumo do mês, ritmo de gastos, tendência de 6 meses, gastos por categoria e **orçamentos** por categoria/mês (CRUD). **Metas e Perfil ficam pra Fatia 6.**

O backend já tem toda a lógica nos services do PWA (`analytics.service.ts`, `budget.service.ts`) e nos repositories (`analytics.repository.ts`, `budget.repository.ts`). A fatia só adiciona rotas `/api/mobile/*` que reusam esses repositories — mesmo contrato aditivo das fatias anteriores.

### O que já existe e é relevante

**No `nexis` (web):**

- **`src/server/repositories/analytics.repository.ts`** — `getAnalyticsData(userId)` retorna objeto plano, **mês corrente fixo** (sem parâmetro):
  ```ts
  {
    monthly: { income: number, expenses: number },      // mês atual, isTransfer:false
    categoryBreakdown: { id, name, color, amount }[],    // EXPENSE top 8 do mês, desc
    trend: { month: 'YYYY-MM', income, expenses }[],     // exatamente 6 itens, mais antigo→atual
    dayOfMonth: number,
    daysInMonth: number,
  }
  ```
- **`src/server/repositories/budget.repository.ts`**:
  - `getBudgetsWithSpending(userId, month, year)` → `Budget[]` com `category` incluída e `category.transactions` = EXPENSE daquele mês/categoria (`select: { amount }`). Ordenado por `category.name asc`.
  - `upsertBudget(userId, categoryId, month, year, amount)` → `prisma.budget.upsert` na unique `(userId, categoryId, month, year)`.
  - `deleteBudget(id, userId)` → `prisma.budget.delete({ where: { id, userId } })`.
- **`src/server/services/budget.service.ts`** — o `getBudgets` mapeia as linhas do repo pra:
  ```ts
  { id, categoryId, categoryName, categoryColor, categoryIcon, limit: number, spent: number }
  ```
  `spent = category.transactions.reduce(+amount)`. `saveBudget` body `{ categoryId, month, year, amount: positive }`. `removeBudget` body `{ id }`.
- **`src/routes/_authenticated/analytics.tsx`** — a tela-referência. Seções: Header (mês por extenso) · Resumo do mês (3 cards: Receitas / Despesas / Saldo) · Ritmo do mês (`SpendingPace`, só quando `income > 0`) · Últimos 6 meses (`MonthlyTrend`, barras income/expense por mês) · Gastos por categoria (`DonutChart` — donut SVG + legenda top-5, expande pra lista completa ao tocar) · **Metas** (link pra `/goals`) · **Orçamentos** (nav de mês ‹ ›, "+" só no mês atual, `BudgetsList` com barra `spent/limit` colorida por faixa, aviso "Limite excedido em R$ X").
- **`src/components/budgets/budget-sheet.tsx`** — sheet CRUD: campo Limite (`CurrencyInput`, autofocus), chips de Categoria (só EXPENSE, **só na criação** — trava no modo edição), estado `saved` com check verde + auto-close, `confirmDelete` inline. Invalida `['budgets']`.
- **Rotas mobile já existentes** (`src/routes/api/mobile/`): padrão `auth.api.getSession(headers)` → 401; querystring/body `zod.safeParse` → 400; `Error` do repo → 404 `{ error }`; sucesso `Response.json(...)`; DELETE responde `Response.json(null)`. `GET /api/mobile/categories?type=EXPENSE` **já existe** (Fatia 3) e devolve os registros crus de `Category`.
- vitest configurado; cada fatia adicionou testes de rota (`src/routes/api/mobile/*.test.ts`).
- **`routeTree.gen.ts`** é regenerado por
  `node -e "const {Generator,getConfig}=require('@tanstack/router-generator');new Generator({config:getConfig({},process.cwd()),root:process.cwd()}).run()"`.

**No `nexis-mobile`:**

- `src/app/(app)/_layout.tsx` — `<Tabs>` com 4 slots: `index` (Início), `transactions` (Transações), `new` (slot central = `FabTabButton`, não navega), `wallets` (Carteiras). `useEffect` chama `triggerRecurring()` ao abrir. `<TransactionSheetProvider>` envolve os `<Tabs>`.
- `src/api/client.ts` — `apiGet(path, parse)`, `apiPost(path, body?, parse?)`, `apiDelete(path)`. Cookie via `authClient.getCookie()` (**síncrono**). `ApiError` extrai `{ error }` PT-BR do corpo; `204` → `undefined`.
- Padrão por recurso: um `<recurso>Query` em `src/api/`, um schema Zod de resposta em `src/schemas/` (`z.object` **não-strict** — campos extras do Prisma passam), mutations invalidam as query keys afetadas.
- `src/api/transactions.ts` — `monthTransactionsQuery(y,m)` key `['transactions', y, m]`; `maxDateQuery` key `['transactions-max-date']`. `src/api/categories.ts` — `categoriesQuery(type)` key `['categories', type]`, `staleTime` 5min.
- `src/api/dashboard.ts` — `dashboardQuery` key `['dashboard']`.
- `src/components/ui/sheet.tsx` — `Sheet` (`BottomSheetModal`, `enableDynamicSizing`, `keyboardBehavior="interactive"`), reexporta `BottomSheetScrollView` / `BottomSheetTextInput`; `type SheetRef`.
- `src/components/ui/sheet-field.tsx` — `SheetField` + `inputStyle` (fundo `colors.border`, focus ring `colors.muted`).
- `src/components/ui/currency-input.tsx` — `CurrencyInput` BRL, `onFocus?` opcional.
- `src/components/wallets/wallet-sheet.tsx` — molde de sheet CRUD: `forwardRef<SheetRef>`, `useState` por campo, `reset()` no `onDismiss`, `isDirty` no botão Salvar, `saved` com check, `confirmDelete` inline, grid de ícones 6-col com `Animated` (0/1 driver, primeiro run sem timer).
- `src/lib/format.ts` — `fmtBRL`, `fmtDate`, `toYMD`, `fmtDayGroup`, `tabularNums`. **`MONTHS_SHORT`** = `['jan',…,'dez']` e `WEEKDAYS_SHORT` são tabelas fixas **de propósito** — `Intl` com `month:'short'` diverge de pontuação entre Node (jest) e Hermes (device).
- `src/lib/category-icons.ts` — `CATEGORY_ICONS: Record<string, LucideIcon>`.
- `src/theme/colors.ts` — `bg #09090b`, `card #18181b`, `border #27272a`, `fg #fafafa`, `muted #71717a`, `accent #60a5fa`, `violet #c084fc`, `positive #34d399`, `negative #f87171`. Espelho do `@theme` de `src/global.css`.
- UI só de `#/tw` / `#/tw/image` (senão `className` não aplica). Exceções em uso: `RefreshControl`, `SectionList`, `useSafeAreaInsets`, `@gorhom/bottom-sheet`, `Modal`, `Platform`, `Animated`, `Switch`, `@react-native-community/datetimepicker`.
- **`react-native-svg` 15.15.4 já é dependência direta.** Não há `@shopify/react-native-skia`.
- Testes: jest-expo (`npx jest --forceExit`), 76 testes. Gotchas (memória / CLAUDE.md do repo): pin RNTL `^13.3.3`; mock `#/tw` nos testes de tela; **nada de `fireEvent.press` que dispare `useMutation` + `waitFor`** (trava o `react-test-renderer`); sem `.test.tsx` sob `src/app/` (vira rota); mock `expo-router` (`useFocusEffect`), `lucide-react-native` (objeto plano de `() => null`, nunca `Proxy`), `#/tw/image` (`() => null`); `jest.mock` factory vars com prefixo `mock`.
- **`nexis-mobile` não tem prettier/eslint funcional.** Estilo (sem ponto-e-vírgula, aspas simples, 2 espaços) é convenção — casar na mão. A barra é `npx tsc --noEmit` limpo + jest verde.

---

## Objetivo da Fatia 5

Abrir a aba **Análise** no `nexis-mobile` espelhando `analytics.tsx` do PWA, **menos** as seções Metas e Perfil:

1. **Resumo do mês** — 3 cards (Receitas / Despesas / Saldo), mês corrente.
2. **Ritmo do mês** — barra de progresso "% da renda gasta" vs. "% do mês andado" + quanto sobra por dia. Só quando `income > 0`.
3. **Últimos 6 meses** — gráfico de barras income vs. expense por mês.
4. **Gastos por categoria** — donut + legenda; toca e expande a lista completa.
5. **Orçamentos** — lista por categoria do mês selecionado com barra `spent/limit` colorida; navegação de mês; criar / editar / excluir orçamento via bottom-sheet. Persistindo no banco de produção por rotas `/api/mobile/*` aditivas.

**Princípio (todo o projeto mobile):** a tela aparece na hora (cache do TanStack Query ou vazia); dados preenchem depois. Skeleton só em cold load real. Sem transição JS na navegação.

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | **Aba** | "Análise" vira a **5ª aba** — `src/app/(app)/analytics.tsx`, registrada **depois de `wallets`** no `_layout.tsx`. Ordem final da tab bar: Início · Transações · ＋ · Carteiras · Análise (igual PWA). Ícone: `ChartColumnBig` (a confirmar no plano). |
| D2 | **Escopo de mês dos gráficos** | Resumo / Ritmo / Tendência / Categorias = **sempre mês corrente**, sem navegação — `getAnalyticsData` não tem parâmetro de mês. Só a seção **Orçamentos** tem nav de mês. |
| D3 | **Backend — Análise** | `GET /api/mobile/analytics` → `getAnalyticsData(session.user.id)` **verbatim**. Sem querystring. 401 se sem sessão. |
| D4 | **Backend — Orçamentos** | `GET /api/mobile/budgets?year=&month=` → mesmo `map` do `getBudgets` do `budget.service.ts` (`{ id, categoryId, categoryName, categoryColor, categoryIcon, limit, spent }`). `POST /api/mobile/budgets` body `{ categoryId, month, year, amount>0 }` → `upsertBudget` → `{ ...b, amount: number }`. `DELETE /api/mobile/budgets/$id` → `deleteBudget(id, userId)` → `Response.json(null)`; erro do repo → 404. Zod inline no arquivo da rota (cópia do service, padrão da casa). |
| D5 | **Categorias no sheet de orçamento** | Reusa `GET /api/mobile/categories?type=EXPENSE` (já existe) + `categoriesQuery('EXPENSE')` do app. Sem rota nova. |
| D6 | **Gráficos — biblioteca** | Usar uma **lib de charts** (decisão do usuário). Recomendação: **`react-native-gifted-charts`** — SVG puro sobre o `react-native-svg` que já está no projeto, **sem** módulo nativo / skia, baixo risco no Expo Go. `victory-native` (XL, precisa de `@shopify/react-native-skia` — suportado no Expo Go SDK 57) fica como alternativa. **Pacote + versão exatos travados no plano após um spike no device.** |
| D7 | **Tendência 6m** | `BarChart` agrupado da lib: 2 barras por mês (Receitas `positive`, Despesas `negative`), rótulo do eixo X = `MONTHS_SHORT[m-1]` a partir da chave `'YYYY-MM'` (**nunca `Intl`** — gotcha de ICU). Legenda (dois pontinhos + rótulo) acima do gráfico, como no PWA. Altura ~112. |
| D8 | **Gastos por categoria** | Donut (`PieChart` `donut` da lib) + legenda top-5 (ponto da cor + nome + %). Toca no bloco → expande pra lista completa (nome + valor em R$), toca de novo → recolhe. Espelha o `DonutChart` do PWA (chevron girando, `Animated` de altura no app). Guardado por `total > 0`. |
| D9 | **Ritmo do mês** | **View/CSS puro** (sem lib) — é barra de progresso + marcador. Porta a lógica do `SpendingPace` do PWA verbatim: `pctMonthElapsed`, `pctIncomeSpent` (cap 999), `aheadOfPace`, `daysLeft`, `dailyBudget`; `barColor` = `>100%` vermelho / `aheadOfPace` laranja / senão verde; mesmos 3 textos e a linha "Restam R$ X/dia…". Só renderiza com `income > 0`. |
| D10 | **Sheet de orçamento** | `src/components/budgets/budget-sheet.tsx`, `forwardRef<SheetRef>`, molde `wallet-sheet`: `BottomSheetScrollView`, `reset()` no `onDismiss`, `isDirty` no botão, `saved` com check verde + auto-close (~900ms), `confirmDelete` inline (só `isEdit`). Campos: **Limite** (`CurrencyInput`, autofocus) e **Categoria** (chips ícone+nome de `categoriesQuery('EXPENSE')`, **só na criação**; travada no edit). Sem `onChange` no `Sheet`. |
| D11 | **Nav de mês dos Orçamentos** | Espelha o PWA: ‹ sempre habilitado (sem piso), › **travado quando `year/month` == mês corrente**, "＋ novo orçamento" **só visível no mês corrente**. Editar/excluir orçamento existente vale em qualquer mês. Rótulo `MONTHS_SHORT[m-1] + '/' + 2-díg do ano` (ex.: `set/25`). |
| D12 | **Query keys / invalidação** | `analyticsQuery` key `['analytics']`; `budgetsQuery(y,m)` key `['budgets', y, m]` com `placeholderData: keepPreviousData`. `saveBudget`/`removeBudget` invalidam `['budgets']` (todos os meses). A tela Análise faz `useFocusEffect` invalidando `['analytics']` **e** `['budgets']` — lançar transação em outra aba muda `spent`, tendência e categorias. |

---

## Arquitetura (delta sobre a Fatia 4)

```
nexis (web) — aditivo
  src/routes/api/mobile/
    analytics.ts           # GET → getAnalyticsData(userId)
    analytics.test.ts
    budgets.ts             # GET (?year&month) + POST (upsert)
    budgets.test.ts
    budgets.$id.ts         # DELETE
    budgets.$id.test.ts
  routeTree.gen.ts         # regenerado

nexis-mobile
  package.json             # + react-native-gifted-charts  (+ expo-linear-gradient se a lib exigir)
  src/app/(app)/
    _layout.tsx            # + <Tabs.Screen name="analytics"> depois de "wallets"
    analytics.tsx          # nova tela da aba
  src/components/analytics/
    summary-cards.tsx      # Resumo do mês (3 cards)
    spending-pace.tsx      # Ritmo do mês (View pura)
    monthly-trend.tsx      # Últimos 6 meses (BarChart da lib)
    category-breakdown.tsx # Donut + legenda expansível (PieChart da lib + Animated)
    analytics-skeleton.tsx
  src/components/budgets/
    budgets-section.tsx    # header (nav de mês + "＋") + lista/empty
    budget-row.tsx         # linha com barra spent/limit colorida
    budget-sheet.tsx       # sheet CRUD
  src/api/
    analytics.ts           # analyticsQuery
    budgets.ts             # budgetsQuery(y,m) + saveBudget + removeBudget
  src/schemas/
    analytics.ts           # AnalyticsSchema
    budget.ts              # BudgetSchema / BudgetsSchema / BudgetInput
  src/lib/
    format.ts              # + fmtMonthKeyShort('YYYY-MM') e fmtBudgetMonth(y,m)
  src/__tests__/           # testes de tela + schema + funções puras
```

### Rotas do backend (detalhe)

**`GET /api/mobile/analytics`** — sem querystring.
```ts
const session = await auth.api.getSession({ headers: request.headers })
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
return Response.json(await getAnalyticsData(session.user.id))
```

**`GET /api/mobile/budgets?year=&month=`**
```ts
const q = z.object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) })
// safeParse → 400
const rows = await getBudgetsWithSpending(session.user.id, month, year)
return Response.json(rows.map((b) => ({
  id: b.id,
  categoryId: b.categoryId,
  categoryName: b.category.name,
  categoryColor: b.category.color ?? '#71717a',
  categoryIcon: b.category.icon,
  limit: b.amount.toNumber(),
  spent: b.category.transactions.reduce((acc, t) => acc + t.amount.toNumber(), 0),
})))
```
> Cópia exata do `map` do `budget.service.ts` — mantém os dois em paridade.

**`POST /api/mobile/budgets`**
```ts
const body = z.object({
  categoryId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  amount: z.number().positive(),
})
// safeParse → 400
const b = await upsertBudget(session.user.id, categoryId, month, year, amount)
return Response.json({ ...b, amount: b.amount.toNumber() })
```

**`DELETE /api/mobile/budgets/$id`** — mesmo shape de `wallets.$id.ts` (helper `budgetId(request, params)` com fallback pra URL, `try/catch` → 404).
```ts
await deleteBudget(budgetId(request, params), session.user.id)
return Response.json(null)
```

### App — camada de dados

```ts
// src/schemas/analytics.ts
export const AnalyticsSchema = z.object({
  monthly: z.object({ income: z.number(), expenses: z.number() }),
  categoryBreakdown: z.array(z.object({
    id: z.string(), name: z.string(), color: z.string(), amount: z.number(),
  })),
  trend: z.array(z.object({
    month: z.string(), income: z.number(), expenses: z.number(),
  })),
  dayOfMonth: z.number(),
  daysInMonth: z.number(),
})
export type Analytics = z.infer<typeof AnalyticsSchema>

// src/schemas/budget.ts
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

```ts
// src/api/analytics.ts
export const analyticsQuery = {
  queryKey: ['analytics'] as const,
  queryFn: () => apiGet('/api/mobile/analytics', (r) => AnalyticsSchema.parse(r)),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
}

// src/api/budgets.ts
export const budgetsQuery = (year: number, month: number) => ({
  queryKey: ['budgets', year, month] as const,
  queryFn: () => apiGet(`/api/mobile/budgets?year=${year}&month=${month}`, (r) => BudgetsSchema.parse(r)),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
})
export const saveBudget = (body: BudgetInputData) =>
  apiPost('/api/mobile/budgets', body, (r) => BudgetSchema.partial().parse(r))
export const removeBudget = (id: string) => apiDelete(`/api/mobile/budgets/${id}`)
```

---

## Especificação de UI (por seção)

Layout geral: `ScrollView className="flex-1 bg-bg"` com `contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 32, gap: 24 }}`, `RefreshControl` invalidando `['analytics']` + `['budgets']` (igual `index.tsx`). Header: `Análise` (text-2xl bold) + mês corrente por extenso em `muted` (`MONTHS_SHORT` + ano, sem `Intl`). `cold = analyticsLoading && !data` → `<AnalyticsSkeleton/>` no lugar das seções.

Cada seção: título `text-xs uppercase tracking-widest` em `muted`, seguido do card (`bg-card`/`border`, `rounded-2xl`, `p-4`).

### 1. Resumo do mês — `summary-cards.tsx`
`View` com 3 colunas (`flex-row gap-2`, cada card `flex-1`). Card: rótulo em `muted` + valor `fmtBRL` `text-sm font-semibold` com `tabularNums`. Cores: Receitas `positive`, Despesas `negative`, Saldo `accent` se `>= 0` senão `negative`. `net = income - expenses`.

### 2. Ritmo do mês — `spending-pace.tsx`
Só renderiza se `!loading && income > 0`. Card com:
- Trilho `h-2.5 rounded-full bg-border` + preenchimento `Animated` de `width` até `min(pctIncomeSpent, 100)%`, cor = `barColor`. Marcador vertical `w-0.5 bg-white/70` em `left: pctMonthElapsed%`.
- Linha: `pctIncomeSpent%` (colorido) + "da renda gasta" · à direita "mês N% andado" em `muted`.
- Parágrafo `text-[11px]` com um dos 3 textos do PWA.
- Se `remaining > 0 && daysLeft > 0`: "Restam **R$ X**/dia pelos próximos N dias pra fechar o mês no azul."

### 3. Últimos 6 meses — `monthly-trend.tsx`
Só se `!loading && trend.length`. Legenda (ponto `positive` "Receitas" · ponto `negative` "Despesas"). `BarChart` da lib, `data` = 6 grupos, 2 barras cada; eixo X `fmtMonthKeyShort(t.month)`; sem eixo Y / grid pesado (minimalista, como o PWA); animação de entrada da própria lib. Altura ~112.

### 4. Gastos por categoria — `category-breakdown.tsx`
Só se `!loading && categoryBreakdown.length && total > 0`. Card com `Pressable` que alterna `expanded`:
- Recolhido: donut (`PieChart` `donut`, `innerRadius` ~55%, cor por fatia = `item.color`, trilho `border`) à esquerda + legenda top-5 (ponto + nome truncado + `%`) + chevron (`Animated` `rotate`).
- Expandido: `Animated` de altura revela a lista completa (`nome` + `fmtBRL(amount)`), como o `AnimatePresence` do PWA.
- `pct(v, total) = round(v/total*100)`.

### 5. Orçamentos — `budgets-section.tsx` + `budget-row.tsx`
Header da seção: título "Orçamentos" à esquerda; à direita um cluster de botões redondos `h-7 w-7 bg-border`:
- ‹ (`ChevronLeft`) — `prevMonth` (sem piso).
- rótulo `fmtBudgetMonth(year, month)` (`min-w`, centralizado, `muted`).
- › (`ChevronRight`) — `nextMonth`, `disabled` + `opacity-30` quando `isCurrentMonth`.
- ＋ (`Plus`) — **só quando `isCurrentMonth`** — abre o `budget-sheet` em modo criação.

Lista (card `p-4`, `gap-3`): `budget-row` por orçamento. Vazio → card com "Nenhum orçamento definido" em `muted`.

`budget-row`: `Pressable` (abre o sheet em modo edição com `{ id, categoryId, limit }`):
- Linha: ponto `categoryColor` + `categoryName` truncado · à direita `fmtBRL(spent)` (`negative` se `over`) + `/ fmtBRL(limit)` em `muted`.
- Trilho `h-1.5 rounded-full bg-border` + preenchimento `Animated` `width: min(spent/limit*100, 100)%`. `barColor` por faixa (mesmos limiares do PWA): `>90%` `#ef4444` · `>80%` `#f87171` · `>60%` `#fb923c` · `>30%` `#eab308` · senão `#22c55e`.
- Se `spent > limit`: `text-[10px]` `negative` "Limite excedido em `fmtBRL(spent - limit)`".

### 6. `budget-sheet.tsx`
Título "Novo orçamento" / "Editar orçamento". `Trash2` no topo (só `isEdit && !saved`) → `confirmDelete` inline (Cancelar / Remover). `saved` → check verde + "Orçamento criado/atualizado", auto-close ~900ms. Form:
- **Limite mensal** — `CurrencyInput` `autoFocus`, `cents` state.
- **Categoria** — só quando `!isEdit`: chips `flex-wrap` de `categoriesQuery('EXPENSE')` (ícone via `CATEGORY_ICONS[cat.icon]` + nome), selecionado = fundo claro / texto escuro (igual PWA).
- Botão "Criar orçamento" / "Salvar" — `disabled` até `categoryId && cents > 0 && !isPending && !saved`; no edit também exige `cents/100 !== budget.limit` (isDirty).
- `mutationFn`: `saveBudget({ categoryId, month, year, amount: cents/100 })`. `onSuccess`: invalida `['budgets']`, `setSaved(true)`.
- `reset()` no `onDismiss` do `Sheet` (sem `onChange`).

---

## Testes

**`nexis` (vitest, `src/routes/api/mobile/*.test.ts`)** — seguir o formato dos testes das fatias 2–4 (mock de `auth.api.getSession`, chamar `Route.options.server.handlers.*`):

- `analytics.test.ts` — GET 200 devolve `{ monthly, categoryBreakdown, trend, dayOfMonth, daysInMonth }` (mock de `getAnalyticsData`); GET 401 sem sessão.
- `budgets.test.ts` — GET com `?year&month` mapeia as linhas (`categoryColor` cai pra `#71717a` quando null; `spent` = soma); GET 400 sem/`month` inválido; GET 401. POST 200 chama `upsertBudget` e devolve `amount: number`; POST 400 body inválido (`amount <= 0`, falta `categoryId`); POST 401.
- `budgets.$id.test.ts` — DELETE 200 (`Response.json(null)`) chama `deleteBudget(id, userId)`; DELETE 404 quando o repo lança; DELETE 401.

Alvo: ~14–18 testes. `routeTree.gen.ts` regenerado e commitado.

**`nexis-mobile` (jest-expo, `src/__tests__/`, `npx jest --forceExit`)** — respeitando os gotchas (sem `press`+`waitFor` de mutation):

- `schemas/analytics.test.ts`, `schemas/budget.test.ts` — parse de payloads representativos + rejeição de shape errado; `BudgetSchema.partial()` tolera resposta enxuta do POST.
- `lib/format.test.ts` — `fmtMonthKeyShort('2026-09')` → `'set'`; `fmtBudgetMonth(2025, 9)` → `'set/25'`.
- `analytics-calcs.test.ts` — funções puras extraídas: `spendingPace(income, expenses, day, days)` (limiares de cor, cap 999, `dailyBudget`), `budgetBarColor(pct)` (as 5 faixas), `pct(v, total)` com `total = 0`.
- `budget-sheet.test.tsx` — render em modo criação (chips de categoria presentes) e edição (sem chips, título "Editar orçamento", lixeira visível); alternar `confirmDelete` (só `setState`, sem mutation).
- `analytics-screen.test.tsx` — mock de `#/tw`, `#/tw/image`, `expo-router` (`useFocusEffect`), `lucide-react-native`, **a lib de charts** (`() => null`), `react-native-safe-area-context`, `#/components/ui/sheet`; com `analyticsQuery`/`budgetsQuery` mockados via `queryClient.setQueryData`, garante que as 5 seções montam e que `income = 0` esconde o Ritmo do mês e `budgets = []` mostra o empty.

Alvo: ~16–22 testes (total do repo ~92–98).

**Barra:** `npx tsc --noEmit` limpo nos dois repos; as duas suítes verdes.

---

## Verificar no device

- `npx expo start --tunnel`, Expo Go no iPhone.
- **Aba**: aparece a 5ª aba "Análise" com o ícone certo; a tab bar com 5 slots + FAB central não quebra em telas pequenas; o label não trunca.
- **Resumo do mês**: os 3 valores batem com a tela Análise do PWA (mesma conta logada).
- **Ritmo do mês**: só aparece se houver receita no mês; o marcador branco fica na % do dia do mês; a cor da barra muda conforme o ritmo (verde / laranja / vermelho); a frase "Restam R$ X/dia…" só quando ainda há saldo e dias.
- **Tendência 6m**: 6 grupos, rótulos `jan`…`dez` corretos (sem ponto), receita verde / despesa vermelha, alturas proporcionais; anima na entrada; nada de crash da lib de charts no Hermes.
- **Gastos por categoria**: donut com as fatias nas cores das categorias; legenda top-5 com %; tocar expande a lista completa (valores em R$) e recolhe; % somam ~100.
- **Orçamentos**: nav de mês — ‹ sempre anda, › trava no mês atual, ＋ só aparece no mês atual; criar (escolher categoria + limite → sucesso com check → some sozinho); a linha nova aparece com a barra na cor da faixa; estourar o limite mostra "Limite excedido em R$ X" e deixa `spent` em vermelho; editar (categoria travada, só o limite muda; botão só habilita se mudou); excluir (confirm inline).
- **Cross-tab**: lançar uma despesa em Transações e voltar pra Análise → Resumo, Tendência, Categorias e o `spent` do orçamento atualizam ao focar.
- **Offline**: a aba abre do cache; `OfflineBanner` aparece; refresh reconecta.
- **Saldo**: nada nesta fatia mexe em saldo de carteira (orçamento é só limite/observação).
- Rodar as duas suítes; `tsc --noEmit` limpo nos dois.

---

## Contrato que a Fatia 6 herda

- **`GET /api/mobile/analytics`** — snapshot do **mês corrente**: `monthly {income,expenses}`, `categoryBreakdown[≤8]`, `trend[6]` (`'YYYY-MM'`, antigo→atual), `dayOfMonth`, `daysInMonth`. Sem parâmetro de mês.
- **`GET /api/mobile/budgets?year=&month=`**, **`POST /api/mobile/budgets`** (upsert na unique `(userId,categoryId,month,year)`), **`DELETE /api/mobile/budgets/$id`**.
- **Lib de charts** (definida no plano) disponível pra barra de progresso das Metas na Fatia 6.
- **`budget-sheet.tsx`** como molde de sheet CRUD "categoria + valor" — reusável pra Metas.
- **A tab bar está cheia (5 slots).** Metas e Perfil na Fatia 6 entram como **telas empilhadas** (rota fora do `<Tabs>` / modal), não como abas — provável: Perfil pelo avatar no header do Dashboard; Metas por um card/atalho no Dashboard ou na própria Análise.
- **A seção "Metas" da tela Análise do PWA foi omitida de propósito nesta fatia** — a Fatia 6 pode adicioná-la como bloco read-only com deep-link pra tela de Metas.

---

## Fora de escopo (Fatia 5)

- **Metas** (CRUD, aporte/resgate de carteira) e o bloco "Metas" na tela Análise — Fatia 6.
- **Perfil / logout** — Fatia 6.
- Navegação de mês nos gráficos (Resumo / Ritmo / Tendência / Categorias) — o backend não suporta.
- Filtro/seleção de período custom na Análise; comparativo mês a mês além dos 6 fixos.
- Notificação de orçamento estourado (`checkBudgetsAndNotify` / push) — a fatia de push tratou o canal; o disparo por orçamento fica pra depois.
- Categorias CRUD pelo app (continua read-only, só EXPENSE no sheet de orçamento).
- Editar a categoria de um orçamento existente (troca = excluir + criar, igual PWA).
- Export CSV / compartilhar relatório.
- Donut interativo (tap numa fatia destacar/filtrar) — o toque só expande/recolhe a legenda.

---

## Riscos / pontos de atenção

- **Lib de charts no Expo Go / Hermes / RN 0.86 / React 19.2.** `react-native-gifted-charts` é SVG puro sobre `react-native-svg` 15.15.4 (já no projeto) — risco baixo, mas **conferir a matriz de compatibilidade da versão com `react-native-svg` 15.x** e um render real no device antes de travar. `victory-native` XL puxa `@shopify/react-native-skia` (suportado no Expo Go SDK 57, porém pesado). O plano faz um spike rápido e trava pacote + versão. O projeto tem histórico de briga de versão (pin do RNTL) — pinar exato.
- **`gifted-charts` e `react-native-linear-gradient`.** Alguns recursos de gradiente pedem esse peer, que não roda no Expo Go — usar `expo-linear-gradient` no lugar **ou** evitar props de gradiente (barras/faixas em cor sólida, como o PWA). Decidir no plano.
- **Divergência ICU Node×Hermes.** Rótulos de mês (tendência e nav de orçamento) **têm** que sair de `MONTHS_SHORT`, nunca de `Intl` com `month:'short'` — mesmo motivo de `fmtDayGroup`.
- **`getAnalyticsData` é mês-corrente fixo.** Se o usuário abrir o app perto da virada do mês, os números da Análise e o "mês atual" da nav de orçamento podem discordar por alguns minutos até o refetch — aceitável, mesmo comportamento do PWA.
- **Donut com `total = 0`.** Guardar a seção inteira (`categoryBreakdown.length && total > 0`) — a lib pode dividir por zero.
- **`prisma.budget.delete({ where: { id, userId } })`.** O `userId` no `where` de um `delete` (além da unique `id`) é aceito pelo Prisma da casa (o service web já faz isso) — manter idêntico, não trocar por `deleteMany`.
- **Tab bar com 5 itens + FAB.** O PWA já usa 5 slots; no RN o `<Tabs>` acomoda, mas testar o label "Análise" em telas estreitas (iPhone SE) — se truncar, encurtar pra "Análise" mesmo ou só ícone.
- **`spent` só conta EXPENSE com `categoryId`.** Transferências têm `categoryId` null e `isTransfer` — já excluídas pelo `where` do repo; nada a fazer, só não “corrigir”.
- **`useFocusEffect` + `keepPreviousData`.** Ao focar a aba a query de `['budgets', y, m]` revalida; por 1 frame a lista renderiza sobre os dados antigos — mesmo comportamento aceito nas fatias 3–4.

---

## A confirmar no plano (não bloqueiam o spec)

- **Pacote + versão da lib de charts** — `react-native-gifted-charts` (proposto) vs. `victory-native` XL; spike no device com os dois payloads (`trend` e `categoryBreakdown`).
- Donut (`PieChart`) vs. barras horizontais pra "Gastos por categoria", se o donut da lib não ficar bom no device.
- Ícone da aba: `ChartColumnBig` (proposto) vs. `ChartPie` vs. `TrendingUp`.
- Animar as barras/donut na montagem (built-in da lib) vs. estático (como o resto do app evita transição JS).
- Piso da navegação de mês dos orçamentos: nenhum (espelha o PWA, proposto) vs. cap de 24 meses (como o fallback da Fatia 4).
- Posição da seção Orçamentos: no fim da `ScrollView` (proposto, igual PWA) vs. logo após o Resumo.
- Extrair `SummaryCard` pra um componente compartilhado com o Dashboard (`index.tsx` tem cards parecidos) vs. manter local.
