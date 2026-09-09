# Nexis Mobile — Fatia 8 (App lock + acabamento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trava biométrica ao abrir o `nexis-mobile` (e ao voltar do background > 30s), toggle no Perfil, haptics padronizado, config de ícone/splash consistente com o tema escuro, e micro-animação de entrada nas telas empilhadas.

**Architecture:** Só app, **sem backend**. `expo-local-authentication` nova. Camada `src/lib/app-lock.ts` (flag em SecureStore + `runAuth`/`canUseAppLock`), `AppLockProvider`/`useAppLock` (contexto, `AppState`), `AppLockScreen` (overlay no `Gate` do root `_layout`, dentro do `SessionProvider`). Haptics via o `useHaptic()` que já existe (Fatia 7). `<ScreenEnter>` = `Animated` fade/slide.

**Tech Stack:** Expo Router + NativeWind/react-native-css + TanStack Query + zod + jest-expo. Dep nova: `expo-local-authentication` (Expo Go OK). `expo-secure-store` / `expo-haptics` já são deps.

**Spec:** `docs/superpowers/specs/2026-09-08-nexis-mobile-slice-8-app-lock-polish-design.md`

## Global Constraints

- **Um repo.** Tudo no `nexis-mobile` (`/home/welbertbarbosa/projects/personal/nexis-mobile`). Branch `feat/mobile-slice-8-app-lock` de `origin/main`.
- **`locked` pessimista** — o contexto começa `locked: true`; o `useEffect` destrava se `!enabled || !hasSession`. Nunca mostrar o app destravado por um frame quando a intenção é travar.
- **Lock só com sessão** — `AppLockProvider` lê `useAuthSession()`; sem `session`, `locked` é sempre `false`.
- **Sem loop de re-prompt** — `runAuth()` só no mount (uma vez) e no botão "Desbloquear". `unlock()` idempotente.
- **App UI** só de `#/tw` / `#/tw/image`. Exceções já em uso + `expo-local-authentication`, `AppState` de `react-native`, `Switch` de `react-native`.
- **Testes** — mock `expo-local-authentication`, `expo-secure-store`, `react-native` `AppState` (capturar o handler), `#/lib/app-lock`, `#/lib/app-lock-context`, `#/lib/haptics`, `#/tw`, `lucide-react-native` (objeto plano), `#/components/ui/sheet`. `jest.mock` factory vars com prefixo `mock`. Sem `fireEvent.press` que dispare `useMutation` + `waitFor`. Sem `.test.tsx` sob `src/app/`.
- **`nexis-mobile` sem prettier/eslint** — estilo na mão (sem `;`, aspas simples, 2 espaços). Barra por task: `npx tsc --noEmit` limpo + jest verde (`--forceExit`).
- **Commits** — pt-BR, escopo da task, commit ao fim de cada task. `gh` em `~/.local/bin/gh`, autenticado.

---

## File Structure

- `package.json` / `package-lock.json` — MOD: `expo-local-authentication`.
- `app.json` — MOD: `ios.icon`, splash `backgroundColor`.
- `src/lib/app-lock.ts` + `src/lib/app-lock.test.ts` — NEW.
- `src/lib/app-lock-context.tsx` + `src/lib/app-lock-context.test.tsx` — NEW.
- `src/components/app-lock-screen.tsx` + `src/__tests__/app-lock-screen.test.tsx` — NEW.
- `src/components/ui/screen-enter.tsx` + `src/__tests__/screen-enter.test.tsx` — NEW.
- `src/app/_layout.tsx` — MOD: providers + overlay.
- `src/app/(app)/_layout.tsx` — MOD: `screenListeners` tabPress → haptic.
- `src/app/(app)/goals.tsx` — MOD: `<ScreenEnter>`.
- `src/app/(app)/transactions.tsx` — MOD: haptic nos chips + nav de mês.
- `src/components/profile/profile-sheet.tsx` + `src/__tests__/profile-sheet.test.tsx` — MOD: toggle + haptics.
- `src/components/transactions/transaction-sheet.tsx` — MOD: haptic no segmented.
- `src/components/transactions/transaction-sheet-context.tsx` — MOD: haptic no open.
- `src/components/profile/category-sheet.tsx` — MOD: haptic (segmented + success/error).
- `src/components/goals/goal-sheet.tsx` — MOD: success/error.
- `src/components/goals/goal-move-sheet.tsx` — MOD: success/error.
- `src/components/budgets/budgets-section.tsx` — MOD: haptic na nav de mês.

