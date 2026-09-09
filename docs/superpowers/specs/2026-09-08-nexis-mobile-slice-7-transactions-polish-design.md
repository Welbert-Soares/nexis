# Nexis Mobile — Fatia 7: Polish de Transações — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D9) — plano a ser derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-7-transactions-polish.md`
**Sub-projeto:** 7 do `nexis-mobile` — **primeira fatia fora da paridade** com o PWA (Fatias 1–6 fecharam a paridade).

---

## Contexto

As Fatias 3–4 entregaram a tela de **Transações** funcional (CRUD, recorrência, parcelamento, filtros). A Fatia 4 **cortou de propósito** um backlog de polish: busca por descrição, swipe-to-delete + undo, haptics, e editar a config de recorrência de uma transação existente. A Fatia 7 fecha esse backlog.

Tudo é client-side + uma extensão aditiva no backend (o `POST /api/mobile/transactions/$id` reganha `recurring`/`interval`, que a rota da Fatia 3 tinha removido). Uma dep nova: `expo-haptics` (módulo Expo, roda no Expo Go).

### O que já existe e é relevante

**No `nexis` (web):**

- **`src/server/services/transaction.service.ts`** — `editTransactionSchema` **já tem** `recurring?`, `interval?`, `nextDue?`. O handler `editTransaction` chama `updateTransaction(id, userId, rest)`.
- **`src/server/repositories/transaction.repository.ts`**:
  - `updateTransaction(id, userId, data)` — `data` aceita `recurring?`, `interval?`, `nextDue?`. Hoje só grava o que recebe (não recalcula `nextDue`).
  - `calcNextDue(from, interval)` — **exportado** (Fatia 4). Soma 7/14 dias, 1 mês, 1 ano.
  - `processDueRecurring(userId)` — varre templates `recurring: true, parentId: null, nextDue <= hoje`. **Desligar `recurring`** num template para a série.
- **`src/routes/api/mobile/transactions.$id.ts`** (Fatia 3) — `POST` (edit) com `editBody` = `{ amount, type, walletId?, categoryId?, description?, date? }` — **sem recorrência, de propósito**. `DELETE` já aceita `?mode=this|this-and-future|all` (Fatia 4). Data `'YYYY-MM-DD'` → `new Date(ymd+'T12:00:00')`. `Error` do repo → 404 `{ error }`.
- **`src/components/transactions/transaction-sheet.tsx`** (PWA) — o bloco **"Repetir"** (toggle + painel de intervalo) aparece em **criação E edição**; no edit, `editTransaction` manda `recurring: recurring || undefined`, `interval: recurring ? interval : undefined`, `nextDue: recurring && !transaction.recurring ? calcNextDue(date, interval) : undefined` (só recalcula ao ligar). "Parcelar" idem só criação. `isDirty` inclui `recurring`/`interval`.
- **`src/routes/_authenticated/transactions.tsx`** (PWA) — referência de UI:
  - **Busca**: `<input>` persistente com ícone `Search` e `X` pra limpar; `filtered = search.trim() ? byCategory.filter(t => description||category.name||wallet.name includes q) : byCategory`. `EmptyState({ hasSearch })` com texto diferente.
  - **Swipe + undo**: `SwipeableRow` (swipe left → ação de excluir). `handleSwipeDelete(tx)` → `setConfirmingTx(tx)` (abre confirmação; pra grupo, seletor de 3 modos). `handleConfirmDelete(mode?)` → `haptic.error()`, `setPendingDelete({tx, mode})`, `setTimeout(5000)` que **só então** chama `execDelete`/`execDeleteInstallments`. Durante os 5s a linha some (`displayed = filtered.filter(t => t.id !== pendingDelete.tx.id)`). `handleUndo()` limpa o timer e restaura — **nenhuma chamada ao servidor**. Toast fixo embaixo com "Desfazer".
