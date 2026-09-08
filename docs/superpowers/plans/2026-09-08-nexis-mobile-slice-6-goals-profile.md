# Nexis Mobile — Fatia 6 (Metas + Perfil) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a paridade do `nexis-mobile` com o PWA: **Metas** (tela `/goals` empilhada — CRUD + aporte/resgate de carteira, entrada por um bloco na Análise) e **Perfil** (bottom-sheet do avatar do Dashboard — identidade + CRUD de categorias + logout).

**Architecture:** Backend — rotas `/api/mobile/goals*` e `/api/mobile/categories*` aditivas que reusam os repositories; **uma** mudança não-aditiva: extrair `depositToGoal`/`withdrawFromGoal` de dentro dos `createServerFn` handlers do `goal.service.ts` pra `goal.repository.ts`, com o service virando wrapper fino. App — schemas/api novos, tela `goals.tsx` registrada com `href: null` (não vira aba), componentes em `src/components/goals/` e `src/components/profile/`, bloco read-only na Análise, e o avatar do Dashboard passa a abrir um `ProfileSheet`.

**Tech Stack:** TanStack Start (SSR) + Prisma + zod + vitest (nexis); Expo Router + NativeWind/react-native-css + TanStack Query + zod + jest-expo (nexis-mobile). Sem deps novas (`@react-native-community/datetimepicker` e `react-native-gifted-charts` já entraram nas fatias 3 e 5). Nova exceção de import no app: `expo-router` `router`/`useRouter`.

**Spec:** `docs/superpowers/specs/2026-09-08-nexis-mobile-slice-6-goals-profile-design.md`

## Global Constraints

- **Dois repos.** Tasks 1–5 no `nexis` (`/home/welbertbarbosa/projects/personal/nexis`). Tasks 6–14 no `nexis-mobile` (`/home/welbertbarbosa/projects/personal/nexis-mobile`). Cada task diz o repo.
- **Branch.** `nexis`: `feat/mobile-slice-6-goals-profile-backend` de `origin/main`. `nexis-mobile`: `feat/mobile-slice-6-goals-profile` de `origin/main`.
- **Rotas mobile aditivas** — `auth.api.getSession({ headers: request.headers })` → `Response.json({ error: 'Unauthorized' }, { status: 401 })`; querystring/body `schema.safeParse(...)` → `400 { error: parsed.error.message }`; `Error` do repo → `404 { error }` (exceção: "Categoria em uso por transações" → **409**); `DELETE` de sucesso → `Response.json(null)`.
- **`goal.service.ts`** — a refatoração NÃO pode mudar o comportamento observável (mesmas mensagens de erro PT-BR, mesma resposta, push `goal-completed` preservado onde está). `npx vitest run` inteiro tem que continuar verde.
- **Datas** — `deadline` `'YYYY-MM-DD'` → `new Date(`${ymd}T12:00:00`)`. No update: `deadline === undefined` = não mexe; `deadline === null` = limpar.
- **App UI** só de `#/tw` / `#/tw/image`. Exceções já em uso + `router`/`useRouter` de `expo-router`.
- **Testes de tela mobile** mockam `#/tw`, `#/tw/image`, `lucide-react-native` (objeto plano), `expo-router` (`useFocusEffect`, `useRouter`, `router`), `react-native-safe-area-context`, `#/components/ui/sheet`, `#/api/*`, `#/auth/client`. Sem `fireEvent.press` que dispare `useMutation`/`signOut` + `waitFor` (trava o RNTL v13) — testes verificam superfície + estado local.
- **`nexis-mobile` sem prettier/eslint** — casar o estilo na mão (sem `;`, aspas simples, 2 espaços). Barra: `npx tsc --noEmit` limpo + jest verde. Jest sempre com `--forceExit`.
- **routeTree** — regenerar a cada task de rota nova no `nexis` (senão o `tsc` da própria task quebra):
  `node -e "const {Generator,getConfig}=require('@tanstack/router-generator');new Generator({config:getConfig({},process.cwd()),root:process.cwd()}).run()"`
- **Commits** — pt-BR, escopo da task só, terminar cada task com commit. `gh` CLI em `~/.local/bin/gh`, autenticado.

---

## File Structure

**nexis (backend):**
- `src/server/repositories/goal.repository.ts` — MOD: `+ depositToGoal`, `+ withdrawFromGoal`.
- `src/server/repositories/goal.repository.test.ts` — NEW.
- `src/server/services/goal.service.ts` — MOD: `depositGoalFromWallet`/`withdrawFromGoal` chamam o repo.
- `src/routes/api/mobile/goals.ts` + `.test.ts` — NEW (`GET` + `POST`).
- `src/routes/api/mobile/goals.$id.ts` + `.test.ts` — NEW (`POST` edit + `DELETE`).
- `src/routes/api/mobile/goals.$id.deposit.ts` + `.test.ts` — NEW.
- `src/routes/api/mobile/goals.$id.withdraw.ts` + `.test.ts` — NEW.
- `src/routes/api/mobile/categories.ts` + `.test.ts` — MOD (`+ POST`).
- `src/routes/api/mobile/categories.$id.ts` + `.test.ts` — NEW (`POST` edit + `DELETE`).
- `src/routes/api/mobile/categories.manage.ts` + `.test.ts` — NEW (`GET`).
- `src/routeTree.gen.ts` — REGEN.

