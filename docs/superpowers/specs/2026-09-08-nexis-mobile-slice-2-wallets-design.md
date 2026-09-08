# Nexis Mobile — Fatia 2: Carteiras (leitura + escrita) — Design

**Data:** 2026-09-08
**Status:** decisões travadas (D1–D8 conforme proposto) — plano derivado em `docs/superpowers/plans/2026-09-08-nexis-mobile-slice-2-wallets.md`
**Sub-projeto:** 2 de ~6 da versão React Native / Expo do Nexis

---

## Contexto

A Fatia 1 entregou a fundação: Expo Go + OAuth (cookie Better Auth) + `apiGet` tipado + Zod + TanStack Query + NativeWind v5, e a tela **Dashboard** (só leitura). Está no ar (`Welbert-Soares/nexis-mobile`), 12 testes verdes, backend aditivo em produção (`/api/mobile/dashboard`).

A Fatia 2 introduz a **primeira superfície de escrita** do app: gerenciar carteiras. É a fatia que valida `POST`/`DELETE` com sessão por cookie a partir de um app nativo, mutations + invalidação de cache, formulário em bottom-sheet, e o `CATEGORY_ICONS` (adiado na Fatia 1).

### O que já existe e é relevante

**No `nexis` (web):**

- **`src/server/repositories/wallet.repository.ts`** — já retorna objetos planos (Decimal → number). Funções:
  - `getWalletsByUser(userId)` → `Array<Wallet & { balance: number; initialBalance: number; creditLimit: number | null }>`. `balance` = `initialBalance + Σincome − Σexpense` (transações não deletadas). Ordena por `createdAt asc`.
  - `createWallet({ userId, name, type, color?, icon?, balance?, creditLimit?, closingDay?, dueDay? })` — `balance` vira `initialBalance`.
  - `updateWallet(id, userId, { name?, type?, color?, icon?, creditLimit?, closingDay?, dueDay? })` — valida ownership (`findFirst { id, userId }`).
  - `deleteWallet(id, userId)` — valida ownership; cascade remove transações vinculadas (FK `onDelete: Cascade`).
  - `transferBetweenWallets(userId, fromWalletId, toWalletId, amount)` — valida ownership das duas, `from !== to`, saldo suficiente; cria par de transações `isTransfer: true` numa `prisma.$transaction` (EXPENSE na origem + INCOME no destino com `parentId`). Lança `Error` com mensagens PT-BR (`'Saldo insuficiente na carteira de origem'`, etc.).
- **`src/server/services/wallet.service.ts`** — `createServerFn`s com Zod inline (`createWalletSchema`, `editWalletSchema`, transfer schema). **Não são rotas HTTP externas.** Os schemas são a referência do contrato.
- **`src/routes/_authenticated/wallets.tsx`** (tela web a portar):
  - Header: "Saldo total" + soma de `balance`; botões circulares **+** (nova) e **↔** (transferir, só se `wallets.length >= 2`).
  - Lista: card por carteira com ícone (cor da carteira, `CATEGORY_ICONS[wallet.icon]` ou ícone do tipo), nome, label do tipo, e saldo à direita.
  - **Carteira de crédito** (`type === 'CREDIT'`): mostra **fatura** = `|min(balance, 0)|` em vermelho se > 0; subtítulo `de {limite} · {pct}%` (`pct = fatura / creditLimit`).
  - `EmptyState` quando `wallets.length === 0`; `WalletsSkeleton` (2 cards) no cold load.
  - Tocar num card → abre `WalletSheet` em modo edição.
