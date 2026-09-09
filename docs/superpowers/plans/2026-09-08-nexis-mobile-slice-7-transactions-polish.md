# Nexis Mobile — Fatia 7 (Polish de Transações) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o backlog de polish da tela **Transações** do `nexis-mobile`: busca por descrição/categoria/carteira, swipe-to-delete com toast "Desfazer" de 5s, haptics, e editar a config de recorrência de uma transação existente.

**Architecture:** Backend aditivo — `POST /api/mobile/transactions/$id` reganha `recurring`/`interval` (removidos de propósito na Fatia 3); `updateTransaction` (repo) passa a recalcular/limpar `nextDue`. App — dep nova `expo-haptics` + hook; campo de busca client-side na tela; `pendingDelete` na tela adia a chamada `DELETE` 5s; `ReanimatedSwipeable` na linha; seletor de 3 modos de exclusão extraído do `transaction-sheet` pra um sheet reusável; bloco "Repetir" passa a aparecer no modo edição.

**Tech Stack:** TanStack Start + Prisma + zod + vitest (nexis); Expo Router + NativeWind/react-native-css + TanStack Query + zod + jest-expo (nexis-mobile). Dep nova no app: `expo-haptics` (Expo Go OK). `react-native-gesture-handler` / `react-native-reanimated` já são deps.

**Spec:** `docs/superpowers/specs/2026-09-08-nexis-mobile-slice-7-transactions-polish-design.md`

## Global Constraints

- **Dois repos.** Tasks 1–2 no `nexis` (`/home/welbertbarbosa/projects/personal/nexis`). Tasks 3–10 no `nexis-mobile` (`/home/welbertbarbosa/projects/personal/nexis-mobile`).
- **Branch.** `nexis`: `feat/mobile-slice-7-tx-polish-backend` de `origin/main`. `nexis-mobile`: `feat/mobile-slice-7-tx-polish` de `origin/main`.
- **Rotas mobile aditivas** — `auth.api.getSession` → 401; body `zod.safeParse` → 400 `{ error }`; `Error` do repo → 404 `{ error }`.
- **`updateTransaction`** — a mudança do `nextDue` NÃO pode quebrar o comportamento observável do PWA além do previsto (recalcular ao trocar intervalo). `npx vitest run` inteiro tem que ficar verde.
- **Undo** — o `DELETE` só vai ao servidor **após os 5s**; "Desfazer" nunca chama o servidor. Um `pendingDelete` por vez; ao surgir outro / trocar de mês / desmontar → drena o anterior na hora.
- **Swipe** — transferências (`isTransfer`) NÃO têm swipe. Um swipe aberto por vez.
- **App UI** só de `#/tw` / `#/tw/image`. Exceções já em uso + `expo-haptics`, `react-native-gesture-handler` (`ReanimatedSwipeable`).
- **Testes de tela mobile** — sem `fireEvent.press` que dispare `useMutation` + `waitFor` (trava o RNTL v13). Mockar `#/tw`, `lucide-react-native` (objeto plano), `expo-router`, `react-native-safe-area-context`, `#/components/ui/sheet`, `#/api/*`, `expo-haptics`, `react-native-gesture-handler`.
- **`nexis-mobile` sem prettier/eslint** — estilo na mão (sem `;`, aspas simples, 2 espaços). Barra: `npx tsc --noEmit` limpo + jest verde (`--forceExit`).
- **routeTree** — regenerar após tocar rota no `nexis`:
  `node -e "const {Generator,getConfig}=require('@tanstack/router-generator');new Generator({config:getConfig({},process.cwd()),root:process.cwd()}).run()"`
- **Commits** — pt-BR, escopo da task, terminar cada task com commit. `gh` CLI em `~/.local/bin/gh`, autenticado.

---

## File Structure

**nexis (backend):**
- `src/server/repositories/transaction.repository.ts` — MOD: `updateTransaction` calcula/limpa `nextDue`.
- `src/server/repositories/transaction.repository.test.ts` — NEW.
- `src/routes/api/mobile/transactions.$id.ts` — MOD: `editBody` += `recurring`/`interval`.
- `src/routes/api/mobile/transactions.$id.test.ts` — MOD: casos de recorrência no edit.

