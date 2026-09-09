# Nexis Mobile — Fatia 9 (Tela de detalhe da carteira) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tocar num card de carteira abre `/wallets/[id]` — tela empilhada com o saldo (tratado como herói), o movimento do mês daquela carteira e a lista das transações dela, com navegação de mês. Editar/transferir viram botões no detalhe. Sem backend, sem dep nova.

**Architecture:** Só app. Restrutura `wallets.tsx` → `wallets/index.tsx` + novo `wallets/[id].tsx`; `<Tabs.Screen name="wallets/[id]" options={{ href: null }} />` no `_layout` (padrão do `goals`). O detalhe filtra `monthTransactionsQuery(y, m)` (cache compartilhado) por `walletId` — nenhuma rota nova. Reaproveita `TransactionRow`, `WalletSheet`, `TransferSheet`, `ScreenEnter` (F8), `useTransactionSheet`.

**Spec:** `docs/superpowers/specs/2026-09-08-nexis-mobile-slice-9-wallet-detail-design.md`

---

## Design pass (skill: frontend-design)

O app já tem identidade travada (dark, tokens em `src/theme/colors.ts`, `tabular-nums` no dinheiro, `rounded-2xl`, Lucide, referência Nubank + Stripe + Linear). Esta fatia **segue** essa identidade — não é greenfield. O trabalho de design é dar **hierarquia e especificidade** a "uma carteira ao longo do tempo", evitando o default "header genérico + lista".

**Token system (herdado, sem mudança):** `bg #09090b` · `card #18181b` · `border #27272a` · `fg #fafafa` · `muted #71717a` · `accent #60a5fa` · `positive #34d399` · `negative #f87171`. Fonte do sistema; `tabularNums` em todo valor.

**Decisões de design (específicas desta tela):**
- **Herói = o saldo, na cor da própria carteira** (`wallet.color ?? accent`), não no `fg` genérico. Logo abaixo, **o movimento líquido do mês** como sinal direcional: `▲ R$ 320,00 em setembro` (verde) ou `▼ R$ 90,00 em setembro` (vermelho). É informação subject-específica ("quanto essa conta mexeu neste mês"), não "número grande + rótulo neutro".
- **Crédito**: herói = `fmtBRL(fatura)` + rótulo "fatura atual" + um **medidor fino** `fatura/limite` (reusa o padrão de barra colorida dos Orçamentos/Metas — verde→amarelo→laranja→vermelho por faixa). O medidor encoda o uso do limite estruturalmente.
- **Entradas / Saídas do mês**: mantém o par de `SummaryCard` (padrão já usado em Dashboard e Transações — quebrar aqui seria *inconsistência*), mas **secundário**, abaixo do herói, sem competir com ele.
- **Um único momento de movimento**: só o `<ScreenEnter>` na montagem. Nada de fade-slide por seção, nada de transição em cada card.
- **Sem chrome de template**: sem eyebrow ALL-CAPS, sem `WORD — fragmento`, sem `→` em botão. "Editar" / "Transferir" em sentence case, o que a ação faz.
- **Copy**: vazio = "Sem movimentações em <mês>" + uma direção ("Toque em ＋ para registrar"). "Movimentações", não "transações" repetido.

**Wireframe:**
```
 ‹      Nubank
        Conta corrente
 ┌─────────────────────────────┐
 │  R$ 1.500,00                 │   ← saldo, na cor da carteira, text-4xl bold
 │  ▲ R$ 320,00 em setembro     │   ← movimento do mês, verde/vermelho, text-xs
 └─────────────────────────────┘
 [ Editar ]  [ Transferir ]          ← só ícone+label, bg-card, pill
 ┌────────────┐ ┌────────────┐
 │ Entradas   │ │ Saídas     │        ← par SummaryCard, secundário
 │ R$ 1.200   │ │ R$ 880     │
 └────────────┘ └────────────┘
   ‹   setembro 2026   ›               ← nav de mês (padrão transactions.tsx)
 ───────────────────────────
 Hoje
   • Salário            + R$ 1.000
   • Mercado            −  R$ 50
 qua, 03 set
   • Transferência ↔    −  R$ 300
```
(crédito troca o bloco do herói por: `R$ 300,00` / "fatura atual · de R$ 2.000 · 15%" / medidor fino)

