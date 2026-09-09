# Nexis Mobile — Fatia 10: Polimento geral + acessibilidade — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D9) — plano a ser derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-10-polish-a11y.md`
**Sub-projeto:** 10 do `nexis-mobile` — **só app, sem backend, sem rota nova, sem dep nova**. Sem feature nova: passada de acabamento transversal.

---

## Contexto

Fatias 1–9 entregaram toda a paridade com o PWA + detalhe de carteira. O app funciona, mas o acabamento está desigual entre telas e a acessibilidade é praticamente inexistente. Esta fatia é uma varredura de consistência, não um recurso.

### Auditoria (estado atual)

- **Acessibilidade quase zero.** Só `src/components/layout/fab.tsx` tem props de a11y. Todos os `Pressable` icon-only (`‹` voltar, `+` novo, `⇄` transferir, chips de filtro, nav de mês `‹ ›`, avatar do perfil, FAB `+`) não têm `accessibilityRole` nem `accessibilityLabel` — o VoiceOver não anuncia nada útil.
- **`allowFontScaling` / `maxFontSizeMultiplier`: nenhum uso.** Os saldos `text-4xl` com `tabularNums` estouram o layout no Dynamic Type grande.
- **`hitSlop`: nenhum uso.** Alvos como o `‹` (`p-1` ≈ 26 px) e o `+` (`h-8 w-8` = 32 px) estão abaixo dos 44×44 recomendados.
- **Skeletons ad-hoc.** Cada tela tem o seu inline: Dashboard (`ListSkeleton` + `h-10 w-40 bg-card` no header), Carteiras (`h-[72px] bg-card` ×2 + `h-10 w-40`), Metas (`h-28 bg-card` ×2), Transações (skeleton próprio), Análise (`AnalyticsSkeleton`, esse é componente). Alturas, formas e opacidades diferentes.
- **Empty states bespoke.** `EmptyRecent` (Dashboard, card 2 linhas), Metas (ícone + texto + CTA, sem card), Transações (`EmptyState` / `EmptyFiltered` / `EmptySearch`), Carteiras (`EmptyState` local com CTA), Detalhe da carteira ("Sem movimentações…" com `text-muted/70`). Paddings, presença de ícone e de CTA variam.
- **Haptics parcial.** Cobre sheets (criar/editar/remover), chips de filtro, nav de mês na Análise, troca de aba. Falta nas ações primárias: tocar num `WalletCard`, tocar numa linha de transação, `+` do FAB, CTAs dos empties, "Editar"/"Transferir" no detalhe, pull-to-refresh.
- **`ScreenEnter` e `UndoToast` ignoram "Reduzir movimento".** `ScreenEnter` sempre faz fade + translateY 8→0; `UndoToast` sempre anima a barra de 5s. Nenhum lê `AccessibilityInfo`.
- **Truncação de texto incompleta.** Nomes longos de carteira/categoria: `TransactionRow` tem `numberOfLines={1}`, mas `WalletCard`, chips e alguns rótulos não foram auditados.
- **Contraste.** `text-muted/70` sobre `bg-card` fica abaixo do razoável para texto secundário (≈ 2,5:1). `colors.muted` cheio (`#71717a`) sobre `#18181b` ≈ 3,6:1 — aceitável para secundário/large, fica.

---

## Objetivo da Fatia 10

Deixar o app **consistente e navegável com leitor de tela / Dynamic Type / reduzir movimento**, sem mudar nenhuma funcionalidade:

1. **Acessibilidade** — `accessibilityRole` + `accessibilityLabel` (pt-BR) em todo controle, `accessibilityState` onde há seleção/disabled, `hitSlop` nos alvos pequenos, `accessibilityRole="header"` nos títulos, rótulos legíveis nos saldos.
2. **Loading** — um primitivo `<Skeleton>` e cada tela usando-o com a forma do seu conteúdo.
3. **Empty states** — um primitivo `<EmptyState>` adotado em todas as telas.
4. **Haptics** — preencher as lacunas nas ações primárias (sempre `haptic.tap()`, silencioso).
5. **Reduzir movimento** — `ScreenEnter` e `UndoToast` respeitam a preferência do sistema.
6. **Dynamic Type** — cap de `maxFontSizeMultiplier` nos numéricos grandes; `numberOfLines` completo nos nomes.

