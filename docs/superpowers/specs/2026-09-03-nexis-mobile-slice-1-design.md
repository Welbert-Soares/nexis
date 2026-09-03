# Nexis Mobile — Fatia 1: Fundação + Auth + Dashboard — Design

**Data:** 2026-09-03
**Status:** aprovado no brainstorming, pendente de revisão do spec escrito
**Sub-projeto:** 1 de ~6 da versão React Native / Expo do Nexis

---

## Contexto

O Nexis hoje é um PWA (TanStack Start SSR + Prisma + NeonDB). O usuário roda ele instalado no iOS, mas quer uma versão nativa — desenvolvida com **Expo**, rodando via **Expo Go** no iPhone dele (sem Mac, sem conta Apple). O PWA continua sendo o produto do dia a dia enquanto o nativo é construído.

### Decisões travadas no brainstorming

| # | Decisão | Escolha |
|---|---------|---------|
| Estado final | web + nativo lado a lado, backend/DB compartilhados | — |
| Alvo de execução | **Expo Go** — sem módulo nativo custom nesta fase | A |
| Repo | **separado** (`nexis-mobile`), não monorepo | A |
| API | **REST + fetch tipado**, não tRPC | A |
| Styling | **NativeWind v5 (preview)** + react-native-css + Tailwind v4, per skill `expo:expo-tailwind-setup` | B |
| Primeira fatia | Fundação + Auth + Dashboard (só leitura) | — |

### O que já existe no repo `nexis` (web) e é relevante

- **Better Auth 1.6.11** (`src/lib/auth.ts`): Google OAuth único, `prismaAdapter` postgres, sessão de 30 dias, `cookieCache`. Handler montado em `src/routes/api/auth/$.ts` (`GET`/`POST` → `auth.handler(request)`). Sem plugins hoje.
- **`src/server/repositories/dashboard.repository.ts`** → `getDashboardData(userId)` retorna:
  ```ts
  {
    totalBalance: number
    hasWallets: boolean
    monthly: { income: number; expenses: number }
    recent: Array<{
      id: string
      type: 'INCOME' | 'EXPENSE'
      amount: number            // já convertido de Decimal
      description: string | null
      date: Date                // → string ISO no JSON
      category: { id, name, color, icon, type, userId } | null
      wallet: { id: string; name: string; color: string | null }
    }>
    categoryBreakdown: Array<{ id: string; name: string; color: string; amount: number }>
  }
  ```
