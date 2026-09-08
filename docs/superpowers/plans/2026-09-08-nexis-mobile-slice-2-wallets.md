# Nexis Mobile — Fatia 2 (Carteiras: leitura + escrita) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba **Carteiras** do `nexis-mobile` (Expo Go): listar carteiras com saldos reais, **criar**, **editar**, **excluir** e **transferir** — persistindo no banco de produção via rotas novas `/api/mobile/wallets*`. Prova a pipeline de **escrita** do app.

**Spec:** `docs/superpowers/specs/2026-09-08-nexis-mobile-slice-2-wallets-design.md` (decisões D1–D8 travadas).

**Architecture:** `nexis` ganha só código aditivo (3 arquivos de rota `/api/mobile/wallets*` reusando `wallet.repository.ts` intocado). `nexis-mobile` ganha: `apiSend/apiPost/apiDelete`, `walletsQuery` + mutations, tela `wallets.tsx`, `wallet-sheet` + `transfer-sheet` em `@gorhom/bottom-sheet`, port de `CurrencyInput` e `CATEGORY_ICONS`, nova aba `<Tabs>`.

---

## Global Constraints

- **Dois repos.** `nexis` = `/home/welbertbarbosa/projects/personal/nexis`. `nexis-mobile` = `/home/welbertbarbosa/projects/personal/nexis-mobile` (irmão). Cada task diz onde opera.
- **`nexis` só aditivo.** Nenhuma rota/service/componente web muda. Zero regressão nos testes atuais (40).
- **`nexis-mobile`:** UI só de `#/tw` / `#/tw/image` — nunca `react-native` direto (exceções já aceitas: `RefreshControl`, `useSafeAreaInsets`, e agora `@gorhom/bottom-sheet` + `react-native/Pressable` cru só onde o `#/tw` não cobre). TS strict nos dois.
- **Testes de tela vão em `src/__tests__/`** — nunca sob `src/app/` (o `require.context` do expo-router empacota como rota). Importam via `#/app/(app)/...`.
- **Alvo Expo Go.** Sem `expo prebuild`. `npx expo install` pra libs.
- **Padrão de tela (herdado da Fatia 1):** render imediato (cache/vazio) + dados depois; `useSafeAreaInsets` no `paddingTop`; `RefreshControl` com `progressViewOffset={insets.top + 8}`; skeleton só em `isLoading && !data`; sem animação de entrada.
- **Mutations:** `useMutation` → `onSuccess` invalida `['wallets']` **e** `['dashboard']` (saldos mudam).
- **Commits terminam com:**
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: <a sessão que estiver executando>
  ```
- **Nunca commitar em `main` no `nexis`.** Branch `feat/mobile-slice-2-wallets-backend`, PR. `nexis-mobile` continua commitando na `main` (repo solo) e dando push ao fim de cada task ou grupo.
- **`.env` do `nexis-mobile` não é versionado** (Fatia 1 fechou isso; `.env.example` documenta `EXPO_PUBLIC_API_URL`).

---

## File Structure

### Repo `nexis` (aditivo)

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `src/routes/api/mobile/wallets.ts` | `GET` (lista) + `POST` (criar) | 2 |
| `src/routes/api/mobile/wallets.$id.ts` | `POST` (editar) + `DELETE` | 2 |
| `src/routes/api/mobile/wallets.transfer.ts` | `POST` (transferir) | 2 |
| `src/routes/api/mobile/wallets*.test.ts` | vitest dos handlers (mock auth + repo) | 2 |

### Repo `nexis-mobile`

| Arquivo | Responsabilidade | Task |
|---|---|---|
| root `_layout.tsx` | `GestureHandlerRootView` + `BottomSheetModalProvider` | 1 |
| `src/components/ui/sheet.tsx` | wrapper de `@gorhom/bottom-sheet` (tema, handle, backdrop) | 1 |
| `src/api/client.ts` | + `apiSend` / `apiPost` / `apiDelete` | 3 |
| `src/api/client.test.ts` | + casos de `apiSend` | 3 |
| `src/lib/category-icons.ts` | port de `CATEGORY_ICONS` (lucide-react-native) | 4 |
| `src/lib/wallet-meta.ts` | `WALLET_META`, `WALLET_TYPES`, `WALLET_COLORS` | 4 |
| `src/schemas/wallet.ts` + `.test.ts` | `WalletSchema`/`WalletsSchema` + bodies | 4 |
| `src/app/(app)/index.tsx` | usa `CATEGORY_ICONS` no `TxRow` (TODO da Fatia 1) | 4 |
| `src/api/wallets.ts` | `walletsQuery` + `createWallet`/`editWallet`/`deleteWallet`/`transferWallets` | 5 |
| `src/components/ui/currency-input.tsx` + test | input BRL (cents) | 6 |
| `src/app/(app)/wallets.tsx` | tela lista + header + abre sheets | 7 |
| `src/components/wallets/wallet-card.tsx` | linha da lista (lógica de crédito) | 7 |
| `src/app/(app)/_layout.tsx` | + aba "Carteiras" | 7 |
| `src/__tests__/wallets-screen.test.tsx` | render da tela | 7 |
| `src/components/wallets/wallet-sheet.tsx` | form criar/editar + excluir | 8 |
| `src/components/wallets/transfer-sheet.tsx` | form transferência | 8 |
| `src/__tests__/wallet-sheet.test.tsx` | render/submit do sheet | 8 |

---

## Task 1: Gate — `@gorhom/bottom-sheet` no Expo Go (repo `nexis-mobile`)

**Objetivo:** provar que a primitiva de sheet funciona no Expo Go do iPhone antes de construir os forms em cima. Se falhar, o plano troca a primitiva por rota modal do Expo Router (as Tasks 7–8 mudam só o container).

**Files:** `src/app/_layout.tsx` (modificar), `src/components/ui/sheet.tsx` (criar), `src/app/(app)/index.tsx` (um botão temporário de teste — reverter no fim da task).

- [ ] **Step 1: Instalar**
  ```bash
  cd /home/welbertbarbosa/projects/personal/nexis-mobile
  npx expo install @gorhom/bottom-sheet
  ```
  (Deve trazer/casar com `react-native-reanimated` 4 e `react-native-gesture-handler` já instalados.)

- [ ] **Step 2: Root providers**
  Em `src/app/_layout.tsx`, embrulhar tudo:
  ```tsx
  import { GestureHandlerRootView } from 'react-native-gesture-handler'
  import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
  // ...
  <GestureHandlerRootView style={{ flex: 1 }}>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BottomSheetModalProvider>
          <StatusBar style="light" />
          <Gate />
        </BottomSheetModalProvider>
      </SessionProvider>
    </QueryClientProvider>
  </GestureHandlerRootView>
  ```

- [ ] **Step 3: `src/components/ui/sheet.tsx`**
  Wrapper fino: `BottomSheetModal` com `backgroundStyle` = `colors.card`, `handleIndicatorStyle` = `colors.border`, `BottomSheetBackdrop` (appearsOnIndex 0, disappearsOnIndex -1), `enableDynamicSizing` ou snap points `['90%']`, `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`. Expõe `ref` (`BottomSheetModal`) e `children`. Exporta também `BottomSheetTextInput` re-exportado de `@gorhom/bottom-sheet` pra uso nos forms.

- [ ] **Step 4: Tela de teste (temporária)**
  No Dashboard (`src/app/(app)/index.tsx`), adicionar um `Pressable` "abrir sheet" que faz `ref.current?.present()` de um `<Sheet>` com um `Text` "Sheet OK" e um `BottomSheetTextInput`.

- [ ] **Step 5: O GATE — device**
  ```bash
  npx expo start --tunnel
  ```
  No Expo Go do iPhone: tocar "abrir sheet" → sheet sobe suave, backdrop escurece, arrastar pra baixo fecha, tocar no input **sobe o sheet com o teclado**.
  **Se travar / não animar / erro de reanimated-worklets:** reportar **DONE_WITH_CONCERNS**. O controller decide: (a) debugar, ou (b) fallback = rota modal do Expo Router (`app/(app)/wallet-form.tsx` com `export const unstable_settings` + `presentation: 'modal'` no `_layout`), e o `sheet.tsx` vira um wrapper de `<View>` full-screen. Tasks 7–8 passam a `router.push('/wallet-form')` em vez de `ref.present()`.

- [ ] **Step 6: Reverter o teste + commit**
  Remover o botão/Sheet de teste do Dashboard. Manter root providers + `sheet.tsx`.
  ```bash
  npx tsc --noEmit && npx jest
  git add -A && git commit -m "feat: @gorhom/bottom-sheet + wrapper #/components/ui/sheet

  GestureHandlerRootView + BottomSheetModalProvider no root. sheet.tsx
  aplica tema/handle/backdrop e reexporta BottomSheetTextInput. Testado
  abrir/fechar/teclado no Expo Go do iPhone.

  <trailer>"
  git push
  ```

---

## Task 2: Backend — rotas `/api/mobile/wallets*` (repo `nexis`)

**Files:** `src/routes/api/mobile/wallets.ts`, `wallets.$id.ts`, `wallets.transfer.ts` + `.test.ts` de cada.

**Interfaces:**
- Consome: `auth` de `#/lib/auth`; de `#/server/repositories/wallet.repository` → `getWalletsByUser`, `createWallet`, `updateWallet`, `deleteWallet`, `transferBetweenWallets`.
- Zod dos bodies: **copiar** de `src/server/services/wallet.service.ts` (`createWalletSchema`, `editWalletSchema` sem o `id`, transfer schema). Não importar do service (evita acoplar a rota REST ao `createServerFn`).

