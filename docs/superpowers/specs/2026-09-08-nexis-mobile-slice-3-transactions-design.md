# Nexis Mobile — Fatia 3: Transações (leitura + escrita) — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D9) — plano a ser derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-3-transactions.md`
**Sub-projeto:** 3 de ~6 da versão React Native / Expo do Nexis

---

## Contexto

A Fatia 1 entregou a fundação (Expo Go + OAuth por cookie + `apiGet` tipado + Zod + TanStack Query + NativeWind) e o Dashboard só-leitura. A Fatia 2 entregou a primeira superfície de escrita — Carteiras (listar/criar/editar/excluir/transferir) — validando `POST`/`DELETE` com sessão por cookie, mutations + invalidação, formulário em bottom-sheet, `CATEGORY_ICONS` e `CurrencyInput`. Ambas no ar (`main` dos dois repos).

A Fatia 3 entrega a **ação central do dia a dia**: registrar receitas e despesas. É o segundo fluxo de escrita e o primeiro que cruza três recursos (transação → carteira → categoria). Introduz o **FAB central** (a entrada de "nova transação" de qualquer aba) e o consumo de **categorias** no app.

### O que já existe e é relevante

**No `nexis` (web):**

- **`src/server/repositories/transaction.repository.ts`** — retorna objetos planos (`amount: Decimal → number`). Funções reusadas nesta fatia:
  - `getTransactionsByMonth(userId, year, month, type?, walletId?)` → rows do mês (`date` no range `[1º dia, 1º dia do mês seguinte)`, `deletedAt: null`), `orderBy: { date: 'desc' }`, `include: { category, wallet: {id,name,color}, parent: {recurring}, _count: {children} }`. Cada row mapeada para `{ ...t, amount: number, isInstallment: boolean }`. Campos do modelo presentes: `id, type, amount, description, date, walletId, categoryId, recurring, interval, parentId, isTransfer, category, wallet`.
  - `createTransaction(data)` → `prisma.transaction.create`. **Não** escreve saldo de carteira. Aceita `{ walletId, amount, type, categoryId?, description?, date?, recurring?, interval?, nextDue?, parentId? }`.
  - `updateTransaction(id, userId, data)` → valida posse (`wallet: { userId }`), `throw new Error('Transaction not found')` se não achar; `prisma.transaction.update`.
  - `deleteTransaction(id, userId)` → valida posse, **soft delete** (`deletedAt: new Date()`).
- **`src/server/repositories/category.repository.ts`**:
  - `getCategoriesByType(type, userId)` → `where: { type, OR: [{ userId: null }, { userId }] }`, `orderBy: [{ userId: 'asc' }, { name: 'asc' }]`. Retorna registros Prisma crus de `Category` (`id, name, color, icon, type, userId, ...`).
- **`src/server/repositories/wallet.repository.ts`** — `getWalletsByUser(userId)` deriva `balance = initialBalance + Σincome − Σexpense` **na leitura**. Ou seja: criar/editar/excluir transação **não requer nenhuma escrita em `Wallet`** — o saldo se recalcula sozinho no próximo GET.
- Zod dos bodies hoje vive inline em `src/server/services/transaction.service.ts` (`createTransactionSchema`, `editTransactionSchema`) e `category.service.ts`.
- Rotas mobile existentes seguem o padrão de `src/routes/api/mobile/wallets.$id.ts`: `createFileRoute` + `server.handlers`, `auth.api.getSession({ headers: request.headers })` → `401`; body via `zodSchema.safeParse(await request.json())` → `400`; `Error` conhecido do repo → `404`/`4xx` com `{ error: message }`; sucesso → `Response.json(...)` com Decimals já convertidos.
- vitest configurado; Fatia 2 adicionou ~53 testes.

**No `nexis-mobile`:**

