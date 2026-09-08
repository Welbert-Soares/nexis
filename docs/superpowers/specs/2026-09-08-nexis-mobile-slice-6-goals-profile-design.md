# Nexis Mobile — Fatia 6: Metas + Perfil — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D13) — plano a ser derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-6-goals-profile.md`
**Sub-projeto:** 6 de ~6 (última) da versão React Native / Expo do Nexis

---

## Contexto

As Fatias 1–5 entregaram Dashboard, Carteiras, Transações (+ recorrência/parcelamento/filtros) e Análise (gráficos + Orçamentos). Falta pra paridade com o PWA: **Metas** (CRUD + aporte/resgate de carteira) e **Perfil** (identidade + logout + CRUD de categorias).

A tab bar já tem os **5 slots cheios** (Início · Transações · ＋ · Carteiras · Análise), então nem Metas nem Perfil viram aba: **Metas** é uma tela empilhada aberta por um bloco novo na tela **Análise**; **Perfil** é um bottom-sheet aberto pelo **avatar no header do Dashboard** — os dois espelham exatamente como o PWA faz.

O backend já tem toda a lógica nos services/repositories do PWA (`goal.service.ts`, `goal.repository.ts`, `category.service.ts`, `category.repository.ts`). A fatia adiciona rotas `/api/mobile/*` aditivas e **extrai a lógica de aporte/resgate** (hoje presa dentro de `createServerFn` handlers) pra uma função de repo reutilizável.

### O que já existe e é relevante

**No `nexis` (web):**

- **`src/server/repositories/goal.repository.ts`**:
  - `getGoalsByUser(userId)` → objetos planos: `{ ...goal, targetAmount:number, seedAmount:number, currentAmount:number }`. `currentAmount = seedAmount + Σ(EXPENSE tagueada com goalId) − Σ(INCOME tagueada com goalId)`.
  - `createGoal({ userId, name, targetAmount, seedAmount?, deadline?, color? })` → `prisma.goal.create`.
  - `updateGoal(id, userId, { name?, targetAmount?, deadline?, color? })` → `findFirst({id,userId})` senão `throw new Error('Goal not found')`, depois `update`.
  - `deleteGoal(id, userId)` → idem guard + `prisma.goal.delete`.
- **`src/server/services/goal.service.ts`** — `getUserGoals`, `createUserGoal` (schema `{ name, targetAmount:positive, seedAmount?:≥0, deadline?:coerce.date|null, color? }`), `updateUserGoal` (`{ id, name?, targetAmount?, deadline?, color? }`), `deleteUserGoal` (`{ id }`), e **`depositGoalFromWallet`** / **`withdrawFromGoal`** (`{ goalId, walletId, amount:positive }`) — **a lógica dos dois está inteira dentro do `.handler`**, não há função de repo. Aporte = `prisma.transaction.create({ type:'EXPENSE', walletId, goalId, description:'Aporte → <meta>', date:new Date() })` após validar `amount ≤ saldo da carteira`. Resgate = `type:'INCOME'`, `description:'Resgate ← <meta>'`, valida `amount ≤ currentAmount`. Aporte que completa a meta dispara push `goal-completed` (fica **fora** da fatia mobile).
- **`src/server/repositories/category.repository.ts`**:
  - `getCategoriesByType(type, userId)` → globais (`userId null`) + do user, ordenado.
  - `getCategoriesWithUsage(userId)` → **todas** (globais + user) com `include: { _count: { select: { transactions: true } } }`, ordenado `type, userId, name`.
  - `createCategory({ name, color, icon?, type, userId })`.
  - `updateCategory(id, userId, { name, color, icon? })` → `update({ where: { id, userId } })` (global/alheia não casa → erro do Prisma).
  - `deleteCategory(id, userId)` → **`if (inUse > 0) throw new Error('Categoria em uso por transações')`**, senão `delete({ where: { id, userId } })`.
- **`src/server/services/category.service.ts`** — `getCategories` (`?type=`), `addCategory` (`{ name, color, icon?, type }`), `editCategory` (`{ id, name, color, icon?:nullable }`), `getCategoriesManagement` (sem args), `removeCategory` (`{ id }`).
- **`src/routes/_authenticated/goals.tsx`** (referência de UI): header "Total guardado" + total das metas + `+`; lista de `GoalCard` (nome, cor, `currentAmount`/`targetAmount`, barra, `%`, ações Aportar/Resgatar); tocar o card → `GoalSheet` de edição; empty state centralizado; drawers separados de aporte e resgate com seletor de carteira (chip mostra `nome` + `saldo`/`no cofre`), `CurrencyInput`, validação de saldo/limite.
- **`src/components/goals/goal-sheet.tsx`** — Nome, Valor da meta, "Já guardei (opcional)" **só na criação**, Prazo (`<input type=date>` opcional, `min` = hoje), Cor (8 swatches). `confirmDelete` inline, `saved` + auto-close 900ms, erro da mutation renderizado.
- **`src/components/profile/profile-sheet.tsx`** — avatar + nome + email; acordeão **Categorias** (toggle Despesas/Receitas; chips ícone-only que expandem o nome ao tocar; tocar expandido edita **se `cat.userId != null`**; **long-press 500ms** → confirmação de exclusão; "Nova categoria"); (no PWA também: instalar app, notificações — **fora** do mobile); **Sair da conta** (`signOut()` → `router.navigate('/login')`).
- **Rotas mobile já existentes** (`src/routes/api/mobile/`): padrão `auth.api.getSession(headers)` → 401; querystring/body `zod.safeParse` → 400; `Error` do repo → 404 `{ error }`; sucesso `Response.json(...)`; DELETE → `Response.json(null)`. **`GET /api/mobile/categories?type=` já existe** (Fatia 3) e continua servindo os chips de transação/orçamento. `routeTree.gen.ts` regenerado por
  `node -e "const {Generator,getConfig}=require('@tanstack/router-generator');new Generator({config:getConfig({},process.cwd()),root:process.cwd()}).run()"`.