---

## Task 1: dep + `src/lib/app-lock.ts`

**Files:** `package.json`; New `src/lib/app-lock.ts`, `src/lib/app-lock.test.ts`

**Interfaces:** `isAppLockEnabled(): Promise<boolean>`, `setAppLockEnabled(v: boolean): Promise<void>`, `canUseAppLock(): Promise<boolean>`, `runAuth(): Promise<boolean>`.

- [ ] **Step 1: Setup + dep**

```bash
cd /home/welbertbarbosa/projects/personal/nexis-mobile
git fetch origin -q && git checkout -b feat/mobile-slice-8-app-lock origin/main
npx expo install expo-local-authentication
```
Conferir o diff de `package.json` (só `expo-local-authentication`).

- [ ] **Step 2: `src/lib/app-lock.ts`** — ver spec §`app-lock.ts`. Key SecureStore `'app-lock'`, `'1'`/`'0'`. Cada função em `try/catch` (SecureStore/LocalAuthentication podem lançar).

- [ ] **Step 3: `app-lock.test.ts`** — `jest.mock('expo-secure-store', () => ({ getItemAsync: mockGet, setItemAsync: mockSet }))`, `jest.mock('expo-local-authentication', () => ({ hasHardwareAsync: mockHasHw, isEnrolledAsync: mockEnrolled, authenticateAsync: mockAuth }))`. Casos:
  - `isAppLockEnabled` → `mockGet` `'1'` ⇒ true; `null` ⇒ false; `mockGet` rejeita ⇒ false.
  - `setAppLockEnabled(true)` ⇒ `mockSet` com `('app-lock','1')`.
  - `canUseAppLock` ⇒ AND de `hasHardwareAsync`/`isEnrolledAsync`; se um é false ⇒ false.
  - `runAuth` ⇒ `mockAuth` `{ success: true }` ⇒ true; `{ success: false }` ⇒ false; `mockAuth` rejeita ⇒ false.

- [ ] **Step 4: Verificar** — `npx jest --forceExit src/lib/app-lock.test.ts && npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git commit -m "feat: expo-local-authentication + src/lib/app-lock"`

---

## Task 2: `src/lib/app-lock-context.tsx`

**Files:** New `src/lib/app-lock-context.tsx`, `src/lib/app-lock-context.test.tsx`

**Interfaces:** `AppLockProvider({ children })`; `useAppLock(): { locked: boolean; unlock: () => Promise<void>; enabled: boolean; refreshEnabled: () => void }`.

- [ ] **Step 1: Implementar** — ver spec §`app-lock-context.tsx`. Detalhes:
  - `const { session } = useAuthSession()`; `const hasSession = !!session`.
  - `const [enabled, setEnabled] = useState(false)`; `const [locked, setLocked] = useState(true)` (**pessimista**).
  - `useEffect(() => { isAppLockEnabled().then((e) => { setEnabled(e); setLocked(e && hasSession) }) }, [hasSession])` — resolve o estado inicial; se não é pra travar, destrava.
  - `AppState` listener em `useEffect([enabled, hasSession])`: `background`/`inactive` → `bgAt.current = Date.now()`; `active` → se `enabled && hasSession && Date.now() - bgAt.current > 30_000` → `setLocked(true)`.
  - `unlock = useCallback(async () => { if (await runAuth()) setLocked(false) }, [])`.
  - `refreshEnabled = useCallback(() => { isAppLockEnabled().then((e) => { setEnabled(e); if (!e) setLocked(false) }) }, [])`.
  - `value = useMemo(() => ({ locked: locked && hasSession, unlock, enabled, refreshEnabled }), [locked, hasSession, enabled, unlock, refreshEnabled])`.
  - `useAppLock()` lança se usado fora do provider.