- `src/app/(app)/_layout.tsx` — hoje um `<Tabs>` do Expo Router com **2 abas** (`index` = Início, `wallets` = Carteiras). Sem FAB.
- `src/app/_layout.tsx` (root) — `GestureHandlerRootView` > `QueryClientProvider` > `SessionProvider` > **`BottomSheetModalProvider`** > `Gate` (`<Stack>` com `(app)` / `(auth)`).
- `src/api/client.ts` — `apiGet` / `apiSend` / `apiPost` / `apiDelete` (cookie via `authClient.getCookie()` síncrono, `credentials: 'omit'`). `ApiError.message` carrega a mensagem PT-BR do backend.
- `src/api/wallets.ts` — `walletsQuery` (`queryKey: ['wallets']`) + mutations.
- `src/lib/category-icons.ts` — `CATEGORY_ICONS: Record<string, LucideIcon>` (portado na Fatia 2).
- `src/lib/format.ts` — `fmtBRL`, `fmtDate`, `tabularNums`.
- `src/components/ui/currency-input.tsx` — `CurrencyInput` (camada de texto visível sobre input transparente; `InputComponent` opcional pra `BottomSheetTextInput`).
- `src/components/ui/sheet.tsx` — `Sheet` (gorhom `BottomSheetModal`, `enableDynamicSizing`), `BottomSheetScrollView`, `BottomSheetTextInput`, tipo `SheetRef`.
- `src/components/wallets/wallet-sheet.tsx` — referência do padrão de sheet de formulário: `reset()` no `onDismiss`, `SheetField` com indicador de foco, `isDirty` no botão, confirmação de exclusão inline, check de sucesso.
- `src/theme/colors.ts` — `bg #09090b`, `card #18181b`, `border #27272a`, `fg #fafafa`, `muted #71717a`, `accent #60a5fa`, `positive #34d399`, `negative #f87171`.
- Testes: jest-expo (`npx jest`), 35 testes. Gotchas em `CLAUDE.md` do repo / memória: pin RNTL `^13.3.3`, mock `#/tw` nos testes de tela, nada de `fireEvent.press` que dispara `useMutation` + `waitFor` (trava), sem `.test.tsx` sob `src/app/`.

---

## Objetivo da Fatia 3

Na aba **Transações** (nova) e pelo **FAB central** (novo, disponível em qualquer aba) do `nexis-mobile`: **listar** as transações do mês, **criar**, **editar** e **excluir** receitas/despesas — persistindo no banco de produção via rotas novas `/api/mobile/transactions*` e `/api/mobile/categories`. Prova o segundo fluxo de escrita, o consumo de categorias, e a entrada global de ação.

**Princípio (todo o projeto mobile):** a tela aparece na hora (cache do TanStack Query ou vazia); dados preenchem depois. Skeleton só em cold load real. Sem transição JS na navegação.

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | **Lista** | Enxuta: mês atual + navegação `‹ ›`; resumo Receitas/Despesas; agrupada por dia. **Sem** filtros, **sem** busca, **sem** export CSV. |
| D2 | **Sheet criar/editar** | Básico: tipo, valor, data, categoria (escolher entre existentes), carteira, descrição. Editar + excluir. **Sem** recorrência, **sem** parcelamento, **sem** criar categoria inline. |
| D3 | **Entrada "nova transação"** | **FAB central** flutuante, disponível em todas as abas. |
| D4 | **Exclusão** | Lixeira dentro do sheet + confirmação inline (igual `WalletSheet`). **Sem** swipe-to-delete, **sem** undo toast. |
| D5 | **Categorias** | Só leitura nesta fatia — `GET /api/mobile/categories?type=`. Globais (`userId null`) + as que o usuário já criou na web. Criar/editar categoria fica pra fatia futura. |
| D6 | **Saldo de carteira** | Derivado na leitura; nenhuma escrita em `Wallet`. Mutations invalidam `['transactions']` + `['wallets']` + `['dashboard']`. |
| D7 | **Data** | Controle **nativo** `@react-native-community/datetimepicker` (compatível com Expo Go). Default hoje, `max` hoje. App manda `'YYYY-MM-DD'`; **o backend persiste `new Date(dateStr + 'T12:00:00')`** (meio-dia local do servidor) pra não pular de dia. |
| D8 | **FAB — implementação** | FAB **flutuante** (`position: absolute` sobre a tab bar padrão), não `tabBar` custom. `<Tabs>` fica com 3 abas reais. |
| D9 | **Rows especiais** | Transferências (`isTransfer`) e parcelas/recorrentes criadas na web **aparecem** na lista. Transferência é read-only (sem tap). Parcela/recorrente: tap abre edição normal (valor/data/categoria/carteira/descrição) — **não** edita a config de recorrência/parcelamento. |