**Review contra o default:** um "header + big number + 2 cards + lista" seria o genérico. O que torna esta tela específica: (1) o saldo na cor da carteira, (2) o delta direcional do mês logo abaixo (não um rótulo neutro), (3) o medidor de limite pra crédito. O resto fica quieto e consistente com as 8 fatias anteriores — a ousadia gasta num lugar só (o herói).

---

## Global Constraints

- **Um repo.** Tudo no `nexis-mobile` (`/home/welbertbarbosa/projects/personal/nexis-mobile`). Branch `feat/mobile-slice-9-wallet-detail` de `origin/main`.
- **Sem backend, sem dep nova.** Filtro client-side sobre `['transactions', y, m]`.
- **`href: null`** pra `wallets/[id]` (mesmo padrão do `goals`); `<ScreenEnter>` dá o fade. Refactor Stack-sobre-Tabs segue anotado como futuro.
- **Mini-resumo inclui `isTransfer`** — decisão deliberada (fluxo real da carteira), diferente da tela geral de Transações. Comentar no código.
- **App UI** só de `#/tw` / `#/tw/image`. Exceções já em uso + `useLocalSearchParams`/`useRouter` de `expo-router`.
- **Testes** — mock `expo-router` (`useFocusEffect`, `useRouter`, `useLocalSearchParams`), `#/tw`, `lucide-react-native`, `react-native-safe-area-context`, `#/api/*`, `#/components/ui/sheet`, sheets → `() => null`, `#/components/ui/screen-enter` (children passthrough), `#/components/transactions/transaction-sheet-context`. Sem `.test.tsx` sob `src/app/`. Sem `fireEvent.press` que dispare `useMutation` + `waitFor`.
- **`nexis-mobile` sem prettier/eslint** — estilo na mão (sem `;`, aspas simples, 2 espaços). Barra por task: `npx tsc --noEmit` limpo + jest verde (`--forceExit`).
- **Commits** — pt-BR, escopo da task. `gh` em `~/.local/bin/gh`, autenticado.

---

## File Structure

- `src/app/(app)/wallets.tsx` — RENAME → `src/app/(app)/wallets/index.tsx` (MOD: tap → `router.push`; remove `WalletSheet`/`openEdit`/`editing`/`walletRef`).
- `src/app/(app)/wallets/[id].tsx` — NEW.
- `src/app/(app)/_layout.tsx` — MOD: `+ <Tabs.Screen name="wallets/[id]" options={{ href: null }} />`.
- `src/app/(app)/transactions.tsx` — MOD: `export function SummaryCard`; `import { groupByDay } from '#/lib/tx-group'` (remove a local).
- `src/lib/tx-group.ts` + `src/lib/tx-group.test.ts` — NEW (extrai `groupByDay` + type `Section`).
- `src/__tests__/wallets-screen.test.tsx` — MOD (import path + mock `useRouter`).
- `src/__tests__/wallet-detail-screen.test.tsx` — NEW.

---

## Task 1: restrutura das rotas + extrações

**Files:** rename `wallets.tsx`→`wallets/index.tsx`; new `src/lib/tx-group.ts` (+ test); mod `transactions.tsx`, `_layout.tsx`, `wallets/index.tsx`, `wallets-screen.test.tsx`

- [ ] **Step 1: Setup** — `cd .../nexis-mobile && git fetch origin -q && git checkout -b feat/mobile-slice-9-wallet-detail origin/main`

- [ ] **Step 2: `src/lib/tx-group.ts`** — mover de `transactions.tsx`:
  ```ts
  import { fmtDayGroup } from '#/lib/format'
  import type { Transaction } from '#/schemas/transaction'
  export type Section = { title: string; data: Transaction[] }
  export function groupByDay(txs: Transaction[]): Section[] { /* corpo atual, idêntico */ }
  ```
  `src/lib/tx-group.test.ts` — agrupa por dia (chave `Y-M-D`), título via `fmtDayGroup` (usar datas relativas: hoje → "Hoje", ontem → "Ontem"), preserva a ordem de entrada.

- [ ] **Step 3: `transactions.tsx`** — remover a `function groupByDay` + `type Section` locais; `import { groupByDay } from '#/lib/tx-group'`. Trocar `function SummaryCard(` por `export function SummaryCard(`.