- [ ] **Step 1: Branch**
  ```bash
  cd /home/welbertbarbosa/projects/personal/nexis
  git checkout main && git pull --ff-only
  git checkout -b feat/mobile-slice-2-wallets-backend
  ```

- [ ] **Step 2: Testes primeiro (vitest)**
  `src/routes/api/mobile/wallets.test.ts` — mocks de `#/lib/auth` e `#/server/repositories/wallet.repository` (mesmo padrão de `dashboard.test.ts`). Helper que alcança `Route.options.server.handlers.GET|POST`.
  - `GET` sem sessão → 401 `{ error: 'Unauthorized' }`, repo não chamado.
  - `GET` com sessão → 200, corpo = fixture de `getWalletsByUser`, chamado com `session.user.id`.
  - `POST` sem sessão → 401.
  - `POST` body inválido (`{ name: '' }`) → 400 (ZodError capturado → `{ error }`).
  - `POST` válido → `createWallet` chamado com `{ userId, ...body }`; responde 200 com o wallet.

  `src/routes/api/mobile/wallets.$id.test.ts`:
  - `POST` edição válida → `updateWallet(id, userId, rest)`; 200 com wallet.
  - `updateWallet` lança `Error('Wallet not found')` → 404 `{ error: 'Wallet not found' }`.
  - `DELETE` → `deleteWallet(id, userId)`; 200 (corpo `null`) ou 204.

  `src/routes/api/mobile/wallets.transfer.test.ts`:
  - `POST` válido → `transferBetweenWallets(userId, from, to, amount)`; 200.
  - `transferBetweenWallets` lança `Error('Saldo insuficiente na carteira de origem')` → 400 `{ error: '...' }`.

  Rodar: `npx vitest run src/routes/api/mobile/` → FAIL (arquivos não existem).