---

## Arquitetura (delta sobre a Fatia 2)

```
nexis (web) — aditivo
  src/routes/api/mobile/
    transactions.ts        # GET (mês) + POST (criar)
    transactions.$id.ts    # POST (editar) + DELETE
    categories.ts          # GET ?type=

nexis-mobile
  src/schemas/
    transaction.ts         # TransactionSchema, TransactionsSchema, TransactionInput, TransactionEditInput
    category.ts            # CategorySchema, CategoriesSchema
  src/api/
    transactions.ts        # monthTransactionsQuery(y,m) + create/edit/delete
    categories.ts          # categoriesQuery(type)
  src/components/
    layout/
      fab.tsx              # botão + flutuante
    transactions/
      transaction-sheet.tsx
      transaction-row.tsx
      transaction-sheet-context.tsx  # provider + useTransactionSheet()
  src/app/(app)/
    _layout.tsx            # + provider do sheet + <Fab/> + <TransactionSheet/> como irmãos do <Tabs>; 3ª aba
    transactions.tsx       # a tela
```

Nenhuma dep nova além de `@react-native-community/datetimepicker` (D7).

---

## Parte A — backend `nexis` (aditivo)

Padrão idêntico a `wallets.$id.ts`. Todo handler: `auth.api.getSession({ headers: request.headers })` → `Response.json({ error: 'Unauthorized' }, { status: 401 })` sem sessão.

### A1. `src/routes/api/mobile/transactions.ts` — `GET` + `POST`

**`GET`** — query `?year=<int>&month=<1..12>`:

- Parse com `z.object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) })` sobre `new URL(request.url).searchParams`. Inválido → `400`.
- `Response.json(await getTransactionsByMonth(session.user.id, year, month))` — sem `type`/`walletId` nesta fatia. As rows já vêm normalizadas pelo repo (`amount: number`, `isInstallment: boolean`, `date` serializa como ISO string).

**`POST`** — body:

```ts
const createBody = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.coerce.date().optional(),
})
```

- `safeParse(await request.json())` → `400` com `{ error: parsed.error.message }`. `date` chega como `'YYYY-MM-DD'`; `z.coerce.date()` aceita, mas o handler normaliza pra `new Date(raw.date + 'T12:00:00')` **antes** de chamar o repo (D7 — evita pulo de dia em BRT). Sem `date` → repo usa `new Date()`.
- `const t = await createTransaction(parsed.data)`.
- Sucesso → `Response.json({ ...t, amount: t.amount.toNumber() })`. **Não** inclui `category`/`wallet` expandidos (o create do repo não faz `include`); o app invalida `['transactions']` e refetча — não insere no cache manualmente.
- Escopo: o `checkBudgetsAndNotify` do `transaction.service.ts` **não** é chamado aqui (é efeito de push, fora do contrato REST mínimo; pode entrar numa fatia de notificações).

### A2. `src/routes/api/mobile/transactions.$id.ts` — `POST` (editar) + `DELETE`

`walletId(request, params)` = `params?.id ?? new URL(request.url).pathname.split('/').filter(Boolean).pop()!` (mesma helper de `wallets.$id.ts`).

**`POST`** — body:

```ts
const editBody = z.object({
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  walletId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.coerce.date().optional(),
})
```

- Mesma normalização de `date` do `POST` de criação (`'YYYY-MM-DD'` → `T12:00:00`).
- `updateTransaction(id, session.user.id, parsed.data)`. `catch` → `Response.json({ error: e.message }, { status: 404 })` (repo joga `'Transaction not found'` pra id inexistente ou de outro usuário).
- Sucesso → `Response.json({ ...t, amount: t.amount.toNumber() })`.

**`DELETE`**:

- `await deleteTransaction(id, session.user.id)` → `catch` → `404`.
- Sucesso → `Response.json(null)` (o `apiDelete` mobile resolve `void`).

### A3. `src/routes/api/mobile/categories.ts` — `GET`

- Query `?type=INCOME|EXPENSE` via `z.enum(['INCOME','EXPENSE'])`. Ausente/ inválido → `400`.
- `Response.json(await getCategoriesByType(type, session.user.id))` — array de `Category` cru do Prisma. `color`/`icon` são `string | null`; `userId` é `string | null` (null = global).

### A4. Testes do backend (vitest)

`src/routes/api/mobile/*.test.ts` no padrão dos testes de `wallets`:

- `transactions.ts`: `GET` sem sessão → 401; `GET ?year=2026&month=9` com sessão fake → 200 + array; `GET` sem `month` → 400; `POST` body válido → 200 + `{ amount: number }`; `POST amount: -1` → 400; `POST` sem sessão → 401.
- `transactions.$id.ts`: `POST` edição válida → 200; `POST` id de outro user → 404; `DELETE` id válido → 200 + `null`; `DELETE` id alheio → 404; sem sessão → 401.
- `categories.ts`: `GET ?type=EXPENSE` → 200 + array com pelo menos os globais; `GET` sem `type` → 400; sem sessão → 401.

Reusa os helpers de mock de sessão / `prisma` já existentes na suíte.

### A5. Deploy

Vercel (Nitro) auto-deploy no merge pra `main` do `nexis`. As rotas são aditivas — sem migração, sem env nova.

---

## Parte B — app `nexis-mobile`

### B1. Dependência nova

- `@react-native-community/datetimepicker` — `npx expo install @react-native-community/datetimepicker` (resolve a versão compatível com o SDK 57). Funciona no Expo Go (é módulo da lista suportada do Expo Go). É o único módulo nativo novo da fatia.

### B2. Schemas Zod

**`src/schemas/transaction.ts`** — `z.object` não-strict (campos extras do JSON ignorados):

```ts
export const TransactionSchema = z.object({
  id: z.string(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number(),
  description: z.string().nullable(),
  date: z.string(),                       // ISO
  walletId: z.string(),
  categoryId: z.string().nullable(),
  category: z.object({
    name: z.string(),
    color: z.string().nullable(),
    icon: z.string().nullable(),
  }).nullable(),
  wallet: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().nullable(),
  }),
  recurring: z.boolean(),
  parentId: z.string().nullable(),
  isInstallment: z.boolean(),
  isTransfer: z.boolean(),
})
export const TransactionsSchema = z.array(TransactionSchema)
export type Transaction = z.infer<typeof TransactionSchema>

export const TransactionInput = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),            // 'YYYY-MM-DD'
})
export type TransactionInputData = z.infer<typeof TransactionInput>

export const TransactionEditInput = z.object({
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  walletId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.string().optional(),
})
export type TransactionEditData = z.infer<typeof TransactionEditInput>
```

**`src/schemas/category.ts`**:

```ts
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  type: z.enum(['INCOME', 'EXPENSE']),
  userId: z.string().nullable(),
})
export const CategoriesSchema = z.array(CategorySchema)
export type Category = z.infer<typeof CategorySchema>
```

### B3. `src/api/transactions.ts`

```ts
export const monthTransactionsQuery = (year: number, month: number) => ({
  queryKey: ['transactions', year, month] as const,
  queryFn: () =>
    apiGet(`/api/mobile/transactions?year=${year}&month=${month}`, (r) => TransactionsSchema.parse(r)),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
})

export const createTransaction = (body: TransactionInputData) =>
  apiPost('/api/mobile/transactions', body, (r) => TransactionSchema.partial().parse(r))

export const editTransaction = (id: string, body: TransactionEditData) =>
  apiPost(`/api/mobile/transactions/${id}`, body, (r) => TransactionSchema.partial().parse(r))

export const deleteTransaction = (id: string) => apiDelete(`/api/mobile/transactions/${id}`)
```

> O retorno de `POST` não tem `category`/`wallet` expandidos → parse com `.partial()` e o app **ignora** o corpo (só usa pra saber que deu certo); a UI recarrega via invalidação.