- vitest configurado; cada fatia adiciona testes de rota.

**No `nexis-mobile`:**

- `src/app/(app)/_layout.tsx` — `<Tabs>` com 5 slots (`index`, `transactions`, `new`=FAB, `wallets`, `analytics`). `useEffect` → `triggerRecurring()`. `<TransactionSheetProvider>` envolve os `<Tabs>`. Guard: `if (!session) return <Redirect href="/login" />`.
- `src/app/(app)/index.tsx` — Dashboard. Header: saudação + `fmtBRL(totalBalance)` + **avatar** (`session.user.image` numa `Image` OU inicial num `View bg-card` redondo). `useFocusEffect` invalida `['dashboard']`.
- `src/app/(app)/analytics.tsx` — tela da 5ª aba. Seções: Resumo · Ritmo · Últimos 6 meses · Gastos por categoria · `BudgetsSection`. `useFocusEffect` invalida `['analytics']`+`['budgets']`. Helper local `Section({ title, children })`.
- `src/api/client.ts` — `apiGet`/`apiPost`/`apiDelete`. **`cache:'no-store'` + `Cache-Control/Pragma: no-cache` + `?_=<ts>` no `apiGet`** (Fatia 5 — sem isso o `fetch` do RN servia GET velho). Cookie via `authClient.getCookie()` (síncrono). `ApiError` extrai `{ error }` PT-BR; `204` → `undefined`.
- `src/auth/client.ts` — exporta `signIn`, **`signOut`**, `useSession`, `getSession`, `authClient`. `signOut()` limpa o SecureStore; o guard do `_layout` então redireciona.
- `src/auth/session.tsx` — `useAuthSession()` → `{ session, isPending }`. `session.user` = `{ id, name, email, image? }`.
- `src/components/ui/sheet.tsx` — `Sheet` (`BottomSheetModal`, `enableDynamicSizing`, `keyboardBehavior="interactive"`), `SheetRef`, reexporta `BottomSheetScrollView` / `BottomSheetTextInput`.
- `src/components/ui/sheet-field.tsx` — `SheetField` + `inputStyle` (fundo `colors.border`, focus ring `colors.muted`).
- `src/components/ui/currency-input.tsx` — `CurrencyInput` (`cents`, `onChange`, `autoFocus?`, `onFocus?`, `InputComponent?` — passar `BottomSheetTextInput` dentro de sheet).
- `src/components/wallets/wallet-sheet.tsx` — molde de sheet CRUD: `forwardRef<SheetRef>`, `useState` por campo, `reset()` no `onDismiss` (**sem `onChange`**), `isDirty` no botão, `saved` com `Check`, `confirmDelete` inline, **grid de ícones 6-col animado** (`Animated`, driver 0/1, 1º run sem timer).
- `src/components/transactions/transaction-sheet.tsx` — **campo de data**: `Pressable` (label + `inputStyle`) abre `@react-native-community/datetimepicker` — no Android o próprio dialog nativo (`showDatePicker && <DateTimePicker .../>`), no iOS um `<Modal transparent>` centralizado com `display="inline"`, `themeVariant="dark"`, `accentColor={colors.accent}`, botão "Concluir". `locale="pt-BR"`. Reusável pro Prazo da meta (trocar `maximumDate` por `minimumDate={hoje}`).
- `src/components/budgets/budget-sheet.tsx` — sheet CRUD "categoria + valor" (Fatia 5). Erro da mutation renderizado ("Não foi possível salvar/remover").
- `src/lib/format.ts` — `fmtBRL`, `fmtDate`, `toYMD`, `fmtDayGroup`, `fmtMonthKeyShort`, `fmtBudgetMonth`, `tabularNums`, `MONTHS_SHORT` (tabela fixa — **nunca `Intl` com `month:'short'`**).
- `src/lib/analytics-calcs.ts` — `pct(value, total)` (round, 0 se total 0) — reusável pro `%` das metas.
- `src/lib/category-icons.ts` — `CATEGORY_ICONS: Record<string, LucideIcon>` (~30 ícones).
- `src/lib/wallet-meta.ts` — **`WALLET_COLORS`** = `['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#71717a']` (as mesmas 8 cores do `goal-sheet` e do `category-sheet` do PWA).
- `src/api/wallets.ts` — `walletsQuery` (key `['wallets']`) → `Wallet[]` com `balance:number`.
- `src/api/categories.ts` — `categoriesQuery(type)` (key `['categories', type]`).
- `src/theme/colors.ts` — `bg #09090b`, `card #18181b`, `border #27272a`, `fg #fafafa`, `muted #71717a`, `accent #60a5fa`, `violet #c084fc`, `positive #34d399`, `negative #f87171`.
- UI só de `#/tw` / `#/tw/image`. Exceções em uso: `RefreshControl`, `ScrollView`/`SectionList` de `react-native`, `useSafeAreaInsets`, `@gorhom/bottom-sheet`, `Modal`, `Platform`, `Animated`, `Switch`, `@react-native-community/datetimepicker`, `react-native-gifted-charts`. Nova exceção: **`expo-router` `router` / `useRouter`** (pra `router.push('/goals')` / `router.back()`).
- Testes: jest-expo (`npx jest --forceExit`), 115 testes. Gotchas (memória / CLAUDE.md do repo): pin RNTL `^13.3.3`; mock `#/tw`, `#/tw/image`, `lucide-react-native` (objeto plano), `expo-router` (`useFocusEffect`, `useRouter`, `router`), `react-native-safe-area-context`, `#/components/ui/sheet`, `#/api/*` nos testes de tela; **nada de `fireEvent.press` que dispare `useMutation` + `waitFor`** (trava o `react-test-renderer`); sem `.test.tsx` sob `src/app/` (vira rota); `jest.mock` factory vars com prefixo `mock`.
- **`nexis-mobile` não tem prettier/eslint funcional** — casar o estilo na mão (sem ponto-e-vírgula, aspas simples, 2 espaços). Barra: `npx tsc --noEmit` limpo + jest verde.