- [ ] **Step 3: `src/routes/api/mobile/wallets.ts`**
  ```ts
  import { createFileRoute } from '@tanstack/react-router'
  import { z } from 'zod'
  import { auth } from '#/lib/auth'
  import { getWalletsByUser, createWallet } from '#/server/repositories/wallet.repository'

  const createWalletSchema = z.object({ /* cópia de wallet.service.ts */ })

  export const Route = createFileRoute('/api/mobile/wallets')({
    server: {
      handlers: {
        GET: async ({ request }) => {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
          return Response.json(await getWalletsByUser(session.user.id))
        },
        POST: async ({ request }) => {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
          const parsed = createWalletSchema.safeParse(await request.json())
          if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 })
          const w = await createWallet({ userId: session.user.id, ...parsed.data })
          return Response.json({
            ...w,
            balance: w.initialBalance.toNumber(),
            initialBalance: w.initialBalance.toNumber(),
            creditLimit: w.creditLimit?.toNumber() ?? null,
          })
        },
      },
    },
  })
  ```

- [ ] **Step 4: `src/routes/api/mobile/wallets.$id.ts`**
  Ler o `id` do path. **Verificar a convenção do TanStack Start:** o handler `server` recebe `{ request, params }` — usar `params.id`. Se `params` não vier, fallback: `const id = new URL(request.url).pathname.split('/').pop()!`. `POST` = editar (schema = `editWalletSchema` sem `id`), `DELETE` = excluir. `try/catch` em volta das chamadas do repo: `Error` com message conhecida → `Response.json({ error: e.message }, { status: 404 })`.

