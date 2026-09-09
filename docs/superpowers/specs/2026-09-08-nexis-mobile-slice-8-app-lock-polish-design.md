# Nexis Mobile — Fatia 8: App lock + acabamento — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D8) — plano a ser derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-8-app-lock-polish.md`
**Sub-projeto:** 8 do `nexis-mobile` — só app, **sem backend**.

---

## Contexto

O app já tem paridade funcional com o PWA (Fatias 1–7). A Fatia 8 é de acabamento: **trava biométrica** ao abrir o app, **haptics** nas ações que ainda não têm, config de **ícone/splash** consistente com o tema escuro, e uma **micro-animação** de entrada nas telas empilhadas.

Uma dep nova: **`expo-local-authentication`** (módulo Expo, roda no Expo Go). `expo-haptics` (Fatia 7) e `expo-secure-store` (Fatia 1) já estão no projeto.

### O que já existe e é relevante

- **`src/app/_layout.tsx`** — root. `<GestureHandlerRootView>` → `<QueryClientProvider>` → `<SessionProvider>` → `<BottomSheetModalProvider>` → `<StatusBar style="light" />` + `<Gate />`. `Gate()`: `isPending` → "Carregando…"; senão `<Stack>` com `(app)` e `(auth)`.
- **`src/auth/session.tsx`** — `useAuthSession()` → `{ session, isPending }`. `session` = `null` quando deslogado.
- **`src/auth/client.ts`** — `authClient` com `storage: SecureStore`, `storagePrefix: 'nexis'`. Exporta `signOut`, `useSession`, etc.
- **`src/app/(app)/_layout.tsx`** — o guard de sessão (`if (!session) return <Redirect href="/login" />`), o `triggerRecurring()` no mount, e o `<TransactionSheetProvider>` vivem aqui, envolvendo os `<Tabs>`. `goals` é registrado como `<Tabs.Screen name="goals" options={{ href: null }} />` (não é aba; aberto por `router.push('/goals')`, sem animação de push).
- **`src/lib/haptics.ts`** (Fatia 7) — `useHaptic()` → `{ tap: selectionAsync, success/error: notificationAsync, heavy: impactAsync }`, tudo em `try/catch` silencioso.
- **`src/components/profile/profile-sheet.tsx`** — sheet do avatar do Dashboard. Blocos: identidade · divisória (`h-px bg-border`) · Categorias (acordeão) · divisória · "Sair da conta" (`LogOut`, `negative`). Já importa `Switch`? não — mas o `wallet-sheet`/Fatia 4 já usam `Switch` de `react-native` em outros lugares (exceção permitida).
- **`app.json`** — `icon: ./assets/images/icon.png`; **`ios.icon: ./assets/expo.icon`** (path suspeito, extensão `.icon`); `userInterfaceStyle: dark`; plugin `expo-splash-screen` com `backgroundColor: "#208AEF"` (azul — **destoa** do `bg #09090b` do app) e `image: ./assets/images/splash-icon.png`, `imageWidth: 76`. `expo-secure-store` já é plugin.
- **`src/components/ui/offline-banner.tsx`** — padrão de overlay absoluto animado (referência pra tela de lock).
- **Sem `AppState` em uso** em nenhum lugar hoje.
- Deps: `expo-secure-store` ~57.0.3, `expo-splash-screen` ~57.0.8, `expo-haptics` ~57.0.2. **Sem `expo-local-authentication`.**
- Testes: jest-expo (`npx jest --forceExit`), 159 testes. Gotchas: pin RNTL `^13.3.3`; mock `#/tw`, `#/tw/image`, `lucide-react-native` (objeto plano), `expo-router`, `#/components/ui/sheet`, `#/api/*`, `#/lib/haptics`; sem `fireEvent.press` que dispare `useMutation` + `waitFor`; sem `.test.tsx` sob `src/app/`; `jest.mock` factory vars com prefixo `mock`.
- **`nexis-mobile` sem prettier/eslint** — estilo na mão. Barra: `npx tsc --noEmit` limpo + jest verde.

---

## Objetivo da Fatia 8