**nexis-mobile (app):**
- `src/schemas/goal.ts` + `.test.ts` — NEW.
- `src/schemas/category.ts` + `.test.ts` — MOD.
- `src/api/goals.ts` + `.test.ts` — NEW.
- `src/api/categories.ts` + `.test.ts` — MOD.
- `src/components/goals/goal-card.tsx` — NEW.
- `src/components/goals/goal-sheet.tsx` — NEW.
- `src/components/goals/goal-move-sheet.tsx` — NEW.
- `src/components/goals/goals-preview.tsx` — NEW.
- `src/components/profile/profile-sheet.tsx` — NEW.
- `src/components/profile/category-sheet.tsx` — NEW.
- `src/app/(app)/goals.tsx` — NEW.
- `src/app/(app)/_layout.tsx` — MOD: `<Tabs.Screen name="goals" options={{ href: null }} />`.
- `src/app/(app)/analytics.tsx` — MOD: `<GoalsPreview />` + `useFocusEffect` += `['goals']`.
- `src/app/(app)/index.tsx` — MOD: avatar `Pressable` → `ProfileSheet`.
- `src/__tests__/{goal-sheet,goal-move-sheet,goal-card,profile-sheet,category-sheet,goals-screen}.test.tsx` — NEW.
- `src/__tests__/analytics-screen.test.tsx` — MOD.

---

## Task 1: `nexis` — extrair `depositToGoal` / `withdrawFromGoal` pro repo

**Repo:** `nexis`

**Files:**
- Modify: `src/server/repositories/goal.repository.ts`
- New: `src/server/repositories/goal.repository.test.ts`
- Modify: `src/server/services/goal.service.ts`

**Interfaces:**
- Produces: `depositToGoal(userId: string, d: { goalId: string; walletId: string; amount: number }): Promise<{ goalId: string; currentAmount: number; targetAmount: number }>` — porta o corpo do `depositGoalFromWallet.handler` **sem** o push. `withdrawFromGoal(userId, d): Promise<{ goalId; currentAmount }>` — idem `withdrawFromGoal.handler`.
- Consumes (repo): `prisma`, `getWalletBalance` de `#/server/repositories/wallet.repository`.

- [ ] **Step 1: Setup**

```bash
cd /home/welbertbarbosa/projects/personal/nexis
git fetch origin -q && git checkout -b feat/mobile-slice-6-goals-profile-backend origin/main
```

- [ ] **Step 2: Testes que falham** (`goal.repository.test.ts`, mock do `prisma` e do `getWalletBalance` — seguir o estilo dos testes de repo existentes se houver, senão `vi.mock('#/db')`):
  - `depositToGoal` cria `prisma.transaction.create` com `{ amount, type:'EXPENSE', walletId, goalId, description:'Aporte → <nome>', date: <Date> }` quando `amount ≤ saldo`.
  - `depositToGoal` lança `Error('Saldo insuficiente na carteira selecionada')` quando `amount > saldo`.
  - `depositToGoal` lança `Error('Meta não encontrada')` / `Error('Carteira não encontrada')`.
  - `withdrawFromGoal` cria transação `type:'INCOME'`, `description:'Resgate ← <nome>'`; lança `Error('Valor excede o saldo guardado na meta')` quando `amount > currentAmount`.

- [ ] **Step 3: Mover a lógica** — em `goal.repository.ts`, adicionar `depositToGoal`/`withdrawFromGoal` copiando o corpo dos `.handler` de `goal.service.ts` (as partes: `Promise.all` de `goal`/`wallet` `findFirst` com `userId`; `getWalletBalance` no deposit / cálculo de `currentAmount` a partir das transações no withdraw; validações; `prisma.transaction.create`; recomputo e retorno). **Não** incluir `sendPushToUser` / `shouldSendNotification`.

- [ ] **Step 4: Refatorar o service** — `depositGoalFromWallet` e `withdrawFromGoal` em `goal.service.ts` passam a:
  ```ts
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow()
    const res = await depositToGoal(session.user.id, data)
    // preserva o push goal-completed que já existia aqui (usa res.currentAmount/res.targetAmount)
    return res
  })
  ```
  Manter o bloco de push `goal-completed` **no service** (deposit), idêntico ao atual.