### B4. `src/api/categories.ts`

```ts
export const categoriesQuery = (type: 'INCOME' | 'EXPENSE') => ({
  queryKey: ['categories', type] as const,
  queryFn: () =>
    apiGet(`/api/mobile/categories?type=${type}`, (r) => CategoriesSchema.parse(r)),
  staleTime: 5 * 60_000,
  gcTime: 10 * 60_000,
})
```

### B5. Invalidação (padrão de mutation)

Toda mutation de transação, no `onSuccess`:

```ts
qc.invalidateQueries({ queryKey: ['transactions'] })  // todos os meses
qc.invalidateQueries({ queryKey: ['wallets'] })
qc.invalidateQueries({ queryKey: ['dashboard'] })
```

### B6. `src/components/transactions/transaction-sheet-context.tsx`

- `TransactionSheetProvider` — renderiza `{children}` + um `<TransactionSheet ref={sheetRef} tx={editing} onClose={...} />`; mantém `editing: Transaction | undefined` e o `sheetRef`.
- `useTransactionSheet()` → `{ openNew(): void, openEdit(tx: Transaction): void }`.
  - `openNew()` → `setEditing(undefined)` → `sheetRef.current?.present()`.
  - `openEdit(tx)` → `setEditing({ ...tx })` (objeto novo a cada chamada, pro `useEffect([tx])` do sheet repopular) → `present()`.

### B7. `src/components/layout/fab.tsx`

- Círculo `56×56`, `borderRadius: 28`, `backgroundColor: colors.accent`, ícone `Plus` (`lucide-react-native`) branco `24`.
- `position: absolute`, `alignSelf: 'center'`, `bottom: <altura da tab bar> + insets.bottom + 8`. Altura da tab bar: usar `useBottomTabBarHeight()` do `@react-navigation/bottom-tabs` (já vem transitivo do Expo Router) **dentro** de um componente montado sob o navigator; se ficar fora, fallback `49 + insets.bottom`.
- `onPress` → `useTransactionSheet().openNew()`. `active:opacity-80`. Sombra leve (`shadowColor #000`, `elevation: 6`).
- Renderizado como irmão do `<Tabs>` no `(app)/_layout.tsx`, **dentro** do `TransactionSheetProvider`.

### B8. `src/app/(app)/_layout.tsx` (delta)

```tsx
return (
  <TransactionSheetProvider>
    <Tabs screenOptions={{ /* … igual hoje … */ }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: … LayoutDashboard }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transações', tabBarIcon: … ArrowLeftRight }} />
      <Tabs.Screen name="wallets" options={{ title: 'Carteiras', tabBarIcon: … Wallet }} />
    </Tabs>
    <Fab />
  </TransactionSheetProvider>
)
```

- Ícone da aba Transações: `ArrowLeftRight` ou `Receipt` (`lucide-react-native`) — decisão do plano.
- `<TransactionSheet>` fica dentro do provider (B6), não aqui.

### B9. Tela `src/app/(app)/transactions.tsx`

- Estado local: `year`, `month` (default = mês atual).
- `useQuery(monthTransactionsQuery(year, month))` + `placeholderData: keepPreviousData` (troca de mês sem flash).
- **Header** (`paddingTop: insets.top + 16`, `paddingHorizontal: 16`):
  - Linha de navegação: `‹` (`ChevronLeft`) · `setembro / 2025` (capitalize) · `›` (`ChevronRight`, desabilitado quando `year/month >= mês atual`).
  - 2 cards lado a lado: **Receitas** (`positive`) e **Despesas** (`negative`) — `fmtBRL(Σ)` das rows do mês com `!isTransfer`, `text-lg font-semibold`, `tabularNums`. Borda `border`, fundo `card`.
