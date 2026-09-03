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
| Styling | **NativeWind v4** (Tailwind pra RN) | A |
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

Um app Expo que roda no Expo Go do iPhone, faz login com Google, e mostra o Dashboard com dados reais do banco de produção — provando a pipeline inteira ponta a ponta: **Expo Go → OAuth → endpoint REST novo com auth por Bearer → client fetch tipado → validação Zod → tela nativa**. Nenhuma escrita, nenhuma outra tela.

**Princípio de performance (vale pra todo o projeto mobile):** a tela aparece na hora — com cache do TanStack Query ou vazia — e os dados preenchem depois. Nunca bloquear o render esperando fetch. Navegação usa as primitivas nativas do Expo Router (`react-native-screens`), sem transição animada em JS. Skeleton só em cold load real.

---

## Arquitetura

```
┌─────────────────────────┐         HTTPS + Bearer         ┌──────────────────────────┐
│  nexis-mobile (Expo Go)  │  ──────────────────────────▶  │  nexis (Vercel / Nitro)   │
│                          │                                │                          │
│  Expo Router             │   GET /api/mobile/dashboard    │  /api/mobile/*  (novo)    │
│  TanStack Query          │   Authorization: Bearer <tok>  │  Better Auth + bearer()   │
│  NativeWind v4           │                                │  + expo()  (novo)         │
│  better-auth/react       │   POST /api/auth/*  (OAuth)    │  /api/auth/$  (existe)    │
│    + expoClient          │  ◀──────────────────────────  │  getDashboardData()       │
│  expo-secure-store       │        redirect nexismobile:// │  (repository, intocado)  │
└─────────────────────────┘                                └────────────┬─────────────┘
                                                                        │
                                                                  NeonDB (Postgres)
```

- **`nexis` só ganha código aditivo.** Nenhuma rota, service ou componente web existente muda de comportamento. Os plugins `bearer`/`expo` do Better Auth adicionam capacidade (aceitar `Authorization: Bearer` além do cookie) sem remover nada.
- **`nexis-mobile` é 100% independente em runtime.** Não importa código do `nexis`. Compartilha só: o backend (via HTTP), o banco (via backend), e o *contrato* de dados (schemas Zod copiados à mão nesta fase).

---

## Parte A — mudanças no backend `nexis` (aditivas)

### A1. Better Auth: plugins `bearer` + `expo`

`src/lib/auth.ts`:

- Adicionar `import { bearer } from 'better-auth/plugins'` e `import { expo } from '@better-auth/expo'`.
- Nova dep: `@better-auth/expo` (peer do `better-auth`, lado servidor).
- No objeto `betterAuth({...})`:
  - `plugins: [bearer(), expo()]`
  - `trustedOrigins: ['nexismobile://', ...(existentes se houver)]` — o `expo()` plugin exige o scheme do app aqui pra permitir o redirect do OAuth de volta pro app.
- `session`, `socialProviders`, `account` ficam iguais.
- O handler em `src/routes/api/auth/$.ts` **não muda** — os plugins se plugam no `auth` e o handler já os serve.

Efeito: `auth.api.getSession({ headers })` passa a resolver a sessão tanto por cookie (web) quanto por `Authorization: Bearer <token>` (mobile). O `expo()` plugin trata a troca do código OAuth pelo token e o redirect `nexismobile://`.

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

- `npx create-expo-app@latest nexis-mobile` com template TypeScript (Expo Router incluso).
- **Confirmar:** path `C:\Users\welbert.barbosa\Documents\study\nexis-mobile` (irmão do `nexis`).
- SDK: o mais recente estável no momento da implementação. Managed workflow. **Sem `expo prebuild`, sem `ios/`/`android/`** — alvo Expo Go.
- `app.json`:
  - `expo.scheme: "nexismobile"` (**confirmar** o nome)
  - `expo.name: "Nexis"`, `expo.slug: "nexis-mobile"`
  - `expo.userInterfaceStyle: "dark"`
  - `ios.bundleIdentifier` / `android.package` — definidos mas sem efeito no Expo Go; deixados prontos pro build futuro.
- Git: `git init`, primeiro commit com o scaffold limpo.

### B2. Dependências

| Pacote | Papel | Expo Go? |
|---|---|---|
| `expo-router` | navegação file-based | ✅ (no template) |
| `@tanstack/react-query` | cache/fetch client | ✅ (JS puro) |
| `nativewind` + `tailwindcss` | styling | ✅ (transform Babel + runtime) |
| `better-auth` + `@better-auth/expo` | auth client + plugin expo | ✅ |
| `expo-secure-store` | storage do token de sessão | ✅ (SDK) |
| `expo-web-browser` | abrir o OAuth no browser do sistema | ✅ (SDK) |
| `expo-constants` | ler `EXPO_PUBLIC_*` / manifest | ✅ (SDK) |
| `lucide-react-native` + `react-native-svg` | ícones (paridade com o web Lucide) | ✅ |
| `zod` | validar respostas da API | ✅ |