- [ ] **Step 5: Verificar** — `npx vitest run && npx tsc --noEmit`. **Toda** a suíte verde (os testes de `goal.service` existentes são a rede de segurança).

- [ ] **Step 6: Commit** — `git commit -m "refactor: extrai depositToGoal/withdrawFromGoal pro goal.repository"`

---

## Task 2: `nexis` — `GET` + `POST /api/mobile/goals`

**Repo:** `nexis`

**Files:** New `src/routes/api/mobile/goals.ts`, `src/routes/api/mobile/goals.test.ts`

**Interfaces:**
- Consumes: `getGoalsByUser`, `createGoal` de `#/server/repositories/goal.repository`.
- Produces: `GET` → `getGoalsByUser` (array plano). `POST` body `{ name, targetAmount>0, seedAmount?≥0, deadline?:string|null, color? }` → `createGoal` → `{ ...g, targetAmount:number, seedAmount:number }` (200); 400; 401.

- [ ] **Step 1: Teste que falha** (estilo `budgets.test.ts`):
  - GET 401; GET 200 repassa `getGoalsByUser('u1')`.
  - POST 401; POST 400 (`targetAmount: 0`; sem `name`); POST 200 chama `createGoal` com `deadline` convertida (`'2026-12-31'` → `Date` cujo `getMonth()===11`, `getDate()===31`) e devolve Decimals como number (mock `createGoal` → `{ id:'g1', targetAmount:{toNumber:()=>1000}, seedAmount:{toNumber:()=>0} }`).

- [ ] **Step 2: Implementar** — `createFileRoute('/api/mobile/goals')` com `GET` e `POST`. Zod `createBody` = cópia do `goalSchema` de `goal.service.ts` mas `deadline: z.string().nullable().optional()`. `toDate(ymd)` helper (`new Date(`${ymd}T12:00:00`)`). Resposta converte `targetAmount`/`seedAmount`.

- [ ] **Step 3: Regen routeTree + verificar** — `node -e "...Generator..."` && `npx vitest run src/routes/api/mobile/goals.test.ts && npx tsc --noEmit`.

- [ ] **Step 4: Commit** — `git commit -m "feat: GET e POST /api/mobile/goals"`

---

## Task 3: `nexis` — `POST` (edit) + `DELETE /api/mobile/goals/$id`

**Repo:** `nexis`

**Files:** New `src/routes/api/mobile/goals.$id.ts`, `goals.$id.test.ts`

**Interfaces:**
- Consumes: `updateGoal`, `deleteGoal`.
- Produces: `POST` body `{ name?, targetAmount?>0, deadline?:string|null, color? }` → `updateGoal(id, userId, { ...rest, deadline })` — `deadline` `undefined` não vai no objeto, `null` vai como `null`, string vira `Date`. 200 (Decimals convertidos) / 404 / 401. `DELETE` → `deleteGoal` → `Response.json(null)` / 404 / 401.

- [ ] **Step 1: Teste que falha** — molde `budgets.$id.test.ts` + `wallets.$id.test.ts`:
  - POST 200 chama `updateGoal('g1','u1', objeto)`; caso `deadline: null` → objeto tem `deadline: null`; caso sem `deadline` → objeto **não** tem a chave `deadline`.
  - POST 404 (repo lança `Error('Goal not found')`); POST 401.
  - DELETE 200 (`null`, chama `deleteGoal('g1','u1')`); DELETE 404; DELETE 401.

- [ ] **Step 2: Implementar** — helper `goalId(request, params)` (fallback URL, igual `wallets.$id.ts`). Montar o objeto de update condicionalmente pra respeitar `undefined` vs `null`.

- [ ] **Step 3: Regen routeTree + verificar.**

- [ ] **Step 4: Commit** — `git commit -m "feat: POST e DELETE /api/mobile/goals/\$id"`

---

## Task 4: `nexis` — `POST /api/mobile/goals/$id/deposit` e `.../withdraw`

**Repo:** `nexis`