1. **Bloqueio do app** — trava com biometria (Face ID / Touch ID) ou o passcode do device ao abrir o app e ao voltar do background após > 30s. Toggle no Perfil, persistido em SecureStore. Só quando há sessão.
2. **Haptics padronizado** — `haptic.*` nas ações que ficaram sem (chips de filtro, segmenteds, nav de mês, troca de aba, abrir o sheet, aporte/resgate, CRUD de categoria/meta).
3. **Ícone / splash** — corrigir a config (path do ícone iOS, cor do splash) pra bater com o tema escuro. Troca das artes em si é drop manual de PNG.
4. **Micro-animação** — telas empilhadas (`/goals` e futuras) entram com um fade/slide sutil.

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| D1 | **Dep + camada base** | Nova dep **`expo-local-authentication`** (`npx expo install`). `src/lib/app-lock.ts`: `isAppLockEnabled(): Promise<boolean>` / `setAppLockEnabled(v: boolean): Promise<void>` (SecureStore key `app-lock` via `expo-secure-store`, `'1'`/`'0'`); `canUseAppLock(): Promise<boolean>` (`hasHardwareAsync() && isEnrolledAsync()`); `runAuth(): Promise<boolean>` = `LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear o Nexis', fallbackLabel: 'Usar senha do celular', disableDeviceFallback: false }).then(r => r.success)`. |
| D2 | **Contexto** | `src/lib/app-lock-context.tsx` — `AppLockProvider` + `useAppLock()` → `{ locked: boolean; unlock: () => Promise<void>; enabled: boolean; refreshEnabled: () => void }`. No mount: lê `isAppLockEnabled()`; se `true` → `locked = true`. `AppState` listener: ao sair pra `background`/`inactive` grava `bgAt = Date.now()`; ao voltar pra `active`, se `enabled && Date.now() - bgAt > 30_000` → `locked = true`. `unlock()` chama `runAuth()`; sucesso → `locked = false`. Não trava na tela de login (o provider só ativa quando `useAuthSession().session` existe — recebe `hasSession` por prop do `Gate`, ou lê o contexto de sessão). |
| D3 | **Tela de lock** | `src/components/app-lock-screen.tsx` — `View` absoluto cobrindo tudo (`bg-bg`, `z` alto), centralizado: ícone `LockKeyhole` (48, `accent`), "Nexis bloqueado", `Pressable` "Desbloquear" (`bg-accent`). `useEffect` no mount → chama `unlock()` uma vez (auto-prompt). Se o usuário cancelar, fica na tela com o botão. Renderizada pelo `Gate` do root `_layout` **por cima** do `<Stack>` quando `useAppLock().locked && hasSession`. |
| D4 | **Toggle no Perfil** | Nova linha em `profile-sheet.tsx`, entre a divisória das Categorias e o "Sair da conta": ícone `Lock` + "Bloqueio do app" + `Switch` (de `react-native`). Estado inicial de `isAppLockEnabled()`. Ligar → `runAuth()` de confirmação; só persiste (`setAppLockEnabled(true)`) e liga o switch se `success`. Desligar → `setAppLockEnabled(false)` direto. Se `!canUseAppLock()` → linha desabilitada (`opacity 0.5`) + subtexto "Configure Face ID / Touch ID no celular". Chama `refreshEnabled()` do contexto ao mudar. |
| D5 | **Escopo do lock** | Só quando **há sessão** (`session != null`). Sem sessão → tela de login normal, sem lock. Ao deslogar, o toggle continua salvo mas não trava (não há o que proteger); ao logar de novo, volta a valer. Sem auto-lock por inatividade **dentro** do app (só no `background → foreground` > 30s) — mantém simples. |
| D6 | **Ícone / splash (config)** | `app.json`: remover/corrigir `ios.icon` (`./assets/expo.icon` é inválido — apontar pro mesmo `./assets/images/icon.png` **ou** remover a chave `ios.icon` e deixar herdar do `expo.icon`). `expo-splash-screen` plugin: `backgroundColor` `#208AEF` → **`#09090b`** (bate com `bg` e `userInterfaceStyle: dark`). **Não** trocar os PNGs (isso é entrega de asset, fora do escopo de código) — se o usuário fornecer artes novas, é só substituir os arquivos em `assets/images/`. |
| D7 | **Haptics padronizado** | Adicionar `useHaptic()` e chamar: **`tap`** em — chips de filtro (`transactions.tsx`), segmented de tipo (`transaction-sheet`, `category-sheet`, toggle Despesas/Receitas do `profile-sheet`), nav de mês `‹ ›` (`transactions.tsx` e `BudgetsSection` da `analytics.tsx`), troca de aba (`<Tabs screenListeners={{ tabPress: () => haptic.tap() }}>` no `(app)/_layout` ou `(tabs)/_layout`), abrir o sheet de transação (`openNew`/`openEdit` no `transaction-sheet-context`). **`success`** em — aporte/resgate de meta OK (`goal-move-sheet`), categoria/meta criada/editada (`category-sheet`, `goal-sheet`). **`error`** em — categoria/meta excluída (`profile-sheet`, `goal-sheet`), aporte/resgate recusado por validação (`goal-move-sheet`). O `budget-sheet` e `transaction-sheet` já têm `success`/`error` (Fatia 5/7). |
| D8 | **Micro-animação de tela empilhada** | `goals.tsx` (e o padrão pra futuras): envolver o conteúdo raiz num `Animated.View` com `opacity` 0→1 e `translateY` 8→0, `duration` 180ms, `useNativeDriver: true`, disparado no mount. **Não** refatorar a estrutura de rotas (`Stack`-sobre-`Tabs`) nesta fatia — fica anotado como melhoria futura (daria push/swipe-back nativo). Extrair num helper `src/components/ui/screen-enter.tsx` (`<ScreenEnter>{children}</ScreenEnter>`) pra reuso. |