---

## Objetivo da Fatia 6

Fechar a paridade do `nexis-mobile` com o PWA:

1. **Metas** — tela `/goals` (empilhada): listar com progresso, criar / editar / excluir, **aportar** de uma carteira e **resgatar** pra uma carteira. Ponto de entrada: um bloco "Metas" read-only na tela Análise.
2. **Perfil** — bottom-sheet aberto pelo avatar do Dashboard: identidade (avatar/nome/email), **CRUD de categorias** do usuário (acordeão), **sair da conta**.

Persistindo no banco de produção por rotas `/api/mobile/*` aditivas + uma extração de lógica de aporte/resgate pra `goal.repository.ts`.

**Princípio (todo o projeto mobile):** a tela aparece na hora (cache do TanStack Query ou vazia); dados preenchem depois. Skeleton só em cold load real. Sem transição JS na navegação.

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | **Tela de Metas** | `src/app/(app)/goals.tsx`, registrada em `_layout.tsx` como `<Tabs.Screen name="goals" options={{ href: null }} />` — rota existe, **não** aparece na tab bar. Aberta por `router.push('/goals')`. Header próprio: chevron de voltar (`router.back()`) + título + `+`. |
| D2 | **Ponto de entrada** | Bloco **"Metas"** na tela **Análise**, entre "Gastos por categoria" e "Orçamentos". Read-only: lista compacta (ponto da cor + nome + barra + `%`), header da seção com `→` que faz `router.push('/goals')`; a área inteira do card é `Pressable` → push. Empty: "Nenhuma meta ainda". A `useFocusEffect` da Análise passa a invalidar também `['goals']`. |
| D3 | **Perfil** | `src/components/profile/profile-sheet.tsx`, `forwardRef<SheetRef>`. Vive no `index.tsx` (Dashboard); o **avatar do header vira `Pressable`** que faz `sheetRef.current?.present()`. Sem provider/contexto. |
| D4 | **Backend — Metas** | Rotas aditivas: `GET /api/mobile/goals` (= `getGoalsByUser`); `POST /api/mobile/goals` (= `createGoal`, body `{ name, targetAmount>0, seedAmount?≥0, deadline?, color? }`, `deadline` `'YYYY-MM-DD'|null` → `new Date(ymd+'T12:00:00')`); `POST /api/mobile/goals/$id` (= `updateGoal`, body `{ name?, targetAmount?>0, deadline?, color? }` — **sem `seedAmount`**); `DELETE /api/mobile/goals/$id` (= `deleteGoal` → `Response.json(null)`). Zod inline copiado do `goal.service.ts`. Erro do repo → 404. |
| D5 | **Backend — aporte/resgate** | **Extrair** `depositToGoal(userId, { goalId, walletId, amount })` e `withdrawFromGoal(userId, { goalId, walletId, amount })` pra `goal.repository.ts` (lógica pura, `throw new Error(...)` PT-BR nas validações). Refatorar `goal.service.ts` (`depositGoalFromWallet`/`withdrawFromGoal`) pra chamar as novas funções — **sem** o push `goal-completed` na versão de repo (fica só no service, ou nenhum — a definir no plano; o mobile não dispara push). Rotas: `POST /api/mobile/goals/$id/deposit` e `.../withdraw`, body `{ walletId, amount>0 }` → chamam as funções extraídas → 400/404 `{ error }` em validação falha. |
| D6 | **Backend — Categorias** | `GET /api/mobile/categories/manage` (= `getCategoriesWithUsage` — todas, com `_count.transactions`); `POST /api/mobile/categories` (= `createCategory`, body `{ name, color, icon?, type }`); `POST /api/mobile/categories/$id` (= `updateCategory`, body `{ name, color, icon?:nullable }`); `DELETE /api/mobile/categories/$id` (= `deleteCategory` → `Response.json(null)`; **`Error` "Categoria em uso…" → 409 `{ error }`**). O `GET ?type=` da Fatia 3 **não muda**. |
| D7 | **Metas — UI** | Header: `‹` (back) · "Metas" · `+`. Abaixo: "Total guardado" `fmtBRL(Σ currentAmount)` + "de `fmtBRL(Σ targetAmount)` em metas" (se > 0). Lista de `GoalCard`: ponto da cor + nome; `currentAmount` / `targetAmount` (`tabularNums`); barra `Animated` na cor da meta; `%` (`pct`, verde se ≥ 100); `fmtDate(deadline)` se houver. Rodapé do card: 2 botões — **Aportar** (`PiggyBank`) e **Resgatar** (`ArrowDownLeft`, `disabled` se `currentAmount === 0`). Tocar o corpo do card → `goal-sheet` de edição. Empty: ícone `Target` + "Nenhuma meta ainda" + CTA. `PullToRefresh`/`RefreshControl` com `progressViewOffset={insets.top + 8}`. |
| D8 | **`goal-sheet.tsx`** | Molde wallet/budget-sheet. Campos: **Nome** (`SheetField`, autofocus na criação), **Valor da meta** (`CurrencyInput`), **"Já guardei"** (`CurrencyInput`, **só criação**), **Prazo** (campo de data opcional — padrão do `transaction-sheet`, `minimumDate={hoje}`, com um "Limpar" pra voltar a sem-prazo), **Cor** (8 swatches `WALLET_COLORS`, ring no selecionado). `confirmDelete` inline (só `isEdit`), `saved` + auto-close, `isDirty`, erro da mutation renderizado. `reset()` no `onDismiss`. |
| D9 | **`goal-move-sheet.tsx`** | Um sheet, prop `mode: 'deposit' \| 'withdraw'`. Título ("Aportar na meta" / "Resgatar da meta") + nome. Seletor de **carteira** (chips: ponto da cor + nome + `fmtBRL(saldo)`; auto-seleciona se `wallets.length === 1`). `CurrencyInput`. Validação: deposit `amount ≤ saldo` ("Saldo insuficiente"); withdraw `amount ≤ currentAmount` ("Valor acima do guardado"). Botão Confirmar. `onSuccess` invalida `['goals']`,`['wallets']`,`['dashboard']`,`['transactions']`. Erro renderizado. |
| D10 | **Perfil — UI** | `BottomSheetScrollView`: avatar (`Image` ou inicial) + nome + email; divisória; **Categorias** (acordeão `Animated` de altura — driver 0/1, 1º run sem timer): toggle **Despesas/Receitas** (segmented), chips **ícone-only** que expandem o nome ao tocar (`expandedId`, um por vez, recolhe ao tocar fora via `Pressable` de fundo), tocar expandido **e `cat.userId != null`** → `category-sheet` de edição, **long-press 500ms** (`onPressIn`/`onPressOut` + `setTimeout`) numa categoria do user → `confirmingDelete`; "＋ Nova categoria" (borda tracejada). Divisória; **"Sair da conta"** (`LogOut`, `negative`) → `signOut()` (o guard redireciona). Confirmação de exclusão = bloco inline no próprio sheet (não um 2º Modal). |
| D11 | **`category-sheet.tsx`** | Molde wallet-sheet (grid de ícones). Campos: **Nome** (`SheetField`), **Ícone** (grid 6-col animado, `CATEGORY_ICONS`), **Cor** (8 swatches), **Tipo** (segmented Despesa/Receita, **só criação**). `confirmDelete` **não** aqui (a exclusão é no Perfil por long-press). `saved` + auto-close, `isDirty`, erro renderizado. |
| D12 | **Query keys / invalidação** | `goalsQuery` key `['goals']`; `categoriesManagementQuery` key `['categories-management']`. Goal CRUD → `['goals']`. Deposit/withdraw → `['goals']`+`['wallets']`+`['dashboard']`+`['transactions']`. Category CRUD → `['categories-management']`+`['categories']` (os chips de transação/orçamento). `useFocusEffect` em `/goals` invalida `['goals']`+`['wallets']`. `analytics.tsx` `useFocusEffect` += `['goals']`. |
| D13 | **Navegação `href: null`** | `goals` como `Tabs.Screen` com `href: null` mantém a tab bar visível (nenhum slot acende) e navega por `router.push`/`router.back`. **Não** refatorar o `(app)/_layout` pra Stack-sobre-Tabs nesta fatia (risco alto perto do fim do projeto). Se o "sem animação de push" incomodar no device, o plano avalia `presentation:'modal'` na screen. |