- **`src/server/services/dashboard.service.ts`** → `getDashboard` é um `createServerFn` que faz `auth.api.getSession({ headers: getRequest().headers })`, joga `'Unauthorized'` se não houver, senão chama `getDashboardData`. **Não é uma rota HTTP consumível externamente.**
- Zod schemas: hoje ficam **inline** nos arquivos de service (`*.service.ts`), não em arquivos separados.
- Deploy: Vercel (Nitro). Segredos (`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `DATABASE_URL`) vivem na Vercel — **não há `.env.local` no checkout**.
- vitest configurado (`vitest.config.ts`, jsdom), 38 testes.
- Dashboard web (`src/routes/_authenticated/dashboard.tsx`): header (saudação + `Avatar`), 2 `SummaryCard` (Receitas verde / Despesas vermelho), seção "Recentes" com até 5 `TransactionRow`, `OnboardingCard` quando `!hasWallets`, `EmptyTransactions` quando `recent` vazio. Paleta zinc-950 / zinc-900 / azul-400 de destaque. Ícones Lucide.

---

## Objetivo da Fatia 1

Um app Expo que roda no Expo Go do iPhone, faz login com Google, e mostra o Dashboard com dados reais do banco de produção — provando a pipeline inteira ponta a ponta: **Expo Go → OAuth → endpoint REST novo com sessão por cookie → client fetch tipado → validação Zod → tela nativa**. Nenhuma escrita, nenhuma outra tela.

**Princípio de performance (vale pra todo o projeto mobile):** a tela aparece na hora — com cache do TanStack Query ou vazia — e os dados preenchem depois. Nunca bloquear o render esperando fetch. Navegação usa as primitivas nativas do Expo Router (`react-native-screens`), sem transição animada em JS. Skeleton só em cold load real.

---

## Arquitetura

```
┌─────────────────────────┐        HTTPS + Cookie header   ┌──────────────────────────┐
│  nexis-mobile (Expo Go)  │  ──────────────────────────▶  │  nexis (Vercel / Nitro)   │
│                          │                                │                          │
│  Expo Router             │   GET /api/mobile/dashboard    │  /api/mobile/*  (novo)    │
│  TanStack Query          │   Cookie: <session>            │  Better Auth + expo()     │
│  NativeWind v5 (preview) │                                │       (novo)              │
│  better-auth/react       │   POST /api/auth/*  (OAuth)    │  /api/auth/$  (existe)    │
│    + expoClient          │  ◀──────────────────────────  │  getDashboardData()       │
│  expo-secure-store       │            redirect ao app     │  (repository, intocado)  │
└─────────────────────────┘                                └────────────┬─────────────┘
                                                                        │
                                                                  NeonDB (Postgres)
```

- **`nexis` só ganha código aditivo.** Nenhuma rota, service ou componente web existente muda de comportamento. O plugin `expo()` do Better Auth adiciona capacidade (fluxo OAuth pra app + validação de `id_token` no fallback) sem remover nada; a sessão do mobile continua sendo um cookie Better Auth, igual ao web.
- **`nexis-mobile` é 100% independente em runtime.** Não importa código do `nexis`. Compartilha só: o backend (via HTTP), o banco (via backend), e o *contrato* de dados (schemas Zod copiados à mão nesta fase).

---

## Parte A — mudanças no backend `nexis` (aditivas)

### A1. Better Auth: plugin `expo`

`src/lib/auth.ts`:

- Adicionar `import { expo } from '@better-auth/expo'`. Nova dep: `@better-auth/expo` (lado servidor).
- No objeto `betterAuth({...})`:
  - `plugins: [expo()]`
  - `trustedOrigins: ['nexismobile://', 'nexismobile://**', 'exp://**']` — o `expo()` plugin exige aqui o scheme do app e (pra dev no Expo Go) os wildcards `exp://`.
- `session`, `socialProviders`, `account` ficam iguais.
- O handler em `src/routes/api/auth/$.ts` **não muda** — o plugin se pluga no `auth` e o handler já o serve.

Efeito: o `expo()` plugin habilita o fluxo OAuth pra app (redirect de volta pro scheme) e o `signIn.social({ idToken })` do fallback. A sessão do mobile é o **mesmo cookie Better Auth** do web; `auth.api.getSession({ headers })` resolve normalmente quando o app manda o header `Cookie`.

**Não usamos o plugin `bearer()`** — o `@better-auth/expo` trabalha com o cookie via `authClient.getCookie()`, não com token Bearer.

### A2. Rota REST `GET /api/mobile/dashboard`

Novo arquivo `src/routes/api/mobile/dashboard.ts`, no padrão das rotas API do TanStack Start:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getDashboardData } from '#/server/repositories/dashboard.repository'

export const Route = createFileRoute('/api/mobile/dashboard')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return Response.json(await getDashboardData(session.user.id))
      },
    },
  },
})
```

(`Response.json` é Web API padrão e sempre funciona no runtime Nitro. Se o repo já tiver um helper `json()` do TanStack — verificar no plano — usar ele por consistência.)

- Reusa `getDashboardData` **sem tocar no repository**.
- `recent[].date` (um `Date`) serializa pra string ISO no `json()`. Documentado no contrato; o mobile reconverte.
- Sem CORS: o consumidor é `fetch` nativo do RN (não browser), então não há preflight. (Se algum dia um browser consumir, adicionar headers CORS aqui.)
- Namespace `/api/mobile/*` deixa claro que é superfície pública pro app e facilita versionar/proteger depois.

### A3. Teste do backend

`src/routes/api/mobile/dashboard.test.ts` (vitest, já configurado):

- **sem sessão** → mock `auth.api.getSession` retornando `null` → handler responde `401` com `{ error: 'Unauthorized' }`.
- **com sessão** → mock `getSession` retornando `{ user: { id: 'u1' } }` e mock `getDashboardData` retornando um fixture → handler responde `200` com o fixture, `Content-Type: application/json`.
- Verifica que o `userId` passado a `getDashboardData` é o `session.user.id`.

(Teste de unidade do handler, com os dois colaboradores mockados — não sobe servidor nem banco.)

### A4. Config na Vercel / Google

- `trustedOrigins` inclui `nexismobile://` (via A1) — sem isso o redirect do OAuth falha.
- O Google OAuth **não** precisa de config nova: o fluxo é app → browser → Google → `…/api/auth/callback/google` (já registrado pro web) → Better Auth redireciona pro scheme `nexismobile://`. O Google só conhece a callback da Vercel.
- **Confirmar antes de implementar:** a URL de produção estável da Vercel (será o `EXPO_PUBLIC_API_URL` e o `baseURL` do auth client).

---

## Parte B — app `nexis-mobile` (repo novo)

### B1. Scaffold

- `npx create-expo-app@latest nexis-mobile` com template TypeScript (Expo Router incluso). SDK atual (**57** no momento — RN 0.86, React 19.2).
- Path `C:\Users\welbert.barbosa\Documents\study\nexis-mobile` (irmão do `nexis`).
- Managed workflow. **Sem `expo prebuild`, sem `ios/`/`android/`** — alvo Expo Go.
- `app.json`:
  - `expo.scheme: "nexismobile"`
  - `expo.name: "Nexis"`, `expo.slug: "nexis-mobile"`
  - `expo.userInterfaceStyle: "dark"`
  - `ios.bundleIdentifier` / `android.package` — definidos mas sem efeito no Expo Go; prontos pro build futuro.
- Git: `git init`, primeiro commit com o scaffold limpo.

### B2. Dependências

Styling segue a skill **`expo:expo-tailwind-setup`** (NativeWind **v5 preview** + react-native-css + Tailwind v4). Instalar via `npx expo install` sempre que possível (resolve a versão compatível com o SDK).

| Pacote | Papel |
|---|---|
| `expo-router`, `react-native-safe-area-context`, `react-native-screens` | navegação nativa (no template) |
| `@tanstack/react-query` | cache/fetch client |
| `tailwindcss@^4`, `nativewind@5.0.0-preview.2`, `react-native-css@0.0.0-nightly.5ce6396`, `@tailwindcss/postcss`, `tailwind-merge`, `clsx` | styling (versões conforme a skill; bump se `expo install` recomendar) |
| `react-native-reanimated` | exigido pelos wrappers `src/tw/` (Image/Animated) |
| `better-auth`, `@better-auth/expo` | auth |
| `expo-secure-store` | storage da sessão |
| `expo-network` | detecção de rede (dep do `@better-auth/expo`) |
| `expo-web-browser`, `expo-linking`, `expo-constants` | fluxo OAuth |
| `expo-auth-session` | **fallback** de OAuth (só se o `@better-auth/expo` falhar no Expo Go) |
| `expo-image` | avatar |
| `lucide-react-native`, `react-native-svg` | ícones (paridade Lucide com o web) |
| `zod` | validar respostas da API |
| **dev:** `jest-expo`, `jest`, `@testing-library/react-native`, `react-test-renderer` | testes |

`package.json`: `"resolutions": { "lightningcss": "1.30.1" }` (compat, per skill).

### B3. Estrutura de pastas

```
nexis-mobile/
  app/
    _layout.tsx              # QueryClientProvider + SessionProvider + gate de auth + <Stack>
    index.tsx                # <Redirect> p/ (app) ou (auth)/login conforme sessão
    (auth)/
      _layout.tsx
      login.tsx              # botão "Entrar com Google"
    (app)/
      _layout.tsx            # <Tabs> nativo (só a aba Dashboard nesta fatia)
      index.tsx              # tela Dashboard
  src/
    tw/
      index.tsx              # wrappers useCssElement: View, Text, Pressable, ScrollView, TextInput, Link
      image.tsx              # wrapper CSS da expo-image
    api/
      client.ts             # fetch tipado (Cookie header) + erro + parse
      dashboard.ts          # getDashboard() -> DashboardData (validado por Zod)
    auth/
      client.ts             # createAuthClient + expoClient
      session.tsx           # SessionProvider / useSession
    schemas/
      dashboard.ts          # Zod: DashboardResponseSchema (cópia do contrato)
    theme/
      colors.ts             # tokens zinc/azul em JS (p/ uso fora de className)
    lib/
      format.ts             # fmtBRL, fmtDate
  global.css                # @import "tailwindcss/..." + @theme com os tokens
  postcss.config.mjs        # { plugins: { "@tailwindcss/postcss": {} } }
  metro.config.js           # withNativewind(config, { inlineVariables:false, globalClassNamePolyfill:false })
  .env                      # EXPO_PUBLIC_API_URL=https://nexis-virid.vercel.app
  app.json
```

**Sem `babel.config.js`** (NativeWind v5 + Tailwind v4 é CSS-first; se o template criar um só com preset expo, manter — mas nada de `nativewind/babel`).
**Sem `tailwind.config.js`** — tema via `@theme` no `global.css`. `content` não é necessário (a skill não usa).
Todo componente de UI vem de **`#/tw`** (ou `#/tw/image`), nunca de `react-native` direto — senão `className` não aplica.

### B4. Auth client (`src/auth/client.ts`)

```ts
import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import * as SecureStore from 'expo-secure-store'

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  plugins: [
    expoClient({
      scheme: 'nexismobile',
      storagePrefix: 'nexis',
      storage: SecureStore,
    }),
  ],
})

export const { signIn, signOut, useSession, getSession } = authClient
```

- O `expoClient` persiste a sessão (cookie) no `SecureStore`. **Não** injeta header automático nas nossas chamadas `fetch`.
- **Contrato pro `api/client.ts`:** ler o cookie com `await authClient.getCookie()` e mandar como header `Cookie`, com `credentials: 'omit'` (padrão documentado do `@better-auth/expo`).

### B5. Fetch client tipado (`src/api/client.ts`)

```ts
import { authClient } from '#/auth/client'

const BASE = process.env.EXPO_PUBLIC_API_URL!

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiGet<T>(path: string, parse: (raw: unknown) => T): Promise<T> {
  const cookie = await authClient.getCookie()
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: { Cookie: cookie, Accept: 'application/json' },
    credentials: 'omit',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }
  return parse(await res.json())
}
```

- `parse` = `schema.parse` do Zod. Erro de validação = bug de contrato, propaga.
- `ApiError` com `status` → a UI distingue 401 (deslogar) de 5xx (retry/erro).
- Interface pública estável: `apiGet<T>(path, parse) -> Promise<T>` + `ApiError { status }`.

### B6. Schema Zod (`src/schemas/dashboard.ts`)

Cópia do contrato de A2. Aproximadamente:

```ts
import { z } from 'zod'

const RecentTx = z.object({
  id: z.string(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number(),
  description: z.string().nullable(),
  date: z.string(),                      // ISO; convertido na UI
  category: z.object({
    id: z.string(), name: z.string(),
    color: z.string().nullable(), icon: z.string().nullable(),
  }).nullable(),
  wallet: z.object({
    id: z.string(), name: z.string(), color: z.string().nullable(),
  }),
})

export const DashboardResponseSchema = z.object({
  totalBalance: z.number(),
  hasWallets: z.boolean(),
  monthly: z.object({ income: z.number(), expenses: z.number() }),
  recent: z.array(RecentTx),
  categoryBreakdown: z.array(z.object({
    id: z.string(), name: z.string(), color: z.string(), amount: z.number(),
  })),
})

export type DashboardData = z.infer<typeof DashboardResponseSchema>
```

Nota: o `category` do repo web inclui `type`/`userId`; o schema mobile pega só os campos que a tela usa (`name`, `color`, `icon`). Campos extras no JSON são ignorados pelo `z.object` (não-strict).

### B7. `src/api/dashboard.ts`

```ts
import { apiGet } from './client'
import { DashboardResponseSchema, type DashboardData } from '#/schemas/dashboard'

export function getDashboard(): Promise<DashboardData> {
  return apiGet('/api/mobile/dashboard', (raw) => DashboardResponseSchema.parse(raw))
}

export const dashboardQuery = {
  queryKey: ['dashboard'] as const,
  queryFn: getDashboard,
  staleTime: 30_000,
  gcTime: 5 * 60_000,
}
```

### B8. Root layout (`app/_layout.tsx`)

- `QueryClientProvider` com um `QueryClient` singleton (`defaultOptions.queries`: `staleTime: 30_000`, `gcTime: 5min`, `retry: 1`, `refetchOnReconnect: true`).
- `SessionProvider` (wrap de `authClient.useSession`) expondo `{ session, isPending }`.
- Gate: enquanto `isPending` → splash simples (View zinc-950 + logo/spinner). Depois → `<Stack>` com `(auth)` e `(app)`; `app/index.tsx` faz o `<Redirect>` conforme `session`.
- `<StatusBar style="light" />`, fundo zinc-950 global.
- `import '../global.css'`.

### B9. Login (`app/(auth)/login.tsx`)

- Tela centrada: logo Nexis, tagline, um botão "Entrar com Google".
- **Caminho A (principal):** `onPress` → `authClient.signIn.social({ provider: 'google', callbackURL: '/' })`.
  - O `expoClient` abre o browser do sistema (`expo-web-browser`), conduz o OAuth, recebe o redirect, grava a sessão no `SecureStore`.
  - `useSession` re-renderiza → `app/index.tsx` redireciona pra `(app)`.
- **Caminho B (fallback, só se A não voltar pro app no Expo Go):** `expo-auth-session` com `AuthSession.makeRedirectUri()` faz o OAuth direto com o Google, obtém o `id_token`, e chama `authClient.signIn.social({ provider: 'google', idToken: { token } })` — o backend (`expo()` + provider `google` já configurado) valida o `id_token`, cria a `Session` e devolve o cookie. Mesma tela, mesmo botão; a decisão A↔B é feita na implementação após testar no device.
- Estado de loading no botão enquanto o browser está aberto; cancelamento (usuário fecha o browser) não vira erro ruidoso.

### B10. Dashboard (`app/(app)/index.tsx`)

Porta o layout web pra primitivas nativas. **Componentes vêm de `#/tw` e `#/tw/image`**, não de `react-native`.

| Web | Nativo |
|---|---|
| `<div className>` | `<View className>` de `#/tw` |
| textos | `<Text className>` de `#/tw` |
| `PullToRefresh` | `<ScrollView>` de `#/tw` + `RefreshControl` (de `react-native`) |
| `Avatar` | `<Image>` de `#/tw/image`, circular, fallback iniciais |
| `SummaryCard` ×2 | `<View>` grid 2 col (flex) |
| lista `recent` | `.map` (≤5 itens, não precisa `FlatList`) |
| `OnboardingCard` | idem, com `<Link href="/(app)/wallets">` de `#/tw` (destino é placeholder) |
| ícones Lucide | `lucide-react-native` |
| `fmt()` BRL | `src/lib/format.ts` → `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })` |

- `useQuery(dashboardQuery)`.
- **Render imediato:** enquanto `isLoading` e sem cache → skeleton leve (Views cinza). Com cache → mostra na hora, revalida em background (`isFetching` pode virar um indicador sutil, opcional).
- `RefreshControl.onRefresh` → `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`.
- Sem animação de entrada (nada de stagger). A tela nativa já renderiza rápido.
- Saudação usa `session.user.name.split(' ')[0]`; avatar usa `session.user.image`.

### B11. Tema (`global.css` + `src/theme/colors.ts`)

- Tokens espelhando o web, definidos como cores do Tailwind v4 no `global.css` via `@theme`:
  ```css
  @layer theme {
    @theme {
      --color-bg: #09090b;         /* zinc-950 */
      --color-card: #18181b;       /* zinc-900 */
      --color-border: #27272a;     /* zinc-800 */
      --color-fg: #fafafa;
      --color-muted: #71717a;      /* zinc-500 */
      --color-accent: #60a5fa;     /* blue-400 */
      --color-positive: #34d399;   /* emerald-400 */
      --color-negative: #f87171;   /* red-400 */
    }
  }
  ```
  Uso: `className="bg-bg text-fg border-border"`, `text-positive`, etc.
- `src/theme/colors.ts` — os mesmos valores hex em objeto JS, pra onde `className` não alcança (ex: `backgroundColor` inline calculado a partir de `category.color`, `tintColor` de ícone Lucide).

### B12. Testes (mobile)

`jest-expo` + `@testing-library/react-native`:

- `src/schemas/dashboard.test.ts` — fixture JSON válido (`date` ISO, `category` null e não-null, `recent` vazio e cheio) `.parse` sem erro e produz o shape esperado; fixture inválido (`amount` string) joga `ZodError`.
- `src/api/client.test.ts` — mock de `authClient.getCookie` + `global.fetch`: resposta `ok` com JSON → `apiGet` resolve com `parse(json)` e o header `Cookie` foi enviado; resposta `401` → `apiGet` rejeita com `ApiError` de `status` 401.
- `src/lib/format.test.ts` — `fmtBRL(1234.5)` → `"R$ 1.234,50"` (ou o formato que o Hermes produzir; o teste fixa o esperado e revela se `Intl` diverge).
- `app/(app)/index.test.tsx` — render do Dashboard com `QueryClientProvider` + cache pré-populado (`queryClient.setQueryData(['dashboard'], fixture)`) e `useSession` mockado → "Receitas", o valor formatado e as linhas de `recent` aparecem; com `hasWallets: false` → texto do onboarding aparece.

Sem teste E2E / Detox nesta fatia.

### B13. Rodar

- `nexis-mobile/.env`: `EXPO_PUBLIC_API_URL=https://nexis-virid.vercel.app`
- `npx expo start` (ou `--tunnel` se o iPhone não estiver na mesma rede) → QR no terminal → abrir no **Expo Go** do iPhone.
- A API é a Vercel de produção, então o celular alcança sem config de rede local.
- Login real com a conta Google do usuário; Dashboard com os dados reais dele.

