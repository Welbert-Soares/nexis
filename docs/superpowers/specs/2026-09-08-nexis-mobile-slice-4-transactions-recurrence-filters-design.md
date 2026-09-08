# Nexis Mobile — Fatia 4: Transações (recorrência, parcelamento, filtros) — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D7) — plano a ser derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-4-transactions-recurrence-filters.md`
**Sub-projeto:** 4 de ~6 da versão React Native / Expo do Nexis

---

## Contexto

A Fatia 3 entregou a tela de **Transações** enxuta: listar o mês, criar/editar/excluir receitas e despesas, FAB (hoje item central da tab bar), consumo de categorias só-leitura. Foi deliberadamente cortada — o spec da Fatia 3 listou como **fora de escopo**: recorrência e parcelamento na criação/edição, filtros (tipo/carteira/categoria), busca, delete inteligente de parcelas, swipe-to-delete/undo, export CSV.

A Fatia 4 fecha a parte funcional dessa tela: **recorrência**, **parcelamento** e **delete de grupo** na criação/exclusão, mais **filtros** (tipo/carteira/categoria) na lista. Busca, swipe-to-delete/undo e export ficam para um polish posterior.

O backend já tem tudo que precisa nos repositories — a fatia só re-expõe campos que as rotas `/api/mobile/transactions*` da Fatia 3 tinham removido de propósito, e adiciona um `?mode=` no DELETE.

### O que já existe e é relevante

**No `nexis` (web):**

- **`src/server/repositories/transaction.repository.ts`** — retorna objetos planos (`amount: Decimal → number`):
  - `createTransaction(data)` → `prisma.transaction.create`. Aceita `{ walletId, amount, type, categoryId?, description?, date?, recurring?, interval?, nextDue?, parentId? }`. **Não** escreve saldo.
  - `createInstallments({ walletId, amount, type, categoryId?, description?, date, installments })` → cria a parcela raiz + `installments - 1` filhas (`parentId` = raiz), cada uma `amount / installments` arredondado, `date` + i meses, descrição sufixada `(i/N)`.
  - `deleteInstallmentGroup(id, userId, mode: 'this' | 'this-and-future' | 'all')` → `rootId = tx.parentId ?? tx.id`; `this` = soft-delete só do `id`; `all` = soft-delete de `{id: rootId}` + `{parentId: rootId}`; `this-and-future` = soft-delete das irmãs com `date >= tx.date`. Funciona igual para parcelas **e** recorrentes (raiz + filhas por `parentId`).
  - `deleteTransaction(id, userId)` → soft-delete de uma linha só.
  - `calcNextDue(from: Date, interval)` → soma 7/14 dias, 1 mês ou 1 ano. **Hoje é `function` privada** do módulo (usada por `processDueRecurring`). **Esta fatia exporta.**
  - `processDueRecurring(userId)` → varre templates (`recurring: true`, `parentId: null`, `nextDue <= hoje`, `deletedAt: null`), cria a ocorrência e avança `nextDue`. Já é chamado no mount do app (`triggerRecurring`).
- **`src/server/services/transaction.service.ts`** — `createTransactionSchema` inclui `recurring?, interval? ('WEEKLY'|'BIWEEKLY'|'MONTHLY'|'YEARLY'), nextDue?, installments? (2–24)`. O handler `addTransaction`: se `installments >= 2` → `createInstallments` e retorna `null`; senão → `createTransaction` e retorna `{ ...t, amount: number }`. `editTransactionSchema` tem `recurring?, interval?, nextDue?` mas **a Fatia 4 não usa** (edição fica básica — D3).
- **Rotas mobile da Fatia 3** (`src/routes/api/mobile/transactions.ts`, `transactions.$id.ts`, `categories.ts`): padrão `auth.api.getSession` → 401; body `zod.safeParse` → 400; `Error` do repo → 404 `{ error }`. `POST /transactions` hoje aceita só `{ walletId, amount, type, categoryId?, description?, date? }` (sem recorrência/parcela). `DELETE /transactions/$id` chama `deleteTransaction` sem opção de modo. Data `'YYYY-MM-DD'` persistida como `new Date(dateStr + 'T12:00:00')`.
- vitest configurado; a Fatia 3 adicionou 19 testes de rota.