- **`src/hooks/use-haptic.ts`** (PWA) — `navigator.vibrate`: `tap` (8), `success` (`[10,40,10]`), `error` (`[30,20,30]`), `heavy` (25).

**No `nexis-mobile`:**

- `src/app/(app)/transactions.tsx` — `txs` (mês), `filteredTxs` (`useMemo` sobre `filterType`/`filterWalletId`/`filterCategoryId`), `sections = groupByDay(filteredTxs)`, `<SectionList renderItem={<TransactionRow tx onPress={openEdit} />}>`, `EmptyFiltered` (quando `hasActiveFilter`) vs `EmptyState`. Barra de filtros colapsável (Fatia 4). `useFocusEffect` invalida `['transactions']`. Navegação de mês `‹ ›` até `maxDateQuery`.
- `src/components/transactions/transaction-row.tsx` — ícone + `description ?? category?.name ?? 'Sem descrição'`, hint `Repeat2` quando `recurring || parentId`, transferências renderizadas sem `onPress` (read-only).
- `src/components/transactions/transaction-sheet.tsx` — `forwardRef<SheetRef>`, bloco "Repetir/Parcelar" gated `{!isEdit && (...)}`; `INTERVALS` const; `isGroupTx = !!tx && (tx.isInstallment || tx.recurring || !!tx.parentId)` — hoje o **seletor de 3 modos de exclusão vive dentro deste componente**; `editTransaction` body = `{ amount, type, walletId, categoryId, description, date }` (sem recorrência).
- `src/components/transactions/transaction-sheet-context.tsx` — `TransactionSheetProvider` monta o sheet uma vez; `openNew()` / `openEdit(tx)`.
- `src/api/transactions.ts` — `monthTransactionsQuery(y,m)` key `['transactions', y, m]`; `deleteTransaction(id, mode?)` → `DELETE /api/mobile/transactions/${id}${mode ? '?mode='+mode : ''}`; mutations invalidam `['transactions']`+`['wallets']`+`['dashboard']`+`['transactions-max-date']`.
- `src/schemas/transaction.ts` — `TransactionSchema` tem `recurring`, `parentId`, `isInstallment`, **não tem `interval`**. `TransactionEditInput` = `{ amount, type, walletId?, categoryId?, description?, date? }`.
- `src/lib/format.ts`, `src/lib/analytics-calcs.ts` (`pct`), `src/theme/colors.ts` (`bg/card/border/fg/muted/accent/violet/positive/negative`).
- Root `src/app/_layout.tsx` tem `<GestureHandlerRootView style={{ flex: 1 }}>`. Deps: `react-native-gesture-handler` ~2.32.0, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1 (SDK 57). **Sem `expo-haptics`.**
- `src/components/ui/` — `OfflineBanner` (banner absoluto animado). **Sem toast/snackbar.**
- Testes: jest-expo (`npx jest --forceExit`), 146 testes. Gotchas: pin RNTL `^13.3.3`; mock `#/tw`, `#/tw/image`, `lucide-react-native` (objeto plano), `expo-router`, `react-native-safe-area-context`, `#/components/ui/sheet`, `#/api/*`; **nada de `fireEvent.press` que dispare `useMutation` + `waitFor`** (trava); sem `.test.tsx` sob `src/app/`. `jest.mock` factory vars com prefixo `mock`.
- **`nexis-mobile` sem prettier/eslint** — estilo na mão (sem `;`, aspas simples, 2 espaços). Barra: `npx tsc --noEmit` limpo + jest verde.

---

## Objetivo da Fatia 7

Na tela **Transações** do `nexis-mobile`:

1. **Buscar** a lista do mês por descrição / categoria / carteira (client-side, combina com os filtros da Fatia 4).
2. **Excluir arrastando** a linha pra esquerda, com **5 segundos pra desfazer** (toast) antes de a exclusão de fato ir ao servidor.
3. **Haptics** nas ações (criar/editar/excluir/confirmar/abrir sheet).
4. **Editar a recorrência** de uma transação existente (ligar/desligar "Repetir", trocar intervalo) pela própria tela de edição — hoje só dá na criação. Desligar = para a série.

