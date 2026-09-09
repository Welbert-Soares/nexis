# Nexis Mobile — Fatia 10 (Polimento geral + acessibilidade) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o `nexis-mobile` consistente e utilizável com leitor de tela, Dynamic Type e "Reduzir movimento", sem mudar nenhuma funcionalidade. Dois primitivos novos (`<Skeleton>`, `<EmptyState>`), um hook (`useReduceMotion`), e uma varredura de `accessibility*` / `hitSlop` / `maxFontSizeMultiplier` / haptics pelas telas.

**Architecture:** Só app, **sem backend, sem rota, sem dep, sem `app.json`**. `useReduceMotion()` sobre `AccessibilityInfo`. `<Skeleton>`/`<EmptyState>` em `src/components/ui/`. Haptics via o `useHaptic()` que já existe (Fatia 7). Mudanças aditivas: no modo padrão (Dynamic Type normal, movimento normal) o app fica visualmente idêntico.

**Tech Stack:** Expo Router + NativeWind/react-native-css + TanStack Query + zod + jest-expo. Nenhuma dep nova. `AccessibilityInfo`, `Animated` e `Switch` vêm de `react-native`.

**Spec:** `docs/superpowers/specs/2026-09-08-nexis-mobile-slice-10-polish-a11y-design.md`

## Global Constraints

- **Um repo.** Tudo no `nexis-mobile` (`/home/welbertbarbosa/projects/personal/nexis-mobile`). Branch `feat/mobile-slice-10-polish-a11y` de `origin/main`.
- **Zero regressão visual** no modo padrão — mesmos textos, cores, paddings. `<Skeleton>`/`<EmptyState>` replicam o que já existe inline.
- **Strings de a11y em pt-BR, inline** — sem arquivo central (poucas, contexto local).
- **App UI** só de `#/tw` / `#/tw/image`. Exceções já em uso + `AccessibilityInfo`/`Animated`/`Switch` de `react-native`.
- **`maxFontSizeMultiplier`** só nos numéricos grandes (cap **1.4**); corpo/label ficam livres.
- **Testes** — mock `AccessibilityInfo` no `jest.setup` (`isReduceMotionEnabled: () => Promise.resolve(false)`, `addEventListener: () => ({ remove(){} })`); override por teste onde precisar `true`. Mocks de sempre: `#/tw`, `lucide-react-native` (objeto plano/Proxy), `#/api/*`, `#/lib/haptics`, `#/components/ui/sheet`. `jest.mock` factory vars com prefixo `mock`. Sem `fireEvent.press` que dispare `useMutation` + `waitFor`. Sem `.test.tsx` sob `src/app/`.
- **`nexis-mobile` sem prettier/eslint** — estilo na mão (sem `;`, aspas simples, 2 espaços). Barra por task: `npx tsc --noEmit` limpo + jest verde (`--forceExit`).
- **Commits** — pt-BR, escopo da task, commit ao fim de cada task. `gh` em `~/.local/bin/gh`, autenticado.
- **Ordem de prioridade se faltar tempo:** Tasks 1–4 (primitivos) → 5 (Dashboard) → 6 (Transações) → 7 (Carteiras) → 8 (Metas/Análise) → 9 (Perfil). Perfil e Análise podem virar follow-up sem quebrar a fatia.

---

## File Structure

- `src/lib/reduce-motion.ts` + `src/lib/reduce-motion.test.ts` — NEW.
- `src/components/ui/skeleton.tsx` + `src/__tests__/skeleton.test.tsx` — NEW.
- `src/components/ui/empty-state.tsx` + `src/__tests__/empty-state.test.tsx` — NEW.
- `src/components/ui/screen-enter.tsx` + `src/__tests__/screen-enter.test.tsx` — MOD.
- `src/components/ui/undo-toast.tsx` + `src/__tests__/undo-toast.test.tsx` — MOD/NEW.
- `jest.setup.*` (ou `jest.config` `setupFiles`) — MOD: mock `AccessibilityInfo`.
- `src/app/(app)/index.tsx` — MOD.
- `src/app/(app)/transactions.tsx` — MOD.
- `src/app/(app)/analytics.tsx` — MOD.
- `src/app/(app)/goals.tsx` — MOD.
- `src/app/(app)/wallets/index.tsx` — MOD.
- `src/app/(app)/wallets/[id].tsx` — MOD.
- `src/app/(app)/_layout.tsx` — MOD.
- `src/components/wallets/wallet-card.tsx` — MOD.
- `src/components/transactions/transaction-row.tsx` — MOD.
- `src/components/transactions/transaction-sheet.tsx` — MOD.
- `src/components/budgets/budgets-section.tsx`, `budget-row.tsx` — MOD.
- `src/components/goals/goal-card.tsx` — MOD.
- `src/components/profile/profile-sheet.tsx`, `category-sheet.tsx` — MOD.
- `src/components/analytics/analytics-skeleton.tsx` — MOD (compõe `<Skeleton>`).