**Files:** New `src/routes/api/mobile/goals.$id.deposit.ts` (+ `.test.ts`), `goals.$id.withdraw.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `depositToGoal` / `withdrawFromGoal` (Task 1).
- Produces: `POST` body `{ walletId: string, amount>0 }` → `depositToGoal(session.user.id, { goalId: <path>, walletId, amount })` → 200 (o retorno da função) / **400** `{ error }` quando a função lança "Saldo insuficiente…" / "Valor excede…" / "Meta não encontrada" etc. (mapear tudo pra 400 com a mensagem; ou "não encontrada" → 404 — **decisão: 404 pra "não encontrada", 400 pro resto**, casar as substrings) / 401.

- [ ] **Step 1: Testes que falham** (um por arquivo):
  - 401 sem sessão.
  - 200 chama `depositToGoal('u1', { goalId:'g1', walletId:'w1', amount: 50 })` e repassa o retorno.
  - 400 quando `depositToGoal` rejeita com `Error('Saldo insuficiente na carteira selecionada')` → `{ error: 'Saldo insuficiente na carteira selecionada' }`.
  - (withdraw) 400 com `Error('Valor excede o saldo guardado na meta')`.
  - 404 quando a mensagem contém "não encontrada".

- [ ] **Step 2: Implementar** os 2 arquivos (quase idênticos; `goalId` do path). `catch (e)`: `const msg = e instanceof Error ? e.message : '...'; const status = /não encontrad/i.test(msg) ? 404 : 400; return Response.json({ error: msg }, { status })`.

- [ ] **Step 3: Regen routeTree + verificar.**

- [ ] **Step 4: Commit** — `git commit -m "feat: POST /api/mobile/goals/\$id/{deposit,withdraw}"`

---

## Task 5: `nexis` — categorias (manage / create / edit / delete), routeTree, suíte, PR

**Repo:** `nexis`

**Files:**
- Modify: `src/routes/api/mobile/categories.ts` (+ `POST`), `categories.test.ts`
- New: `src/routes/api/mobile/categories.$id.ts` + `.test.ts`
- New: `src/routes/api/mobile/categories.manage.ts` + `.test.ts`
- Regen: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `createCategory`, `updateCategory`, `deleteCategory`, `getCategoriesWithUsage` de `#/server/repositories/category.repository`.
- Produces:
  - `GET /api/mobile/categories/manage` → `getCategoriesWithUsage(userId)` (200) / 401.
  - `POST /api/mobile/categories` body `{ name:min(1), color:string, icon?:string, type:enum }` → `createCategory({ ...data, userId })` (200) / 400 / 401.
  - `POST /api/mobile/categories/$id` body `{ name:min(1), color:string, icon?:string|null }` → `updateCategory(id, userId, ...)` (200) / 404 / 401.
  - `DELETE /api/mobile/categories/$id` → `deleteCategory(id, userId)` → `Response.json(null)`; `Error` cuja mensagem contém "em uso" → **409**; resto → 404; sempre `{ error }`. / 401.

- [ ] **Step 1: Testes que falham** — `categories.test.ts` ganha os casos de `POST`; `categories.$id.test.ts` e `categories.manage.test.ts` novos. Cobrir o 409 do delete-em-uso explicitamente.

- [ ] **Step 2: Implementar** — no `categories.ts` adicionar `POST` ao lado do `GET` (mockar `createCategory` no teste junto do `getCategoriesByType` já existente). `categories.$id.ts` com helper `categoryId(request, params)`. `categories.manage.ts` só `GET`.

- [ ] **Step 3: Regen routeTree** — conferir `git diff src/routeTree.gen.ts`: entram `goals`, `goals/$id`, `goals/$id/deposit`, `goals/$id/withdraw`, `categories/$id`, `categories/manage` (o `categories` já existia).

- [ ] **Step 4: Suíte inteira + tsc** — `npx vitest run && npx tsc --noEmit` — tudo verde.

- [ ] **Step 5: Commit + PR**