**No `nexis-mobile`:**

- `src/app/(app)/transactions.tsx` — mês atual + navegação `‹ ›`, cards Receitas/Despesas (ignoram `isTransfer`), `SectionList` agrupada por dia (`fmtDayGroup`), `useFocusEffect` invalidando a query ao focar, salto pro mês da transação recém-criada via `useTransactionSheet().createdMonth`.
- `src/components/transactions/transaction-sheet.tsx` — `forwardRef<SheetRef>`, props `{ tx?, onClose?, onCreated? }`. Campos: tipo (segmented), valor (`CurrencyInput`), data (label + surface + calendário nativo em `Modal` no iOS / dialog no Android, `locale="pt-BR"`), categoria e carteira (chips ícone-only que expandem no selecionado e recolhem ao tocar fora — `collapseChips()`), descrição (`SheetField`). `reset()` no `onDismiss`, sem `onChange` no `Sheet`. `isDirty` no botão. `confirmDelete` inline. Guard "sem carteira".
- `src/components/transactions/transaction-sheet-context.tsx` — `TransactionSheetProvider` + `useTransactionSheet()` → `openNew()` / `openEdit(tx)` / `createdMonth` / `consumeCreatedMonth`.
- `src/components/transactions/transaction-row.tsx` — ícone 36, `description ?? category?.name ?? 'Sem descrição'`, hint `Repeat2` quando `recurring || parentId`, transferências read-only.
- `src/api/transactions.ts` — `monthTransactionsQuery(y, m)` (`queryKey: ['transactions', y, m]`), `createTransaction` / `editTransaction` / `deleteTransaction`. Mutations invalidam `['transactions']` + `['wallets']` + `['dashboard']`.
- `src/api/categories.ts` — `categoriesQuery(type)` (`queryKey: ['categories', type]`).
- `src/schemas/transaction.ts` — `TransactionSchema` (resposta), `TransactionInput` (criar), `TransactionEditInput` (editar). `src/schemas/category.ts`.
- `src/components/ui/sheet-field.tsx` — `SheetField` + `inputStyle` (fundo `colors.border`, focus ring `colors.muted`).
- `src/components/ui/currency-input.tsx` — `CurrencyInput` com `onFocus?` opcional.
- `src/lib/format.ts` — `fmtBRL`, `fmtDate`, `fmtDayGroup`, `toYMD`, `tabularNums`.
- `src/theme/colors.ts` — `bg #09090b`, `card #18181b`, `border #27272a`, `fg #fafafa`, `muted #71717a`, `accent #60a5fa`, `positive #34d399`, `negative #f87171`.
- UI só de `#/tw`; exceções em uso: `RefreshControl`, `SectionList`, `useSafeAreaInsets`, `@gorhom/bottom-sheet`, `Modal`, `Platform`, `Animated`, `@react-native-community/datetimepicker`. **Esta fatia adiciona `Switch`** (de `react-native`).
- Testes: jest-expo (`npx jest`), 56 testes. Gotchas (memória / CLAUDE.md do repo): pin RNTL `^13.3.3`, mock `#/tw` nos testes de tela, nada de `fireEvent.press` que dispare `useMutation` + `waitFor` (trava), sem `.test.tsx` sob `src/app/`, mockar `expo-router` (`useFocusEffect`) nos testes de tela.

---

## Objetivo da Fatia 4

Na tela **Transações** do `nexis-mobile`: **criar** receitas/despesas **recorrentes** (semanal/quinzenal/mensal/anual) e despesas **parceladas** (2–24x); **excluir** parcelas e séries recorrentes com escolha de escopo (esta / esta e as futuras / toda a série); **filtrar** a lista do mês por tipo, carteira e categoria. Persistindo no banco de produção pelas rotas `/api/mobile/transactions*` (aditivo — recorrência/parcela voltam ao `POST`, `?mode=` novo no `DELETE`).