---

## Design pass (skill: `frontend-design`)

Aqui o "design" é **consistência**, não um momento-herói — não há wireframe. Tokens fixos dos dois primitivos, para todo mundo usar igual:

**`<Skeleton>`**
- Superfície: `rounded-xl bg-card` (o mesmo `colors.card` dos blocos inline de hoje).
- Pulse: opacidade `0.5 ↔ 1`, `900ms`, `easing` linear, `useNativeDriver: true`, loop. Desligado por `useReduceMotion()` **ou** `pulse={false}` → opacidade fixa `1`.
- Sem shimmer, sem gradiente, sem borda.
- Formas por tela = as de hoje: Dashboard header `h-10 w-40 rounded-lg`; row `h-8 w-8` + 2 linhas (`h-3.5 w-28`, `h-3 w-20`); Carteiras `h-[72px] rounded-2xl`; Metas `h-28 rounded-2xl border border-border`.

**`<EmptyState>`**
- `variant='card'` (default): `items-center gap-3 rounded-2xl border border-border bg-card py-12 px-6`.
- `variant='bare'`: `items-center gap-3 py-12` (sem card) — só o Metas.
- Ícone (opcional): `size={28}` `strokeWidth={1.5}` `color={colors.muted}`.
- `title`: `text-sm text-muted text-center`.
- `description` (opcional): `text-xs text-muted text-center` — **sem `/70`**.
- `action` (opcional): `Pressable` `rounded-xl bg-border px-4 py-2.5` + `Text text-sm font-medium text-fg` + `haptic.tap()` no press + `accessibilityRole="button"` + `accessibilityLabel={action.label}`.
- Sem `→`, sem eyebrow ALL-CAPS, sem card idêntico repetido — segue o sistema visual das 9 fatias.

---

## Task 1: `useReduceMotion` + mock global de `AccessibilityInfo`

**Files:** New `src/lib/reduce-motion.ts`, `src/lib/reduce-motion.test.ts`; Modify o setup do jest.

**Interfaces:** `useReduceMotion(): boolean`.

- [ ] **Step 1: Setup + branch**
```bash
cd /home/welbertbarbosa/projects/personal/nexis-mobile
git fetch origin -q && git checkout -b feat/mobile-slice-10-polish-a11y origin/main
```

- [ ] **Step 2: Spike `#/tw` + `maxFontSizeMultiplier`** — abrir `src/tw/` (ou onde o wrapper `Text` é definido). Confirmar que props desconhecidas (`maxFontSizeMultiplier`, `numberOfLines`, `accessibilityRole`, `accessibilityLabel`) são repassadas ao `Text`/`Pressable` do RN. react-native-css normalmente faz `{...rest}`. **Se não repassar:** anotar aqui e passar via `style`/props diretos nas tasks seguintes, ou estender o wrapper (mudança mínima). Registrar o resultado num comentário no topo de `reduce-motion.ts` ou no PR.

- [ ] **Step 3: `src/lib/reduce-motion.ts`** — ver spec §`reduce-motion.ts`. `useState(false)` + `useEffect` com `AccessibilityInfo.isReduceMotionEnabled().then(...).catch(()=>{})` + `AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)`; cleanup `sub?.remove?.()` + guarda `alive`.

- [ ] **Step 4: Mock global** — no arquivo de `setupFiles`/`setupFilesAfterEnav` do jest (conferir `package.json`/`jest.config.js` — provável `jest.setup.js`):
```js
jest.spyOn(require('react-native').AccessibilityInfo, 'isReduceMotionEnabled')
  .mockResolvedValue(false)
jest.spyOn(require('react-native').AccessibilityInfo, 'addEventListener')
  .mockReturnValue({ remove: () => {} })
```
(usar `jest.spyOn`, **não** `jest.mock('react-native', ...)` — quebra jest-expo, ver [[nexis-mobile-testing]]). Se o setup não existir, criar e apontar em `jest.config`.