- [ ] **Step 2: Teste** — mock `#/lib/app-lock` (`mockIsEnabled`, `mockRunAuth`), `#/auth/session` (`useAuthSession: () => ({ session: mockSession })` — variável mutável entre casos ou re-`jest.doMock`), e `AppState`:
  ```ts
  let appStateHandler: (s: string) => void
  jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native')
    return { ...RN, AppState: { addEventListener: (_: string, h: any) => { appStateHandler = h; return { remove: jest.fn() } } } }
  })
  ```
  Um componente de teste que consome `useAppLock()` e renderiza `locked ? 'LOCKED' : 'OPEN'`. Casos:
  - `mockIsEnabled` → true + sessão → texto "LOCKED" (após o `act`/flush do `useEffect`).
  - `mockIsEnabled` → false → "OPEN".
  - enabled + sessão + `unlock()` com `mockRunAuth`→true → "OPEN".
  - `jest.useFakeTimers()`; enabled; disparar `appStateHandler('background')`, avançar 31s, `appStateHandler('active')` → "LOCKED".
  - sem sessão (`session: null`) → sempre "OPEN".

- [ ] **Step 3: Verificar** — jest + `tsc`.

- [ ] **Step 4: Commit** — `git commit -m "feat: AppLockProvider / useAppLock (AppState + timeout de 30s)"`

---

## Task 3: `src/components/app-lock-screen.tsx`

**Files:** New `src/components/app-lock-screen.tsx`, `src/__tests__/app-lock-screen.test.tsx`

- [ ] **Step 1: Implementar** — `const { unlock } = useAppLock()`. `View` `style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 999 }}` `className="items-center justify-center bg-bg gap-4"`. Ícone `LockKeyhole` (48, `colors.accent`), `Text` "Nexis bloqueado" (`text-base font-semibold text-fg`), `Text` "Use o Face ID pra continuar" (`text-xs text-muted`), `Pressable` "Desbloquear" (`bg-accent rounded-2xl px-6 py-3`, `Text text-white font-semibold`) → `unlock()`. `useEffect(() => { unlock() }, [])` — auto-prompt uma vez. `useRef` pra não re-disparar.

- [ ] **Step 2: Teste** — mock `#/lib/app-lock-context` (`useAppLock: () => ({ locked: true, unlock: mockUnlock })`), `#/tw`, `lucide` (objeto plano). Asserts: "Nexis bloqueado" e "Desbloquear" presentes; `mockUnlock` foi chamado no mount (auto-prompt); `fireEvent.press` em "Desbloquear" chama de novo.

- [ ] **Step 3: Verificar** — jest + `tsc`.

- [ ] **Step 4: Commit** — `git commit -m "feat: app-lock-screen (overlay de bloqueio)"`

---

## Task 4: `<ScreenEnter>` + wire em `goals.tsx`

**Files:** New `src/components/ui/screen-enter.tsx`, `src/__tests__/screen-enter.test.tsx`; Modify `src/app/(app)/goals.tsx`

- [ ] **Step 1: `screen-enter.tsx`** — `import { Animated } from 'react-native'`. `const v = useRef(new Animated.Value(0)).current`. `useEffect(() => { Animated.timing(v, { toValue: 1, duration: 180, useNativeDriver: true }).start() }, [v])`. `return <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>`.

- [ ] **Step 2: `goals.tsx`** — envolver o `return (<><ScrollView.../><GoalSheet.../>...</>)` num `<ScreenEnter>`. O `<ScreenEnter>` fica **por fora** do fragmento (`<ScreenEnter><>...</></ScreenEnter>` ou envolver só a `ScrollView` — envolver tudo é mais simples; os sheets são `position: absolute` de qualquer forma).

- [ ] **Step 3: `screen-enter.test.tsx`** — mock `#/tw` não é necessário (usa `Animated` cru). `render(<ScreenEnter><Text>oi</Text></ScreenEnter>)` → `getByText('oi')`.

- [ ] **Step 4: Verificar** — jest + `tsc` + `npx jest --forceExit src/__tests__/goals-screen.test.tsx` (garantir que o wrap não quebrou; se o teste mockar `#/tw` e não `Animated`, ok — `Animated` sobe no jest).

- [ ] **Step 5: Commit** — `git commit -m "feat: ScreenEnter (fade/slide) na tela de Metas"`

---

## Task 5: wire no root `src/app/_layout.tsx`

**Files:** Modify `src/app/_layout.tsx`

- [ ] **Step 1: Implementar** — `import { AppLockProvider, useAppLock } from '#/lib/app-lock-context'` + `import { AppLockScreen } from '#/components/app-lock-screen'`. Envolver: `<SessionProvider><AppLockProvider><BottomSheetModalProvider>...<Gate /></BottomSheetModalProvider></AppLockProvider></SessionProvider>`. No `Gate()`: `const { locked } = useAppLock()`; depois do `<Stack>...</Stack>` (num fragmento), `{locked && <AppLockScreen />}`.