- **`src/components/wallets/wallet-sheet.tsx`** — bottom-sheet (`vaul`) com: nome, saldo inicial (só criação, `CurrencyInput`), tipo (chips), bloco de crédito (limite + dia de fechamento/vencimento) quando `type === 'CREDIT'`, grade de ícones (12 visíveis + expandir p/ o resto), grade de 8 cores, botão salvar. Modo edição adiciona lixeira → confirmação inline → excluir. Estado `saved` mostra um check por 900ms e fecha.
- **`src/components/wallets/transfer-sheet.tsx`** — sheet com selects "De → Para" (excludentes), saldo disponível da origem, `CurrencyInput` com erro se `amount > saldo`, botão transferir.
- **`src/lib/category-icons.ts`** — `CATEGORY_ICONS: Record<string, LucideIcon>` com ~30 ícones Lucide. Chave = nome PascalCase (`'Wallet'`, `'CreditCard'`, `'Coffee'`...). Usado por carteiras, categorias e transações.
- **`src/components/ui/currency-input.tsx`** — input BRL baseado em **cents** (`cents: number`, `onChange(cents)`), exibe `(cents/100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })` com prefixo `R$`. Máscara: só dígitos, teto `99_999_999` cents.
- `WALLET_META` (web, em `wallets.tsx`): label + ícone default por tipo — `CHECKING` Conta corrente/Wallet, `SAVINGS` Poupança/PiggyBank, `CASH` Dinheiro/Banknote, `INVESTMENT` Investimento/TrendingUp, `CREDIT` Crédito/CreditCard.

**No `nexis-mobile` (Fatia 1 — contrato herdado):**