- **Lista** — `SectionList` (de `react-native`; exceção permitida como `RefreshControl`):
  - `sections` = agrupamento por dia (`Hoje` / `Ontem` / `qua, 06 set` via helper igual ao `fmtDay` do PWA), ordem `date desc`.
  - `renderSectionHeader` → `Text` `text-xs font-medium text-muted`, sticky off.
  - `renderItem` → `<TransactionRow tx={item} onPress={isTransfer ? undefined : () => openEdit(item)} />`.
  - `refreshControl` → `RefreshControl` invalidando `['transactions']`.
  - `ListEmptyComponent` → card "Nenhuma transação neste mês" / "Toque em + para adicionar".
  - Cold load (`isLoading && !data`) → 4–5 linhas skeleton.
- Sem `PullToRefresh` custom (a `SectionList` tem `refreshControl` nativo).

### B10. `src/components/transactions/transaction-row.tsx`

- `<Pressable onPress>` (ou `View` quando `isTransfer`).
- Ícone `36×36` `rounded-xl`, fundo `${color}20`. `color` = `category.color ?? wallet.color ?? colors.muted`. Conteúdo: ícone Lucide de `CATEGORY_ICONS[category.icon]` se houver; senão dot; se `isTransfer` → `ArrowLeftRight` cinza.
- Centro: `description ?? category?.name ?? 'Sem descrição'` (`text-sm text-fg`, `numberOfLines={1}`) + hint `Repeat2` `12` quando `recurring || parentId`; sublinha `wallet.name` (`text-xs text-muted`).
- Direita: `± fmtBRL(amount)` — `text-sm font-medium`, `tabularNums`, cor `negative` (EXPENSE) / `positive` (INCOME).

### B11. `src/components/transactions/transaction-sheet.tsx`

`forwardRef<SheetRef>`, props `{ tx?: Transaction; onClose?: () => void }`. Estrutura espelha `wallet-sheet.tsx`.

- `Sheet` (gorhom) + `BottomSheetScrollView` (`contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}`).
- `isEdit = !!tx`.
- Estado: `type` (`'EXPENSE'` default), `cents` (`Math.round((tx?.amount ?? 0) * 100)`), `walletId`, `categoryId`, `description`, `date` (`Date`, default hoje), `saved`, `confirmDelete`, `showDatePicker`.
- `useEffect(() => reset(tx), [tx])`; `reset()` no `onDismiss` (padrão Fatia 2). Sem `onChange` no `Sheet` (bug conhecido: dispara em resize e apaga `confirmDelete`).
- `useQuery(categoriesQuery(type))` — recarrega ao trocar o tipo. `useQuery(walletsQuery)` pro chip de carteira.
- **Guard "sem carteira"**: se `walletsQuery` retorna `[]` → tela de CTA "Crie uma carteira" com botão que navega pra aba Carteiras (`router.navigate('/wallets')` + `dismiss()`).
- **Campos** (quando não `saved` / `confirmDelete` / guard):
  1. **Tipo** — segmented 2 opções dentro de `View` `bg-border rounded-xl p-1`: Despesa (`negative` tint quando ativo) / Receita (`positive` tint). Trocar → `setCategoryId(null)`.
  2. **Valor** — `<CurrencyInput cents={cents} onChange={setCents} autoFocus={!isEdit} InputComponent={BottomSheetTextInput} />`.
  3. **Data** — `Pressable` mostrando `fmtDate(date)` (estilo `SheetField`); `onPress` → `setShowDatePicker(true)`. `showDatePicker && <DateTimePicker value={date} mode="date" maximumDate={new Date()} onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) setDate(d) }} />`. (iOS: inline/spinner; Android: dialog nativo que fecha sozinho.)
  4. **Categoria** — label "Categoria" + chip row horizontal (`ScrollView horizontal`): chip = ícone (`CATEGORY_ICONS[c.icon]` ou dot da cor) + nome; selecionado → fundo `fg`/texto `bg`; toque de novo desmarca (`categoryId` opcional).
  5. **Carteira** — `walletId` default = `tx?.walletId ?? wallets[0]?.id ?? ''`, setado em `reset()` **e** num `useEffect([wallets])` (as carteiras podem chegar depois do primeiro render). O chip row só aparece se `wallets.length > 1`; com 1 carteira o valor fica implícito. Sem opção de desmarcar.
  6. **Descrição** — `SheetField` (portado de `wallet-sheet` ou extraído pra `components/ui/`), placeholder "Descrição (opcional)".