**Princípio (todo o projeto mobile):** a tela aparece na hora (cache do TanStack Query ou vazia); dados preenchem depois. Skeleton só em cold load real. Sem transição JS na navegação.

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | **Recorrência** | Toggle "Repetir" + intervalo (Semanal / Quinzenal / Mensal / Anual). **Só na criação.** |
| D2 | **Parcelamento** | Toggle "Parcelar" + contador 2–24x. **Só na criação, só despesa.** Mutuamente exclusivo com Repetir (ligar um desliga o outro) — igual PWA. |
| D3 | **Edição** | Só campos básicos (valor/data/categoria/carteira/descrição). **Sem** toggles de recorrência/parcela no modo edição. Editar uma parcela/ocorrência muda só aquela linha. |
| D4 | **`nextDue`** | Calculado no **backend** a partir de `date` + `interval`. `calcNextDue` passa a ser exportado de `transaction.repository.ts`. O app **não** manda `nextDue`. |
| D5 | **Delete de grupo** | Seletor de 3 opções (`esta` / `esta e as futuras` / `toda a série/parcelamento`) quando a linha é parcela **ou** recorrente (`isInstallment || recurring || parentId`). Linha comum → confirmação simples da Fatia 3. Reusa `deleteInstallmentGroup`. **Sem** swipe-to-delete, **sem** undo toast. |
| D6 | **Filtros** | Tipo / carteira / categoria, **100% client-side** sobre o mês já carregado. Barra colapsável abaixo dos cards de resumo. Os cards Receitas/Despesas seguem mostrando o **total real do mês** (imunes ao filtro). Sem mudança na rota GET. **Sem** busca (fatia futura). |
| D7 | **Opções do filtro de categoria** | Só as categorias presentes nas transações do mês corrente. |

---

## Arquitetura (delta sobre a Fatia 3)

```
nexis (web) — aditivo
  src/routes/api/mobile/
    transactions.ts        # POST: body reganha recurring/interval/installments
    transactions.$id.ts    # DELETE: ?mode=this|this-and-future|all opcional
  src/server/repositories/
    transaction.repository.ts   # export calcNextDue (era privada)

nexis-mobile
  src/schemas/transaction.ts     # TransactionInput += recurring/interval/installments
  src/api/transactions.ts        # createTransaction tolera resposta null; deleteTransaction(id, mode?)
  src/components/transactions/
    transaction-sheet.tsx        # bloco Repetir/Parcelar (só criação) + seletor de delete de grupo
  src/app/(app)/transactions.tsx # barra de filtros colapsável + lista usa filteredTxs
```

Nenhuma dep nova. Um componente nativo novo em uso: `Switch` de `react-native`.

---

## Parte A — backend `nexis` (aditivo)

Padrão idêntico às rotas da Fatia 3.

### A1. `src/routes/api/mobile/transactions.ts` — `POST` (delta)

Body volta a ser a cópia do `createTransactionSchema` do `transaction.service.ts`:

```ts
const createBody = z.object({
  walletId: z.string(),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),                 // 'YYYY-MM-DD'
  recurring: z.boolean().optional(),
  interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  installments: z.number().int().min(2).max(24).optional(),
})
```

Handler (espelha `addTransaction` do PWA):

- `safeParse` → 400. Data normalizada pra meio-dia local (`toDate`, já existe). `const when = toDate(date) ?? new Date()`.
- **Se `installments && installments >= 2`:**
  ```ts
  await createInstallments({ walletId, amount, type, categoryId, description, date: when, installments })
  return Response.json(null)
  ```
- **Senão:**
  ```ts
  const nextDue = recurring ? calcNextDue(when, interval ?? 'MONTHLY') : undefined
  const t = await createTransaction({ walletId, amount, type, categoryId, description, date: toDate(date), recurring, interval, nextDue })
  return Response.json({ ...t, amount: t.amount.toNumber() })
  ```
  (`date` passado como `toDate(date)` — pode ser `undefined`, o repo usa `new Date()`; `when` só serve pro `calcNextDue` e pro `createInstallments`.)