**nexis-mobile (app):**
- `package.json` — MOD: `expo-haptics`.
- `src/lib/haptics.ts` + `src/lib/haptics.test.ts` — NEW.
- `src/schemas/transaction.ts` + `src/schemas/transaction.test.ts` — MOD.
- `src/components/ui/undo-toast.tsx` + `src/__tests__/undo-toast.test.tsx` — NEW.
- `src/components/transactions/delete-mode-sheet.tsx` + `src/__tests__/delete-mode-sheet.test.tsx` — NEW.
- `src/components/transactions/transaction-sheet.tsx` + `src/__tests__/transaction-sheet.test.tsx` — MOD.
- `src/components/transactions/transaction-row.tsx` — MOD.
- `src/app/(app)/transactions.tsx` + `src/__tests__/transactions-screen.test.tsx` — MOD.

---

## Task 1: `nexis` — `updateTransaction` calcula/limpa `nextDue`

**Repo:** `nexis`

**Files:**
- Modify: `src/server/repositories/transaction.repository.ts`
- New: `src/server/repositories/transaction.repository.test.ts`

**Interfaces:**
- `updateTransaction(id, userId, data)` — `data` agora: quando `data.recurring === true` e `data.nextDue === undefined`, grava `data.nextDue = calcNextDue(data.date ?? old.date, data.interval ?? old.interval ?? 'MONTHLY')`; quando `data.recurring === false`, grava `data.nextDue = null`. O tipo de `data.nextDue` passa a `Date | null | undefined`.

- [ ] **Step 1: Setup**

```bash
cd /home/welbertbarbosa/projects/personal/nexis
git fetch origin -q && git checkout -b feat/mobile-slice-7-tx-polish-backend origin/main
```

- [ ] **Step 2: Teste que falha** (`transaction.repository.test.ts`, `vi.mock('#/db')` + mock de `calcNextDue`? — `calcNextDue` é do mesmo módulo, então **não** mockar; usar datas reais e conferir o dia). Casos, mockando `prisma.transaction.findFirst` (o `old`) e `prisma.transaction.update`:
  - `recurring: true` sem `nextDue`, `interval: 'WEEKLY'`, `date: 2026-09-10` → `update` recebe `nextDue` = 2026-09-17.
  - `recurring: true`, `interval` novo `'MONTHLY'`, sem `date` (usa `old.date` = 2026-09-10) → `nextDue` = 2026-10-10.
  - `recurring: false` → `update` recebe `nextDue: null`.
  - payload sem a chave `recurring` → `update` **não** recebe `nextDue`.
  - `recurring: true` **com** `nextDue` explícito → respeita o explícito (não recalcula).

- [ ] **Step 3: Implementar** — em `updateTransaction`, depois do `const old = await prisma.transaction.findFirst(...)` / `if (!old) throw`, antes do `prisma.transaction.update`:
  ```ts
  if (data.recurring === true && data.nextDue === undefined) {
    const base = data.date ?? old.date
    data.nextDue = calcNextDue(base, data.interval ?? (old.interval as RecurrenceInterval | null) ?? 'MONTHLY')
  }
  if (data.recurring === false) {
    data.nextDue = null
  }
  ```
  Ajustar a assinatura de `data` pra `nextDue?: Date | null` e garantir que o objeto do `prisma.transaction.update({ data: { ... } })` inclua `nextDue`/`recurring`/`interval` quando presentes (checar o mapeamento atual do `update`).

- [ ] **Step 4: Verificar** — `npx vitest run && npx tsc --noEmit`. Suíte inteira verde.

- [ ] **Step 5: Commit** — `git commit -m "feat: updateTransaction recalcula/limpa nextDue na edição"`

---

## Task 2: `nexis` — `POST /api/mobile/transactions/$id` reganha `recurring`/`interval`

**Repo:** `nexis`