- **Header**: título `Nova transação` / `Editar transação`; lixeira (só edição, `!saved`) → `setConfirmDelete(true)`.
- **`confirmDelete`** → bloco inline "Excluir esta transação? / O saldo da carteira será revertido." + Cancelar / Excluir (`remove.mutate()`), igual `WalletSheet`.
- **`saved`** → check verde + "Transação salva" / "Transação atualizada"; `setTimeout(dismiss, 900)`.
- **Botão** — `disabled = busy || cents <= 0 || !walletId || !isDirty`. `isDirty`: em criação sempre `true`; em edição compara `type`, `cents`, `walletId`, `categoryId`, `description`, `date` (comparar por `YYYY-MM-DD`).
- **Save**:
  ```ts
  const amount = cents / 100
  const dateStr = toYMD(date)          // 'YYYY-MM-DD'
  isEdit
    ? editTransaction(tx!.id, { amount, type, walletId, categoryId: categoryId ?? null, description: description || null, date: dateStr })
    : createTransaction({ amount, type, walletId, categoryId: categoryId ?? undefined, description: description || undefined, date: dateStr })
  ```
  `onSuccess` → invalidação (B5) + `setSaved(true)`.
- Erros: `save.isError` → `Text` centralizado `negative` com `ApiError.message`.

### B12. `SheetField` compartilhado

Hoje vive em `wallet-sheet.tsx`. Extrair pra `src/components/ui/sheet-field.tsx` (input do sheet com indicador de foco) e importar nos dois sheets. Refactor pequeno, dentro do escopo (o design toca os dois arquivos).

### B13. Testes (mobile)

- `src/schemas/transaction.test.ts` — fixture JSON válido (`date` ISO, `category` null e não-null, `isTransfer`/`isInstallment` true/false) `.parse` ok; inválido (`amount` string) → `ZodError`.
- `src/schemas/category.test.ts` — fixture global (`userId: null`) e do usuário; inválido.
- `src/__tests__/transaction-sheet.test.tsx` — mock `#/tw`, `#/components/ui/sheet`, `#/api/transactions`, `#/api/wallets`, `#/api/categories`, `@react-native-community/datetimepicker` (`() => null`), `lucide-react-native`. Assere superfície de render: modo criação mostra "Nova transação" + "Salvar"; modo edição com `tx` mostra "Editar transação" + lixeira; `confirmDelete` inline abre no toque da lixeira (`setState` local, sem mutation). Sem `fireEvent.press` que dispare `useMutation`.
- `src/__tests__/transactions-screen.test.tsx` — mock das queries via `queryClient.setQueryData(['transactions', y, m], fixture)`; assere: soma de Receitas/Despesas ignora `isTransfer`; headers de dia ("Hoje"/"Ontem"); empty state com `[]`.
- `src/api/transactions.test.ts` — spy `globalThis.fetch`; `createTransaction` monta `POST` com `Cookie` + JSON; `deleteTransaction` monta `DELETE`; `monthTransactionsQuery.queryFn` parseia.

### B14. Rodar / verificar no device

- `npx expo start --tunnel`, Expo Go no iPhone.
- Criar despesa "hoje" com valor + categoria → aparece na lista agrupada em "Hoje", resumo de Despesas sobe, saldo da carteira na aba Carteiras e no Dashboard cai (invalidação).
- Criar receita com data de outro dia do mês → aparece no grupo certo.
- Editar valor/categoria → reflete na hora. Excluir → some, saldo reverte, conferir no PWA.
- Navegar `‹` pra mês anterior → lista do mês; `›` bloqueado no mês atual.
- FAB abre o sheet em qualquer aba; teclado não cobre o valor; fechar app e voltar mantém a lista (cache).
- Rodar as duas suítes: `nexis` (vitest) e `nexis-mobile` (`npx jest`); `tsc --noEmit` limpo nos dois.

---

## Contrato que a Fatia 4+ herda