- **Escopo:** `checkBudgetsAndNotify` continua fora (efeito de push — fatia de notificações).

### A2. `src/routes/api/mobile/transactions.$id.ts` — `DELETE` (delta)

```ts
DELETE: async ({ request, params }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const mode = new URL(request.url).searchParams.get('mode')
  const isGroupMode = mode === 'this' || mode === 'this-and-future' || mode === 'all'
  try {
    if (isGroupMode) {
      await deleteInstallmentGroup(txId(request, params), session.user.id, mode)
    } else {
      await deleteTransaction(txId(request, params), session.user.id)
    }
    return Response.json(null)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Erro ao excluir transação' }, { status: 404 })
  }
}
```

`mode` ausente ou inválido → delete simples (comportamento atual). `POST` (edição) **não muda**.

### A3. `src/server/repositories/transaction.repository.ts`

Trocar `function calcNextDue(...)` por `export function calcNextDue(...)`. Nenhuma outra mudança — `processDueRecurring` continua usando a mesma função.

### A4. Testes do backend (vitest)

Reusa os helpers de mock (`getSession`, repo mockado) dos testes de `transactions*`:

- `transactions.ts` `POST`: body com `installments: 3` → `createInstallments` chamado com `installments: 3`, resposta `null`, status 200; body com `recurring: true, interval: 'WEEKLY'` → `createTransaction` chamado com `nextDue` instanceof Date 7 dias após a data; `recurring` sem `interval` → usa `'MONTHLY'`; body sem recorrência → igual hoje; `installments: 1` → 400 (min 2); `amount: -1` → 400.
- `transactions.$id.ts` `DELETE`: `?mode=all` → `deleteInstallmentGroup(id, userId, 'all')`, 200 + `null`; `?mode=this-and-future` idem; sem `mode` → `deleteTransaction`; `?mode=foo` → `deleteTransaction` (ignora); id alheio (`deleteInstallmentGroup` joga `'Transaction not found'`) → 404; sem sessão → 401.

### A5. Deploy

Vercel (Nitro) auto-deploy no merge pra `main` do `nexis`. Aditivo — sem migração, sem env nova.

---

## Parte B — app `nexis-mobile`: o sheet de criar

### B1. `src/schemas/transaction.ts`

`TransactionInput` ganha:

```ts
recurring: z.boolean().optional(),
interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
installments: z.number().int().min(2).max(24).optional(),
```

`TransactionEditInput` **não muda** (D3).

### B2. `src/api/transactions.ts`

- `createTransaction` — o parser tolera `null` (parcelamento responde `null`):
  ```ts
  apiPost('/api/mobile/transactions', body, (r) => (r == null ? null : TransactionSchema.partial().parse(r)))
  ```
- `deleteTransaction(id: string, mode?: 'this' | 'this-and-future' | 'all')`:
  ```ts
  apiDelete(`/api/mobile/transactions/${id}${mode ? `?mode=${mode}` : ''}`)
  ```

### B3. `transaction-sheet.tsx` — bloco Repetir / Parcelar

**Renderizado só quando `!isEdit`** (e não `saved` / `confirmDelete` / guard), logo depois da Descrição.

- **Estado** (resetado em `reset()`):
  - `recurring: boolean` (default `false`)
  - `interval: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY'` (default `'MONTHLY'`)
  - `parceling: boolean` (default `false`)
  - `installments: number` (default `2`)
- **Linha "Repetir"** — label + `Switch` (de `react-native`; `trackColor={{ true: colors.accent, false: colors.border }}`, `thumbColor={colors.fg}`). `onValueChange`: `setRecurring(v); if (v) setParceling(false); collapseChips()`.
  - `recurring` → abaixo, chip-row de 4 pills fixas: `Semanal` / `Quinzenal` / `Mensal` / `Anual` (`INTERVALS` const local). Selecionada = fundo `colors.fg`, texto `colors.bg`; resto fundo `colors.border`, texto `colors.muted`. Sem ícone. Sem animação de expandir.