Sem `react-native-reanimated`/`gesture-handler` custom nesta fatia (Expo Router já traz o necessário).

### B3. Estrutura de pastas

```
nexis-mobile/
  app/
    _layout.tsx              # QueryClientProvider + SessionProvider + gate de auth + <Stack>
    index.tsx                # redireciona p/ (app) ou (auth)/login conforme sessão
    (auth)/
      _layout.tsx
      login.tsx              # botão "Entrar com Google"
    (app)/
      _layout.tsx            # <Tabs> nativo (só a aba Dashboard nesta fatia; placeholders p/ o resto)
      index.tsx              # tela Dashboard
  src/
    api/
      client.ts             # fetch tipado + Bearer + erro + parse
      dashboard.ts          # getDashboard() -> DashboardData (validado por Zod)
    auth/
      client.ts             # createAuthClient + expoClient
      session.tsx           # SessionProvider / useSession (wrap do authClient.useSession)
    schemas/
      dashboard.ts          # Zod: DashboardResponseSchema (cópia do contrato)
    theme/
      colors.ts             # tokens zinc/azul espelhando o web
    lib/
      format.ts             # fmtBRL, fmtDate (Intl.NumberFormat)
  global.css                # @tailwind base/components/utilities
  tailwind.config.js        # preset nativewind + cores de theme/colors
  babel.config.js           # preset expo + nativewind/babel
  metro.config.js           # withNativeWind
  .env                      # EXPO_PUBLIC_API_URL=<url prod Vercel>
  app.json
```

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

- `expoClient` persiste a sessão no `SecureStore` e injeta o `Authorization: Bearer` em todas as chamadas feitas pelo `authClient.$fetch`.
- **Contrato pro `api/client.ts`:** ele precisa do mesmo header. Duas opções, decidir na implementação:
  1. Rotear as chamadas REST pelo `authClient.$fetch` (herda o Bearer de graça).
  2. Ler o token via API do `expoClient` (`authClient.getCookie()` expõe o valor armazenado) e setar o header no nosso `fetch`.
  Preferência: **opção 1** — menos código, um caminho só de auth.

### B5. Fetch client tipado (`src/api/client.ts`)

```ts
import { authClient } from '#/auth/client'

const BASE = process.env.EXPO_PUBLIC_API_URL!

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function apiGet<T>(path: string, parse: (raw: unknown) => T): Promise<T> {
  const res = await authClient.$fetch(`${BASE}${path}`, { method: 'GET' })
  // authClient.$fetch já anexa o Bearer e faz JSON parse; normalizar a forma aqui
  if (res.error) throw new ApiError(res.error.status ?? 0, res.error.message ?? 'Request failed')
  return parse(res.data)
}
```

(A forma exata do retorno de `authClient.$fetch` é confirmada na implementação; a interface pública `apiGet<T>(path, parse) -> Promise<T>` é o contrato estável.)

- `parse` = `schema.parse` do Zod. Erro de validação = bug de contrato, propaga.
- `ApiError` com `status` → a UI distingue 401 (deslogar) de 5xx (retry/erro).

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
- `onPress` → `authClient.signIn.social({ provider: 'google', callbackURL: '/' })`.
  - O `expoClient` abre o browser do sistema (`expo-web-browser`), conduz o OAuth, recebe o redirect `nexismobile://`, grava a sessão no `SecureStore`.
  - `useSession` re-renderiza → `app/index.tsx` redireciona pra `(app)`.
- Estado de loading no botão enquanto o browser está aberto; tratar cancelamento (usuário fecha o browser) sem erro ruidoso.

### B10. Dashboard (`app/(app)/index.tsx`)

Porta o layout web pra primitivas nativas:

| Web | Nativo |
|---|---|
| `<div className>` | `<View className>` (NativeWind) |
| textos | `<Text className>` |
| `PullToRefresh` | `<ScrollView refreshControl={<RefreshControl />}>` |
| `Avatar` | `expo-image` circular, fallback iniciais |
| `SummaryCard` ×2 | `<View>` grid 2 col (flex) |
| lista `recent` | `.map` (≤5 itens, não precisa `FlatList`) |
| `OnboardingCard` | idem, com `<Link href="/(app)/wallets">` (placeholder) |
| ícones Lucide | `lucide-react-native` |
| `fmt()` BRL | `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })` |