```bash
git add -A && git commit -m "feat: rotas /api/mobile/categories* (manage, create, edit, delete) + routeTree"
git push -u origin feat/mobile-slice-6-goals-profile-backend
gh pr create --repo Welbert-Soares/nexis --base main \
  --title "feat: rotas /api/mobile/goals* e /api/mobile/categories* (Fatia 6)" \
  --body "Fatia 6 do Nexis Mobile — backend. Rotas aditivas de Metas (GET/POST /goals, POST/DELETE /goals/\$id, POST /goals/\$id/{deposit,withdraw}) e Categorias (GET /categories/manage, POST /categories, POST/DELETE /categories/\$id). Única mudança não-aditiva: depositToGoal/withdrawFromGoal extraídas do goal.service pro goal.repository (service vira wrapper; push goal-completed preservado). Spec: docs/superpowers/specs/2026-09-08-nexis-mobile-slice-6-goals-profile-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Task 6: `nexis-mobile` — schemas `goal` e `category` (mod)

**Repo:** `nexis-mobile`

**Files:** New `src/schemas/goal.ts` + `.test.ts`; Modify `src/schemas/category.ts` + `.test.ts`

**Interfaces:** `GoalSchema`/`GoalsSchema`/`Goal`/`GoalInput`/`GoalInputData`/`GoalEditInput`/`GoalEditData`/`GoalMoveInput`/`GoalMoveData`; `CategoryManagementSchema`/`CategoriesManagementSchema`/`CategoryInput`/`CategoryEditInput` (+ os tipos). Ver o bloco "App — schemas" do spec.

- [ ] **Step 1: Setup** — `cd .../nexis-mobile && git fetch origin -q && git checkout -b feat/mobile-slice-6-goals-profile origin/main`

- [ ] **Step 2: Testes que falham** — `goal.test.ts`: parse de meta com `deadline` string e `null`; `GoalSchema.partial()` tolera `{ id, name }`; `GoalInput` rejeita `targetAmount: 0`; `GoalMoveInput` rejeita `amount: 0`. `category.test.ts` (mod): `CategoryManagementSchema` exige `_count.transactions:number`; rejeita sem `_count`.

- [ ] **Step 3: Implementar** os schemas (spec).

- [ ] **Step 4: Verificar** — `npx jest --forceExit src/schemas && npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git commit -m "feat: schemas de goal e category (management)"`

---

## Task 7: `nexis-mobile` — api `goals` e `categories` (mod)

**Repo:** `nexis-mobile`

**Files:** New `src/api/goals.ts` + `.test.ts`; Modify `src/api/categories.ts` + `.test.ts`

**Interfaces:** `goalsQuery` (`['goals']`), `createGoal`/`editGoal`/`deleteGoal`/`depositGoal`/`withdrawGoal`; `categoriesManagementQuery` (`['categories-management']`), `createCategory`/`editCategory`/`removeCategory`. Ver "App — api" do spec.

- [ ] **Step 1: Testes que falham** (spy `globalThis.fetch`, molde `budgets.test.ts`): URLs/métodos/corpos. `depositGoal('g1', { walletId:'w1', amount:50 })` → `POST /api/mobile/goals/g1/deposit`. `removeCategory('c1')` → `DELETE /api/mobile/categories/c1`. `categoriesManagementQuery.queryKey` === `['categories-management']` e a URL é `/api/mobile/categories/manage`.

- [ ] **Step 2: Implementar** (spec). `createGoal`/`editGoal` parseiam com `GoalSchema.partial()`; `depositGoal`/`withdrawGoal` sem parse (`apiPost` sem 3º arg).

- [ ] **Step 3: Verificar** — `npx jest --forceExit src/api && npx tsc --noEmit`.

- [ ] **Step 4: Commit** — `git commit -m "feat: api de goals e categorias (management)"`

---

## Task 8: `nexis-mobile` — `goal-card` + `goal-sheet`

**Repo:** `nexis-mobile`

**Files:** New `src/components/goals/goal-card.tsx`, `src/components/goals/goal-sheet.tsx`, `src/__tests__/goal-card.test.tsx`, `src/__tests__/goal-sheet.test.tsx`

**Interfaces:**
- `GoalCard({ goal, onEdit, onDeposit, onWithdraw }: { goal: Goal; onEdit: (g: Goal) => void; onDeposit: (g: Goal) => void; onWithdraw: (g: Goal) => void })`.
- `GoalSheet` — `forwardRef<SheetRef, { goal?: EditableGoal; onClose?: () => void }>`; `EditableGoal = { id; name; targetAmount; deadline: string | null; color: string | null }`.

- [ ] **Step 1: `goal-card.tsx`** — ver D7/§goal-card do spec. Barra `Animated` (driver de largura, 1º run sem timer — padrão `budget-row`). `pct` de `#/lib/analytics-calcs`. Botão "Resgatar" `disabled` + `opacity-40` quando `goal.currentAmount <= 0`.

- [ ] **Step 2: `goal-sheet.tsx`** — molde `budget-sheet.tsx` + campo de data do `transaction-sheet.tsx` (extrair o bloco de data pra um sub-componente local `DeadlineField({ value, onChange })` — `value: Date | null`; `minimumDate={new Date()}`; um "Limpar" quando há data). Campos: Nome (`SheetField`, autofocus `!isEdit`), Valor da meta (`CurrencyInput` + `BottomSheetTextInput`), "Já guardei" (só `!isEdit`), Prazo, Cor (8 swatches `WALLET_COLORS`, ring). `save` mutation: `isEdit ? editGoal(goal.id, { name, targetAmount, deadline, color }) : createGoal({ name, targetAmount, seedAmount: seed || undefined, deadline, color })` — `deadline` = `date ? toYMD(date) : null`. `onSuccess`: invalida `['goals']` (+ `refetchType:'all'`), `setSaved(true)`, `setTimeout(dismiss, 900)`. `remove` mutation → `deleteGoal`, invalida `['goals']`. `confirmDelete` inline (só `isEdit`). Erro renderizado. `reset()` no `onDismiss`.

- [ ] **Step 3: Testes** — `goal-card.test.tsx`: render de nome/`%`; "Resgatar" desabilitado com `currentAmount:0`. `goal-sheet.test.tsx`: criação (Nome/Valor/"Já guardei"/Prazo/Cor; botão "Criar meta") vs edição (sem "Já guardei"; "Editar meta"; lixeira; toggle `confirmDelete` por press na lixeira — só `setState`). Mocks: `#/tw`, `#/components/ui/sheet`, `#/components/ui/currency-input` (`() => null`), `@react-native-community/datetimepicker` (`() => null`), `#/api/goals` (`jest.fn()`s), `lucide-react-native` (objeto plano), `@tanstack/react-query` real com `QueryClientProvider`.