**Files:**
- Modify: `src/routes/api/mobile/transactions.$id.ts`, `src/routes/api/mobile/transactions.$id.test.ts`

**Interfaces:**
- `POST /api/mobile/transactions/$id` body += `recurring: z.boolean().optional()`, `interval: z.enum(['WEEKLY','BIWEEKLY','MONTHLY','YEARLY']).optional()`. Handler passa adiante pro `updateTransaction` (não manda `nextDue`).

- [ ] **Step 1: Teste que falha** — em `transactions.$id.test.ts`:
  - POST 200 com `{ amount, type, recurring: true, interval: 'WEEKLY' }` → `updateTransaction` chamado com `recurring: true, interval: 'WEEKLY'` no objeto.
  - POST 200 com `{ ..., recurring: false }` → objeto tem `recurring: false`.
  - POST 400 com `interval: 'DAILY'` (fora do enum).
  - Os casos existentes continuam passando.

- [ ] **Step 2: Implementar** — adicionar as 2 chaves ao `editBody`; no handler, `recurring`/`interval` já entram em `...rest` (conferir o destructuring — hoje é `const { date, ...rest } = parsed.data`).

- [ ] **Step 3: Regen routeTree + verificar** — `node -e "…Generator…"` (a rota já existe; o diff deve ser vazio ou mínimo) && `npx vitest run && npx tsc --noEmit`.

- [ ] **Step 4: Commit + PR**

```bash
git add -A && git commit -m "feat: POST /api/mobile/transactions/\$id aceita recurring/interval"
git push -u origin feat/mobile-slice-7-tx-polish-backend
gh pr create --repo Welbert-Soares/nexis --base main \
  --title "feat: editar recorrência via /api/mobile/transactions/\$id (Fatia 7)" \
  --body "Fatia 7 do Nexis Mobile — backend. O POST /api/mobile/transactions/\$id reganha recurring/interval (a Fatia 3 tinha removido). updateTransaction (repo) passa a recalcular nextDue quando liga/troca o intervalo e limpar quando desliga. Spec: docs/superpowers/specs/2026-09-08-nexis-mobile-slice-7-transactions-polish-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Task 3: `nexis-mobile` — `expo-haptics` + `useHaptic()`

**Repo:** `nexis-mobile`

**Files:**
- Modify: `package.json`, `package-lock.json`
- New: `src/lib/haptics.ts`, `src/lib/haptics.test.ts`

- [ ] **Step 1: Setup** — `cd .../nexis-mobile && git fetch origin -q && git checkout -b feat/mobile-slice-7-tx-polish origin/main`

- [ ] **Step 2: Instalar** — `npx expo install expo-haptics` (versão do SDK 57). Conferir o diff do `package.json` (só `expo-haptics`).

- [ ] **Step 3: `src/lib/haptics.ts`** (ver spec §App):
  ```ts
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

- [ ] **Step 4: `haptics.test.ts`** — `jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined), notificationAsync: jest.fn().mockResolvedValue(undefined), impactAsync: jest.fn().mockResolvedValue(undefined), NotificationFeedbackType: { Success: 'S', Error: 'E' }, ImpactFeedbackStyle: { Medium: 'M' } }))`. Casos: `useHaptic().tap()` chama `selectionAsync`; `success`/`error` chamam `notificationAsync` com o tipo certo; `heavy` chama `impactAsync`; se a API rejeita, `error()` não lança.

- [ ] **Step 5: Verificar** — `npx jest --forceExit src/lib/haptics.test.ts && npx tsc --noEmit`.

- [ ] **Step 6: Commit** — `git commit -m "feat: expo-haptics + useHaptic()"`

---

## Task 4: `nexis-mobile` — schema `transaction` (+ interval, + recurring/interval no EditInput)

**Repo:** `nexis-mobile`

**Files:** Modify `src/schemas/transaction.ts`, `src/schemas/transaction.test.ts`

- [ ] **Step 1: Testes que falham** — `TransactionSchema.parse` aceita `interval: 'WEEKLY'` e `interval: null`; `TransactionEditInput.parse` aceita `recurring`/`interval`; rejeita `interval` fora do enum.