---

## Contrato entre as partes (o que a Fatia 2+ herda)

- **`apiGet<T>(path, parse) -> Promise<T>`** e `ApiError { status }` — todo endpoint futuro passa por aqui (cookie via `authClient.getCookie()` → header `Cookie`).
- **Namespace `/api/mobile/*`** no `nexis`, cada rota: `auth.api.getSession({ headers })` → 401 ou `Response.json(repositoryCall(session.user.id))`.
- **Um schema Zod por resposta** em `src/schemas/`, copiado do contrato da rota.
- **Um objeto `<recurso>Query`** (`queryKey`, `queryFn`, `staleTime`) por recurso, consumido com `useQuery`.
- **UI vem de `#/tw`** — nunca `react-native` direto.
- Padrão de tela: render imediato (cache/vazio) + dados depois; navegação nativa; sem animação de entrada bloqueante.

---

## Fora de escopo (Fatia 1)

- Telas de Transações, Carteiras, Transferência, Orçamentos, Metas, Análise, Categorias, Perfil.
- Qualquer operação de escrita (criar/editar/excluir).
- Push notifications.
- Offline / cache persistente em disco.
- Lock biométrico (Face ID).
- Ícone do app, splash screen customizada, deep links além do OAuth.
- `expo prebuild`, EAS Build, submissão nas lojas.
- Extração dos schemas Zod pra pacote compartilhado (fica pra quando a duplicação doer).
- Monorepo.