- [ ] **Step 4: mover `wallets.tsx` → `wallets/index.tsx`**
  ```bash
  mkdir -p "src/app/(app)/wallets"
  git mv "src/app/(app)/wallets.tsx" "src/app/(app)/wallets/index.tsx"
  ```
  Em `wallets/index.tsx`: `import { useRouter } from 'expo-router'`; `const router = useRouter()`. Remover `editing`/`setEditing`/`walletRef`/`openEdit`/`<WalletSheet .../>` e o import do `WalletSheet`. Trocar `onPress={() => openEdit(w)}` por
  `onPress={() => router.push({ pathname: '/wallets/[id]', params: { id: w.id } })}`. `<TransferSheet>` **fica**.

- [ ] **Step 5: `_layout.tsx`** — depois do `<Tabs.Screen name="goals" ... />`:
  `<Tabs.Screen name="wallets/[id]" options={{ href: null }} />`

- [ ] **Step 6: `wallets-screen.test.tsx`** — `import Wallets from '#/app/(app)/wallets/index'`; trocar o mock do `expo-router` por `() => ({ useFocusEffect: () => {}, useRouter: () => ({ push: jest.fn() }) })`; remover o `jest.mock('#/components/wallets/wallet-sheet', ...)` (não é mais importado). Casos existentes seguem.

- [ ] **Step 7: Verificar** — `npx jest --forceExit src/__tests__/wallets-screen.test.tsx src/lib/tx-group.test.ts src/__tests__/transactions-screen.test.tsx && npx tsc --noEmit`.

- [ ] **Step 8: Commit** — `git commit -m "refactor: wallets vira wallets/index; extrai groupByDay; exporta SummaryCard"`

---

## Task 2: `wallets/[id].tsx` — tela de detalhe

**Files:** New `src/app/(app)/wallets/[id].tsx`, `src/__tests__/wallet-detail-screen.test.tsx`

**Interfaces:** rota `/wallets/[id]` (empilhada). Consome `walletsQuery`, `monthTransactionsQuery`, `maxDateQuery`, `useTransactionSheet().openEdit`.

- [ ] **Step 1: Implementar** — seguir o wireframe do Design pass e o esqueleto do spec §`wallets/[id].tsx`. Pontos:
  - `const { id } = useLocalSearchParams<{ id: string }>()`. `const wallet = wallets.find((w) => w.id === id)`.
  - `useEffect(() => { if (!walletsLoading && id && !wallet) router.back() }, [walletsLoading, id, wallet, router])`. `if (!wallet) return null`.
  - **Herói (não-crédito)**: `Text` `text-4xl font-bold` `style={[tabularNums, { color: wallet.color ?? colors.accent }]}` = `fmtBRL(wallet.balance)`; abaixo `Text text-xs` com `▲`/`▼` + `fmtBRL(|net|)` + ` em ${MONTHS[month-1]}` na cor `net >= 0 ? positive : negative` (`net` = soma de `walletTxs`, `INCOME` positivo, `EXPENSE` negativo, **incluindo `isTransfer`**).
  - **Herói (crédito)**: `invoice = Math.abs(Math.min(wallet.balance, 0))`; `Text text-4xl font-bold` `fmtBRL(invoice)` (cor `invoice > 0 ? negative : fg`); `Text text-xs text-muted` "fatura atual" + (se `creditLimit`) ` · de ${fmtBRL(creditLimit)} · ${pct}%`; **medidor**: `View h-1.5 rounded-full bg-border` + preenchimento `min(invoice/limit*100,100)%` cor por faixa (`budgetBarColor` de `#/lib/analytics-calcs` — reuso).
  - **Ações**: `flex-row gap-3` — `Pressable` "Editar" (`Pencil` 14 + label, `bg-card rounded-full px-4 py-2`) → `walletSheetRef.current?.present()`; `Pressable` "Transferir" (`ArrowLeftRight` 14 + label) → `transferSheetRef.current?.present()`, **só se `wallets.length >= 2`**.
  - **Mini-resumo**: `<View className="flex-row gap-3"><SummaryCard label="Entradas" value={income} kind="in" loading={cold} /><SummaryCard label="Saídas" value={expenses} kind="out" loading={cold} /></View>` (import `{ SummaryCard }` de `#/app/(app)/transactions`). `income`/`expenses` somam `walletTxs` **incluindo `isTransfer`**.
  - **Nav de mês**: copiar `canGoNext`/`shift` de `transactions.tsx` (com `maxDateQuery`, fallback 24 meses). `shift` faz só `setYM` (sem `flushPending` — não há delete pendente aqui).
  - **Lista**: `<SectionList sections={groupByDay(walletTxs)} keyExtractor={(t) => t.id} renderItem={({ item }) => <TransactionRow tx={item} onPress={item.isTransfer ? undefined : () => openEdit(item)} />} renderSectionHeader={...} ListEmptyComponent={<EmptyWalletMonth month={MONTHS[month-1]} />} refreshControl={...} />`. `cold = txq.isLoading && !txq.data`.
  - Fora da `SectionList`, no fim: `<WalletSheet ref={walletSheetRef} wallet={wallet} onClose={() => {}} />` e `<TransferSheet ref={transferSheetRef} wallets={wallets} />`.
  - Tudo dentro de `<ScreenEnter>`. `useFocusEffect` invalida `['wallets']` + `['transactions', year, month]`.
  - `MONTHS` = copiar o array de `transactions.tsx` (nomes por extenso).
  - `EmptyWalletMonth({ month })` → `View` card: "Sem movimentações em {month}" + "Toque em ＋ para registrar".