---

## Arquitetura (delta sobre a Fatia 5)

```
nexis (web) — aditivo
  src/server/repositories/goal.repository.ts   # + depositToGoal, withdrawFromGoal (extraídas do service)
  src/server/services/goal.service.ts          # depositGoalFromWallet/withdrawFromGoal passam a chamar o repo
  src/routes/api/mobile/
    goals.ts                 # GET + POST
    goals.test.ts
    goals.$id.ts             # POST (edit) + DELETE
    goals.$id.test.ts
    goals.$id.deposit.ts     # POST
    goals.$id.withdraw.ts    # POST
    goals.$id.deposit.test.ts / goals.$id.withdraw.test.ts
    categories.ts            # + POST (create)  [GET já existe]
    categories.$id.ts        # POST (edit) + DELETE
    categories.manage.ts     # GET
    categories.test.ts (MOD) / categories.$id.test.ts / categories.manage.test.ts
  src/routeTree.gen.ts       # regenerado

nexis-mobile
  src/app/(app)/
    _layout.tsx              # + <Tabs.Screen name="goals" options={{ href: null }} />
    goals.tsx               # tela de Metas (empilhada)
    index.tsx               # avatar do header vira Pressable → ProfileSheet
    analytics.tsx           # + <GoalsPreview> entre Categorias e Orçamentos; useFocusEffect += ['goals']
  src/components/goals/
    goal-card.tsx
    goal-sheet.tsx
    goal-move-sheet.tsx
    goals-preview.tsx        # bloco read-only da Análise
  src/components/profile/
    profile-sheet.tsx
    category-sheet.tsx
  src/api/
    goals.ts                # goalsQuery + createGoal/editGoal/deleteGoal/depositGoal/withdrawGoal
    categories.ts (MOD)     # + categoriesManagementQuery + createCategory/editCategory/removeCategory
  src/schemas/
    goal.ts                 # GoalSchema/GoalsSchema/GoalInput/GoalEditInput/GoalMoveInput
    category.ts (MOD)       # + CategoryManagementSchema (com _count), CategoryInput/CategoryEditInput
  src/__tests__/            # goal-sheet, goal-move-sheet, profile-sheet, category-sheet, goals-screen
```