---

## Riscos / pontos de atenção

- **NativeWind v5 é preview.** `nativewind@5.0.0-preview.2` + `react-native-css@nightly`. **Mitigação:** Task 1 do plano é só "scaffold + NativeWind v5 + uma tela estilizada renderiza no Expo Go" — se não funcionar no SDK 57, a task falha na hora e o fallback é NativeWind v4 estável (`className` direto via `nativewind/babel`, sem wrappers `#/tw`, `tailwind.config.js` com Tailwind v3). Custo afundado mínimo.
- **`@better-auth/expo` + Expo Go:** o redirect OAuth pode não voltar pro app no Expo Go (scheme efetivo é `exp://…`). **É o risco central da fatia — validar no device antes de construir em cima.** Fallback embutido no B9: `expo-auth-session` + `signIn.social({ idToken })`.
- **`Intl.NumberFormat` no Hermes:** suportado no RN atual, mas confirmar o formato BRL exato (`R$ 1.234,56`). `src/lib/format.test.ts` fixa o esperado; se divergir, formatador manual (o web tem um).
- **`getCookie()` do `@better-auth/expo`:** confirmar que retorna a string de cookie pronta pro header (formato `name=value; name2=value2`). Se retornar outra coisa, ajustar `apiGet`.
- **`react-native-reanimated`:** exigido pelos wrappers da skill de tailwind; incluído no Expo Go, mas confere se o `expo start` pede alguma config de plugin.

---

## Confirmado

1. Path do repo: `C:\Users\welbert.barbosa\Documents\study\nexis-mobile` ✅
2. Scheme do app: `nexismobile` ✅
3. URL de produção do `nexis` (→ `EXPO_PUBLIC_API_URL` + `baseURL` do auth): **`https://nexis-virid.vercel.app`** ✅