- [ ] **Step 5: `src/routes/api/mobile/wallets.transfer.ts`**
  `POST` só. Body `{ fromWalletId, toWalletId, amount }`. `try/catch`: `Error` do repo → `Response.json({ error: e.message }, { status: 400 })`. Sucesso → `Response.json(null)`.

- [ ] **Step 6: Regenerar routeTree + typecheck + suíte**
  ```bash
  npm run dev   # ~5s, gera src/routeTree.gen.ts com as rotas novas; Ctrl+C
  npx tsc --noEmit
  npm run test  # 40 + novos, todos verdes
  ```

- [ ] **Step 7: Commit + PR**
  ```bash
  git add src/routes/api/mobile/wallets*.ts src/routes/api/mobile/wallets*.test.ts src/routeTree.gen.ts
  git commit -m "feat: rotas /api/mobile/wallets* para o app mobile

  GET/POST /api/mobile/wallets, POST/DELETE /api/mobile/wallets/\$id,
  POST /api/mobile/wallets/transfer. Reusa wallet.repository sem tocá-lo.
  Erros do repository (PT-BR) propagam em { error } com 4xx.

  <trailer>"
  git push -u origin feat/mobile-slice-2-wallets-backend
  ```
  Abrir PR pra `main` ("feat: backend Carteiras (Nexis Mobile Fatia 2)"). **Mergear só na Task 9** (ou antes, se preferir — é aditivo, testes verdes).

---

## Task 3: `apiSend` / `apiPost` / `apiDelete` (repo `nexis-mobile`)

**Files:** `src/api/client.ts` (modificar), `src/api/client.test.ts` (estender).

- [ ] **Step 1: Testes primeiro**
  Adicionar ao `client.test.ts` (mock de `#/auth/client.getCookie` já existe; `globalThis.fetch` spy):
  - `apiPost('/x', { a: 1 }, parse)` → `fetch` chamado com `method: 'POST'`, header `Content-Type: application/json`, header `Cookie`, `credentials: 'omit'`, `body === JSON.stringify({ a: 1 })`; resolve `parse(json)`.
  - resposta `{ ok: false, status: 400, text: () => Promise.resolve('{"error":"Saldo insuficiente na carteira de origem"}') }` → rejeita com `ApiError` de `status 400` e `message === 'Saldo insuficiente na carteira de origem'`.
  - resposta `{ ok: true, status: 204 }` → `apiSend` resolve `undefined` (não chama `.json()`).
  - `apiDelete('/x')` → `method: 'DELETE'`, sem `Content-Type`, sem `body`.

  `npx jest src/api/client.test.ts` → FAIL nos novos.