- `useQuery(dashboardQuery)`.
- **Render imediato:** enquanto `isLoading` e sem cache → skeleton leve (Views cinza). Com cache → mostra na hora, revalida em background (`isFetching` pode virar um indicador sutil, opcional).
- `RefreshControl.onRefresh` → `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`.
- Sem animação de entrada (nada de stagger). A tela nativa já renderiza rápido.
- Saudação usa `session.user.name.split(' ')[0]`; avatar usa `session.user.image`.

### B11. Tema (`src/theme/colors.ts` + `tailwind.config.js`)

- Tokens espelhando o web: `bg` `#09090b` (zinc-950), `card` `#18181b`/`rgba(24,24,27,0.5)`, `border` `#27272a` (zinc-800), `text` `#fafafa`, `muted` `#71717a` (zinc-500), `accent` `#60a5fa` (blue-400), `positive` `#34d399` (emerald-400), `negative` `#f87171` (red-400).
- `tailwind.config.js`: `presets: [require('nativewind/preset')]`, `content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}']`, `theme.extend.colors` com os tokens.

### B12. Testes (mobile)

`jest-expo` + `@testing-library/react-native`:

- `src/schemas/dashboard.test.ts` — um fixture JSON válido (com `date` ISO, `category` null e não-null, `recent` vazio e cheio) `.parse` sem erro e produz o shape esperado; um fixture inválido (`amount` string) joga `ZodError`.
- `src/api/client.test.ts` — mock do `authClient.$fetch`: retorno `{ data }` → `apiGet` resolve com `parse(data)`; retorno `{ error: { status: 401 } }` → `apiGet` rejeita com `ApiError` de `status` 401.
- `app/(app)/index.test.tsx` — render do Dashboard com `QueryClientProvider` + query pré-populada no cache (`queryClient.setQueryData(['dashboard'], fixture)`) e `useSession` mockado → assere que "Receitas", o valor formatado e as linhas de `recent` aparecem; com `hasWallets: false` → aparece o texto do onboarding.

Sem teste E2E / Detox nesta fatia.

### B13. Rodar

- `nexis-mobile/.env`: `EXPO_PUBLIC_API_URL=https://<url-prod-vercel>`
- `npx expo start` (ou `--tunnel` se o iPhone não estiver na mesma rede) → QR no terminal → abrir no **Expo Go** do iPhone.
- A API é a Vercel de produção, então o celular alcança sem config de rede local.
- Login real com a conta Google do usuário; Dashboard com os dados reais dele.

---

## Contrato entre as partes (o que a Fatia 2+ herda)

- **`apiGet<T>(path, parse) -> Promise<T>`** e `ApiError { status }` — todo endpoint futuro passa por aqui.
- **Namespace `/api/mobile/*`** no `nexis`, cada rota: `getSession` por Bearer → 401 ou `json(repositoryCall(session.user.id))`.
- **Um schema Zod por resposta** em `src/schemas/`, copiado do contrato da rota.
- **Um objeto `<recurso>Query`** (`queryKey`, `queryFn`, `staleTime`) por recurso, consumido com `useQuery`.
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

- **`@better-auth/expo` + Expo Go:** o redirect OAuth via scheme funciona no Expo Go, mas o scheme efetivo no Expo Go é `exp://…` — o `expoClient` lida com isso em dev, mas **validar no device real cedo** (é o coração da fatia). Se travar, o fallback é o `makeRedirectUri` do `expo-auth-session` com proxy.
- **`authClient.$fetch` como transporte REST:** confirmar que ele aceita URL absoluta e método/headers custom, e a forma do retorno (`{ data, error }`). Se for inconveniente, cair pro plano B do B5 (ler o token e usar `fetch` puro).
- **`Intl.NumberFormat` no Hermes:** suportado nas versões de RN atuais com `hermes-intl`; confirmar que o BRL formata certo (`R$ 1.234,56`). Fallback: formatador manual (o web tem um).
- **URL da Vercel:** se não houver uma URL de produção estável ainda, o app aponta pra um preview — funciona, mas muda a cada deploy. Idealmente fixar o domínio de produção.
- **NativeWind v4 + SDK novo:** ocasionalmente há defasagem de compatibilidade na semana de um lançamento de SDK. Se `npx expo start` reclamar, fixar a versão de `nativewind` que o `expo install` recomendar.

---

## Confirmado

1. Path do repo: `C:\Users\welbert.barbosa\Documents\study\nexis-mobile` ✅
2. Scheme do app: `nexismobile` ✅
3. URL de produção do `nexis` (→ `EXPO_PUBLIC_API_URL` + `baseURL` do auth): **`https://nexis-virid.vercel.app`** ✅