- [ ] **Step 2: Implementar** — `TransactionSchema` += `interval: z.enum(['WEEKLY','BIWEEKLY','MONTHLY','YEARLY']).nullable()`. `TransactionEditInput` += `recurring: z.boolean().optional()`, `interval: z.enum([...]).optional()`. Exportar `TransactionEditData` (já existe).

- [ ] **Step 3: Verificar** — jest do arquivo + `tsc` (o `src/api/transactions.ts` `editTransaction` já é genérico; só o tipo do `body` muda — conferir que compila).

- [ ] **Step 4: Commit** — `git commit -m "feat: interval no TransactionSchema + recurring/interval no EditInput"`

---

## Task 5: `nexis-mobile` — `undo-toast.tsx`

**Repo:** `nexis-mobile`

**Files:** New `src/components/ui/undo-toast.tsx`, `src/__tests__/undo-toast.test.tsx`

**Interfaces:** `UndoToast({ visible, label, onUndo }: { visible: boolean; label: string; onUndo: () => void })`.

- [ ] **Step 1: Implementar** — `if (!visible) return null`. `View` `position:'absolute'`, `left:12, right:12, bottom:12`, `bg-card`, `border border-border`, `rounded-2xl`, sombra, `flex-row items-center justify-between px-4 py-3`. Esquerda: `Text text-sm text-fg` `{label}`. Direita: `Pressable onPress={onUndo}` → `Text text-sm font-semibold` `style={{ color: colors.accent }}` "Desfazer". Barra de progresso: `Animated.View` `height:2` no rodapé do toast, `width` animada de `'100%'` → `'0%'` em 5000ms (reinicia quando `visible` vira true — `useEffect([visible])`). `pointerEvents` padrão (o toast é pequeno, não cobre a lista).

- [ ] **Step 2: Teste** — `undo-toast.test.tsx`: `visible={false}` → nada; `visible` → `label` e "Desfazer" presentes; `fireEvent.press` em "Desfazer" → `onUndo` chamado (é callback puro, sem mutation). Mock `#/tw`, `lucide` (nenhum ícone usado — ok), sem mais nada.

- [ ] **Step 3: Verificar** — jest + `tsc`.

- [ ] **Step 4: Commit** — `git commit -m "feat: undo-toast"`

---

## Task 6: `nexis-mobile` — `delete-mode-sheet.tsx` (extraído do transaction-sheet)

**Repo:** `nexis-mobile`

**Files:** New `src/components/transactions/delete-mode-sheet.tsx`, `src/__tests__/delete-mode-sheet.test.tsx`

**Interfaces:** `DeleteModeSheet` — `forwardRef<SheetRef, { onPick: (mode: 'this' | 'this-and-future' | 'all') => void; onClose?: () => void }>`.

- [ ] **Step 1: Implementar** — copiar o markup do seletor de 3 modos que hoje vive no `transaction-sheet.tsx` (procurar `this-and-future`). `Sheet` + `BottomSheetView`, `contentContainerStyle`/padding padrão dos outros sheets. Título "Excluir…". 3 `Pressable` empilhados (`gap-2`), cada um `rounded-xl border border-border py-3 px-4`, `Text` centralizado: "Só esta" / "Esta e as próximas" / "Toda a série / parcelamento". `onPress` → `onPick(mode)` + `dismiss()`. Um "Cancelar" discreto embaixo (fecha).

- [ ] **Step 2: Teste** — render dos 3 rótulos; `fireEvent.press` num deles → `onPick` com o `mode` correto (callback puro). Mocks: `#/tw`, `#/components/ui/sheet` (children passthrough + `BottomSheetView`), `lucide` se usado.

- [ ] **Step 3: Verificar** — jest + `tsc`.

- [ ] **Step 4: Commit** — `git commit -m "feat: delete-mode-sheet (seletor de 3 modos extraído)"`

---

## Task 7: `nexis-mobile` — `transaction-sheet`: "Repetir" no edit + delete-mode-sheet + haptics