- `apiGet<T>(path, parse) → Promise<T>` + `ApiError { status }` (`src/api/client.ts`). Cookie via `authClient.getCookie()` (**síncrono** no `@better-auth/expo` 1.6.11), header `Cookie`, `credentials: 'omit'`.
- Namespace `/api/mobile/*` no backend; cada rota: `auth.api.getSession({ headers })` → 401 ou `Response.json(...)`.
- Um schema Zod por resposta em `src/schemas/`. Um `<recurso>Query` (`queryKey`, `queryFn`, `staleTime`) por recurso.
- UI só de `#/tw` (`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Link`) e `#/tw/image`. Nunca `react-native` direto (senão `className` não aplica). Exceções já em uso: `RefreshControl`, `useSafeAreaInsets` importados de `react-native`/`react-native-safe-area-context`.
- Tokens de tema: `bg #09090b`, `card #18181b`, `border #27272a`, `fg #fafafa`, `muted #71717a`, `accent #60a5fa`, `positive #34d399`, `negative #f87171` — em `global.css` (`@theme`) e `src/theme/colors.ts` (hex JS).
- `fmtBRL` / `fmtDate` em `src/lib/format.ts` (Intl pt-BR, normaliza espaço no-break).
- Navegação: `src/app/` (não raiz). `(app)/_layout.tsx` = `<Tabs>` nativo com o gate de sessão (`Redirect` → `/login`). Hoje só a aba `index` (Dashboard).
- **Testes fora de `src/app/`** — o `require.context` do expo-router empacota qualquer `.tsx` sob `src/app/` como rota. Testes de tela vão em `src/__tests__/`, importando via `#/app/(app)/...`.
- Deps já instaladas úteis aqui: `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `@tanstack/react-query`, `lucide-react-native`, `react-native-svg`, `zod`.
- `@testing-library/react-native` fixado em **`^13.3.3`** (v14 tem peer `test-renderer` que não resolve aqui). `overrides` `@better-auth/core@1.6.11` + `@better-fetch/fetch@1.1.21` alinham o `@better-auth/expo`.

---

## Objetivo da Fatia 2

Na aba **Carteiras** do app: ver a lista com saldos reais, **criar**, **editar** e **excluir** carteiras, e **transferir** entre elas — tudo persistindo no banco de produção via `/api/mobile/wallets*`. Prova a pipeline de **escrita**: bottom-sheet nativo → `apiPost`/`apiDelete` com cookie → repository existente → invalidação de `['wallets']` + `['dashboard']` → UI atualiza.

Mantém os princípios da Fatia 1: render imediato (cache/vazio) + dados depois; navegação nativa; sem animação de entrada bloqueante; skeleton só em cold load.

---

## Decisões travadas

| # | Tema | Decisão |
|---|------|---------|
| D1 | Primitiva de bottom-sheet | **`@gorhom/bottom-sheet`** (reanimated + gesture-handler já instalados). Fallback documentado: rota modal do Expo Router — 1ª task do plano é o gate. |
| D2 | Estilo de escrita no client | **`apiSend<T>(method, path, body?, parse?)`** genérico, expondo `apiPost` / `apiDelete`. |
| D3 | Granularidade das rotas backend | `GET`+`POST` em `/api/mobile/wallets`; `POST`(edit)+`DELETE` em `/api/mobile/wallets/$id`; `POST` em `/api/mobile/wallets/transfer`. `POST` (não `PATCH`) pra edição — consistência com o resto do backend. |
| D4 | Atualização pós-mutation | **Refetch** (`invalidateQueries`), igual ao web. Sem optimistic. |
| D5 | Icon picker | **Portar `CATEGORY_ICONS` inteiro** + grade expansível (12 + resto). |
| D6 | Haptics | **Fora de escopo.** `expo-haptics` entra numa fatia de polish. |
| D7 | Confirmação de exclusão | **Inline no sheet** (padrão web), não `Alert.alert`. |
| D8 | Erros do backend | Propagar a `message` PT-BR do `Error` do repository no corpo `{ error }` da resposta não-2xx; `ApiError.message` carrega ela; a UI mostra abaixo do botão. |

---

## Arquitetura (delta sobre a Fatia 1)

```
nexis-mobile                          nexis (Vercel / Nitro)
─────────────                         ──────────────────────
apiGet  (Fatia 1)   ── GET ─────────▶ /api/mobile/wallets            getWalletsByUser
apiPost (novo)      ── POST ────────▶ /api/mobile/wallets            createWallet
apiPost (novo)      ── POST ────────▶ /api/mobile/wallets/$id        updateWallet
apiDelete (novo)    ── DELETE ──────▶ /api/mobile/wallets/$id        deleteWallet
apiPost (novo)      ── POST ────────▶ /api/mobile/wallets/transfer   transferBetweenWallets
```

- **`nexis` continua só aditivo.** Novas rotas em `/api/mobile/wallets*`, reusando o repository sem tocá-lo. Zod dos bodies copiado de `wallet.service.ts`.
- Sessão idêntica à Fatia 1: header `Cookie` + `credentials: 'omit'`. Escrita de app nativo não tem risco de CSRF (sem credencial ambiente, sem browser) — não precisa de token anti-CSRF.
- Sem CORS (consumidor é `fetch` do RN, não browser).

---

## Parte A — backend `nexis` (aditivo)

### A1. `src/api/client.ts` (mobile) — método de escrita

Estender o client da Fatia 1 com envio de corpo. Proposta (D2):

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
    try { message = JSON.parse(text).error ?? message } catch {}
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return parse(await res.json())
}
export const apiPost = <T>(p: string, b?: unknown, parse?: (r: unknown) => T) => apiSend<T>('POST', p, b, parse)
export const apiDelete = (p: string) => apiSend<void>('DELETE', p)
```

- `ApiError.message` carrega a `message` PT-BR do backend (D8) — a UI mostra direto.
- Interface pública estável pra Fatia 3+.

### A2. Rotas REST `/api/mobile/wallets*` (backend `nexis`)

Padrão idêntico ao `dashboard.ts` da Fatia 1: `createFileRoute` + `auth.api.getSession({ headers: request.headers })` → 401 sem sessão.

**`src/routes/api/mobile/wallets.ts`** — `GET` e `POST`:

- `GET` → `Response.json(await getWalletsByUser(session.user.id))`.
- `POST` → parse do body com `createWalletSchema` (copiado de `wallet.service.ts`); `createWallet({ userId, ...data })`; devolve o wallet normalizado (`balance`/`initialBalance`/`creditLimit` como number) — **mesmo shape do `getWalletsByUser`**, pra UI poder inserir no cache sem refetch se quiser.

**`src/routes/api/mobile/wallets.$id.ts`** — `POST` (edit) e `DELETE`:

- `POST` → `editWalletSchema` sem o `id` (vem do path); `updateWallet(id, session.user.id, rest)`; devolve o wallet normalizado.
- `DELETE` → `deleteWallet(id, session.user.id)`; `Response.json(null)` (ou 204).
- `updateWallet`/`deleteWallet` já lançam `Error('Wallet not found')` se não for do usuário → mapear pra **404** (ou 403). Handler: `try/catch`, `Error` conhecido → `Response.json({ error: e.message }, { status: 404 })`.

**`src/routes/api/mobile/wallets.transfer.ts`** — `POST`:

- Body: `{ fromWalletId, toWalletId, amount }` (schema de `transferUserWallets`).
- `transferBetweenWallets(...)` lança `Error` PT-BR (saldo insuficiente, carteiras iguais, não encontrada) → handler mapeia pra **400** com `{ error: e.message }`.
- Sucesso → `Response.json(null)` (ou 204). A UI invalida `['wallets']` + `['dashboard']`.

> **Verificar no plano:** a forma exata do arquivo pra rota com parâmetro (`wallets.$id.ts` vs `wallets/$id.ts`) e como o handler lê `params.id` no TanStack Start (Nitro). Provável: `({ request, params })`. Se a API interna diferir, ajustar mantendo o contrato HTTP.

### A3. Testes do backend (vitest)

Um arquivo por rota, colaboradores (`auth`, repository) mockados — não sobe servidor nem banco:

- `wallets.test.ts` — `GET` sem sessão → 401; `GET` com sessão → 200 com o fixture de `getWalletsByUser`, `userId` correto. `POST` body inválido (`name` vazio) → 400/ZodError; `POST` válido → chama `createWallet` com `userId` da sessão, responde 200 com o wallet.
- `wallets.$id.test.ts` — `POST` edição → `updateWallet(id, userId, rest)`; `Error('Wallet not found')` → 404. `DELETE` → `deleteWallet(id, userId)`; ok → 200/204.
- `wallets.transfer.test.ts` — sucesso → chama `transferBetweenWallets` com os args certos; `Error('Saldo insuficiente…')` → 400 com `{ error }`.

Meta: suíte do `nexis` continua verde (40 atuais + os novos).

### A4. Deploy

- Mergear na `main` do `nexis` → Vercel publica as rotas novas.
- Smoke: `curl -i -X POST https://nexis-virid.vercel.app/api/mobile/wallets` (sem cookie) → **401**.

---

## Parte B — app `nexis-mobile`

### B1. Dependências novas

| Pacote | Papel | Instalação |
|---|---|---|
| `@gorhom/bottom-sheet` | bottom-sheet nativo (D1) | `npx expo install @gorhom/bottom-sheet` (usa reanimated + gesture-handler, já presentes) |
| `expo-haptics` | *(só se D6 = incluir)* | `npx expo install expo-haptics` |

`react-native-gesture-handler` precisa do `GestureHandlerRootView` no root (`src/app/_layout.tsx`) — **verificar** se o template já embrulha; se não, adicionar.

### B2. Estrutura de pastas (delta)

```
src/
  app/(app)/
    _layout.tsx            # + aba "Carteiras"
    wallets.tsx            # NOVA tela (lista + header + FAB abrir sheets)
  api/
    client.ts             # + apiSend / apiPost / apiDelete
    wallets.ts            # walletsQuery + createWallet/editWallet/deleteWallet/transfer (chamam apiPost/apiDelete)
  schemas/
    wallet.ts             # WalletSchema (resposta) + WalletInput/WalletEditInput/TransferInput (bodies)
  components/wallets/
    wallet-sheet.tsx      # form criar/editar + excluir (bottom-sheet)
    transfer-sheet.tsx    # form transferência (bottom-sheet)
    wallet-card.tsx       # linha da lista (extraível; lógica de crédito)
  components/ui/
    currency-input.tsx    # port do input BRL (cents) pra TextInput
    sheet.tsx             # wrapper fino sobre @gorhom/bottom-sheet (tema, handle, backdrop)  [se D1 = gorhom]
  lib/
    category-icons.ts     # port: CATEGORY_ICONS de lucide-react-native
    wallet-meta.ts        # WALLET_META (label + ícone default por tipo)
  __tests__/
    wallets-screen.test.tsx
    wallet-sheet.test.tsx
```