**Não** cobre: tema claro, i18n, onboarding novo, telas/gráficos novos, refactor Stack-sobre-Tabs (segue anotado).

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | **Escopo e barra** | Só app. **Sem** backend, rota, dep, `app.json`/plugin. Barra: `npx tsc --noEmit` limpo + `npx jest --forceExit` verde. Sem prettier/eslint (estilo na mão, como todo o projeto). |
| D2 | **`<Skeleton>` — `src/components/ui/skeleton.tsx` (NEW)** | `<Skeleton className? style? />` → `View` `rounded-xl bg-card`. Pulse de **opacidade** opcional (`Animated`, 0.5↔1, ~900 ms, `useNativeDriver: true`), **desligado quando "Reduzir movimento" está ligado** (via D6). Prop `pulse?: boolean` (default `true`). Sem shimmer/gradiente (evita dep e complexidade). Substitui os blocos inline de Dashboard, Carteiras, Metas, Transações e Detalhe da carteira. `AnalyticsSkeleton` passa a compor `<Skeleton>` internamente. |
| D3 | **`<EmptyState>` — `src/components/ui/empty-state.tsx` (NEW)** | `<EmptyState icon?={LucideIcon} title description? action?={{ label, onPress }} variant?='card'|'bare' />`. `card` (default): `items-center gap-3 rounded-2xl border border-border bg-card py-12 px-6`. `bare`: sem card/borda (para o Metas, que hoje é sem card). Ícone: `size={28}` `strokeWidth={1.5}` `color={colors.muted}`. `title` `text-sm text-muted`; `description` `text-xs text-muted` (**sem `/70`**). `action` → `Pressable` `rounded-xl bg-border px-4 py-2.5` + `haptic.tap()` no press + a11y (D4). Migrar: `EmptyRecent`, `EmptyState`/`EmptyFiltered`/`EmptySearch` (Transações), `EmptyState` (Carteiras), empty do Detalhe da carteira, empty do Metas (`variant='bare'`, ícone `Target`). Textos preservados. |
| D4 | **Toque acessível** | Todo `Pressable` **icon-only** ou de ação primária ganha `accessibilityRole="button"` + `accessibilityLabel` pt-BR. Catálogo mínimo: "Voltar", "Abrir perfil", "Nova carteira", "Transferir entre carteiras", "Adicionar transação", "Nova meta", "Novo orçamento", "Mês anterior", "Próximo mês", "Limpar filtros", "Filtrar por tipo/carteira/categoria", "Editar carteira", "Depositar na meta", "Retirar da meta", "Editar orçamento". `disabled`/opacidade → `accessibilityState={{ disabled: true }}` + `disabled` de verdade. Alvos `< 44 px` → `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` (ou o bastante p/ chegar a 44). Chips de filtro → `accessibilityRole="button"` + `accessibilityState={{ selected }}`. Toggles segmentados (tipo de transação em `transaction-sheet`, tipo em `category-sheet`, Despesas/Receitas) → pai `accessibilityRole="radiogroup"`, cada opção `accessibilityRole="radio"` + `accessibilityState={{ checked }}`. `Switch` do bloqueio do app → `accessibilityLabel="Bloqueio do app"`. `tabBarButton`/`FabTabButton` → `accessibilityRole="button"` + label ("Aba <nome>", "Adicionar transação"). |
| D5 | **Títulos e rótulos legíveis** | Título de cada tela (`text-2xl`/`text-4xl font-bold`: "Análise", "Metas", "Transações", header de Carteiras/Detalhe) → `accessibilityRole="header"`. Saldos grandes (Dashboard "Saldo total", Detalhe da carteira, Metas "Total guardado") → no `Text` do valor, `accessibilityLabel={\`${rótulo}: ${fmtBRL(valor)}\`}` para o leitor falar "Saldo total: mil e duzentos reais" em vez de soletrar dígitos. `UndoToast` → container com `accessibilityLiveRegion="polite"` + `accessibilityLabel="{label}. Toque em desfazer."`. |
| D6 | **Reduzir movimento — `src/lib/reduce-motion.ts` (NEW)** | `useReduceMotion(): boolean` — `useState(false)` + `useEffect` que chama `AccessibilityInfo.isReduceMotionEnabled()` e assina `AccessibilityInfo.addEventListener('reduceMotionChanged', …)` (remove no cleanup). Tudo tolerante a erro (fallback `false`). **`ScreenEnter`**: `reduce` → renderiza `children` num `View flex-1` sem `Animated` (sem fade/slide). **`UndoToast`**: `reduce` → sem `Animated.timing`; a barra fica **estática** (largura fixa ou omitida) — o texto e o comportamento de 5s do pai não mudam. **`<Skeleton pulse>`**: `reduce` → sem pulse. Grades de ícone (`wallet-sheet`, `category-sheet`) e o `orderedIcons`/fade: se a mudança for barata, `reduce` → transição instantânea; senão, anotar como follow-up (não bloqueia). |
| D7 | **Haptics nas ações primárias** | Adicionar `haptic.tap()` (do `useHaptic()`, já existe, silencioso): tocar num `WalletCard` (abrir detalhe), tocar numa linha de transação p/ editar (se o `transaction-sheet-context.openEdit` já não cobrir — **conferir**), `+` do FAB / `openNew` (se não coberto — **conferir**), CTA dos `<EmptyState>` (no próprio componente, D3), "Editar"/"Transferir" no Detalhe da carteira, `onRefresh` de **todos** os `RefreshControl` (Dashboard, Carteiras, Transações, Análise, Metas, Detalhe). **Não** adicionar em scroll, foco de input, nem duplicar onde já existe. `haptic.success()`/`error()` das mutations ficam como estão. |
| D8 | **Dynamic Type** | Nos `Text` de **valor monetário/numérico grande** (`text-3xl`/`text-4xl` com `tabularNums`) e no badge de parcelas/contadores: `maxFontSizeMultiplier={1.4}`. Rótulos de aba: `tabBarLabelStyle` com `maxFontSizeMultiplier` (~1.2) ou `allowFontScaling: false` se cortar. Textos de corpo/label ficam livres (escalam). Auditar `numberOfLines={1}` + `flex-shrink`/`min-w-0` em `WalletCard` (nome), chips (rótulo expandido), rótulos de categoria/carteira nas rows — completar onde faltar. **Conferir** que o `#/tw` `Text` repassa `maxFontSizeMultiplier` pro RN `Text` (spike no plano; se não repassar, passar via `style`/props diretos ou ajustar o wrapper). |
| D9 | **Sem regressão visual** | O visual em Dynamic Type **padrão** e "Reduzir movimento" **desligado** deve ficar idêntico ao de hoje (mesmos textos, cores, paddings). Os primitivos `<Skeleton>`/`<EmptyState>` replicam o que já existe; a fatia é invisível para quem não usa recurso de acessibilidade, fora o polimento de consistência. |