**Repo:** `nexis-mobile`

**Files:** Modify `src/components/transactions/transaction-sheet.tsx`, `src/__tests__/transaction-sheet.test.tsx`

- [ ] **Step 1: Bloco "Repetir" no modo edição** — tirar o bloco "Repetir" de dentro do `{!isEdit && (…)}` (deixar só "Parcelar" gated por `!isEdit`). Estrutura: um wrapper que sempre mostra "Repetir"; dentro de `!isEdit`, também "Parcelar".
- [ ] **Step 2: `reset(tx)`** — `setRecurring(tx?.recurring ?? false)`, `setInterval(((tx?.interval as Interval) ?? 'MONTHLY'))`. Zerar `parceling` sempre.
- [ ] **Step 3: `save` mutation (edit)** — `editTransaction(tx!.id, { amount, type, walletId, categoryId, description, date: toYMD(date), recurring: recurring || undefined, interval: recurring ? interval : undefined })`.
- [ ] **Step 4: `isDirty`** — += `recurring !== (tx?.recurring ?? false)` e `(recurring && interval !== ((tx?.interval as Interval) ?? 'MONTHLY'))`.
- [ ] **Step 5: delete-mode-sheet** — importar `DeleteModeSheet` + `type SheetRef`; `const deleteModeRef = useRef<SheetRef>(null)`. O botão de lixeira do sheet: se `isGroupTx` → `deleteModeRef.current?.present()` (em vez do bloco inline de 3 modos); senão → `confirmDelete` inline como hoje. Renderizar `<DeleteModeSheet ref={deleteModeRef} onPick={(mode) => { del.mutate(mode) ; /* ou */ deleteTransaction(tx!.id, mode)… }} />` no fim. **Remover** o markup inline do seletor de 3 modos (foi pro componente).
- [ ] **Step 6: haptics** — `const haptic = useHaptic()`; `haptic.success()` no `onSuccess` da `save` (antes do `setSaved`); `haptic.error()` no `onSuccess` da mutation de delete.
- [ ] **Step 7: Teste (MOD)** — no **modo edição** (`tx` setado, não-grupo): o bloco "Repetir" aparece, "Parcelar" **não**; título "Editar transação". Toggle de `recurring` (só `setState`) reflete em algum texto visível (ex.: o hint do intervalo). Mock `#/lib/haptics` (`useHaptic: () => ({ tap: jest.fn(), success: jest.fn(), error: jest.fn(), heavy: jest.fn() })`), `#/components/transactions/delete-mode-sheet` (`() => null`).
- [ ] **Step 8: Verificar** — jest do arquivo + `tsc`.
- [ ] **Step 9: Commit** — `git commit -m "feat: editar recorrência no transaction-sheet + delete-mode-sheet + haptics"`

---

## Task 8: `nexis-mobile` — `transaction-row`: swipe-to-delete

**Repo:** `nexis-mobile`

**Files:** Modify `src/components/transactions/transaction-row.tsx`

**Interfaces:** `TransactionRow` += `onSwipeDelete?: () => void`. Sem `onSwipeDelete` **ou** `tx.isTransfer` → render atual (sem `Swipeable`).

- [ ] **Step 1: Implementar** — `import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'` (conferir o caminho estável na 2.32 — senão `import { Swipeable } from 'react-native-gesture-handler'`). Quando swipe habilitado, envolver o conteúdo:
  ```tsx
  <ReanimatedSwipeable
    ref={swipeRef}
    friction={2}
    rightThreshold={40}
    renderRightActions={() => (
      <Pressable
        onPress={() => { swipeRef.current?.close(); onSwipeDelete!() }}
        className="items-center justify-center"
        style={{ width: 88, backgroundColor: 'rgba(248,113,113,0.18)' }}
      >
        <Trash2 size={18} color={colors.negative} />
        <Text className="mt-1 text-[11px]" style={{ color: colors.negative }}>Excluir</Text>
      </Pressable>
    )}
    onSwipeableOpen={(dir) => { if (dir === 'right') { swipeRef.current?.close(); onSwipeDelete!() } }}
  >
    {/* linha atual */}
  </ReanimatedSwipeable>
  ```
  `const swipeRef = useRef<SwipeableMethods>(null)` (ou `any` se o tipo não resolver).