- [ ] **Step 2: Implementar** (spec §A1):
  ```ts
  export async function apiSend<T>(
    method: 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    parse: (raw: unknown) => T = (r) => r as T,
  ): Promise<T> {
    const cookie = authClient.getCookie()
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      credentials: 'omit',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let message = text || res.statusText
      try { const j = JSON.parse(text); if (j?.error) message = j.error } catch { /* texto puro */ }
      throw new ApiError(res.status, message)
    }
    if (res.status === 204) return undefined as T
    return parse(await res.json())
  }
  export const apiPost = <T>(p: string, b?: unknown, parse?: (r: unknown) => T) =>
    apiSend<T>('POST', p, b, parse)
  export const apiDelete = (p: string) => apiSend<void>('DELETE', p)
  ```

- [ ] **Step 3: Verde + typecheck + commit**
  ```bash
  npx jest && npx tsc --noEmit
  git add src/api/client.ts src/api/client.test.ts
  git commit -m "feat: apiSend/apiPost/apiDelete (escrita com cookie + erro PT-BR)

  <trailer>"
  git push
  ```

---

## Task 4: `CATEGORY_ICONS`, `wallet-meta`, schemas Zod (repo `nexis-mobile`)

**Files:** `src/lib/category-icons.ts`, `src/lib/wallet-meta.ts`, `src/schemas/wallet.ts` + `.test.ts`, `src/app/(app)/index.tsx` (usar `CATEGORY_ICONS`).

- [ ] **Step 1: `src/lib/category-icons.ts`**
  Cópia de `nexis/src/lib/category-icons.ts` com `import ... from 'lucide-react-native'` (mesmas ~30 chaves, `type LucideIcon` de `lucide-react-native`).

- [ ] **Step 2: `src/lib/wallet-meta.ts`** — spec §B4 (`WALLET_META`, `WALLET_TYPES`, `WALLET_COLORS`).

- [ ] **Step 3: `src/schemas/wallet.ts`** — spec §B5 (`WalletSchema`, `WalletsSchema`, `WalletInput`, `WalletEditInput`, `TransferInput`).
  **Antes:** confirmar o shape real rodando a rota da Task 2 uma vez (`curl` com cookie de dev) ou relendo `getWalletsByUser`. Campos que a UI usa (`balance`, `creditLimit`, `closingDay`, `dueDay`, `color`, `icon`, `type`, `name`) têm que bater; `z.object` não-strict ignora o resto.

- [ ] **Step 4: `src/schemas/wallet.test.ts`**
  - `WalletsSchema.parse` de fixture com carteira `CHECKING` (icon/color null) + `CREDIT` (com `creditLimit`, `closingDay`, `dueDay`) → ok, shape esperado.
  - `WalletInput.parse({ name: '' })` → throw. `WalletInput.parse({ name: 'X', type: 'CASH', closingDay: 40 })` → throw.
  - `TransferInput.parse({ fromWalletId: 'a', toWalletId: 'b', amount: -1 })` → throw.

- [ ] **Step 5: Wire `CATEGORY_ICONS` no Dashboard** (TODO da Fatia 1)
  Em `src/app/(app)/index.tsx`, no `TxRow`: `const Icon = tx.category?.icon ? CATEGORY_ICONS[tx.category.icon] : null` → se `Icon`, renderiza `<Icon size={16} color={color} />` dentro do círculo em vez da bolinha; senão mantém a bolinha. Ajustar o mock de `lucide-react-native` no `dashboard-screen.test.tsx` se preciso (adicionar as chaves usadas, ou mockar `#/lib/category-icons`).

- [ ] **Step 6: typecheck + jest + commit**
  ```bash
  npx tsc --noEmit && npx jest
  git add src/lib/category-icons.ts src/lib/wallet-meta.ts src/schemas/wallet.ts src/schemas/wallet.test.ts "src/app/(app)/index.tsx" src/__tests__/dashboard-screen.test.tsx
  git commit -m "feat: CATEGORY_ICONS + wallet-meta + schemas Zod de carteira

  Porta CATEGORY_ICONS (lucide-react-native) — usado ja no TxRow do
  Dashboard. WALLET_META/TYPES/COLORS. WalletSchema + bodies (espelham
  wallet.service.ts).

  <trailer>"
  git push
  ```