---

## Arquitetura (delta sobre a Fatia 7)

```
nexis-mobile
  package.json                          # + expo-local-authentication
  app.json                              # ios.icon + splash backgroundColor
  src/lib/app-lock.ts                   # NEW: enabled flag (SecureStore) + runAuth + canUseAppLock
  src/lib/app-lock.test.ts              # NEW
  src/lib/app-lock-context.tsx          # NEW: AppLockProvider + useAppLock
  src/lib/app-lock-context.test.tsx     # NEW
  src/components/app-lock-screen.tsx    # NEW
  src/components/__tests__ (ou src/__tests__)/app-lock-screen.test.tsx  # NEW
  src/components/ui/screen-enter.tsx    # NEW: <ScreenEnter> (fade/slide)
  src/app/_layout.tsx                   # MOD: <AppLockProvider> + <AppLockScreen/> no Gate
  src/components/profile/profile-sheet.tsx  # MOD: linha "Bloqueio do app" + haptics
  src/__tests__/profile-sheet.test.tsx      # MOD
  src/app/(app)/_layout.tsx            # MOD: screenListeners tabPress → haptic.tap()
  src/app/(app)/transactions.tsx       # MOD: haptic.tap() nos chips + nav de mês
  src/app/(app)/goals.tsx              # MOD: <ScreenEnter>
  src/components/transactions/transaction-sheet.tsx  # MOD: haptic.tap() no segmented de tipo
  src/components/transactions/transaction-sheet-context.tsx  # MOD: haptic.tap() no openNew/openEdit
  src/components/profile/category-sheet.tsx   # MOD: haptic.tap() no segmented; success/error
  src/components/goals/goal-sheet.tsx         # MOD: success/error
  src/components/goals/goal-move-sheet.tsx    # MOD: success no OK, error na validação
  src/components/budgets/budgets-section.tsx  # MOD: haptic.tap() na nav de mês
```

### `src/lib/app-lock.ts`
```ts
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

const KEY = 'app-lock'

export async function isAppLockEnabled(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(KEY)) === '1' } catch { return false }
}
export async function setAppLockEnabled(v: boolean): Promise<void> {
  try { await SecureStore.setItemAsync(KEY, v ? '1' : '0') } catch { /* noop */ }
}
export async function canUseAppLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
  } catch { return false }
}
export async function runAuth(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear o Nexis',
      fallbackLabel: 'Usar senha do celular',
    })
    return r.success
  } catch { return false }
}
```