- [ ] **Step 5: `reduce-motion.test.ts`** — override local do spy:
  - `isReduceMotionEnabled` resolve `true` → hook retorna `true` após flush.
  - dispara o handler de `reduceMotionChanged` com `true` → re-render `true`.
  - `isReduceMotionEnabled` rejeita → fica `false`.

- [ ] **Step 6: Verificar** — `npx jest --forceExit src/lib/reduce-motion.test.ts && npx tsc --noEmit`. Rodar a suíte inteira pra garantir que o mock global não quebrou nada.

- [ ] **Step 7: Commit** — `git commit -m "feat: useReduceMotion + mock global de AccessibilityInfo"`

---

## Task 2: `<Skeleton>`

**Files:** New `src/components/ui/skeleton.tsx`, `src/__tests__/skeleton.test.tsx`; Modify `src/components/analytics/analytics-skeleton.tsx`

- [ ] **Step 1: `skeleton.tsx`** — ver Design pass. `export function Skeleton({ className, style, pulse = true }: { className?: string; style?: StyleProp<ViewStyle>; pulse?: boolean })`. `const reduce = useReduceMotion()`. Se `pulse && !reduce`: `Animated.loop(Animated.sequence([timing 1→0.5, timing 0.5→1]))` com `useNativeDriver: true`, `start()` no mount, `stop()` no cleanup; `Animated.View style={[{ opacity: v }, style]}`. Senão: `View` simples. Sempre `className={`rounded-xl bg-card ${className ?? ''}`}` — como o `#/tw` `View` aceita `className`; se `Animated.View` não passar pelo `#/tw`, usar `Animated.View` cru com `style` só (traduzir o `bg-card`/`rounded` pra `style` com `colors.card` + `borderRadius`). **Preferir**: `Animated.View` cru + `style`, sem `className` (o primitivo é baixo nível).

- [ ] **Step 2: `analytics-skeleton.tsx`** — trocar os `View bg-card` internos por `<Skeleton>` com as mesmas dimensões. Sem mudança de layout.

- [ ] **Step 3: `skeleton.test.tsx`** — mock `#/lib/reduce-motion` (`useReduceMotion: jest.fn(() => false)`). Casos: renderiza (`toJSON` não-nulo); `pulse={false}` → sem `Animated` (ou ao menos não quebra); `useReduceMotion → true` → idem estático. Não precisa asserir a animação em si.

- [ ] **Step 4: Verificar** — jest + `tsc` + `npx jest --forceExit src/__tests__/analytics-screen.test.tsx`.

- [ ] **Step 5: Commit** — `git commit -m "feat: <Skeleton> (pulse respeitando reduce-motion) + analytics-skeleton"`

---

## Task 3: `<EmptyState>`

**Files:** New `src/components/ui/empty-state.tsx`, `src/__tests__/empty-state.test.tsx`

- [ ] **Step 1: `empty-state.tsx`** — contrato do spec §`empty-state.tsx` + tokens do Design pass. `import { useHaptic } from '#/lib/haptics'`. `action` press → `haptic.tap()` **depois** `action.onPress()`. `icon` renderiza só se passado.

- [ ] **Step 2: `empty-state.test.tsx`** — mock `#/tw`, `#/lib/haptics`, `lucide` (objeto plano). Casos: `title` + `description` aparecem; sem `action` não há botão; com `action`, `fireEvent.press` chama `onPress` (mock síncrono, sem mutation); `variant='bare'` — asserir via ausência da classe de card não é trivial no RNTL, então asserir `toJSON` snapshot leve **ou** um `testID` diferente por variante (adicionar `testID="empty-state"` sempre e checar `props.className` no nó raiz).

- [ ] **Step 3: Verificar** — jest + `tsc`.

- [ ] **Step 4: Commit** — `git commit -m "feat: <EmptyState> (card/bare, ícone, CTA com haptic)"`

---

## Task 4: `<ScreenEnter>` + `<UndoToast>` respeitam reduce-motion

**Files:** Modify `src/components/ui/screen-enter.tsx`, `src/__tests__/screen-enter.test.tsx`, `src/components/ui/undo-toast.tsx`; New/Modify `src/__tests__/undo-toast.test.tsx`