### Rotas do backend (detalhe)

**`GET /api/mobile/goals`** — `Response.json(await getGoalsByUser(session.user.id))`.

**`POST /api/mobile/goals`**
```ts
const body = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  seedAmount: z.number().min(0).optional(),
  deadline: z.string().nullable().optional(),   // 'YYYY-MM-DD'
  color: z.string().optional(),
})
const g = await createGoal({
  userId: session.user.id,
  name, targetAmount, seedAmount,
  deadline: deadline ? new Date(`${deadline}T12:00:00`) : null,
  color,
})
return Response.json({ ...g, targetAmount: g.targetAmount.toNumber(), seedAmount: g.seedAmount.toNumber() })
```

**`POST /api/mobile/goals/$id`** — body `{ name?, targetAmount?>0, deadline?:string|null, color? }` → `updateGoal(id, userId, { ...rest, deadline: deadline === undefined ? undefined : (deadline ? new Date(...) : null) })`; `try/catch` → 404. Resposta com Decimals convertidos.

**`DELETE /api/mobile/goals/$id`** — `deleteGoal(id, userId)` → `Response.json(null)`; `try/catch` → 404.

**`POST /api/mobile/goals/$id/deposit`** e **`.../withdraw`** — body `z.object({ walletId: z.string(), amount: z.number().positive() })` → `depositToGoal`/`withdrawFromGoal(session.user.id, { goalId: <id do path>, walletId, amount })`. `Error` conhecido → 400 `{ error }` (validação de saldo/limite), goal/wallet não encontrada → 404. Resposta `{ goalId, currentAmount }` (ou o que a função extraída devolver).

**`goal.repository.ts` — funções extraídas** (portam o `.handler` atual, sem o push):
```ts
export async function depositToGoal(userId: string, d: { goalId: string; walletId: string; amount: number }) {
  const [goal, wallet] = await Promise.all([...])
  if (!goal) throw new Error('Meta não encontrada')
  if (!wallet) throw new Error('Carteira não encontrada')
  const balance = await getWalletBalance(d.walletId)
  if (d.amount > balance) throw new Error('Saldo insuficiente na carteira selecionada')
  await prisma.transaction.create({ data: { amount: d.amount, type: 'EXPENSE', walletId: d.walletId, goalId: d.goalId, description: `Aporte → ${goal.name}`, date: new Date() } })
  // recomputa currentAmount e devolve { goalId, currentAmount, targetAmount }
}
export async function withdrawFromGoal(userId, d) { /* type INCOME, valida amount ≤ currentAmount */ }
```
`goal.service.ts` passa a ser um wrapper fino (mantém o comportamento de push só nele, se o plano decidir manter).

**`GET /api/mobile/categories/manage`** — `Response.json(await getCategoriesWithUsage(session.user.id))`.

**`POST /api/mobile/categories`** (novo handler no `categories.ts`, ao lado do `GET`) — body `{ name:min(1), color:string, icon:string.optional(), type:enum }` → `createCategory({ ...data, userId: session.user.id })`.

**`POST /api/mobile/categories/$id`** — body `{ name:min(1), color:string, icon:string.nullable().optional() }` → `updateCategory(id, userId, ...)`; `try/catch` → 404 (global/alheia).

**`DELETE /api/mobile/categories/$id`** — `deleteCategory(id, userId)` → `Response.json(null)`; `catch` → mensagem "Categoria em uso por transações" ⇒ **409**, resto ⇒ 404, sempre `{ error }`.

### App — schemas

```ts
// src/schemas/goal.ts
export const GoalSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetAmount: z.number(),
  seedAmount: z.number(),
  currentAmount: z.number(),
  deadline: z.string().nullable(),   // ISO ou null
  color: z.string().nullable(),
})
export const GoalsSchema = z.array(GoalSchema)
export type Goal = z.infer<typeof GoalSchema>
export const GoalInput = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  seedAmount: z.number().min(0).optional(),
  deadline: z.string().nullable().optional(),   // 'YYYY-MM-DD'
  color: z.string().optional(),
})
export const GoalEditInput = z.object({
  name: z.string().min(1).optional(),
  targetAmount: z.number().positive().optional(),
  deadline: z.string().nullable().optional(),
  color: z.string().optional(),
})
export const GoalMoveInput = z.object({ walletId: z.string(), amount: z.number().positive() })

// src/schemas/category.ts  (+ ao existente)
export const CategoryManagementSchema = z.object({
  id: z.string(), name: z.string(), color: z.string().nullable(),
  icon: z.string().nullable(), type: z.enum(['INCOME', 'EXPENSE']),
  userId: z.string().nullable(),
  _count: z.object({ transactions: z.number() }),
})
export const CategoriesManagementSchema = z.array(CategoryManagementSchema)
export const CategoryInput = z.object({
  name: z.string().min(1), color: z.string(),
  icon: z.string().optional(), type: z.enum(['INCOME', 'EXPENSE']),
})
export const CategoryEditInput = z.object({
  name: z.string().min(1), color: z.string(), icon: z.string().nullable().optional(),
})
```