- [ ] **Step 2: Verificar** — `npx tsc --noEmit && npx jest --forceExit`. **Atenção:** testes de tela que renderizam via `#/app/...` não montam o root `_layout`, então não precisam mockar o `AppLockProvider`. Se algum teste montar o root (não deve), mockar `#/lib/app-lock-context`.

- [ ] **Step 3: Commit** — `git commit -m "feat: AppLockProvider + overlay de bloqueio no root layout"`

---

## Task 6: toggle "Bloqueio do app" no `profile-sheet`

**Files:** Modify `src/components/profile/profile-sheet.tsx`, `src/__tests__/profile-sheet.test.tsx`

- [ ] **Step 1: Implementar** — `import { Switch } from 'react-native'`, `import { Lock } from 'lucide-react-native'`, `import { isAppLockEnabled, setAppLockEnabled, canUseAppLock, runAuth } from '#/lib/app-lock'`, `import { useAppLock } from '#/lib/app-lock-context'`, `import { useHaptic } from '#/lib/haptics'`.
  - `const { refreshEnabled } = useAppLock()`; `const haptic = useHaptic()`.
  - `const [lockOn, setLockOn] = useState(false)`; `const [canLock, setCanLock] = useState(false)`.
  - `useEffect(() => { isAppLockEnabled().then(setLockOn); canUseAppLock().then(setCanLock) }, [])`.
  - `async function toggleLock(next: boolean) { if (next) { const ok = await runAuth(); if (!ok) return } await setAppLockEnabled(next); setLockOn(next); refreshEnabled() }`.
  - Nova linha **entre a divisória das Categorias e o "Sair da conta"**: `View flex-row items-center gap-3 px-1 py-2` — `Lock` (18, `muted`) + `View flex-1` (`Text text-sm text-fg` "Bloqueio do app" + se `!canLock` um `Text text-[11px] text-muted` "Configure Face ID / Touch ID no celular") + `Switch value={lockOn} onValueChange={toggleLock} disabled={!canLock}`. `style={{ opacity: canLock ? 1 : 0.5 }}`.
- [ ] **Step 2: Haptics no delete de categoria** — no `remove` mutation (`onSuccess`) do `profile-sheet`, `haptic.error()`. No toggle Despesas/Receitas do acordeão, `haptic.tap()`.
- [ ] **Step 3: Teste (MOD)** — mock `#/lib/app-lock` (`isAppLockEnabled: jest.fn().mockResolvedValue(false)`, `canUseAppLock: jest.fn().mockResolvedValue(true)`, `setAppLockEnabled: jest.fn()`, `runAuth: jest.fn()`), `#/lib/app-lock-context` (`useAppLock: () => ({ refreshEnabled: jest.fn() })`), `#/lib/haptics`. Assert: "Bloqueio do app" aparece; o `Switch` renderiza. (sem apertar o switch — envolve async.)
- [ ] **Step 4: Verificar** — jest + `tsc`.
- [ ] **Step 5: Commit** — `git commit -m "feat: toggle Bloqueio do app no Perfil"`

---

## Task 7: haptics padronizado (call sites)

**Files:** Modify `src/app/(app)/_layout.tsx`, `src/app/(app)/transactions.tsx`, `src/components/transactions/transaction-sheet.tsx`, `src/components/transactions/transaction-sheet-context.tsx`, `src/components/profile/category-sheet.tsx`, `src/components/goals/goal-sheet.tsx`, `src/components/goals/goal-move-sheet.tsx`, `src/components/budgets/budgets-section.tsx`