- [ ] **Step 4: Verificar** — jest dos 2 + `tsc`.

- [ ] **Step 5: Commit** — `git commit -m "feat: goal-card e goal-sheet"`

---

## Task 9: `nexis-mobile` — `goal-move-sheet`

**Repo:** `nexis-mobile`

**Files:** New `src/components/goals/goal-move-sheet.tsx`, `src/__tests__/goal-move-sheet.test.tsx`

**Interfaces:** `GoalMoveSheet` — `forwardRef<SheetRef, { mode: 'deposit' | 'withdraw'; goal?: Goal; wallets: Wallet[]; onClose?: () => void }>`.

- [ ] **Step 1: Implementar** — ver D9/§goal-move-sheet. `BottomSheetScrollView`. Título por `mode`. Chips de carteira (`wallets.map` → ponto da cor + nome + `fmtBRL(w.balance)`; `selectedId`, auto-`wallets[0].id` se só 1 — via `useEffect([goal?.id, mode])`). `CurrencyInput`. `const amount = cents / 100`. Validação: `mode==='deposit'` → `selectedWallet && amount > selectedWallet.balance` ("Saldo insuficiente na carteira selecionada"); `mode==='withdraw'` → `goal && amount > goal.currentAmount` ("Valor acima do guardado na meta"). `canConfirm = cents > 0 && !!selectedId && !invalid && !busy`. `move` mutation → `mode==='deposit' ? depositGoal(goal.id, { walletId, amount }) : withdrawGoal(...)`; `onSuccess` invalida `['goals']`,`['wallets']`,`['dashboard']`,`['transactions']` + `dismiss()`. Erro renderizado. `reset()` no `onDismiss`.

- [ ] **Step 2: Teste** — `goal-move-sheet.test.tsx`: `mode='deposit'` renderiza "Aportar na meta" + os chips de carteira com saldo; `mode='withdraw'` → "Resgatar da meta". Sem press de mutation.

- [ ] **Step 3: Verificar** — jest + `tsc`.

- [ ] **Step 4: Commit** — `git commit -m "feat: goal-move-sheet (aporte/resgate)"`

---

## Task 10: `nexis-mobile` — tela `/goals` + registro `href: null`

**Repo:** `nexis-mobile`

**Files:** New `src/app/(app)/goals.tsx`; Modify `src/app/(app)/_layout.tsx`; New `src/__tests__/goals-screen.test.tsx`

- [ ] **Step 1: `_layout.tsx`** — adicionar, **depois** do `<Tabs.Screen name="analytics">`:
  ```tsx
  <Tabs.Screen name="goals" options={{ href: null }} />
  ```

- [ ] **Step 2: `goals.tsx`** — ver §"Tela /goals" do spec. `useRouter()` pra `router.back()`. `useQuery(goalsQuery)` + `useQuery(walletsQuery)`. `useFocusEffect` invalida `['goals']`+`['wallets']`. Refs: `goalSheetRef`, `moveSheetRef`. State: `editing?: EditableGoal`, `movingGoal?: Goal`, `moveMode: 'deposit'|'withdraw'`. `openNew`/`openEdit(g)`/`openDeposit(g)`/`openWithdraw(g)`. `totalSaved`/`totalTarget` reduzidos. `cold = isLoading && !data`. `<GoalSheet ref={goalSheetRef} goal={editing} onClose={() => { setEditing(undefined); qc.invalidateQueries({ queryKey:['goals'] }) }} />` + `<GoalMoveSheet ref={moveSheetRef} mode={moveMode} goal={movingGoal} wallets={wallets} onClose={() => { setMovingGoal(undefined); qc.invalidateQueries({ queryKey:['goals'] }); qc.invalidateQueries({ queryKey:['wallets'] }) }} />`.

- [ ] **Step 3: `goals-screen.test.tsx`** — mock `expo-router` (`useRouter: () => ({ back: jest.fn(), push: jest.fn() })`, `useFocusEffect: (cb) => cb()`), `react-native-safe-area-context`, `#/tw`, `lucide-react-native` (Proxy), `#/api/goals` + `#/api/wallets` (queries inertes), `#/components/goals/goal-sheet` + `goal-move-sheet` (`() => null`). Semear `['goals']`: header "Metas", "Total guardado", 1 `GoalCard` (nome visível). Semear `[]`: "Nenhuma meta ainda".

- [ ] **Step 4: Verificar** — jest + `tsc`.

- [ ] **Step 5: Commit** — `git commit -m "feat: tela de Metas (/goals)"`

---

## Task 11: `nexis-mobile` — bloco "Metas" na Análise