Backend: `POST /api/mobile/transactions/$id` reganha `recurring`/`interval`; `nextDue` recalculado no backend.

**Princípio (todo o projeto mobile):** a tela aparece na hora (cache ou vazia); dados preenchem depois. Sem transição JS na navegação.

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | **Busca** | `TextInput` persistente na tela Transações, **entre os cards de resumo e o gatilho da barra de filtros**. Ícone `Search` à esquerda, `X` pra limpar quando não-vazio. Filtra `filteredTxs` (ou seja, **depois** dos filtros de tipo/carteira/categoria) por `description` **ou** `category.name` **ou** `wallet.name`, `toLowerCase().includes(q)`. Estado local `search`, **não** persiste, **não** vai pra rota. Busca ativa + zero resultado → `EmptySearch` ("Nenhum resultado" / "Tente outros termos"), distinto do `EmptyFiltered`. |
| D2 | **Swipe-to-delete** | `TransactionRow` embrulhada num `ReanimatedSwipeable` de `react-native-gesture-handler`. Arrastar pra **esquerda** revela uma ação vermelha (`Trash2` + "Excluir"); soltar além do limite **ou** tocar na ação dispara a exclusão. **Transferências não têm swipe** (continuam read-only). `TransactionRow` ganha `onSwipeDelete?: () => void`; quando ausente (ou `isTransfer`), renderiza sem `Swipeable`. Um swipe aberto por vez (fecha o anterior via `ref`); fecha ao rolar. |
| D3 | **Exclusão + undo (5s)** | Linha **comum** → `pendingDelete = { tx }`; a linha some da lista na hora; toast embaixo com contagem regressiva 5s + "Desfazer". Timer expira → `deleteTransaction(tx.id)` de verdade. "Desfazer" → limpa o timer, a linha volta, **nenhuma chamada ao servidor**. Linha de **grupo** (`tx.isInstallment \|\| tx.recurring \|\| tx.parentId`) → abre o **seletor de 3 modos** (`delete-mode-sheet`, D9); escolhido o modo → `pendingDelete = { tx, mode }` + toast; expira → `deleteTransaction(tx.id, mode)`. `haptic.error()` ao confirmar. **Um `pendingDelete` por vez** — novo swipe/troca de mês/desmontagem resolve o pendente **na hora** (chama o delete). O `pendingDelete` vive na tela (`transactions.tsx`), não no contexto do sheet. |
| D4 | **Haptics** | Dep nova **`expo-haptics`** (módulo Expo, Expo Go OK). `src/lib/haptics.ts` → `useHaptic()` espelhando o do PWA: `tap` = `Haptics.selectionAsync()`; `success` = `Haptics.notificationAsync(Success)`; `error` = `Haptics.notificationAsync(Error)`; `heavy` = `Haptics.impactAsync(Medium)`. Cada chamada em `try/catch` (silenciosa; simulador iOS não vibra). Uso: `success` no check de criar/editar; `error` ao confirmar exclusão; `tap` ao abrir o sheet, trocar tipo, abrir o seletor de modo, tocar num chip de filtro. |
| D5 | **Editar recorrência no sheet** | O bloco **"Repetir"** (toggle + chips de intervalo) passa a aparecer **também no modo edição**. **"Parcelar" continua só na criação** (re-parcelar não existe). `recurring`/`interval` inicializam de `tx?.recurring` / `tx?.interval ?? 'MONTHLY'`. `editTransaction` body ganha `recurring: recurring \|\| undefined` e `interval: recurring ? interval : undefined`. `isDirty` += `recurring !== (tx?.recurring ?? false)` e `(recurring && interval !== (tx?.interval ?? 'MONTHLY'))`. Desligar "Repetir" numa recorrente = para a série (o `processDueRecurring` só varre `recurring: true`). **Nota:** editar uma **ocorrência filha** (`parentId != null`) mexe só naquela linha — "parar a série" de forma garantida continua sendo o delete `?mode=all`; mesma ambiguidade do PWA. |
| D6 | **Backend — edit** | `POST /api/mobile/transactions/$id` `editBody` += `recurring: z.boolean().optional()`, `interval: z.enum(['WEEKLY','BIWEEKLY','MONTHLY','YEARLY']).optional()`. O **`nextDue` é responsabilidade do backend**: estender `updateTransaction` (repo) — se `data.recurring === true` e `data.nextDue` não veio, `data.nextDue = calcNextDue(data.date ?? old.date, data.interval ?? old.interval ?? 'MONTHLY')`; se `data.recurring === false`, `data.nextDue = null`. Muda levemente o PWA (passa a recalcular também ao **trocar** o intervalo, não só ao ligar) — melhoria, baixo risco; adicionar teste do repo. |
| D7 | **Schema do app** | `TransactionSchema` (app) += `interval: z.enum(['WEEKLY','BIWEEKLY','MONTHLY','YEARLY']).nullable()` (o repo já devolve o campo cru). `TransactionEditInput` += `recurring?`, `interval?`. |
| D8 | **Toast de undo** | Novo `src/components/ui/undo-toast.tsx` — `View` absoluto ancorado acima da tab bar (`position:'absolute'`, `left/right: 12`, `bottom: 12` — dentro do `main` que já é `overflow-hidden` sobre a tab bar), `bg-card` + `border`, sombra. Texto ("Transação excluída") + barra de progresso 5s (`Animated.timing` width 100→0) + `Pressable` "Desfazer" (`accent`). Controlado por props `{ visible, label, onUndo }` — a tela reinicia a animação a cada novo `pendingDelete`. Sem lib. |
| D9 | **Seletor de modo extraído** | Tirar o seletor de 3 modos de dentro do `transaction-sheet` pra `src/components/transactions/delete-mode-sheet.tsx` — `forwardRef<SheetRef, { tx?: Transaction; onPick: (mode: 'this' \| 'this-and-future' \| 'all') => void }>`. Reusado pelo **swipe** (via `transactions.tsx`) e pelo **botão de excluir do sheet de edição**. O `transaction-sheet` passa a `present()` esse sheet no lugar do bloco inline. |