### B3. `src/lib/category-icons.ts` (port)

Cópia de `nexis/src/lib/category-icons.ts` trocando o import `lucide-react` → `lucide-react-native`. Mesmas ~30 chaves PascalCase. `type LucideIcon` vem de `lucide-react-native`. (Já resolve o TODO deixado na Fatia 1 pro Dashboard também.)

### B4. `src/lib/wallet-meta.ts`

```ts
import { Wallet, PiggyBank, Banknote, TrendingUp, CreditCard } from 'lucide-react-native'
export type WalletType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT'
export const WALLET_META: Record<WalletType, { label: string; icon: /* LucideIcon */ }> = {
  CHECKING:  { label: 'Conta corrente', icon: Wallet },
  SAVINGS:   { label: 'Poupança',       icon: PiggyBank },
  CASH:      { label: 'Dinheiro',       icon: Banknote },
  INVESTMENT:{ label: 'Investimento',   icon: TrendingUp },
  CREDIT:    { label: 'Crédito',        icon: CreditCard },
}
export const WALLET_TYPES = (Object.keys(WALLET_META) as WalletType[]).map((v) => ({ value: v, label: WALLET_META[v].label }))
export const WALLET_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#71717a']
```

### B5. Schemas Zod (`src/schemas/wallet.ts`)

```ts
import { z } from 'zod'

export const WalletSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['CHECKING','SAVINGS','CASH','INVESTMENT','CREDIT']),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  balance: z.number(),
  initialBalance: z.number(),
  creditLimit: z.number().nullable(),
  closingDay: z.number().nullable(),
  dueDay: z.number().nullable(),
  currency: z.string(),          // "BRL" — vem do repo; ignorar na UI
  userId: z.string(),
  createdAt: z.string(),         // ISO
  updatedAt: z.string(),
})
export const WalletsSchema = z.array(WalletSchema)
export type Wallet = z.infer<typeof WalletSchema>

// bodies (espelham wallet.service.ts)
export const WalletInput = z.object({
  name: z.string().min(1),
  type: z.enum(['CHECKING','SAVINGS','CASH','INVESTMENT','CREDIT']),
  color: z.string().optional(),
  icon: z.string().optional(),
  balance: z.number().min(0).optional(),
  creditLimit: z.number().positive().nullable().optional(),
  closingDay: z.number().int().min(1).max(28).nullable().optional(),
  dueDay: z.number().int().min(1).max(28).nullable().optional(),
})
export const WalletEditInput = WalletInput.partial().extend({ icon: z.string().nullable().optional() })
export const TransferInput = z.object({
  fromWalletId: z.string(), toWalletId: z.string(), amount: z.number().positive(),
})
```

> Confirmar no plano o shape exato de `getWalletsByUser` (rodar a rota uma vez / ler o repo) — `WalletSchema` não-strict ignora campos extras, mas os que a UI usa (`balance`, `creditLimit`, `closingDay`, `dueDay`, `color`, `icon`, `type`, `name`) precisam estar certos.

### B6. `src/api/wallets.ts`

```ts
import { apiGet, apiPost, apiDelete } from './client'
import { WalletsSchema, WalletSchema, type Wallet } from '#/schemas/wallet'

export const walletsQuery = {
  queryKey: ['wallets'] as const,
  queryFn: () => apiGet('/api/mobile/wallets', (r) => WalletsSchema.parse(r)),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
}

export const createWallet = (body: unknown) =>
  apiPost('/api/mobile/wallets', body, (r) => WalletSchema.parse(r))
export const editWallet = (id: string, body: unknown) =>
  apiPost(`/api/mobile/wallets/${id}`, body, (r) => WalletSchema.parse(r))
export const deleteWallet = (id: string) => apiDelete(`/api/mobile/wallets/${id}`)
export const transferWallets = (body: unknown) => apiPost('/api/mobile/wallets/transfer', body)
```