- [ ] **Step 1: `screen-enter.tsx`** — `const reduce = useReduceMotion()`. `if (reduce) return <View style={{ flex: 1 }}>{children}</View>` (import `View` de `react-native` cru, já que hoje usa `Animated` cru). Resto igual.

- [ ] **Step 2: `undo-toast.tsx`** — `const reduce = useReduceMotion()`. No `useEffect` da animação: `if (!visible || reduce) return` (não inicia o `Animated.timing`). A barra: quando `reduce`, renderizar `Animated.View` com `width: '100%'` fixo (sem `interpolate`) — o pai continua controlando os 5s. Container `<View>` ganha `accessibilityLiveRegion="polite"` + `accessibilityLabel={`${label}. Toque em desfazer.`}`. Botão "Desfazer" ganha `accessibilityRole="button"` + `accessibilityLabel="Desfazer exclusão"` + `hitSlop={8}`.

- [ ] **Step 3: `screen-enter.test.tsx` (MOD)** — mock `#/lib/reduce-motion`. Caso novo: `useReduceMotion → true` → `getByText('oi')` presente de imediato (já é, mas o teste documenta o caminho sem `Animated`).

- [ ] **Step 4: `undo-toast.test.tsx`** — mock `#/tw`, `#/lib/reduce-motion`. `visible` → `label` + "Desfazer"; `fireEvent.press` em "Desfazer" chama `onUndo`; `!visible` → `toJSON()` nulo; container tem `accessibilityLiveRegion`.

- [ ] **Step 5: Verificar** — jest + `tsc` + `npx jest --forceExit src/__tests__/goals-screen.test.tsx src/__tests__/transactions-screen.test.tsx`.

- [ ] **Step 6: Commit** — `git commit -m "feat: ScreenEnter/UndoToast respeitam Reduzir movimento + live region"`

---

## Task 5: Dashboard (`index.tsx`)

**Files:** Modify `src/app/(app)/index.tsx`, `src/__tests__/dashboard-screen.test.tsx`

- [ ] **Step 1: Skeleton/EmptyState** — `ListSkeleton` interno → compor `<Skeleton>` (3 rows). Header `h-10 w-40 rounded-lg bg-card` → `<Skeleton style={{ height: 40, width: 160, borderRadius: 8 }} />`. `EmptyRecent` → `<EmptyState title="Nenhuma transação ainda" description="Toque em + para adicionar" />` (variant card). `SummaryCard` loading placeholder → `<Skeleton>`.

- [ ] **Step 2: A11y** — "Olá, {firstName}" fica; o `Text` do saldo (`text-4xl`) → `accessibilityRole="header"` **não** (é valor); em vez disso `accessibilityLabel={`Saldo total: ${fmtBRL(data?.totalBalance ?? 0)}`}` + `maxFontSizeMultiplier={1.4}`. "Saldo total · todas as carteiras" fica. Avatar `Pressable` → `accessibilityRole="button"` + `accessibilityLabel="Abrir perfil"` + `hitSlop={8}`. "Recentes" `Text` → `accessibilityRole="header"`.

- [ ] **Step 3: Haptic** — `onRefresh` do `RefreshControl` → `haptic.tap()` antes do `invalidateQueries` (`const haptic = useHaptic()`; conferir se já importa).

- [ ] **Step 4: `OnboardingCard`** — o "botão" visual "Criar carteira" (`View`, não navega) fica; sem a11y de botão (não é interativo). Sem mudança de comportamento.

- [ ] **Step 5: Teste (MOD)** — o teste já mocka `#/tw`, `#/api/dashboard`, `#/components/profile/profile-sheet`. Adicionar mock `#/lib/haptics`, `#/components/ui/skeleton` (`Skeleton: () => null`) e `#/components/ui/empty-state` (`EmptyState: ({ title }) => <Text>{title}</Text>` — usar o `Text` do mock de `#/tw`). Assert novo: `getByLabelText('Abrir perfil')`. Os `getByText` de saldo/nome seguem.

- [ ] **Step 6: Verificar** — jest + `tsc`.

- [ ] **Step 7: Commit** — `git commit -m "feat: Dashboard — Skeleton/EmptyState + a11y (perfil, saldo, headers) + haptic refresh"`

---

## Task 6: Transações (`transactions.tsx` + row + sheet)

**Files:** Modify `src/app/(app)/transactions.tsx`, `src/components/transactions/transaction-row.tsx`, `src/components/transactions/transaction-sheet.tsx`, `src/__tests__/transactions-screen.test.tsx`