---

## Arquitetura (delta sobre a Fatia 6)

```
nexis (web) — aditivo
  src/server/repositories/transaction.repository.ts   # updateTransaction: calc/limpa nextDue
  src/server/repositories/transaction.repository.test.ts  # NEW (casos de nextDue no update)
  src/routes/api/mobile/transactions.$id.ts           # editBody += recurring/interval
  src/routes/api/mobile/transactions.$id.test.ts      # + casos de recorrência no edit

nexis-mobile
  package.json                                        # + expo-haptics (npx expo install)
  src/lib/haptics.ts                                  # NEW: useHaptic()
  src/schemas/transaction.ts                          # + interval no Schema; + recurring/interval no EditInput
  src/api/transactions.ts                             # editTransaction tolera os campos novos (só tipos)
  src/components/ui/undo-toast.tsx                     # NEW
  src/components/transactions/delete-mode-sheet.tsx   # NEW (extraído do transaction-sheet)
  src/components/transactions/transaction-row.tsx     # + Swipeable + onSwipeDelete
  src/components/transactions/transaction-sheet.tsx   # bloco Repetir também no edit; usa delete-mode-sheet
  src/app/(app)/transactions.tsx                      # campo de busca; pendingDelete + timer; UndoToast; swipe wiring
  src/__tests__/…                                      # haptics, undo-toast, transactions-screen (busca+undo), transaction-sheet (repetir no edit), delete-mode-sheet
```

### Backend (detalhe)