---

## Task 5: `src/api/wallets.ts` (repo `nexis-mobile`)

**Files:** `src/api/wallets.ts`.

- [ ] **Step 1: Implementar** — spec §B6:
  ```ts
  export const walletsQuery = {
    queryKey: ['wallets'] as const,
    queryFn: () => apiGet('/api/mobile/wallets', (r) => WalletsSchema.parse(r)),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  }
  export const createWallet = (body: unknown) => apiPost('/api/mobile/wallets', body, (r) => WalletSchema.parse(r))
  export const editWallet = (id: string, body: unknown) => apiPost(`/api/mobile/wallets/${id}`, body, (r) => WalletSchema.parse(r))
  export const deleteWallet = (id: string) => apiDelete(`/api/mobile/wallets/${id}`)
  export const transferWallets = (body: unknown) => apiPost('/api/mobile/wallets/transfer', body)
  ```

- [ ] **Step 2: typecheck + commit** (sem teste dedicado — coberto pelos testes de tela/sheet que mockam este módulo)
  ```bash
  npx tsc --noEmit && npx jest
  git add src/api/wallets.ts && git commit -m "feat: src/api/wallets — walletsQuery + mutations

  <trailer>"
  git push
  ```

---

## Task 6: `CurrencyInput` (repo `nexis-mobile`)

**Files:** `src/components/ui/currency-input.tsx` + `src/__tests__/currency-input.test.tsx`.

- [ ] **Step 1: Teste primeiro**
  Render com `cents={0}` → exibe `"0,00"`. `fireEvent.changeText(input, '12345')` → `onChange` chamado com `12345` (cents). `cents={123450}` → exibe `"1.234,50"`. `changeText(input, 'abc9')` → `onChange(9)`. Teto: `changeText` com 10 dígitos → `onChange(99_999_999)`.
  *(Mockar `#/tw` com RN cru como nos outros testes de tela.)*

- [ ] **Step 2: Implementar** — spec §B10. `TextInput` de `#/tw` (ou receber via prop `Input` pra poder injetar `BottomSheetTextInput` dentro do sheet), `keyboardType="number-pad"`, `value` formatado, `onChangeText` → dígitos → cents. Prefixo `R$` absoluto à esquerda. `error` → `text-negative` + `bg-negative/10`.
  Nota: dentro do `@gorhom/bottom-sheet` o input **precisa** ser `BottomSheetTextInput` senão o teclado empurra errado. Deixar o componente aceitar `component?: typeof TextInput` (default = `#/tw` TextInput) e o `wallet-sheet` passa o `BottomSheetTextInput`.

- [ ] **Step 3: verde + typecheck + commit + push**
  ```
  feat: CurrencyInput (input BRL baseado em cents)
  ```

---

## Task 7: Tela `wallets.tsx` + aba (repo `nexis-mobile`)

**Files:** `src/app/(app)/wallets.tsx`, `src/components/wallets/wallet-card.tsx`, `src/app/(app)/_layout.tsx` (aba), `src/__tests__/wallets-screen.test.tsx`.

- [ ] **Step 1: Teste primeiro** (`src/__tests__/wallets-screen.test.tsx`)
  Mocks: `#/tw`, `#/tw/image`, `lucide-react-native`, `react-native-safe-area-context`, `#/api/wallets` (`walletsQuery` com `queryKey: ['wallets']`), `#/components/wallets/wallet-sheet` + `transfer-sheet` (stubs `() => null`).
  - cache `qc.setQueryData(['wallets'], [checking, credit])` → "Saldo total" + `fmtBRL(soma)`; um card por carteira com o nome; card de crédito mostra a **fatura** (`|min(balance,0)|`).
  - `[]` → `EmptyState` com "Criar carteira".
  - `[uma]` → botão ↔ (transferir) **não** aparece; `[duas]` → aparece.