### App — api

```ts
// src/api/goals.ts
export const goalsQuery = {
  queryKey: ['goals'] as const,
  queryFn: () => apiGet('/api/mobile/goals', (r) => GoalsSchema.parse(r)),
  staleTime: 30_000, gcTime: 5 * 60_000,
}
export const createGoal = (b: GoalInputData) => apiPost('/api/mobile/goals', b, (r) => GoalSchema.partial().parse(r))
export const editGoal = (id: string, b: GoalEditData) => apiPost(`/api/mobile/goals/${id}`, b, (r) => GoalSchema.partial().parse(r))
export const deleteGoal = (id: string) => apiDelete(`/api/mobile/goals/${id}`)
export const depositGoal = (id: string, b: GoalMoveData) => apiPost(`/api/mobile/goals/${id}/deposit`, b)
export const withdrawGoal = (id: string, b: GoalMoveData) => apiPost(`/api/mobile/goals/${id}/withdraw`, b)

// src/api/categories.ts  (+ ao existente)
export const categoriesManagementQuery = {
  queryKey: ['categories-management'] as const,
  queryFn: () => apiGet('/api/mobile/categories/manage', (r) => CategoriesManagementSchema.parse(r)),
  staleTime: 60_000,
}
export const createCategory = (b: CategoryInputData) => apiPost('/api/mobile/categories', b, (r) => CategorySchema.partial().parse(r))
export const editCategory = (id: string, b: CategoryEditData) => apiPost(`/api/mobile/categories/${id}`, b, (r) => CategorySchema.partial().parse(r))
export const removeCategory = (id: string) => apiDelete(`/api/mobile/categories/${id}`)
```

---

## Especificação de UI (por peça)

### Bloco "Metas" na Análise — `goals-preview.tsx`
`useQuery(goalsQuery)`. `Section`-like header: "Metas" + botão redondo `→` (`ArrowRight`, `bg-border`) → `router.push('/goals')`. Card `Pressable` (toda a área → push): se vazio, `Text` "Nenhuma meta ainda" em `muted`; senão até ~4 metas, cada linha: ponto da cor + nome truncado (esq) · `%` (`pct(currentAmount, targetAmount)`, `positive` se ≥ 100) (dir); barra fina `h-1 bg-border` + preenchimento na cor. Sem animação de entrada (a Análise já tem bastante).

### Tela `/goals` — `goals.tsx`
`ScrollView bg-bg` com `contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 20 }}`, `RefreshControl` (`progressViewOffset={insets.top + 8}`) invalidando `['goals']`+`['wallets']`. `useFocusEffect` idem.
- **Header**: `flex-row items-center justify-between` — `Pressable` `‹` (`ChevronLeft`, `router.back()`) · `Text` "Metas" `text-2xl font-bold` · `Pressable` redondo `+` (`Plus`, `bg-border`) → `goalSheetRef.present()` (modo criação).
- **Resumo**: "Total guardado" `muted text-xs` + `fmtBRL(totalSaved)` `text-3xl font-bold` `tabularNums` + (se `totalTarget > 0`) "de `fmtBRL(totalTarget)` em metas" `text-xs muted`.
- **Lista**: `cold` → skeleton (2–3 blocos `h-28`). Vazio → `Target` + "Nenhuma meta ainda" + CTA "Criar meta". Senão `goals.map` → `<GoalCard goal onEdit onDeposit onWithdraw />`.
- Sheets no fim: `<GoalSheet ref={goalSheetRef} goal={editing} onClose={...} />` e `<GoalMoveSheet ref={moveSheetRef} mode={moveMode} goal={movingGoal} wallets={wallets} onClose={...} />`.

### `goal-card.tsx`
Card `rounded-2xl bg-card border border-border p-4 gap-3`. Linha 1: `Pressable` (→ `onEdit(goal)`) `flex-row justify-between` — ponto+nome (esq) · `fmtBRL(current)` `/ fmtBRL(target)` `tabularNums` + `%` (`positive` se ≥ 100) (dir). Barra `h-1.5 bg-border` + `Animated.View` largura → `min(current/target*100, 100)%`, cor = `goal.color ?? colors.accent`. Se `deadline`: `Text text-[11px] muted` `fmtDate(new Date(deadline))`. Linha 2 (ações): `flex-row gap-2` — `Pressable` "Aportar" (`PiggyBank` 14 + label, `bg-border`) → `onDeposit(goal)`; `Pressable` "Resgatar" (`ArrowDownLeft` 14 + label) → `onWithdraw(goal)`, `disabled` + `opacity-40` se `currentAmount <= 0`.

### `goal-sheet.tsx` e `goal-move-sheet.tsx` — ver D8 / D9.