- [ ] **Step 2: Verificar** — `npx tsc --noEmit`. **Sem teste de componente** aqui (Swipeable + gesture-handler não sobe fácil no jest; a cobertura vem do teste de tela com o `react-native-gesture-handler` mockado — ver Task 9). Confirmar que os testes existentes de `transaction-row`/tela que renderizam a linha **sem** `onSwipeDelete` continuam passando (branch sem Swipeable).
- [ ] **Step 3: Commit** — `git commit -m "feat: swipe-to-delete na transaction-row"`

---

## Task 9: `nexis-mobile` — `transactions.tsx`: busca + pendingDelete + UndoToast + swipe

**Repo:** `nexis-mobile`

**Files:** Modify `src/app/(app)/transactions.tsx`, `src/__tests__/transactions-screen.test.tsx`

- [ ] **Step 1: Busca** — `const [search, setSearch] = useState('')`. Campo `View` (`bg-border`, rounded) com `Search` (16, `muted`) + `TextInput` (`placeholder="Buscar descrição, categoria, carteira"`, `value`, `onChangeText`) + `X` (`Pressable` → `setSearch('')`) quando `search !== ''`. Posição: entre os cards de resumo e o gatilho da barra de filtros.
- [ ] **Step 2: `searchedTxs`** — `const q = search.trim().toLowerCase()`; `const searchedTxs = useMemo(() => (q ? filteredTxs.filter((t) => (t.description ?? '').toLowerCase().includes(q) || (t.category?.name ?? '').toLowerCase().includes(q) || t.wallet.name.toLowerCase().includes(q)) : filteredTxs), [filteredTxs, q])`.
- [ ] **Step 3: `pendingDelete`** — `const [pendingDelete, setPendingDelete] = useState<{ tx: Transaction; mode?: 'this'|'this-and-future'|'all' } | null>(null)`. `const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)`. `const haptic = useHaptic()`. `const deleteModeRef = useRef<SheetRef>(null)`.
  - `function flush() { const p = pendingDeleteRef.current; if (!p) return; deleteTransaction(p.tx.id, p.mode); setPendingDelete(null) }` — usar um `pendingDeleteRef` (ref espelhando o state) pra o cleanup ler o valor atual.
  - `function requestDelete(tx: Transaction) { if (pendingDelete) flush(); if (tx.isInstallment || tx.recurring || tx.parentId) { setPendingTarget(tx); deleteModeRef.current?.present() } else { startPending(tx) } }`
  - `function startPending(tx, mode?) { haptic.error(); setPendingDelete({ tx, mode }); if (deleteTimer.current) clearTimeout(deleteTimer.current); deleteTimer.current = setTimeout(() => { deleteTransaction(tx.id, mode); setPendingDelete(null) }, 5000) }`
  - `function undo() { if (deleteTimer.current) clearTimeout(deleteTimer.current); setPendingDelete(null) }`
  - `useEffect(() => () => { if (deleteTimer.current) { clearTimeout(deleteTimer.current); flush() } }, [])` (drena ao desmontar).
  - Trocar de mês (`setYM`) → `flush()` antes.