---

## Arquitetura (delta sobre a Fatia 9)

```
nexis-mobile
  src/components/ui/skeleton.tsx           # NEW
  src/components/ui/empty-state.tsx        # NEW
  src/lib/reduce-motion.ts                 # NEW
  src/components/ui/screen-enter.tsx       # MOD (useReduceMotion)
  src/components/ui/undo-toast.tsx         # MOD (reduce-motion + live region)
  src/app/(app)/index.tsx                  # MOD (Skeleton/EmptyState, a11y header+saldo, haptic refresh, maxFontSizeMultiplier)
  src/app/(app)/transactions.tsx          # MOD (EmptyState ×3, a11y chips/nav/busca, haptic refresh)
  src/app/(app)/analytics.tsx            # MOD (a11y título, Section headers, haptic refresh)
  src/app/(app)/goals.tsx               # MOD (Skeleton/EmptyState bare, a11y, haptic refresh)
  src/app/(app)/wallets/index.tsx      # MOD (Skeleton, EmptyState, a11y botões, haptic no card + refresh)
  src/app/(app)/wallets/[id].tsx      # MOD (a11y header/ações/nav, EmptyState, haptic editar/transferir/refresh)
  src/app/(app)/_layout.tsx          # MOD (tabBar a11y + label maxFontSizeMultiplier)
  src/components/wallets/wallet-card.tsx           # MOD (numberOfLines no nome, accessibilityLabel do card)
  src/components/transactions/transaction-row.tsx  # MOD (accessibilityLabel resumindo a tx; hitSlop no swipe action)
  src/components/transactions/transaction-sheet.tsx # MOD (radiogroup/radio no toggle de tipo; maxFontSizeMultiplier no contador)
  src/components/budgets/budgets-section.tsx       # MOD (a11y na nav de mês / RoundBtn)
  src/components/budgets/budget-row.tsx            # MOD (accessibilityLabel; a11y no editar)
  src/components/goals/goal-card.tsx               # MOD (a11y nos botões depósito/saque/editar)
  src/components/profile/profile-sheet.tsx         # MOD (a11y no acordeão + toggle segmentado + Switch)
  src/components/profile/category-sheet.tsx        # MOD (radiogroup/radio no tipo; a11y nos chips)
  src/lib/haptics.ts                               # (sem mudança; só mais call-sites)
```