**`transaction.$id.ts` — `editBody`:**
```ts
const editBody = z.object({
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  walletId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.string().optional(),
  recurring: z.boolean().optional(),
  interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
})
```
Handler passa `recurring`/`interval` adiante pro `updateTransaction` (não manda `nextDue` — o repo cuida).

**`transaction.repository.ts` — `updateTransaction`:** depois de carregar `old` e antes do `prisma.transaction.update`:
```ts
if (data.recurring === true && data.nextDue === undefined) {
  const base = data.date ?? old.date
  data.nextDue = calcNextDue(base, data.interval ?? old.interval ?? 'MONTHLY')
}
if (data.recurring === false) {
  data.nextDue = null
}
```
(`calcNextDue` já importado no módulo. `data.nextDue` no tipo passa a aceitar `Date | null`.)

### App — schema/api

```ts
// src/schemas/transaction.ts
export const TransactionSchema = z.object({
  // …campos atuais…
  interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).nullable(),
})
export const TransactionEditInput = z.object({
  amount: z.number().positive(),
  type: TX_TYPE,
  walletId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.string().optional(),
  recurring: z.boolean().optional(),
  interval: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
})
```
`src/api/transactions.ts` — `editTransaction` já é genérico (`apiPost(path, body, parse)`); só o tipo do `body` muda via `TransactionEditData`.

```ts
// src/lib/haptics.ts
import * as Haptics from 'expo-haptics'

const safe = (fn: () => Promise<unknown>) => { try { fn().catch(() => {}) } catch { /* noop */ } }

export function useHaptic() {
  return {
    tap: () => safe(() => Haptics.selectionAsync()),
    success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  }
}
```

---

## Especificação de UI

### Tela Transações — busca + undo
- **Campo de busca**: `View` com `inputStyle`-like (`bg-border`, rounded), ícone `Search` (16, `muted`), `TextInput` (`placeholder="Buscar descrição, categoria, carteira"`, `value=search`), `X` (`Pressable`) quando `search !== ''`. Fica logo abaixo dos cards Receitas/Despesas, acima do gatilho de filtros.
- **`searchedTxs`** = `search.trim() ? filteredTxs.filter(match) : filteredTxs`; `sections = groupByDay(searchedTxs)` **menos** o `pendingDelete?.tx.id`.
- **Empty**: `search.trim()` e zero → `EmptySearch`; senão `hasActiveFilter` → `EmptyFiltered`; senão `EmptyState`.
- **`pendingDelete`** state `{ tx: Transaction; mode?: DeleteMode } | null`. `deleteTimer` `useRef`. Ao setar: `haptic.error()` + `deleteTimer.current = setTimeout(() => { flush(); }, 5000)`. `flush()` = `deleteTransaction(tx.id, mode)` + `setPendingDelete(null)`. `undo()` = `clearTimeout` + `setPendingDelete(null)`. `useEffect` cleanup e mudança de mês → se há pendente, `flush()` imediato (não deixar timer órfão).
- **`<UndoToast visible={!!pendingDelete} label="Transação excluída" onUndo={undo} />`** renderizado no fim do JSX da tela (dentro do container, sobre a lista).

### `transaction-row.tsx` — swipe
- Se `isTransfer` ou sem `onSwipeDelete` → render atual (sem `Swipeable`).
- Senão → `<ReanimatedSwipeable renderRightActions={…} onSwipeableOpen={(dir) => dir === 'right' && onSwipeDelete()} friction={2} rightThreshold={40} ref={…}>` envolvendo o conteúdo da linha. `renderRightActions` = `View` vermelho (`bg` `rgba(248,113,113,0.18)`) com `Trash2` + "Excluir" (`negative`), largura ~88, `Pressable` → `onSwipeDelete()`.
- A tela passa `onSwipeDelete={() => requestDelete(item)}`; `requestDelete` decide: grupo → abre `delete-mode-sheet`; comum → `setPendingDelete({ tx })`.