### B7. Tela `src/app/(app)/wallets.tsx`

Porta `wallets.tsx` do web. `#/tw` + `#/tw/image` (não `react-native`). `useSafeAreaInsets` pro `paddingTop` (padrão fixado na Fatia 1).

- `useQuery(walletsQuery)`. `totalBalance = Σ balance`.
- **Header:** "Saldo total" + `fmtBRL(totalBalance)`; à direita, `Pressable` **↔** (só se `wallets.length >= 2`) abre `TransferSheet`; `Pressable` **+** abre `WalletSheet` (modo criação).
- **Lista:** `ScrollView` + `RefreshControl` (`progressViewOffset={insets.top + 8}`, padrão da Fatia 1). `.map` (sem `FlatList` — poucas carteiras). Cada item = `WalletCard` num `Pressable` que abre `WalletSheet` em edição com os campos da carteira.
- `WalletCard`: círculo com `wallet.color` (`bg` = `${color}26`), ícone = `CATEGORY_ICONS[wallet.icon] ?? WALLET_META[type].icon`; nome + label do tipo; à direita o saldo — se `CREDIT`, a lógica de fatura/limite/% do web (`text-negative` se fatura > 0).
- `EmptyState` (sem carteiras) com botão "Criar carteira" → abre o sheet. `WalletsSkeleton` (2 `View` cinza `h-[72px]`) só em `isLoading && !data`.
- Estado local: `sheetOpen`, `editing?: Wallet`, `transferOpen`.

### B8. `src/components/wallets/wallet-sheet.tsx`

Bottom-sheet (D1). Conteúdo portado do web:

- **Campos:** nome (`TextInput`), **saldo inicial** (`CurrencyInput`, só criação), **tipo** (chips `Pressable`), **bloco de crédito** (aparece se `type === 'CREDIT'`: limite via `CurrencyInput`, fechamento/vencimento via `TextInput` `keyboardType="number-pad"` 1–28), **ícone** (grade `CATEGORY_ICONS`, 12 + expandir — ou MVP por D5), **cor** (8 swatches `Pressable`).
- **Mutations** (`useMutation`):
  - criar → `createWallet({ name, type, color, icon, balance: cents/100, ...creditData })`
  - editar → `editWallet(id, { name, type, color, icon, ...creditData })`
  - `onSuccess` → `qc.invalidateQueries(['wallets'])` + `qc.invalidateQueries(['dashboard'])`; estado `saved` (check 900ms) → fecha.
- **Editar** adiciona lixeira → confirmação inline (D7) → `deleteWallet(id)` → invalida + fecha.
- `saveMutation.isError` → `Text` de erro (`text-negative`) abaixo do botão com `error.message` (vem do backend, D8).
- Sem `@tanstack/react-form` / `vaul` / `framer-motion` (deps web). Form = `useState`. Animações do sheet ficam com o `@gorhom/bottom-sheet`.
- `keyboardBehavior`/`android:adjustResize` — o sheet precisa subir com o teclado; `@gorhom/bottom-sheet` tem `BottomSheetTextInput` pra isso (usar em vez do `TextInput` de `#/tw` dentro do sheet, ou embrulhar).

### B9. `src/components/wallets/transfer-sheet.tsx`

- Recebe `wallets: Wallet[]`. Selects "De"/"Para" (`Pressable` que abre uma lista, ou um sub-sheet) — excludentes. Web usa `<select>`; no nativo, um menu simples (`Pressable` + lista condicional, ou `@gorhom/bottom-sheet` aninhado).
- "Disponível: {fmtBRL(from.balance)}"; `CurrencyInput` com `error` se `amount > from.balance`.
- `canSubmit = fromId && toId && fromId !== toId && cents > 0 && !insufficient`.
- `transferWallets({ fromWalletId, toWalletId, amount })` → `onSuccess` invalida `['wallets']` + `['dashboard']` → check → fecha.