- [ ] **Step 1: `(app)/_layout.tsx`** — `const haptic = useHaptic()`; no `<Tabs screenListeners={{ tabPress: () => haptic.tap() }}>`.
- [ ] **Step 2: `transactions.tsx`** — `haptic` já não existe? tem (`useHaptic` da Fatia 7). `haptic.tap()` no `onPress` de cada `FilterChip` (dentro dos `setFilter*`) e no `shift()` (nav de mês).
- [ ] **Step 3: `transaction-sheet.tsx`** — `haptic.tap()` no `onPress` do segmented de tipo (Despesa/Receita).
- [ ] **Step 4: `transaction-sheet-context.tsx`** — `const haptic = useHaptic()`; `haptic.tap()` no `openNew()` e `openEdit()`.
- [ ] **Step 5: `category-sheet.tsx`** — `const haptic = useHaptic()`; `haptic.tap()` no segmented de tipo; `haptic.success()` no `save.onSuccess`.
- [ ] **Step 6: `goal-sheet.tsx`** — `const haptic = useHaptic()`; `haptic.success()` no `save.onSuccess`; `haptic.error()` no `remove.onSuccess`.
- [ ] **Step 7: `goal-move-sheet.tsx`** — `const haptic = useHaptic()`; `haptic.success()` no `move.onSuccess`; `haptic.error()` quando `overBalance || overSaved` bloqueia (no `onPress` do Confirmar, antes do `return`, se `invalid`).
- [ ] **Step 8: `budgets-section.tsx`** — `const haptic = useHaptic()`; `haptic.tap()` no `onPrev`/`onNext` (ou no `RoundBtn` press).
- [ ] **Step 9: Verificar** — `npx tsc --noEmit && npx jest --forceExit`. Testes de tela que já mockam `#/lib/haptics` passam; onde algum teste **não** mockar e o componente passar a importar `#/lib/haptics`, adicionar o mock (`useHaptic: () => ({ tap: jest.fn(), success: jest.fn(), error: jest.fn(), heavy: jest.fn() })`). Prováveis: `budget-sheet`/`budgets-section` (via analytics-screen), `goal-*` (via goals-screen), `category-sheet` (via profile-sheet ou próprio teste), `transaction-sheet-context` (via qualquer tela que use o provider — mas as telas mockam o context).
- [ ] **Step 10: Commit** — `git commit -m "feat: haptics padronizado (chips, segmenteds, nav, abas, aporte/resgate, CRUD)"`

---

## Task 8: `app.json` (ícone/splash), suíte, checklist, PR

**Files:** Modify `app.json`

- [ ] **Step 1: `app.json`** — **remover** a chave `ios.icon` (path `./assets/expo.icon` inválido; herda de `expo.icon`). No plugin `expo-splash-screen`: `backgroundColor` `"#208AEF"` → `"#09090b"`. **Não** mexer nos PNGs.

- [ ] **Step 2: Suíte** — `npx tsc --noEmit && npx jest --forceExit`. Tudo verde (~175+).

- [ ] **Step 3: Checklist de device** (usuário — `npx expo start --tunnel`, device físico com Face ID):
  - [ ] Perfil → "Bloqueio do app": liga com Face ID de confirmação; sem biometria no device → linha desabilitada + aviso.
  - [ ] Fechar o app e reabrir → tela "Nexis bloqueado" + prompt automático; cancelar → fica travado com botão; passar → entra.
  - [ ] Sair > 30s e voltar → trava de novo; voltar em < 30s → não trava.
  - [ ] Deslogar → não pede biometria; logar → volta a valer.
  - [ ] Haptics: chip de filtro, segmented de tipo, `‹ ›` de mês, trocar de aba, abrir o sheet de transação → vibração leve; aportar/resgatar e criar/editar categoria/meta → sucesso; excluir / validação recusada → erro.
  - [ ] Splash com fundo escuro; ícone iOS ok (sem erro de asset).
  - [ ] Abrir a tela de Metas → entra com fade/slide sutil.
  - [ ] `tsc` limpo + jest verde.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/mobile-slice-8-app-lock
gh pr create --repo Welbert-Soares/nexis-mobile --base main \
  --title "feat: Fatia 8 — bloqueio do app + acabamento" \
  --body "Trava biométrica (expo-local-authentication) ao abrir o app e ao voltar do background >30s; toggle \"Bloqueio do app\" no Perfil (SecureStore); só com sessão. Haptics padronizado (chips, segmenteds, nav de mês, abas, aporte/resgate, CRUD). app.json: ios.icon corrigido + splash escuro. Micro-animação de entrada na tela de Metas. Sem backend. Spec/plano: nexis.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Rollback

- Reverter o PR tira o lock, os haptics extras e a animação; a dep `expo-local-authentication` sai junto. `app.json` volta ao estado anterior (incluindo o `ios.icon` quebrado — que já estava lá).