### `delete-mode-sheet.tsx`
`Sheet` + `BottomSheetView`. Título "Excluir…". 3 `Pressable` empilhados: "Só esta" (`this`), "Esta e as próximas" (`this-and-future`), "Toda a série / parcelamento" (`all`) — rótulo e ordem iguais aos de hoje no `transaction-sheet`. Ao escolher → `onPick(mode)` + `dismiss()`. Cancelar fecha.

### `transaction-sheet.tsx`
- Bloco **"Repetir"**: tirar do `{!isEdit && …}` — passa a renderizar sempre. **"Parcelar"** fica dentro de um `{!isEdit && …}`.
- `recurring`/`interval` no `reset(tx)`: `setRecurring(tx?.recurring ?? false)`, `setInterval((tx?.interval as Interval) ?? 'MONTHLY')`.
- `save` mutation (edit): `editTransaction(tx.id, { amount, type, walletId, categoryId, description, date: toYMD(date), recurring: recurring || undefined, interval: recurring ? interval : undefined })`.
- O botão de lixeira do sheet, quando `isGroupTx`, faz `deleteModeRef.current?.present()` (o `delete-mode-sheet`) em vez do bloco inline; `onPick` → `deleteTransaction(tx.id, mode)` + fecha o sheet. Linha comum → `confirmDelete` inline como hoje.
- `haptic.success()` no `onSuccess` (antes do check); `haptic.tap()` no `present` do contexto (abrir o sheet).

---

## Testes

**`nexis` (vitest):**
- `transaction.repository.test.ts` (NEW) — `updateTransaction`: `recurring: true` sem `nextDue` → grava `nextDue = calcNextDue(date, interval)`; `recurring: true` com `interval` novo → recalcula; `recurring: false` → `nextDue: null`; sem `recurring` no payload → não mexe em `nextDue`. (mock `prisma`.)
- `transactions.$id.test.ts` — POST 200 com `recurring: true, interval: 'WEEKLY'` chama `updateTransaction` com esses campos; POST 200 com `recurring: false`; 400 `interval` inválido.

Alvo backend: +8–10 vitest.

**`nexis-mobile` (jest-expo, `--forceExit`):**
- `lib/haptics.test.ts` — mock `expo-haptics`; `tap/success/error/heavy` chamam a API certa; erro na API não propaga.
- `schemas/transaction.test.ts` (MOD) — `TransactionSchema` aceita `interval` string e `null`; `TransactionEditInput` aceita `recurring`/`interval`.
- `undo-toast.test.tsx` — `visible` mostra o label + "Desfazer"; `onUndo` chamado ao tocar (é `setState` puro no pai, sem mutation).
- `delete-mode-sheet.test.tsx` — render dos 3 modos; tocar chama `onPick` com o valor certo.
- `transaction-sheet.test.tsx` (MOD) — no **modo edição** o bloco "Repetir" aparece; "Parcelar" **não**; toggle de `recurring` reflete no `isDirty` (via estado local).
- `transactions-screen.test.tsx` (MOD) — campo de busca filtra a lista (texto some/aparece); busca sem match → "Nenhum resultado"; `pendingDelete` semeado → a linha some e o `UndoToast` aparece. **Sem** `fireEvent.press` que dispare a mutation de delete.

Alvo app: +12–16 jest (total ~160+).

**Barra:** `npx tsc --noEmit` limpo nos dois; as duas suítes verdes.

---

## Verificar no device