### B10. `src/components/ui/currency-input.tsx` (port)

- Props: `cents: number`, `onChange(cents: number)`, `error?: boolean`, `autoFocus?`.
- `TextInput` (`#/tw` ou `BottomSheetTextInput` dentro de sheet), `keyboardType="number-pad"`.
- `value` = `(cents/100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- `onChangeText`: `const digits = t.replace(/\D/g, ''); onChange(digits ? Math.min(parseInt(digits,10), 99_999_999) : 0)`.
- Prefixo `R$` posicionado à esquerda; `error` → `text-negative` + fundo `bg-negative/10`.
- Cursor sempre no fim (RN reposiciona ao re-renderizar com `value` controlado; se ficar ruim, `selection={{ start: value.length, end: value.length }}`).

### B11. `src/app/(app)/_layout.tsx` — nova aba

Adicionar `<Tabs.Screen name="wallets" options={{ title: 'Carteiras', tabBarIcon: ... Wallet }} />`. Ordem: `index` (Início), `wallets` (Carteiras). (O `+` central e as abas Transações/Análise do `BottomNav` web ficam pra fatias seguintes.)

### B12. Root — `GestureHandlerRootView`

`@gorhom/bottom-sheet` exige `<GestureHandlerRootView style={{ flex: 1 }}>` acima dos providers em `src/app/_layout.tsx`. E `@gorhom/bottom-sheet` v5 quer `<BottomSheetModalProvider>` se usar `BottomSheetModal` (recomendado pra sheets sob demanda).

### B13. Testes (mobile)

Padrão da Fatia 1: mockar `#/tw`, `#/tw/image`, `lucide-react-native`, `react-native-safe-area-context`, e a camada `#/api/wallets`. Testes em `src/__tests__/` (nunca sob `src/app/`).

- `src/schemas/wallet.test.ts` — `WalletsSchema.parse` de um fixture (com e sem `CREDIT`, `icon`/`color` null); `WalletInput` rejeita `name` vazio, `closingDay: 40`.
- `src/api/client.test.ts` — *(estender)* `apiSend`: `POST` manda `Content-Type` + body JSON + header `Cookie`; resposta 400 com `{ error: 'Saldo insuficiente...' }` → `ApiError` com `status 400` e `message` = a string PT-BR; `204` → resolve `undefined`.
- `src/__tests__/wallets-screen.test.tsx` — cache pré-populado (`qc.setQueryData(['wallets'], fixture)`): renderiza "Saldo total" + soma formatada, um card por carteira, o saldo de crédito como fatura; `wallets: []` → `EmptyState` ("Criar carteira"); botão ↔ só aparece com ≥ 2 carteiras.
- `src/__tests__/wallet-sheet.test.tsx` — abrir em criação: preencher nome + tocar "Criar carteira" chama `createWallet` com o payload certo (mock) e, no sucesso, invalida `['wallets']`; abrir em edição com `type: 'CREDIT'` mostra os campos de crédito; lixeira → confirmação → `deleteWallet`.
- `@gorhom/bottom-sheet` no jest: pode precisar de mock (`jest.mock('@gorhom/bottom-sheet', ...)`) — testar o conteúdo do sheet renderizado direto, sem a animação/gestos.

### B14. Rodar / verificar no device

- `npx expo start --tunnel` (setup de rede da Fatia 1: WSL mirrored + tunnel).
- Aba **Carteiras**: lista com saldos batendo com o PWA.
- **Criar** uma carteira (ex: "Teste RN", CASH, saldo 100) → aparece na lista e no "Saldo total"; conferir no PWA que criou.
- **Editar** nome/cor/ícone → reflete na hora.
- **Transferir** entre duas → saldos ajustam nas duas; Dashboard (aba Início) também (invalidação de `['dashboard']`).
- **Excluir** a carteira de teste → some; conferir no PWA.
- Erro esperado: transferir mais que o saldo → mensagem "Saldo insuficiente na carteira de origem" abaixo do botão.
- Sessão/perf: sheet abre suave, teclado não cobre o campo, fechar app e voltar mantém tudo.
- Rodar as duas suítes: `nexis` (vitest) e `nexis-mobile` (`npx jest`).