- [ ] **Step 1: EmptyState ×3** — `EmptyState` / `EmptyFiltered` / `EmptySearch` internos → `<EmptyState>`. Textos preservados: sem tx no mês → "Nenhuma transação neste mês" / "Toque em + para adicionar"; filtro sem resultado → "Nada com esses filtros" / CTA "Limpar filtros" (`action` → `clearFilters` + haptic já no componente); busca vazia → "Nada encontrado" / descrição com o termo. Conferir os textos atuais e manter.

- [ ] **Step 2: A11y na barra de filtros** — título "Transações" → `accessibilityRole="header"`. Gatilho de colapso → `accessibilityRole="button"` + `accessibilityLabel={filtrosAtivos ? 'Filtros (ativos)' : 'Filtros'}` + `accessibilityState={{ expanded }}`. Cada `FilterChip` → `accessibilityRole="button"` + `accessibilityLabel` (ex.: "Tipo: Despesa", "Carteira: Nubank", "Categoria: Todas") + `accessibilityState={{ selected }}` + `hitSlop={6}`. `FilterX` (limpar) → `accessibilityRole="button"` + `accessibilityLabel="Limpar filtros"` + `hitSlop={8}`. Nav de mês `‹ ›` (`month-prev`/`month-next`) → `accessibilityRole="button"` + `accessibilityLabel="Mês anterior"/"Próximo mês"` + `accessibilityState={{ disabled: !canGoNext }}` no next + `hitSlop={8}`. Campo de busca → `accessibilityLabel="Buscar transações"`.

- [ ] **Step 3: Haptic** — `onRefresh` → `haptic.tap()`. (chips e nav de mês já têm haptic da Fatia 8 — **não** duplicar; só adicionar as props de a11y.)

- [ ] **Step 4: `transaction-row.tsx`** — o `Pressable`/`View` raiz da row → `accessibilityRole={onPress ? 'button' : 'text'}` + `accessibilityLabel={`${label}, ${isExpense ? 'saída' : 'entrada'} de ${fmtBRL(tx.amount)}${hideWallet ? '' : `, ${tx.wallet.name}`}`}`. O `Pressable` do swipe "Excluir" → `accessibilityRole="button"` + `accessibilityLabel="Excluir transação"` + `hitSlop={8}`.

- [ ] **Step 5: `transaction-sheet.tsx`** — o toggle segmentado de tipo (Despesa/Receita): container `accessibilityRole="radiogroup"`; cada opção `accessibilityRole="radio"` + `accessibilityState={{ checked: selected }}` + `accessibilityLabel`. O contador grande de parcelas (`text-...` grande) → `maxFontSizeMultiplier={1.4}`. (haptic no segmented já existe.)

- [ ] **Step 6: Teste (MOD)** — já mocka `#/lib/haptics`, `ReanimatedSwipeable`, `#/components/ui/undo-toast`, `TextInput`. Adicionar mock `#/components/ui/empty-state`. Asserts novos: `getByLabelText('Mês anterior')`, `getByLabelText('Limpar filtros')` (quando filtros ativos). Os `getByText`/`testID` seguem.

- [ ] **Step 7: Verificar** — jest + `tsc`.

- [ ] **Step 8: Commit** — `git commit -m "feat: Transações — EmptyState + a11y (filtros, nav, row, segmented) + haptic refresh"`

---

## Task 7: Carteiras (lista + detalhe + card)

**Files:** Modify `src/app/(app)/wallets/index.tsx`, `src/app/(app)/wallets/[id].tsx`, `src/components/wallets/wallet-card.tsx`, `src/__tests__/wallets-screen.test.tsx`, `src/__tests__/wallet-detail-screen.test.tsx`

- [ ] **Step 1: `wallets/index.tsx`** — skeleton do header e da lista → `<Skeleton>` (header `h-10 w-40`; 2× `h-[72px] rounded-2xl`). `EmptyState` local → `<EmptyState icon={WalletIcon} title="Nenhuma carteira ainda" description="Crie uma para começar" action={{ label: 'Criar carteira', onPress: openNew }} />`. "Saldo total" `Text` valor → `accessibilityLabel={`Saldo total: ${fmtBRL(totalBalance)}`}` + `maxFontSizeMultiplier={1.4}`. `⇄` → `accessibilityRole="button"` + `accessibilityLabel="Transferir entre carteiras"` + `hitSlop={6}`. `+` → `accessibilityLabel="Nova carteira"` + `hitSlop={6}`. `Pressable` de cada card → `haptic.tap()` no `onPress` antes do `router.push` + `accessibilityRole="button"`. `onRefresh` → `haptic.tap()`.