- [ ] **Step 2: `wallet-detail-screen.test.tsx`** — mocks (ver §Testes do spec). Semear:
  - `qc.setQueryData(['wallets'], [W1])` (W1 = CHECKING, id `w1`, name `Nubank`, balance 1500, color `#8b5cf6`), e um W2 pra transfer.
  - `qc.setQueryData(['transactions', Y, M], [TX_W1_INCOME, TX_W2_EXPENSE])`.
  - `qc.setQueryData(['transactions-max-date'], null)`.
  Casos:
  - header mostra "Nubank" e "R$ 1.500,00".
  - "Entradas" e "Saídas" presentes.
  - a linha da tx de `w1` aparece; a de `w2` **não**.
  - `['transactions', Y, M]` = `[]` → "Sem movimentações em <mês>".
  - `['wallets']` = `[]` (e não loading) → `back()` chamado.

- [ ] **Step 3: Verificar** — `npx jest --forceExit src/__tests__/wallet-detail-screen.test.tsx && npx tsc --noEmit`.

- [ ] **Step 4: Commit** — `git commit -m "feat: tela de detalhe da carteira (/wallets/[id])"`

---

## Task 3: suíte, checklist, PR

- [ ] **Step 1** — `npx tsc --noEmit && npx jest --forceExit`. Tudo verde (~183+).

- [ ] **Step 2: Checklist de device** (usuário — `npx expo start --tunnel`):
  - [ ] Tocar num card de carteira → abre o detalhe com fade; `‹` volta.
  - [ ] Herói: saldo na cor da carteira + `▲/▼ R$ X em <mês>` (verde/vermelho). Crédito: "fatura atual" + medidor de limite.
  - [ ] "Editar" abre o `WalletSheet` da carteira; salvar → nome/saldo atualizam ao voltar. Excluir → a tela volta pra lista sozinha.
  - [ ] "Transferir" abre o `TransferSheet` (some com só 1 carteira); transferir → aparece na lista da carteira e o saldo muda.
  - [ ] Entradas/Saídas batem com as txs da carteira no mês (transferências **contam**).
  - [ ] Lista só da carteira; nav de mês `‹ ›` funciona; tocar numa linha abre o sheet de transação.
  - [ ] Mês sem movimento → "Sem movimentações em <mês>".
  - [ ] `tsc` limpo + jest verde.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/mobile-slice-9-wallet-detail
gh pr create --repo Welbert-Soares/nexis-mobile --base main \
  --title "feat: Fatia 9 — tela de detalhe da carteira" \
  --body "Tocar num card de carteira abre /wallets/[id] (empilhada): saldo na cor da carteira como herói + movimento líquido do mês (▲/▼), mini-resumo Entradas/Saídas (inclui transferências), lista das transações da carteira com nav de mês, botões Editar/Transferir. Sem backend — filtra o mês em cache por walletId. Restrutura: wallets.tsx → wallets/index.tsx + wallets/[id].tsx. Spec/plano: nexis.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Rollback

- Reverter o PR desfaz a restrutura (`wallets/index.tsx` → `wallets.tsx`) e tira a tela de detalhe + `src/lib/tx-group.ts`. O `SummaryCard` volta a ser não-exportado.