### `src/lib/reduce-motion.ts` (esqueleto)
```ts
import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduce(v) })
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => { alive = false; sub?.remove?.() }
  }, [])
  return reduce
}
```

### `src/components/ui/empty-state.tsx` (contrato)
```tsx
export function EmptyState({
  icon: Icon, title, description, action, variant = 'card',
}: {
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  title: string
  description?: string
  action?: { label: string; onPress: () => void }
  variant?: 'card' | 'bare'
}) { /* ver D3 */ }
```

---

## Testes

**`nexis-mobile` (jest-expo, `--forceExit`):**

- `skeleton.test.tsx` (NEW) — renderiza; `pulse={false}` não monta `Animated`; com `useReduceMotion → true` (mock) não pulsa.
- `empty-state.test.tsx` (NEW) — mostra `title`/`description`; `action` renderiza botão e `fireEvent.press` chama `onPress`; `variant='bare'` sem borda/card.
- `reduce-motion.test.ts` (NEW) — hook lê `AccessibilityInfo.isReduceMotionEnabled` (mock resolve `true` → `true`); evento `reduceMotionChanged` atualiza; erro na promise → `false`.
- `screen-enter.test.tsx` (MOD) — com reduce-motion mockado `true`, `children` aparece de imediato (sem depender de `Animated` terminar).
- `undo-toast.test.tsx` (NEW ou MOD, se já existir) — `visible` mostra `label` + "Desfazer"; press chama `onUndo`; container tem `accessibilityLiveRegion`.
- Telas (MOD, sem quebrar o que existe): em Dashboard, Transações e Carteiras adicionar 1–2 asserts de `getByLabelText('Voltar' | 'Nova carteira' | …)` e `getByRole('header')`. Os `getByText` de números **não mudam** (o `maxFontSizeMultiplier` não altera o texto).
- **Setup jest**: mockar `AccessibilityInfo` no `jest.setup` (`isReduceMotionEnabled: () => Promise.resolve(false)`, `addEventListener: () => ({ remove() {} })`) para os testes que não se importam.

Alvo: **+10–14 jest** (total ~190+).

**Barra:** `npx tsc --noEmit` limpo; suíte verde. Sem backend.

---

## Verificar no device

`npx expo start --tunnel`, Expo Go, iPhone.