- [ ] **Step 2: `wallets/[id].tsx`** — `‹` voltar → `accessibilityRole="button"` + `accessibilityLabel="Voltar"` + `hitSlop={8}`. Nome da carteira (`text-base font-semibold`) → `accessibilityRole="header"`. Saldo `text-4xl` → `accessibilityLabel={`Saldo: ${fmtBRL(wallet.balance)}`}` (ou "Fatura atual: …" no crédito) + `maxFontSizeMultiplier={1.4}`. "Editar" / "Transferir" `Pressable` → `accessibilityRole="button"` + label + `haptic.tap()` no press. Nav de mês `‹ ›` (`wd-month-prev`/`wd-month-next`) → label "Mês anterior"/"Próximo mês" + `accessibilityState={{ disabled: !canGoNext }}` + `hitSlop={8}`. Empty da `SectionList` → `<EmptyState title={`Sem movimentações em ${MONTHS[month-1]}`} description="Toque em ＋ para registrar" />`. `onRefresh` do `RefreshControl` → `haptic.tap()`.

- [ ] **Step 3: `wallet-card.tsx`** — nome da carteira `Text` → `numberOfLines={1}` + `className` com `flex-shrink`/container `min-w-0` se ainda não tiver. `WALLET_META[type].label` fica. O `<View>` raiz do card → `accessibilityLabel={`${wallet.name}, ${saldoOuFatura}`}` (o `Pressable` pai na lista já dá o `role`; no card basta o label — ou mover o label pro Pressable da lista e deixar o card `accessible={false}` pra não duplicar. **Decisão:** label no `Pressable` da lista, `wallet-card` sem props de a11y — evita anúncio duplo).

  → Ajuste no Step 1: o `Pressable` de cada card recebe `accessibilityLabel={`${w.name}, saldo ${fmtBRL(w.balance)}`}`.

- [ ] **Step 4: Testes (MOD)** — `wallets-screen.test.tsx`: mock `#/lib/haptics`, `#/components/ui/skeleton`, `#/components/ui/empty-state`. Assert `getByLabelText('Nova carteira')`. `wallet-detail-screen.test.tsx`: mock `#/lib/haptics`, `#/components/ui/empty-state`; assert `getByLabelText('Voltar')`. `getByText` de nomes/valores seguem.

- [ ] **Step 5: Verificar** — jest + `tsc`.

- [ ] **Step 6: Commit** — `git commit -m "feat: Carteiras (lista+detalhe) — Skeleton/EmptyState + a11y + haptics"`

---

## Task 8: Metas + Análise

**Files:** Modify `src/app/(app)/goals.tsx`, `src/app/(app)/analytics.tsx`, `src/components/goals/goal-card.tsx`, `src/components/budgets/budgets-section.tsx`, `src/components/budgets/budget-row.tsx`, `src/__tests__/goals-screen.test.tsx`, `src/__tests__/analytics-screen.test.tsx`

- [ ] **Step 1: `goals.tsx`** — skeleton (`h-28` ×2) → `<Skeleton>` com `border border-border` no style. Empty (`Target` + texto + CTA) → `<EmptyState variant="bare" icon={Target} title="Nenhuma meta ainda" action={{ label: 'Criar meta', onPress: openNew }} />`. `‹` voltar → `accessibilityRole="button"` + `accessibilityLabel="Voltar"` + `hitSlop={8}`. Título "Metas" → `accessibilityRole="header"`. `+` → `accessibilityLabel="Nova meta"` + `hitSlop={6}`. "Total guardado" valor `text-3xl` → `accessibilityLabel={`Total guardado: ${fmtBRL(totalSaved)}`}` + `maxFontSizeMultiplier={1.4}`. `onRefresh` → `haptic.tap()` (`const haptic = useHaptic()`).

- [ ] **Step 2: `goal-card.tsx`** — botões de depósito / saque / editar → `accessibilityRole="button"` + `accessibilityLabel` ("Depositar na meta {nome}", "Retirar da meta {nome}", "Editar meta {nome}") + `hitSlop={6}`. Barra de progresso → `accessibilityRole="progressbar"` + `accessibilityValue={{ min: 0, max: 100, now: pct }}` (opcional, se não inflar).