### `src/lib/app-lock-context.tsx` (esboço)
```ts
const Ctx = createContext<...>(null)
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { session } = useAuthSession()
  const hasSession = !!session
  const [enabled, setEnabled] = useState(false)
  const [locked, setLocked] = useState(false)
  const bgAt = useRef(0)

  useEffect(() => { isAppLockEnabled().then((e) => { setEnabled(e); if (e && hasSession) setLocked(true) }) }, [])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') bgAt.current = Date.now()
      else if (s === 'active' && enabled && hasSession && Date.now() - bgAt.current > 30_000) setLocked(true)
    })
    return () => sub.remove()
  }, [enabled, hasSession])

  const unlock = useCallback(async () => { if (await runAuth()) setLocked(false) }, [])
  const refreshEnabled = useCallback(() => { isAppLockEnabled().then(setEnabled) }, [])

  return <Ctx.Provider value={{ locked: locked && hasSession, unlock, enabled, refreshEnabled }}>{children}</Ctx.Provider>
}
```
`AppLockProvider` vai **dentro** do `SessionProvider` (precisa de `useAuthSession`) e **fora** do `Gate`.

### `src/app/_layout.tsx` (delta)
```tsx
<SessionProvider>
  <AppLockProvider>
    <BottomSheetModalProvider>
      <StatusBar style="light" />
      <Gate />
    </BottomSheetModalProvider>
  </AppLockProvider>
</SessionProvider>
```
No `Gate()`: `const { locked } = useAppLock()` → depois do `<Stack>`, `{locked && <AppLockScreen />}`.

---

## Testes

**`nexis-mobile` (jest-expo, `--forceExit`):**
- `app-lock.test.ts` — mock `expo-secure-store` + `expo-local-authentication`. `isAppLockEnabled` lê `'1'`→true / ausente→false / erro→false; `setAppLockEnabled(true)` grava `'1'`; `canUseAppLock` = AND de hasHardware/isEnrolled; `runAuth` mapeia `{ success }` e engole exceção → false.
- `app-lock-context.test.tsx` — mock `#/lib/app-lock` (`mockIsEnabled`, `mockRunAuth`), `#/auth/session` (`useAuthSession` → com sessão), `react-native` `AppState` (`addEventListener` capturando o handler). Casos: enabled + sessão → `locked` true no mount; `unlock()` com `runAuth`→true → `locked` false; simular `background` e depois `active` com `> 30s` (fake timers) → re-tranca; sem sessão → `locked` sempre false.
- `app-lock-screen.test.tsx` — render de "Nexis bloqueado" + botão "Desbloquear"; mock `#/lib/app-lock-context` (`useAppLock` → `{ locked: true, unlock: jest.fn() }`), `#/tw`, `lucide`.
- `screen-enter.test.tsx` — renderiza os `children` (a animação não bloqueia).
- `profile-sheet.test.tsx` (MOD) — a linha "Bloqueio do app" aparece; mock `#/lib/app-lock` + `#/lib/app-lock-context`. (sem apertar o Switch de mutation.)
- Haptics: os testes de tela que já mockam `#/lib/haptics` cobrem os call sites novos sem asserção extra.

Alvo: +14–18 jest (total ~175+).

**Barra:** `npx tsc --noEmit` limpo; suíte verde. **Sem backend.**

---

## Verificar no device