- **VoiceOver ligado** (Ajustes → Acessibilidade → VoiceOver): percorrer Dashboard → cada botão anuncia rótulo em pt-BR; "Saldo total" é lido como cabeçalho e o valor como "Saldo total: R$ …"; avatar anuncia "Abrir perfil". Repetir em Transações (chips dizem "selecionado"), Carteiras (card anuncia nome + saldo), Detalhe da carteira, Metas, Análise, Perfil.
- **Dynamic Type no máximo** (Ajustes → Tela e Brilho → Tamanho do texto + Acessibilidade → Texto maior, maior passo): abrir todas as telas; nenhum número ou botão essencial corta; nomes longos de carteira/categoria truncam com "…"; abas legíveis.
- **Reduzir movimento ligado** (Ajustes → Acessibilidade → Movimento): abrir Metas / Detalhe da carteira → aparecem sem slide/fade; excluir uma transação → toast sem barra animada, mas o botão Desfazer e a exclusão em 5 s funcionam; skeletons não pulsam.
- **Haptics**: tocar num card de carteira, numa linha de transação, no `+` do FAB, nos CTAs de empty, em "Editar"/"Transferir" do detalhe, e puxar pra atualizar → todos dão um tap sutil.
- **Empty states**: zerar transações do mês / ficar sem metas / sem carteiras → todos com o mesmo visual (ícone, título, descrição, CTA quando aplicável).
- **Skeletons**: matar a rede e abrir cada aba fria → skeleton com a forma do conteúdo (não spinner, não tela branca).
- `tsc` limpo + jest verde.

---

## Fora de escopo (Fatia 10)

- Tema claro / alternância de tema.
- i18n — textos seguem pt-BR fixo.
- Onboarding novo (o `OnboardingCard` do Dashboard fica como está; só ganha a11y).
- Refactor Stack-sobre-Tabs (push/swipe-back nativo p/ `goals` e `wallets/[id]`) — segue anotado.
- Skeleton com shimmer/gradiente.
- Telas, gráficos ou métricas novas.
- Auditoria de a11y no Android TalkBack — alvo é iOS/VoiceOver (device do usuário).

---

## Riscos / pontos de atenção

- **`AccessibilityInfo` no jest-expo** — sem mock, `isReduceMotionEnabled` pode não existir/rejeitar. Mockar no `jest.setup` global e permitir override por teste.
- **`#/tw` repassa `maxFontSizeMultiplier`?** — react-native-css normalmente repassa props desconhecidas pro `Text` do RN, mas confirmar num spike rápido (Task 1 do plano). Se não repassar: passar via `style`/props diretos ou estender o wrapper.
- **`accessibilityRole="radio"` / `radiogroup`** — o VoiceOver iOS expõe bem; no Android é irregular, mas fora de escopo.
- **Escopo pode inflar** — são ~15 arquivos tocados. Ordem de prioridade se faltar tempo: primitivos (`Skeleton`/`EmptyState`/`reduce-motion`) → Dashboard → Transações → Carteiras (+Detalhe) → Metas → Análise → Perfil. Perfil e Análise podem ir num follow-up sem quebrar a fatia.
- **Não regredir os testes de tela existentes** — muitos fazem `getByText` em números e rótulos; as mudanças são aditivas (props de a11y, wrappers que preservam texto). Rodar a suíte inteira a cada task.
- **`UndoToast` com reduce-motion** — a barra é o único feedback visual de "quanto falta". Sem animação, ou fica estática (100 %) ou some; decidir no plano (proposta: fica estática em 100 %, o texto já comunica).

---

## A confirmar no plano (não bloqueiam o spec)

- `<Skeleton>` com pulse (default) vs. estático puro — proposta: pulse default, desligado por reduce-motion e por `pulse={false}`.
- Strings de a11y inline vs. um `src/lib/a11y-labels.ts` central — proposta: inline (poucas, contexto local).
- Cap de `maxFontSizeMultiplier` nos numéricos grandes: 1.3 / 1.4 / 1.5 — proposta: 1.4.
- Incluir Perfil + Análise nesta fatia ou empurrar pra follow-up.
- `UndoToast` sob reduce-motion: barra estática em 100 % vs. omitir a barra.
- Design pass (skill `frontend-design`) no plano: aqui o "design" é consistência, não um momento-herói — a seção de design do plano vira um checklist de tokens/espaçamento dos dois primitivos novos, não um wireframe.