- [ ] **Step 3: `analytics.tsx`** — título "Análise" → `accessibilityRole="header"`. `Section` (o helper interno) — o `Text` do título de seção → `accessibilityRole="header"`. `onRefresh` → `haptic.tap()` (`const haptic = useHaptic()`; hoje não importa — adicionar). Se algum empty interno de seção existir (`categoryBreakdown` vazio já é condicional de render, então não há empty visível — ok, nada a fazer).

- [ ] **Step 4: `budgets-section.tsx`** — `RoundBtn` da nav de mês → `accessibilityRole="button"` + `accessibilityLabel="Mês anterior"/"Próximo mês"` + `accessibilityState={{ disabled }}` + `hitSlop={8}`. Botão "Novo orçamento" (`onNew`) → `accessibilityRole="button"` + `accessibilityLabel="Novo orçamento"`. (haptic na nav já existe da Fatia 8.)

- [ ] **Step 5: `budget-row.tsx`** — o `Pressable` de editar → `accessibilityRole="button"` + `accessibilityLabel={`Editar orçamento de ${categoria}`}`. Barra spent/limit → `accessibilityLabel={`${categoria}: ${fmtBRL(spent)} de ${fmtBRL(limit)}`}` no container.

- [ ] **Step 6: Testes (MOD)** — `goals-screen.test.tsx`: mock `#/lib/haptics`, `#/components/ui/skeleton`, `#/components/ui/empty-state`; assert `getByLabelText('Nova meta')` ou `getByLabelText('Voltar')`. `analytics-screen.test.tsx`: mock `#/lib/haptics` (novo import), `#/components/ui/skeleton` (via analytics-skeleton — ou deixar o real, é leve); assert `getByRole('header')` pega "Análise".

- [ ] **Step 7: Verificar** — jest + `tsc`.

- [ ] **Step 8: Commit** — `git commit -m "feat: Metas/Análise — Skeleton/EmptyState + a11y (headers, nav, cards) + haptic refresh"`

---

## Task 9: Perfil (`profile-sheet` + `category-sheet`)

**Files:** Modify `src/components/profile/profile-sheet.tsx`, `src/components/profile/category-sheet.tsx`, `src/__tests__/profile-sheet.test.tsx`

- [ ] **Step 1: `profile-sheet.tsx`** — cabeçalhos de seção (identidade, "Categorias", etc.) → `accessibilityRole="header"`. Cada linha de acordeão (gatilho) → `accessibilityRole="button"` + `accessibilityLabel={`Categorias de ${tipo}`}` + `accessibilityState={{ expanded }}`. Toggle segmentado Despesas/Receitas → container `accessibilityRole="radiogroup"`; cada opção `accessibilityRole="radio"` + `accessibilityState={{ checked }}`. `Switch` "Bloqueio do app" → `accessibilityLabel="Bloqueio do app"` (o `Switch` nativo já expõe `checked`). Chips de ícone-only de categoria → `accessibilityLabel={categoria.name}` + `accessibilityState={{ selected }}`. "Sair da conta" `Pressable` → `accessibilityRole="button"` + `accessibilityLabel="Sair da conta"`.

- [ ] **Step 2: `category-sheet.tsx`** — seletor de tipo segmentado → `radiogroup`/`radio` + `accessibilityState={{ checked }}`. Grade de ícones: cada `Pressable` de ícone → `accessibilityRole="button"` + `accessibilityLabel={`Ícone ${nome}`}` + `accessibilityState={{ selected }}`. Botão de expandir/recolher a grade → `accessibilityLabel={expanded ? 'Recolher ícones' : 'Mais ícones'}`. Campo de nome → `accessibilityLabel="Nome da categoria"`.

- [ ] **Step 3: Teste (MOD)** — `profile-sheet.test.tsx` já mocka bastante coisa (`#/lib/app-lock*`, `#/lib/haptics`, `Lock` no lucide). Adicionar asserts leves: `getByLabelText('Sair da conta')`, `getByLabelText('Bloqueio do app')`. Nada de apertar switch/mutation.

- [ ] **Step 4: Verificar** — jest + `tsc`.

- [ ] **Step 5: Commit** — `git commit -m "feat: Perfil — a11y (acordeão, radiogroup, chips, switch, sair)"`

---

## Task 10: tab bar a11y + suíte + checklist + PR