- `npx expo start --tunnel`, Expo Go no iPhone (Face ID / Touch ID configurado).
- **Ligar o bloqueio**: Perfil → "Bloqueio do app" → o toggle pede Face ID; confirmando, fica ligado. Sem biometria no device → linha desabilitada com o aviso.
- **Cold start**: fechar o app de vez e reabrir → tela "Nexis bloqueado" + prompt de Face ID automático; falhar/cancelar → fica travado com o botão "Desbloquear"; passar → entra no app.
- **Background**: sair do app por > 30s e voltar → trava de novo. Voltar em < 30s → **não** trava.
- **Sem sessão**: deslogar → não pede biometria (login normal). Logar → volta a valer.
- **Haptics** (device físico): vibração leve ao tocar chip de filtro, segmented de tipo, `‹ ›` de mês, trocar de aba, abrir o sheet de transação; vibração de sucesso ao aportar/resgatar e criar/editar categoria/meta; de erro ao excluir e em validação recusada.
- **Splash**: a tela de abertura tem fundo escuro (`#09090b`), sem o azul antigo.
- **Ícone**: build/preview do app mostra o ícone certo no iOS (sem erro de asset).
- **Animação**: abrir a tela de Metas → entra com um fade/slide sutil.
- `tsc --noEmit` limpo + jest verde.

---

## Fora de escopo (Fatia 8)

- **Push remoto / notificações** (exige dev build).
- **Refactor `Stack`-sobre-`Tabs`** pra push/swipe-back nativo em `/goals` — anotado como melhoria futura; a Fatia 8 só adiciona a micro-animação.
- **Artes novas** de ícone / splash — só a config; os PNGs são substituição manual.
- **PIN próprio do app** — usa o fallback do sistema (`authenticateAsync` cai pro passcode do device).
- **Auto-lock por inatividade dentro do app** (só `background → foreground` > 30s).
- Bloqueio por transação individual / "cofre" separado.

---

## Riscos / pontos de atenção

- **`expo-local-authentication` no Expo Go** — módulo Expo suportado. No **simulador** não há biometria enrolada → `canUseAppLock()` false, o toggle fica desabilitado; testar em device físico.
- **`AppState` no jest** — mockar `AppState.addEventListener` (capturar o callback) e usar `jest.useFakeTimers()` pro teste do timeout de 30s.
- **Ordem dos providers** — `AppLockProvider` precisa de `useAuthSession`, então fica **dentro** do `SessionProvider`. A `AppLockScreen` renderiza por cima do `<Stack>` — garantir `zIndex`/`elevation` alto e cobrir o `insets` todo (`position: 'absolute', inset: 0`).
- **Deadlock de re-prompt** — se `runAuth()` falhar, **não** re-chamar em loop; só no mount uma vez + no botão. `unlock()` idempotente.
- **`disableDeviceFallback`** — deixar `false` pra o usuário sem biometria (mas com passcode) ainda conseguir; se `true`, um device sem Face ID enrolado ficaria preso. `canUseAppLock` já barra o caso sem nada configurado.
- **SecureStore no cold start** — `isAppLockEnabled()` é async; enquanto resolve, **não** mostrar o app destravado por um frame se estava pra travar. Iniciar `locked` como `false` mas, se a intenção for travar, o `AppLockScreen` cobre assim que o `useEffect` resolve (aceitável — janela de ~1 frame; ou iniciar `locked = true` "pessimista" e destravar se `!enabled`). **Decisão: pessimista** — `locked` começa `true`; o `useEffect` destrava se `!enabled || !hasSession`.
- **Troca de aba + haptic** — `screenListeners.tabPress` dispara também ao tocar na aba já ativa; aceitável (é o comportamento iOS).
- **Reanimated vs Animated** — usar `Animated` do `react-native` (não reanimated) pro `ScreenEnter`, `useNativeDriver: true` — leve, sem risco.

---

## A confirmar no plano (não bloqueiam o spec)

- `locked` inicial pessimista (`true`, proposto) vs. otimista com splash segurando.
- Timeout de background: 30s (proposto) vs. configurável / 60s.
- `AppLockScreen` como overlay no `Gate` (proposto) vs. uma rota `(app)/lock`.
- `ScreenEnter` só em `/goals` agora, ou já aplicar no `transaction-sheet`/outros sheets também.
- Corrigir `ios.icon` removendo a chave vs. apontando pro `icon.png` (proposto: remover, herda do `expo.icon`).
- Vibrar em `tabPress` sempre vs. só quando muda de aba.