**Repo:** `nexis-mobile`

**Files:** New `src/components/goals/goals-preview.tsx`; Modify `src/app/(app)/analytics.tsx`, `src/__tests__/analytics-screen.test.tsx`

- [ ] **Step 1: `goals-preview.tsx`** — ver §"Bloco Metas na Análise". `useRouter()` + `useQuery(goalsQuery)`. Não renderiza skeleton próprio (a Análise já cobre o cold com o skeleton geral); se `isLoading && !data` → `return null`. Header "Metas" + `→` (`ArrowRight`, `bg-border`) → `router.push('/goals')`. Card `Pressable` (área toda → push). Empty → "Nenhuma meta ainda". Senão até 4 metas: ponto+nome (esq) · `%` (dir); barra `h-1`.

- [ ] **Step 2: `analytics.tsx`** — importar `GoalsPreview`; renderizar **entre** o bloco "Gastos por categoria" e o `<BudgetsSection>`, dentro do `{!cold && (<>...`. Adicionar `qc.invalidateQueries({ queryKey: ['goals'] })` na `useFocusEffect` e no `onRefresh` do `RefreshControl`.

- [ ] **Step 3: `analytics-screen.test.tsx` (mod)** — adicionar mock de `expo-router` `useRouter`, mock `#/api/goals` (`goalsQuery` inerte), semear `['goals']` `[]` → assert "Nenhuma meta ainda" aparece; com 1 meta → nome aparece. Os testes existentes continuam passando.

- [ ] **Step 4: Verificar** — `npx jest --forceExit src/__tests__/analytics-screen.test.tsx && npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git commit -m "feat: bloco Metas na tela Análise"`

---

## Task 12: `nexis-mobile` — `category-sheet`

**Repo:** `nexis-mobile`

**Files:** New `src/components/profile/category-sheet.tsx`, `src/__tests__/category-sheet.test.tsx`

**Interfaces:** `CategorySheet` — `forwardRef<SheetRef, { category?: EditableCategory; defaultType: 'INCOME' | 'EXPENSE'; onClose?: () => void }>`; `EditableCategory = { id; name; color; icon: string | null; type; userId: string | null }`.

- [ ] **Step 1: Implementar** — molde `wallet-sheet.tsx` (grid de ícones 6-col animado — extrair pra reuso ou copiar `ICON_OPTIONS`/`IconCell`). Campos: Nome (`SheetField`), Ícone (grid `CATEGORY_ICONS`), Cor (8 swatches), Tipo (segmented Despesa/Receita — **só `!isEdit`**). `save` → `isEdit ? editCategory(category.id, { name, color, icon }) : createCategory({ name, color, icon, type })`; `onSuccess` invalida `['categories-management']` + `['categories']` (`refetchType:'all'`), `setSaved`, auto-close. **Sem** `confirmDelete` (exclusão é no Perfil). Erro renderizado.

- [ ] **Step 2: Teste** — criação (grid de ícones + segmented de tipo + "Criar categoria") vs edição (sem segmented; "Editar categoria").

- [ ] **Step 3: Verificar** — jest + `tsc`.

- [ ] **Step 4: Commit** — `git commit -m "feat: category-sheet"`

---

## Task 13: `nexis-mobile` — `profile-sheet`

**Repo:** `nexis-mobile`

**Files:** New `src/components/profile/profile-sheet.tsx`, `src/__tests__/profile-sheet.test.tsx`

**Interfaces:** `ProfileSheet` — `forwardRef<SheetRef, { onClose?: () => void }>`. Lê `useAuthSession()` internamente.

- [ ] **Step 1: Implementar** — ver D10/§profile-sheet. `BottomSheetScrollView`. Bloco identidade (avatar `Image`/inicial + nome + email). Divisória (`h-px bg-border`). **Categorias** acordeão: `useQuery({ ...categoriesManagementQuery, enabled: <sheet aberto — usar um state `mounted` setado no `onChange`? não; deixar sempre enabled é ok })`. Toggle `catType` (segmented). `filtered = cats.filter(c => c.type === catType)`. Chips ícone-only (`expandedId`, um por vez); `Pressable` de fundo (`onPress={() => setExpandedId(null)}`) atrás dos chips. `onPressIn` → `timer = setTimeout(() => { longPressed.current = true; if (cat.userId) setConfirmingDelete(cat) }, 500)`; `onPressOut`/`onResponderTerminate` → `clearTimeout`. `onPress` → se `longPressed.current` `{ longPressed.current = false; return }`; senão se `expandedId !== cat.id` → expande; senão se `cat.userId` → `openEditCategory(cat)`. Legenda. "＋ Nova categoria" (borda tracejada). `confirmingDelete` = bloco inline (não Modal): "Excluir \"<nome>\"?" + Cancelar/Excluir; `remove` mutation → `removeCategory(id)`, `onSuccess` invalida `['categories-management']`+`['categories']`; `onError` → mostra `remove.error.message` (ex.: "Categoria em uso por transações"). Divisória. **"Sair da conta"** (`LogOut`, cor `negative`): `Pressable` → `setLoggingOut(true); await signOut(); onClose?.()` (o guard do `_layout` redireciona). `<CategorySheet ref={categorySheetRef} category={editingCategory} defaultType={catType} onClose={...} />` no fim.