---

## Contrato que a Fatia 3+ herda

- **`apiSend` / `apiPost` / `apiDelete`** — toda escrita passa por aqui; `ApiError.message` carrega a mensagem PT-BR do backend.
- **Rotas de escrita `/api/mobile/<recurso>*`** no `nexis`, reusando o repository, Zod do body copiado do `*.service.ts`; `Error` conhecido do repository → 4xx com `{ error: message }`.
- **`CATEGORY_ICONS`** portado (`src/lib/category-icons.ts`) — disponível pro Dashboard, Transações, Categorias.
- **Primitiva de sheet** (`components/ui/sheet.tsx` + `@gorhom/bottom-sheet`) — reusada por Transações, Metas, Perfil, etc.
- **`CurrencyInput`** (`components/ui/currency-input.tsx`) — reusado por Transações, Transferência, Orçamentos, Metas.
- Padrão de mutation: `useMutation` → `onSuccess` invalida as `queryKey`s afetadas (mín. o próprio recurso + `['dashboard']`).

---

## Fora de escopo (Fatia 2)

- Telas de Transações, Análise, Metas, Orçamentos, Categorias, Perfil.
- O `+` central (nova transação) do `BottomNav`.
- Reordenar carteiras; arquivar; múltiplas moedas (o `currency` do modelo é sempre "BRL").
- Detalhe da carteira (extrato por carteira).
- Optimistic updates (D4 = refetch).
- Haptics (D6), a menos que o brainstorming decida incluir.
- Offline / fila de mutations.
- Extração dos schemas Zod pra pacote compartilhado.
- Push, biometria, EAS Build.

---

## Riscos / pontos de atenção

- **`@gorhom/bottom-sheet` no Expo Go (SDK 57 / RN 0.86 / reanimated 4).** É a primeira dep de UI "pesada" da fatia. **Mitigação:** primeira task do plano = "sheet vazio abre/fecha suave no Expo Go do iPhone"; se não, fallback pra rota modal do Expo Router (`presentation: 'modal'`) — troca a primitiva, as telas de conteúdo não mudam.
- **Teclado vs. sheet.** `CurrencyInput`/nome dentro do sheet precisam subir com o teclado. Usar `BottomSheetTextInput` + `keyboardBehavior="interactive"`; testar no device cedo.
- **`updateWallet`/`deleteWallet` lançam `Error` genérico** pra carteira de outro usuário — o handler precisa mapear pra 404/403 sem vazar detalhe. Idem `transferBetweenWallets` (mensagens são PT-BR e OK de exibir).
- **Shape de `getWalletsByUser`** — confirmar `closingDay`/`dueDay` (não são Decimal, vêm como number|null direto do Prisma) e que `color`/`icon` são `string | null`. O `WalletSchema` precisa bater.
- **`CurrencyInput` controlado no RN** — máscara + cursor. O web reformata a cada tecla; no RN o cursor pode pular. Ter o `selection` como plano B.
- **Rota com path param no TanStack Start** (`wallets.$id.ts`) — confirmar convenção de arquivo e `params` no handler `server`. Se atritar, usar querystring (`/api/mobile/wallets?id=...`) como alternativa.
- **Invalidação de `['dashboard']`** — toda mutation de carteira/transferência muda saldos; não esquecer, senão a aba Início fica desatualizada até o `staleTime`.

---

## A confirmar antes do plano

1. **D1** — `@gorhom/bottom-sheet` vs. rota modal do Expo Router.
2. **D3** — granularidade/verbos das rotas backend (e a mecânica de path param no TanStack Start).
3. **D5** — icon picker completo ou MVP.
4. **D6** — incluir `expo-haptics` já?
5. Shape real de `getWalletsByUser` (rodar a rota ou reler o repo no início do plano).
6. Nome/ordem das abas: `Início · Carteiras` agora; quando entram Transações e o `+`?