- [ ] **Step 4: Lista** — `sections = useMemo(() => groupByDay(pendingDelete ? searchedTxs.filter((t) => t.id !== pendingDelete.tx.id) : searchedTxs), [searchedTxs, pendingDelete])`. `renderItem` → `<TransactionRow tx={item} onPress={() => openEdit(item)} onSwipeDelete={item.isTransfer ? undefined : () => requestDelete(item)} />`.
- [ ] **Step 5: Empty** — `q && zero` → `<EmptySearch />` (novo, "Nenhum resultado" / "Tente outros termos"); senão `hasActiveFilter` → `EmptyFiltered`; senão `EmptyState`.
- [ ] **Step 6: Toast + sheet** — no fim do JSX da tela: `<UndoToast visible={!!pendingDelete} label="Transação excluída" onUndo={undo} />` e `<DeleteModeSheet ref={deleteModeRef} onPick={(mode) => { const tx = pendingTarget; if (tx) startPending(tx, mode) }} />`.
- [ ] **Step 7: Teste (MOD)** — `transactions-screen.test.tsx`: mock `react-native-gesture-handler` (`{ ReanimatedSwipeable: ({ children }) => children, Swipeable: ({ children }) => children }` ou o que o import usar), `#/lib/haptics`, `#/components/ui/undo-toast` (render real — é simples) OU mock, `#/components/transactions/delete-mode-sheet` (`() => null`). Casos:
  - digitar no campo de busca (via `fireEvent.changeText`) filtra a lista (uma descrição some).
  - busca sem match → "Nenhum resultado".
  - semear `pendingDelete` não dá — é state interno; em vez disso, testar que o `UndoToast` **não** aparece no estado inicial e que a busca com match mostra as linhas. (O fluxo de swipe→delete→undo é validado no device.)
- [ ] **Step 8: Verificar** — jest do arquivo + `tsc`.
- [ ] **Step 9: Commit** — `git commit -m "feat: busca + swipe-to-delete com undo de 5s nas Transações"`

---

## Task 10: `nexis-mobile` — suíte completa, checklist de device, PR

**Repo:** `nexis-mobile`

- [ ] **Step 1** — `npx tsc --noEmit && npx jest --forceExit`. Tudo verde (~160+).

- [ ] **Step 2: Checklist de device** (usuário — `npx expo start --tunnel`; backend: PR do `nexis` no ar/mergeado):
  - [ ] **Busca**: filtra por descrição/categoria/carteira; `X` limpa; combina com os filtros; sem match → "Nenhum resultado".
  - [ ] **Swipe** linha comum → some + toast 5s + "Desfazer"; desfazer restaura e o PWA **não** registra exclusão; expirar → some de vez, reflete em Carteiras/Dashboard ao focar.
  - [ ] **Swipe** grupo (parcela/recorrente) → seletor de 3 modos → toast; cada modo confere no PWA.
  - [ ] **Transferência** não arrasta.
  - [ ] **Haptics** (device físico): criar/editar (sucesso), confirmar exclusão (erro), abrir o sheet (leve).
  - [ ] **Editar recorrência**: abrir uma transação → "Repetir" aparece no edit; ligar + "Semanal" → salvar → PWA mostra `recurring/interval/nextDue` certos. Desligar numa recorrente → reabrir o app → `processDueRecurring` não gera mais.
  - [ ] **Undo + trocar de mês**: com undo pendente, mudar o mês → exclusão efetivada na hora (sem timer órfão).
  - [ ] `tsc` limpo + jest verde nos dois repos.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/mobile-slice-7-tx-polish
gh pr create --repo Welbert-Soares/nexis-mobile --base main \
  --title "feat: Fatia 7 — polish de Transações (busca, swipe+undo, haptics, editar recorrência)" \
  --body "Busca client-side por descrição/categoria/carteira; swipe-to-delete com toast \"Desfazer\" de 5s (o DELETE só vai ao servidor depois dos 5s); haptics (expo-haptics); editar a recorrência de uma transação pela tela de edição (bloco \"Repetir\" no modo edit). Consome POST /api/mobile/transactions/\$id (recurring/interval — PR do nexis). Spec/plano: nexis.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Ordem de merge

1. PR do `nexis` (Tasks 1–2) primeiro.
2. PR do `nexis-mobile` (Tasks 3–10) depois, com o checklist de device.

## Rollback

- `nexis`: aditivo; a mudança do `nextDue` no `updateTransaction` reverte junto (os testes novos cobrem a equivalência).
- `nexis-mobile`: reverter o PR tira a busca, o swipe/undo, os haptics e a edição de recorrência; a dep `expo-haptics` sai junto.