- [ ] **Step 2: `wallet-card.tsx`** — spec §B7 (círculo com `wallet.color`, ícone `CATEGORY_ICONS[wallet.icon] ?? WALLET_META[type].icon`, nome + label, saldo à direita; se `CREDIT`: `invoice = Math.abs(Math.min(balance, 0))`, `limit = creditLimit ?? 0`, `pct = limit>0 ? invoice/limit : 0`, subtítulo `de {fmtBRL(limit)} · {round(pct*100)}%`, cor `negative` se `invoice>0`).

- [ ] **Step 3: `wallets.tsx`** — spec §B7. `useQuery(walletsQuery)`; header (Saldo total + `Pressable` ↔ se `>=2` + `Pressable` +); `ScrollView` + `RefreshControl` (`progressViewOffset={insets.top+8}`, `onRefresh` → `invalidateQueries(['wallets'])`); `.map(WalletCard)` em `Pressable` que seta `editing` e abre o sheet; `EmptyState`; `WalletsSkeleton` (2 `View` cinza) só em `isLoading && !data`. Estado: `sheetOpen`/`editing`/`transferOpen` + refs dos `BottomSheetModal`.

- [ ] **Step 4: Aba** — `src/app/(app)/_layout.tsx`: adicionar `<Tabs.Screen name="wallets" options={{ title: 'Carteiras', tabBarIcon: ({color,size}) => <Wallet color={color} size={size} /> }} />` depois de `index`.

- [ ] **Step 5: typecheck + jest + boot + commit**
  ```bash
  npx tsc --noEmit && npx jest
  npx expo start --tunnel   # aba Carteiras aparece, lista carrega, cards ok; sheets ainda stub
  git add ... && git commit -m "feat: tela Carteiras (lista + aba)

  <trailer>"
  git push
  ```

---

## Task 8: `wallet-sheet` + `transfer-sheet` (repo `nexis-mobile`)

**Files:** `src/components/wallets/wallet-sheet.tsx`, `transfer-sheet.tsx`, `src/__tests__/wallet-sheet.test.tsx`. Remover os stubs da Task 7.

- [ ] **Step 1: Teste primeiro** (`wallet-sheet.test.tsx`)
  Mock `#/api/wallets` (`createWallet`/`editWallet`/`deleteWallet` = `jest.fn().mockResolvedValue(...)`), `@gorhom/bottom-sheet` (render children direto, `BottomSheetTextInput` = RN `TextInput`), `#/tw`, `lucide-react-native`.
  - modo criação: `changeText` no nome + tocar "Criar carteira" → `createWallet` chamado com `{ name, type: 'CHECKING', color: <default>, icon: undefined, balance: 0 }`; no `resolve`, `qc.invalidateQueries` com `['wallets']` (e `['dashboard']`).
  - modo edição com `wallet.type === 'CREDIT'` → campos "Limite"/"Fechamento"/"Vencimento" presentes.
  - tocar lixeira → texto "Excluir esta carteira?" → "Excluir" → `deleteWallet(id)`.

- [ ] **Step 2: `wallet-sheet.tsx`** — spec §B8. `useState` (sem `@tanstack/react-form`/`vaul`/`framer-motion`). `useMutation` pra salvar/excluir. Campos: nome, saldo inicial (`CurrencyInput` só criação), tipo (chips `Pressable`), bloco crédito condicional, grade de ícones (`CATEGORY_ICONS`, 12 + expandir), 8 cores. `saveMutation.isError` → `Text` `text-negative` com `error.message`. Estado `saved` (check 900ms → `dismiss()`). Inputs = `BottomSheetTextInput` (via prop do `CurrencyInput` e direto no nome/dias).

- [ ] **Step 3: `transfer-sheet.tsx`** — spec §B9. Recebe `wallets`. Seletores De/Para (`Pressable` abrindo lista inline, excludentes), "Disponível", `CurrencyInput` com `error` se `amount > from.balance`, botão. `transferWallets({...})` → invalida `['wallets']` + `['dashboard']` → check → `dismiss()`.