- **Linha "Parcelar"** — só quando `type === 'EXPENSE'`. Label + `Switch`. `onValueChange`: `setParceling(v); if (v) setRecurring(false); collapseChips()`.
  - `parceling` → contador: botão `−` / `Text {installments}x` (`tabularNums`) / botão `＋`; abaixo, `de {fmtBRL(cents / 100 / installments)} cada` (`text-xs text-muted`). `−` desabilita em 2, `＋` em 24.
- Trocar o tipo pra `INCOME` com `parceling` ligado → `setParceling(false)` (a linha some; garante consistência).

- **Save (branch de criação)** passa a incluir:
  ```ts
  recurring: recurring || undefined,
  interval: recurring ? interval : undefined,
  installments: parceling ? installments : undefined,
  ```
  `nextDue` não é enviado (D4).
- **Tela de sucesso**: `parceling` → `${installments} parcelas criadas`; senão `Transação salva` (igual hoje).
- **`onCreated(date)`** já é chamado no `onSuccess` da criação — continua mandando `date` (mês da 1ª parcela / do lançamento). A lista pula pra lá.
- `isDirty` na criação já é sempre `true` — sem mudança.
- **Modo edição**: o sheet é exatamente o da Fatia 3 (nenhum toggle novo aparece).

### B4. `transaction-sheet.tsx` — exclusão de grupo

- `isGroupTx = !!tx && (tx.isInstallment || tx.recurring || !!tx.parentId)`.
- `remove` vira `useMutation({ mutationFn: (mode?: 'this' | 'this-and-future' | 'all') => deleteTransaction(tx!.id, mode), onSuccess: () => { invalidate(); dismiss() } })`.
- Bloco `confirmDelete`:
  - `isGroupTx` → título + 3 `Pressable` (estilo dos botões do bloco atual) + Cancelar:
    - parcela (`tx.isInstallment`): "Só esta parcela" / "Esta e as próximas" / "Todas as parcelas"
    - recorrente (senão): "Só esta ocorrência" / "Esta e as futuras" / "Toda a série"
    - 3º botão com o destaque vermelho (`rgba(248,113,113,0.18)` / texto `colors.negative`), como o "Excluir" atual.
    - cada um → `remove.mutate('this' | 'this-and-future' | 'all')`.
  - senão → bloco atual inalterado → `remove.mutate(undefined)`.
- Copy de apoio abaixo do título: "O saldo da carteira será revertido." (igual hoje).

---

## Parte C — app `nexis-mobile`: filtros na lista

### C1. `transactions.tsx` — estado

```ts
const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
const [filterWalletId, setFilterWalletId] = useState<string | null>(null)
const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null)
const [filtersOpen, setFiltersOpen] = useState(false)
```

- `useQuery(walletsQuery)` pro chip-row de carteira.
- `categoriesInMonth` = `useMemo`: categorias distintas (`{ id: t.categoryId, name, color, icon }`) das `txs` do mês com `t.categoryId` setado, ordenadas por nome.
- `filteredTxs = useMemo(() => txs.filter(t =>
    (filterType === 'ALL' || t.type === filterType) &&
    (!filterWalletId || t.walletId === filterWalletId) &&
    (!filterCategoryId || t.categoryId === filterCategoryId)
  ), [txs, filterType, filterWalletId, filterCategoryId])`.
- `sections = useMemo(() => groupByDay(filteredTxs), [filteredTxs])`.
- **`income` / `expenses` (cards) continuam calculados sobre `txs`** (D6).
- `hasActiveFilter = filterType !== 'ALL' || !!filterWalletId || !!filterCategoryId`.
- Filtros **persistem** ao trocar de mês (nenhum reset automático).

### C2. `transactions.tsx` — UI

Abaixo dos cards de resumo, ainda no header fixo:

- **Linha-gatilho**: `Pressable` → `setFiltersOpen(o => !o)`. Ícone `SlidersHorizontal` (`colors.fg` se `hasActiveFilter`, senão `colors.muted`) + texto: resumo dos ativos (`"Despesas · Nubank"`) ou `"Filtros"`. Chevron rotaciona com `filtersOpen`.
  - Quando `hasActiveFilter`: botão "limpar" (`FilterX`, `text-xs`) à direita → zera os 3.
- **Painel** (`filtersOpen && ...`, com fade `Animated` de `opacity`): 3 blocos `gap-2`, cada um `Text` label `text-xs text-muted` + `ScrollView horizontal` de pills (`rounded-full px-3 py-1.5`, selecionada = `bg` `colors.fg` / texto `colors.bg`, senão `colors.border` / `colors.muted`):
  - **Tipo**: `Todas` (`ALL`) / `Receitas` (`INCOME`) / `Despesas` (`EXPENSE`).
  - **Carteira**: uma pill por `wallet.name`; tocar de novo na selecionada desmarca (`setFilterWalletId(id === filterWalletId ? null : id)`).
  - **Categoria**: uma pill por `categoriesInMonth`; mesmo toggle. Só renderiza o bloco se `categoriesInMonth.length > 0`.
- Pills são label-only (sem ícone, sem animação de expandir — diferente dos chips do sheet).

### C3. `transactions.tsx` — lista e vazio

- `SectionList sections={sections}` (agora de `filteredTxs`).
- `ListEmptyComponent`:
  - `hasActiveFilter` → card "Nenhuma transação com esses filtros" + `Pressable` "limpar filtros".
  - senão → o "Nenhuma transação neste mês" atual.
- Cold load inalterado (skeleton quando `isLoading && !data`).

---

## Testes

### Backend (`nexis`, vitest) — ver A4.

### App (`nexis-mobile`, jest)

- `src/schemas/transaction.test.ts` — `TransactionInput` aceita `recurring/interval/installments`; rejeita `installments: 1` e `installments: 25`; `interval` fora do enum → erro.
- `src/api/transactions.test.ts` — `deleteTransaction('t1', 'all')` monta `DELETE /api/mobile/transactions/t1?mode=all`; `deleteTransaction('t1')` sem query; `createTransaction` com resposta `null` do fetch resolve `null` sem lançar.
- `src/__tests__/transaction-sheet.test.tsx` — criação (EXPENSE) mostra "Repetir" e "Parcelar"; criação (INCOME) mostra "Repetir", **não** "Parcelar"; **edição** (`tx` prop) não mostra nenhum dos dois; toque na lixeira de uma `tx` com `isInstallment: true` abre o seletor com "Todas as parcelas"; `tx` com `recurring: true` abre com "Toda a série"; `tx` comum abre o "Excluir esta transação?". Sem `fireEvent.press` que dispare `useMutation`.
- `src/__tests__/transactions-screen.test.tsx` — `queryClient.setQueryData(['transactions', y, m], fixture)`; filtro de tipo `Despesas` some as receitas da lista mas os cards Receitas/Despesas seguem iguais; filtro de categoria; "limpar" volta tudo; com filtro e zero resultado → estado "Nenhuma transação com esses filtros". Mockar `expo-router` (`useFocusEffect`), `#/tw`, `#/api/*`, `lucide-react-native`, `#/components/transactions/transaction-sheet-context`.

### `tsc --noEmit` limpo nos dois repos.

---

## Verificar no device