- [ ] **Step 2: Teste** — `profile-sheet.test.tsx`: mock `#/auth/client` (`signOut: jest.fn()`), `#/auth/session` (`useAuthSession: () => ({ session: { user: { name:'Welbert Soares', email:'w@x.com', image:null } } })`), `#/api/categories` (`categoriesManagementQuery` inerte + `removeCategory`), `#/components/profile/category-sheet` (`() => null`), `#/components/ui/sheet`, `#/tw`, `lucide-react-native`. Asserts: nome e email renderizados; "Sair da conta" presente; tocar o cabeçalho "Categorias" abre o acordeão (aparece o segmented "Despesas"/"Receitas") — só `setState`. **Não** apertar "Sair da conta".

- [ ] **Step 3: Verificar** — jest + `tsc`.

- [ ] **Step 4: Commit** — `git commit -m "feat: profile-sheet (identidade + categorias + logout)"`

---

## Task 14: `nexis-mobile` — ligar o `ProfileSheet` no Dashboard, suíte, checklist, PR

**Repo:** `nexis-mobile`

**Files:** Modify `src/app/(app)/index.tsx`

- [ ] **Step 1: `index.tsx`** — `import { ProfileSheet } from '#/components/profile/profile-sheet'` + `import type { SheetRef }`. `const profileRef = useRef<SheetRef>(null)`. Envolver o bloco do avatar (a `Image` **e** o fallback da inicial) num `Pressable onPress={() => profileRef.current?.present()}`. No fim do componente, fora da `ScrollView`: `<ProfileSheet ref={profileRef} />`.

- [ ] **Step 2: Suíte + tipos** — `npx tsc --noEmit && npx jest --forceExit`. Tudo verde (~145–150 testes).

- [ ] **Step 3: Checklist de device** (usuário roda — `npx expo start --tunnel`; backend: PR do `nexis` no ar/mergeado):
  - [ ] Bloco "Metas" na Análise (entre Categorias e Orçamentos); tocar → `/goals`; `‹` volta. Avaliar se o "sem push" incomoda → se sim, trocar `href:null` por `presentation:'modal'`.
  - [ ] Criar/editar/excluir meta; some/aparece no bloco da Análise e na lista.
  - [ ] Aportar (carteira mostra saldo; valor ≤ saldo) → barra sobe, saldo cai (Carteiras/Dashboard ao focar), transação "Aporte → " em Transações.
  - [ ] Resgatar (valor ≤ guardado) → inverso. "Resgatar" desabilitado em meta zerada.
  - [ ] Validações: aporte > saldo / resgate > guardado → mensagem no sheet.
  - [ ] Avatar do Dashboard → ProfileSheet; nome/email certos.
  - [ ] Categorias: acordeão, toggle, expandir chip, editar (do user), **segurar** → excluir; excluir em uso → "em uso por transações"; global não edita/exclui; nova categoria aparece nos chips de Transação/Orçamento.
  - [ ] "Sair da conta" → login; reabrir → deslogado.
  - [ ] Editar meta no PWA → focar `/goals` → valor novo.
  - [ ] `tsc` limpo + jest verde nos dois repos.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/mobile-slice-6-goals-profile
gh pr create --repo Welbert-Soares/nexis-mobile --base main \
  --title "feat: Fatia 6 — Metas + Perfil" \
  --body "Fecha a paridade com o PWA. **Metas**: tela /goals empilhada (href:null), entrada por um bloco na Análise — CRUD + aportar/resgatar de carteira. **Perfil**: bottom-sheet do avatar do Dashboard — identidade, CRUD de categorias (acordeão, long-press pra excluir), sair da conta. Consome /api/mobile/goals* e /api/mobile/categories*. Spec/plano: nexis (PR do backend).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Ordem de merge

1. PR do `nexis` (Tasks 1–5) primeiro — o app depende das rotas e da extração no repo.
2. PR do `nexis-mobile` (Tasks 6–14) depois, com o checklist de device feito.

## Rollback

- `nexis`: as rotas são aditivas; a extração `depositToGoal`/`withdrawFromGoal` mantém o `goal.service` equivalente — reverter o PR volta tudo sem afetar o PWA (os testes de `goal.service` garantem a equivalência).
- `nexis-mobile`: reverter o PR tira a tela `/goals`, o bloco da Análise e o `ProfileSheet`; nada mais referencia os componentes novos.