- [ ] **Step 4: Ligar na tela** — `wallets.tsx` importa os sheets reais, passa `ref`, `editing`, `wallets`, `onClose`.

- [ ] **Step 5: typecheck + jest + commit + push**
  ```
  feat: wallet-sheet + transfer-sheet (criar/editar/excluir/transferir)
  ```

---

## Task 9: Integração ponta a ponta no device + finalização

- [ ] **Step 1: Deploy backend** — mergear o PR da Task 2 na `main` do `nexis` → Vercel publica. Smoke: `curl -i -X POST https://nexis-virid.vercel.app/api/mobile/wallets` → **401**.

- [ ] **Step 2: Device** (`npx expo start --tunnel`, setup de rede da Fatia 1):
  - [ ] Aba **Carteiras**: saldos batem com o PWA.
  - [ ] **Criar** "Teste RN" (CASH, saldo 100) → aparece na lista + no Saldo total; conferir no PWA.
  - [ ] **Editar** nome/cor/ícone → reflete na hora.
  - [ ] Criar uma 2ª carteira → botão ↔ aparece → **transferir** → saldos ajustam nas duas + no Dashboard (aba Início).
  - [ ] **Excluir** "Teste RN" → some; conferir no PWA.
  - [ ] Transferir > saldo → "Saldo insuficiente na carteira de origem" abaixo do botão.
  - [ ] Sheet: abre suave, teclado não cobre o campo, arrastar fecha.
  - [ ] Fechar/reabrir o app → sessão + dados ok.

- [ ] **Step 3: Suítes**
  ```bash
  cd /home/welbertbarbosa/projects/personal/nexis && npm run test        # 40 + novos
  cd /home/welbertbarbosa/projects/personal/nexis-mobile && npx jest     # todos verdes
  ```

- [ ] **Step 4: Finalizar** — `git push` final do `nexis-mobile`; confirmar merge do PR do `nexis`. Atualizar o header do spec (status → entregue).

---

## Self-Review

**Cobertura do spec:** A1 (`apiSend`) → Task 3. A2 (rotas) → Task 2. A3 (testes backend) → Task 2 Step 2. A4 (deploy) → Task 9 Step 1. B1 (deps) → Task 1. B2 (estrutura) → Tasks 1–8. B3 (`category-icons`) → Task 4. B4 (`wallet-meta`) → Task 4. B5 (schemas) → Task 4. B6 (`api/wallets`) → Task 5. B7 (tela) → Task 7. B8 (`wallet-sheet`) → Task 8. B9 (`transfer-sheet`) → Task 8. B10 (`CurrencyInput`) → Task 6. B11 (aba) → Task 7 Step 4. B12 (root gesture-handler) → Task 1 Step 2. B13 (testes) → Tasks 4/6/7/8. B14 (rodar) → Task 9.

**Ordem / dependências:** Task 1 (sheet) e Task 2 (backend) são independentes — podem ir em paralelo. Task 3 depende de nada (só estende o client). Task 4 depende de nada. Task 5 depende de 3 + 4. Task 6 depende de 1 (usa `BottomSheetTextInput`). Task 7 depende de 4, 5. Task 8 depende de 1, 5, 6, 7. Task 9 depende de tudo + PR mergeado.

**Riscos com fallback escrito:** `@gorhom/bottom-sheet` no Expo Go → Task 1 Step 5 é o gate, fallback = rota modal. Path param no TanStack Start → Task 2 Step 4 tem o fallback (`new URL(request.url)`). Shape de `getWalletsByUser` → Task 4 Step 3 manda confirmar antes. `CurrencyInput` cursor no RN → spec §B10 tem `selection` como plano B. Teclado no sheet → `BottomSheetTextInput` + testar cedo (Task 1 Step 5 já exercita input no sheet).

**Placeholder scan:** sem "TBD". Os pontos "verificar/confirmar" (convenção de arquivo de rota com param; shape exato do repo; mock de `@gorhom/bottom-sheet` no jest) são known-unknowns de API de terceiros, cada um com instrução concreta.