- `npx expo start --tunnel`, Expo Go no iPhone.
- **Recorrência**: criar despesa "Mensal" hoje → aparece na lista; fechar e reabrir o app → `triggerRecurring` gera a ocorrência do mês seguinte (conferir navegando `›`). Conferir no PWA que o template tem `nextDue` no mês certo.
- **Parcelamento**: criar despesa 300,00 em 3x → 3 linhas de 100,00 em 3 meses consecutivos, sucesso diz "3 parcelas criadas", a lista pula pro 1º mês. Conferir descrições `(1/3)`, `(2/3)`, `(3/3)` no PWA.
- **Delete de parcela**: tocar numa parcela → lixeira → 3 opções. "Só esta parcela" some 1; "Esta e as próximas" some a atual + seguintes; "Todas as parcelas" some o grupo. Conferir cada uma no PWA.
- **Delete de recorrente**: tocar numa ocorrência → 3 opções. "Toda a série" → soft-delete do template → `triggerRecurring` não gera mais (reabrir o app e conferir).
- **Filtros**: abrir a barra, combinar tipo + carteira + categoria; a lista estreita, os cards de resumo **não** mudam; "limpar" zera; navegar de mês mantém os filtros; filtro de categoria sem correspondência no mês → "Nenhuma transação com esses filtros".
- **Saldo**: toda operação reflete na aba Carteiras e no Dashboard ao focar (invalidação + `useFocusEffect`).
- Rodar as duas suítes; `tsc --noEmit` limpo nos dois.

---

## Contrato que a Fatia 5+ herda

- **`POST /api/mobile/transactions`** aceita `recurring`/`interval`/`installments`; `nextDue` é responsabilidade do backend (`calcNextDue` exportado).
- **`DELETE /api/mobile/transactions/$id?mode=`** — `this` | `this-and-future` | `all` para parcelas e séries; sem `mode` = delete simples.
- **Filtros client-side** — padrão de barra colapsável + `filteredTxs` derivado; resumo do mês fica imune ao filtro. Reusável em outras listas.
- **`Switch` de `react-native`** — disponível pra Metas/Orçamentos/Perfil.

---

## Fora de escopo (Fatia 4)

- **Editar** a config de recorrência/parcelamento de uma transação existente (ligar/desligar Repetir, trocar intervalo, re-parcelar). Editar template recorrente pra parar a série pela tela de edição — parar só via "Toda a série" no delete.
- Busca por descrição.
- Swipe-to-delete, undo toast (5s), haptics.
- Export CSV.
- Filtro persistido entre sessões; presets de filtro.
- Filtro de categoria como parâmetro da rota (fica client-side).
- Notificação de orçamento estourado (`checkBudgetsAndNotify`).
- Aba Análise, Metas, Orçamentos, Perfil.
- Categorias CRUD pelo app.

---

## Riscos / pontos de atenção

- **`Switch` no Expo Go.** Componente nativo do core do RN, sempre disponível — sem risco de módulo nativo. `trackColor`/`thumbColor` têm quirks de plataforma (no iOS o `false` do track fica pálido); aceitável, é o controle nativo (guideline [[prefer-native-components]]).
- **Resposta `null` do `POST` parcelado.** O `apiPost` da Fatia 3 faz `parse(await res.json())`; `res.json()` de um corpo `null` retorna `null`, e o parser novo (`r == null ? null : ...`) cobre. Testar no device que o sucesso do parcelamento não cai no `save.isError`.
- **`calcNextDue` exportada.** Mudança mínima no repo, mas é um símbolo novo no contrato do módulo — garantir que `processDueRecurring` continua usando a mesma função (sem cópia).
- **`this-and-future` usa `tx.date`.** `deleteInstallmentGroup` compara `date >= tx.date`. Como as datas são persistidas ao meio-dia local, a comparação é estável; o teste do backend cobre os 3 modos.
- **Filtros + `keepPreviousData`.** Ao trocar de mês, `filteredTxs` recalcula sobre as `txs` antigas por 1 frame antes do refetch — mesmo comportamento já aceito na Fatia 3.
- **Contador de parcelas e teclado.** O bloco Parcelar fica no fim do `BottomSheetScrollView`; `keyboardBehavior="interactive"` já cobre. Sem input de texto novo (só −/＋), então sem risco de teclado.

---

## A confirmar no plano (não bloqueiam o spec)

- Animação da barra de filtros: só `opacity` (`Animated`) vs. também altura (`maxHeight` interpolado, como o grid de ícones do `wallet-sheet`).
- Posição do bloco Repetir/Parcelar no sheet: depois da Descrição (proposto) vs. logo depois do Valor.
- Ícone/label das pills de intervalo: texto puro (proposto) vs. abreviação (`1x/sem`, `1x/mês`).