- **Rotas `/api/mobile/transactions*` + `/api/mobile/categories`** — padrão de query string (`?year=&month=`, `?type=`), body Zod copiado do `*.service.ts`, `Error` do repo → 4xx `{ error }`.
- **`monthTransactionsQuery` / `categoriesQuery`** — chaves `['transactions', y, m]` e `['categories', type]`; mutations invalidam `['transactions']` + `['wallets']` + `['dashboard']`.
- **FAB + `TransactionSheetProvider` / `useTransactionSheet()`** — a entrada global de "nova transação"; reusável por atalhos do Dashboard, etc.
- **`SheetField`** (`components/ui/sheet-field.tsx`) — input de sheet com foco, reusável por Metas/Orçamentos/Perfil.
- **Padrão `SectionList` + agrupamento por dia** — reusável por extrato de carteira, Análise.
- **`@react-native-community/datetimepicker`** — disponível pra Metas (deadline), Orçamentos (mês).

---

## Fora de escopo (Fatia 3)

- Filtros (tipo/carteira/categoria), busca, export CSV.
- Recorrência e parcelamento **na criação/edição** pelo app (rows criadas na web ainda aparecem e são editáveis nos campos básicos).
- Criar/editar/excluir **categorias** pelo app (só leitura).
- Swipe-to-delete, undo toast, haptics.
- `tabBar` custom / entalhe do FAB (FAB é flutuante).
- Detalhe/extrato por carteira; abrir o sheet já com carteira pré-selecionada a partir da tela Carteiras.
- Optimistic updates (invalidação = refetch).
- Notificação de orçamento estourado (`checkBudgetsAndNotify`) — fica pra fatia de push.
- Aba Análise, Metas, Orçamentos, Perfil.
- Extração dos schemas Zod pra pacote compartilhado.

---

## Riscos / pontos de atenção

- **`@react-native-community/datetimepicker` no Expo Go (SDK 57).** Primeira dep nativa da fatia. **Mitigação:** primeira task do plano = "picker de data abre e retorna uma data no Expo Go do iPhone"; se falhar, fallback pra um seletor de dia custom (3 colunas dia/mês/ano com `ScrollView`) — troca só o campo Data, o resto do sheet não muda.
- **`useBottomTabBarHeight()` fora do navigator.** Se o `<Fab>` for irmão do `<Tabs>` (não filho de uma `Tabs.Screen`), o hook pode lançar. **Mitigação:** medir a tab bar com fallback `49 + insets.bottom`, ou renderizar o `<Fab>` via `tabBar`/`listeners` — decisão do plano após teste rápido no device.
- **Teclado vs. sheet + chips horizontais.** `CurrencyInput`/descrição precisam subir com o teclado; `keyboardBehavior="interactive"` + `BottomSheetTextInput`. Testar cedo no device.
- **Timezone / pulo de dia.** Resolvido (D7): o backend normaliza `'YYYY-MM-DD'` → `new Date(dateStr + 'T12:00:00')` antes de persistir (mesmo truque do `transaction-sheet.tsx` web). O ponto de atenção é **não esquecer** essa linha nos dois handlers (`POST` criar e `POST` editar) — coberto por um teste vitest que cria com `date: '2026-09-15'` e confere `getMonth()`/`getDate()`.
- **`categoriesQuery(type)` troca ao alternar tipo** — garantir que o `categoryId` selecionado é limpo quando não existe na nova lista (já previsto: trocar tipo zera `categoryId`).
- **`SectionList` + `keepPreviousData`** — ao trocar de mês, as `sections` antigas aparecem 1 frame antes do refetch; aceitável (mesma UX do `keepPreviousData` no PWA).
- **Parse do retorno de `POST`** — o create do repo não faz `include`, então o corpo não tem `category`/`wallet`. `TransactionSchema.partial()` no parse e o app ignora o corpo (usa só como "ok"). Não tentar inserir no cache.

---

## A confirmar no plano (não bloqueiam o spec)

- Ícone da aba Transações (`ArrowLeftRight` vs `Receipt`).
- `useBottomTabBarHeight` vs. medição manual pro `bottom` do FAB (decidir após teste rápido no device).
- Extrair `SheetField` agora (recomendado) vs. duplicar.