### `profile-sheet.tsx` — ver D10.
Categoria chip (acordeão): `Pressable` `flex-row items-center rounded-full py-1.5 px-2.5 bg-border` — ícone (`CATEGORY_ICONS[icon]` ou ponto da cor) + nome que aparece só quando `expandedId === cat.id` (largura animada ou simplesmente render condicional com `Animated`). `onPressIn` inicia timer de 500ms → se disparar e `cat.userId`, abre `confirmingDelete`; `onPress` normal: se não-expandido → expande; se expandido e `cat.userId` → edita. Legenda "toque para ver · toque de novo para editar · segure para excluir".

### `category-sheet.tsx` — ver D11.

### Dashboard (`index.tsx`)
O avatar (bloco `Image`/inicial) vira `Pressable onPress={() => profileRef.current?.present()}`. `<ProfileSheet ref={profileRef} />` renderizado no fim do componente (fora da `ScrollView`).

---

## Testes

**`nexis` (vitest, `src/routes/api/mobile/*.test.ts` + `src/server/repositories/goal.repository.test.ts`)** — formato das fatias 2–5:
- `goal.repository.test.ts` — `depositToGoal`/`withdrawFromGoal`: cria transação `EXPENSE`/`INCOME` com `goalId`/`description` certos; rejeita `amount > saldo` (deposit) e `amount > currentAmount` (withdraw); rejeita meta/carteira inexistente. (mock do `prisma`.)
- `goals.test.ts` — GET 200/401; POST 200 (`deadline` string → `Date` meio-dia; Decimals convertidos), 400 (`targetAmount ≤ 0`, sem `name`), 401.
- `goals.$id.test.ts` — POST 200 (chama `updateGoal` com `id` do path; `deadline: null` limpa; `deadline` ausente não mexe), 404 (repo lança), 401. DELETE 200 (`null`), 404, 401.
- `goals.$id.deposit.test.ts` / `withdraw` — 200 chama a função extraída com `(userId, { goalId, walletId, amount })`; 400 quando ela lança "Saldo insuficiente"/"Valor acima do guardado"; 401.
- `categories.test.ts` (MOD) — POST 200 (`createCategory` com `userId`), 400, 401.
- `categories.$id.test.ts` — POST 200/404/401; DELETE 200 (`null`); DELETE 409 quando o repo lança "Categoria em uso por transações"; DELETE 401.
- `categories.manage.test.ts` — GET 200 (repassa `getCategoriesWithUsage`), 401.
- Ajustar os testes existentes de `goal.service.ts` se a refatoração mudar mocks.

Alvo backend: ~34–40 vitest. `routeTree.gen.ts` regenerado.

**`nexis-mobile` (jest-expo, `src/__tests__/`, `npx jest --forceExit`)** — respeitando os gotchas (sem `press`+`waitFor` de mutation):
- `schemas/goal.test.ts`, `schemas/category.test.ts` (MOD) — parse de payloads representativos; `GoalSchema.partial()` tolera resposta enxuta; `CategoryManagementSchema` exige `_count.transactions`.
- `api/goals.test.ts`, `api/categories.test.ts` (MOD) — URLs, métodos, corpos JSON (spy em `globalThis.fetch`).
- `goal-move-calcs`? — a validação de saldo/limite é trivial e vive no sheet; cobrir via render do sheet (superfície).
- `goal-sheet.test.tsx` — render criação (campos Nome/Valor/Já guardei/Prazo/Cor; botão "Criar meta") e edição (sem "Já guardei"; "Editar meta"; lixeira; toggle `confirmDelete`).
- `goal-move-sheet.test.tsx` — modo `deposit` (título "Aportar…", chips de carteira com saldo) e `withdrawal` (título "Resgatar…"); sem mutation press.
- `goal-card.test.tsx` — render de progresso/`%`, botão "Resgatar" desabilitado quando `currentAmount = 0`.
- `profile-sheet.test.tsx` — mock `#/auth/client` (`signOut`), `#/api/categories`; render de nome/email; acordeão de Categorias fechado→aberto (só `setState`); botão "Sair da conta" presente. **Sem** `fireEvent.press` que dispare `signOut` + navegação.
- `category-sheet.test.tsx` — render criação (grid de ícones, segmented de tipo) vs edição (sem segmented; "Editar categoria").
- `goals-screen.test.tsx` — mock `expo-router` (`useRouter`/`router`/`useFocusEffect`), `#/api/goals`, `#/api/wallets`, sheets → `() => null`; com `goalsQuery` semeado: header "Metas", "Total guardado", 1 `GoalCard`; com `[]`: "Nenhuma meta ainda".
- `analytics-screen.test.tsx` (MOD) — o novo bloco "Metas" aparece; com `['goals']` vazio mostra "Nenhuma meta ainda".

Alvo app: ~28–34 jest (total ~145–150).

**Barra:** `npx tsc --noEmit` limpo nos dois repos; as duas suítes verdes.

---

## Verificar no device