**Files:** Modify `src/app/(app)/_layout.tsx`

- [ ] **Step 1: `_layout.tsx`** — `tabBarLabelStyle` += `maxFontSizeMultiplier: 1.2` (ou `allowFontScaling: false` se cortar no device). Cada `<Tabs.Screen>` visível → `options={{ ..., tabBarAccessibilityLabel: 'Aba <Nome>' }}` (Início, Transações, Carteiras, Análise). O `FabTabButton` (slot central) — **sem mexer na regra** (só `style`, primitivos crus) — adicionar `accessibilityRole="button"` + `accessibilityLabel="Adicionar transação"` diretamente no `Pressable` cru (é prop de RN, não navegação; não viola a regra do [[nexis-mobile-project]]). O `tabBarButton` global idem, se aplicável.

- [ ] **Step 2: Suíte completa** — `npx tsc --noEmit && npx jest --forceExit`. Tudo verde (~190+). Rodar 2×.

- [ ] **Step 3: Checklist de device** (usuário — `npx expo start --tunnel`, iPhone):
  - [ ] **VoiceOver on**: Dashboard — botões anunciam rótulo pt-BR; "Saldo total" é cabeçalho, valor lido como "Saldo total: R$ …"; avatar diz "Abrir perfil". Idem Transações (chips "selecionado"), Carteiras (card diz nome + saldo), Detalhe, Metas, Análise, Perfil.
  - [ ] **Dynamic Type no máximo** (+ "Texto maior"): abrir todas as telas — nenhum número/botão essencial corta; nomes longos truncam com "…"; abas legíveis.
  - [ ] **Reduzir movimento on**: Metas / Detalhe da carteira abrem sem slide/fade; excluir transação → toast sem barra animada, mas Desfazer + exclusão em 5 s ok; skeletons não pulsam.
  - [ ] **Haptics**: tocar card de carteira, linha de transação, `+` do FAB, CTA de empty, "Editar"/"Transferir" do detalhe, e puxar-pra-atualizar → tap sutil.
  - [ ] **Empty states**: zerar transações do mês / sem metas / sem carteiras → mesmo visual (ícone, título, descrição, CTA quando aplicável).
  - [ ] **Skeletons**: rede off + abrir cada aba fria → skeleton com a forma do conteúdo (não spinner, não branco).
  - [ ] `tsc` limpo + jest verde.

- [ ] **Step 4: Push + PR**
```bash
git push -u origin feat/mobile-slice-10-polish-a11y
gh pr create --repo Welbert-Soares/nexis-mobile --base main \
  --title "feat: Fatia 10 — polimento geral + acessibilidade" \
  --body "Varredura transversal, sem feature nova, sem backend. Primitivos <Skeleton> e <EmptyState> adotados em todas as telas; useReduceMotion (AccessibilityInfo) — ScreenEnter/UndoToast/Skeleton respeitam \"Reduzir movimento\". accessibilityRole/Label/State + hitSlop em todo controle icon-only; títulos como header; saldos com rótulo legível. maxFontSizeMultiplier 1.4 nos numéricos grandes + numberOfLines nos nomes. Haptics nas ações primárias que faltavam (card, row, FAB, refresh, CTAs). ~+12 jest (total ~190+). Spec/plano: nexis.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Rollback

- Reverter o PR remove os dois primitivos, o hook e todas as props de a11y/haptics. Sem dep pra desinstalar, sem `app.json` tocado, sem backend. O `analytics-skeleton` volta aos `View` inline.

---

## Notes / decisões deixadas pro implementador

- `<Skeleton>` como `Animated.View` cru + `style` (não `#/tw`) — é primitivo baixo nível; evita depender do wrapper repassar `className` num `Animated.View`.
- `wallet-card` **sem** props de a11y — o `Pressable` da lista carrega o label, evita anúncio duplo.
- `maxFontSizeMultiplier` cap **1.4**; se no device ainda cortar, descer pra 1.3 (registrar no PR).
- Se o `#/tw` `Text`/`Pressable` **não** repassar `accessibility*`/`maxFontSizeMultiplier` (Task 1 Step 2), aplicar via props diretos nos componentes RN por baixo ou estender o wrapper — decidir na Task 1 e seguir o mesmo caminho nas demais.
- `accessibilityRole="progressbar"` em barras (goal-card, budget-row) é opcional — só se não inflar o diff; o `accessibilityLabel` no container já resolve o essencial.