- `npx expo start --tunnel`, Expo Go. Backend: PR do `nexis` no ar/mergeado.
- **Busca**: digitar filtra a lista do mês por descrição/categoria/carteira; `X` limpa; combina com os filtros da Fatia 4; sem match → "Nenhum resultado".
- **Swipe**: arrastar uma linha comum pra esquerda → some, toast "Transação excluída" com barra de 5s + "Desfazer". "Desfazer" antes dos 5s → a linha volta, e o PWA **não** registra exclusão. Deixar expirar → some de vez, reflete em Carteiras/Dashboard ao focar.
- **Swipe em grupo** (parcela/recorrente) → abre o seletor de 3 modos; escolhido → toast + undo; cada modo confere no PWA (só esta / esta+futuras / toda a série).
- **Transferência** não tem swipe.
- **Haptics**: vibra ao criar/editar (sucesso), ao confirmar exclusão (erro), ao abrir o sheet (leve). (Só em device físico.)
- **Editar recorrência**: abrir uma transação → "Repetir" aparece no modo edição; ligar + escolher "Semanal" → salvar; conferir no PWA que o template ficou `recurring: true, interval: WEEKLY` e `nextDue` no futuro certo. Desligar "Repetir" numa recorrente → salvar → reabrir o app → `processDueRecurring` **não** gera mais.
- **Undo + navegação**: com um undo pendente, trocar de mês → a exclusão é efetivada na hora (sem timer órfão).
- `tsc --noEmit` limpo + jest verde nos dois.

---

## Fora de escopo (Fatia 7)

- **Re-parcelar** uma transação existente (não existe no PWA).
- **Export CSV** (continua fora).
- Busca/filtro **persistidos** entre sessões; busca em meses vizinhos (só o mês carregado).
- **Undo real no servidor** (soft-undelete) — o "desfazer" é só o adiamento de 5s da chamada.
- Swipe pra outras ações (editar, duplicar); swipe pra direita.
- Haptics no PWA (já tem `use-haptic`).
- Notificações / push (fatia futura, precisa de dev build pra push remoto).

---

## Riscos / pontos de atenção

- **`expo-haptics` no Expo Go** — módulo Expo suportado; só vibra em device físico (simulador iOS ignora). Falha silenciosa no hook.
- **`ReanimatedSwipeable` dentro de `SectionList`** — fechar o swipe aberto ao rolar / ao abrir outro (`ref` + `close()`); reanimated 4.5 + gesture-handler 2.32 são as versões do SDK 57. O root já tem `GestureHandlerRootView`.
- **`pendingDelete` órfão** — timer tem que ser drenado no cleanup do `useEffect`, na troca de mês, e ao surgir um novo `pendingDelete`. Se o app for pro background durante os 5s, ao voltar o timer do JS pode ter sido pausado — aceitável (a exclusão fica pendente até o timer completar ou o usuário sair da tela → drena).
- **Editar `recurring` numa ocorrência filha** — mexe só na linha aberta, não na série. Documentado; espelha o PWA. O caminho garantido de parar a série é o delete `?mode=all`.
- **`updateTransaction` recalculando `nextDue`** — muda o comportamento observável do PWA (passa a recalcular ao trocar intervalo). Sem testes de `updateTransaction` hoje → a Fatia 7 adiciona. Conferir `npx vitest run` inteiro.
- **Busca client-side só sobre o mês** — igual ao PWA; aceitável.
- **Toast sobre a `SectionList`** — `position: absolute` dentro do container da tela; garantir que não bloqueia o scroll (`pointerEvents` só no toast, não num overlay full-screen).

---

## A confirmar no plano (não bloqueiam o spec)

- `ReanimatedSwipeable` (novo) vs `Swipeable` (legado) de `react-native-gesture-handler` — checar qual está estável na 2.32 do SDK 57.
- Toast: barra de progresso (`Animated` width) vs. só um contador numérico "5…4…3".
- Extrair o seletor de modo já resolvendo o `deleteTransaction` internamente vs. só devolver o `mode` via `onPick` (proposto: só `onPick`, a tela/sheet decide).
- `heavy` haptic em algum lugar (ex.: long-press) ou deixar o hook completo mas usar só `tap/success/error`.
- Posição do campo de busca: fixo acima da lista (proposto) vs. dentro da barra de filtros colapsável.