- `npx expo start --tunnel`, Expo Go no iPhone. Backend: PR do `nexis` no ar ou já mergeado.
- **Entrada Metas**: bloco "Metas" aparece na Análise entre "Gastos por categoria" e "Orçamentos"; tocar (ou no `→`) abre a tela `/goals`; `‹` volta.
- **CRUD Meta**: criar (nome + valor + opcionalmente "já guardei" e prazo + cor) → aparece na lista e no bloco da Análise; editar (nome/valor/prazo/cor; **sem** "já guardei"); excluir (confirm inline).
- **Aportar**: escolher carteira (mostra saldo), valor ≤ saldo → sucesso; a barra da meta sobe, o saldo da carteira cai (conferir aba Carteiras e Dashboard ao focar), aparece uma transação "Aporte → <meta>" em Transações.
- **Resgatar**: valor ≤ guardado → sucesso; barra desce, saldo sobe, transação "Resgate ← <meta>". Botão "Resgatar" desabilitado numa meta zerada.
- **Validações**: aporte > saldo → "Saldo insuficiente"; resgate > guardado → "Valor acima do guardado".
- **Perfil**: tocar o avatar no Dashboard abre o sheet; nome/email certos.
- **Categorias**: acordeão abre; toggle Despesas/Receitas; tocar chip mostra o nome; tocar de novo (categoria do user) edita; **segurar** (categoria do user) → confirmação → excluir; excluir categoria em uso → erro "em uso por transações"; global não deixa editar/excluir; "Nova categoria" cria e ela passa a aparecer nos chips de Transação/Orçamento.
- **Sair da conta** → volta pro login; reabrir → continua deslogado.
- **Frescor cross-client**: editar uma meta no PWA → focar `/goals` no app → valor novo (o `no-store` da Fatia 5 cobre).
- `tsc --noEmit` limpo nos dois; as duas suítes verdes.

---

## Fora de escopo (Fatia 6)

- **Push / notificações** (sem `expo-notifications` no app) — inclui `goal-completed`, `goal-deadline`, `checkBudgetsAndNotify`.
- **"Instalar app"** (é app nativo).
- Haptics.
- Editar `seedAmount` de uma meta existente (igual PWA — só na criação).
- Reordenar metas; arquivar meta atingida.
- Histórico de aportes/resgates por meta (aparecem em Transações como quaisquer outras).
- Categorias: ícone/cor de categoria **global** (só leitura); merge/realocar transações ao excluir (o backend bloqueia exclusão de categoria em uso).
- Tema / moeda / idioma nas configs do Perfil.
- Refatorar `(app)/_layout` pra Stack-sobre-Tabs.

---

## Riscos / pontos de atenção

- **Extrair `depositToGoal`/`withdrawFromGoal` mexe no `goal.service.ts` do PWA.** É a única mudança não puramente-aditiva da fatia. Manter o comportamento observável do service idêntico (mesmas mensagens de erro, mesma resposta, push `goal-completed` preservado onde estava) — os testes existentes de `goal.service` são a rede de segurança; rodar `npx vitest run` inteiro.
- **`href: null` numa `Tabs.Screen`** — a tela abre com a tab bar ainda visível e sem animação de "push" nativa. Aceitável (PWA `/goals` também é rota cheia), mas conferir no device o gesto de voltar; se ruim, `presentation:'modal'` (decidir no plano).
- **`router` do `expo-router` nos testes** — mockar `useRouter`/`router` (`push`/`back` = `jest.fn()`) em `goals-screen` e `goals-preview`/`analytics-screen`.
- **Long-press pra excluir categoria** — `setTimeout` em `onPressIn`, limpar em `onPressOut`/`onPressCancel`; a flag `longPressTriggered` evita o `onPress` disparar logo depois (mesmo padrão do PWA). Sem haptics.
- **Aporte/resgate tocam 4 caches.** Garantir as 4 invalidações (`goals`,`wallets`,`dashboard`,`transactions`) — senão a aba Carteiras/Dashboard fica desatualizada até focar.
- **`deadline` no update** — `undefined` = "não mexe", `null` = "limpar prazo". O schema (`z.string().nullable().optional()`) e o handler precisam distinguir os dois; o app manda `null` explícito quando o usuário limpa.
- **Categoria em uso** — o `deleteCategory` do repo **lança** (não é soft). A rota mapeia essa mensagem pra 409 e o sheet/Perfil mostra "Categoria em uso por transações" em vez de sumir a categoria.
- **`DateTimePicker` já é dep** (Fatia 3) e roda no Expo Go — o campo de Prazo reusa o padrão do `transaction-sheet` (Modal no iOS / dialog no Android), só troca `maximumDate` por `minimumDate={new Date()}`.
- **Tamanho da fatia** — é a maior do projeto (backend: 4 arquivos de rota + `$id` + deposit/withdraw + categorias + extração no repo; app: 6 componentes + 1 tela + 2 telas tocadas). O plano quebra em ~14 tasks; dá pra fatiar o merge (backend primeiro).

---

## A confirmar no plano (não bloqueiam o spec)

- Manter ou remover o push `goal-completed` nas funções extraídas do repo (proposta: manter **só** no `goal.service.ts`, funções de repo sem efeito colateral de push).
- `goal-move-sheet` — um componente com `mode` (proposto) vs. dois sheets separados.
- Confirmação de exclusão de categoria — bloco inline no `profile-sheet` (proposto) vs. um `<Modal>` separado como no PWA.
- Prazo da meta — campo de data reusando o padrão do `transaction-sheet` (proposto) vs. um `SheetField` de texto `dd/mm/aaaa`.
- Bloco "Metas" na Análise — posição entre Categorias e Orçamentos (proposto, = PWA) vs. logo após o Resumo.
- `href: null` vs `presentation:'modal'` pra `/goals` (decidir após um teste rápido no device).
