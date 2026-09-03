# Nexis Mobile — Fatia 1 (Fundação + Auth + Dashboard) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um app Expo rodando no Expo Go do iPhone que loga com Google e mostra o Dashboard com dados reais do banco de produção, provando a pipeline app → API → banco → tela nativa.

**Architecture:** Dois repos. `nexis` (existente) ganha só código aditivo: plugin `expo()` do Better Auth e a rota `GET /api/mobile/dashboard` que reusa o repository existente. `nexis-mobile` (novo) é um app Expo Router + TanStack Query + NativeWind v5, com um client REST tipado (`apiGet`) que anexa o cookie de sessão via `authClient.getCookie()`. Sessão do mobile = mesmo cookie Better Auth do web.

**Tech Stack:** `nexis`: TanStack Start (Nitro), Better Auth 1.6.11, Prisma, vitest. `nexis-mobile`: Expo SDK 57 (RN 0.86 / React 19.2), Expo Router, `@tanstack/react-query`, NativeWind v5 preview + react-native-css + Tailwind v4, `@better-auth/expo`, `expo-secure-store`, `zod`, `jest-expo`.

**Spec:** `docs/superpowers/specs/2026-09-03-nexis-mobile-slice-1-design.md`

## Global Constraints

- **Dois repos.** Cada task diz em qual repo opera. `nexis` = `C:\Users\welbert.barbosa\Documents\study\nexis`. `nexis-mobile` = `C:\Users\welbert.barbosa\Documents\study\nexis-mobile` (irmão, criado na Task 3).
- **`nexis` só ganha código aditivo.** Nenhuma rota/service/componente web existente muda de comportamento. Zero regressão nos 38 testes atuais.
- **Alvo Expo Go.** Sem `expo prebuild`, sem pastas `ios/`/`android/`, sem módulo nativo custom. Instalar libs com `npx expo install` sempre que possível.
- **URL da API:** `https://nexis-virid.vercel.app` (produção). Vai em `nexis-mobile/.env` como `EXPO_PUBLIC_API_URL`.
- **Scheme do app:** `nexismobile`.
- **Styling:** NativeWind v5 conforme a skill `expo:expo-tailwind-setup` — o executor DEVE ler essa skill (`C:\Users\welbert.barbosa\.claude\plugins\cache\claude-plugins-official\expo\1.12.3\skills\expo-tailwind-setup\SKILL.md`) e aplicar os arquivos de config dela verbatim. Componentes de UI vêm de `#/tw`, nunca de `react-native` direto.
- **Auth do mobile = cookie**, não Bearer. `apiGet` faz `await authClient.getCookie()` → header `Cookie` + `credentials: 'omit'`. Não usar o plugin `bearer()`.
- **TypeScript strict** nos dois repos. `nexis` tem `noUnusedLocals`/`noUnusedParameters`. `verbatimModuleSyntax` no `nexis` → `import type` pra tipos.
- **Path alias no `nexis-mobile`:** `#/*` → `src/*` (configurar em `tsconfig.json` + `babel`/`metro` se preciso). No `nexis` já é `#/*` e `@/*` → `src/*`.
- **Commits terminam com:**
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd
  ```
- **Nunca commitar em `main`** no `nexis`. Trabalhar num branch (ex: `feat/mobile-slice-1-backend`). O `nexis-mobile` começa na sua própria `main` (repo novo) — aceitável, é o commit inicial do projeto.
- **Segredos:** o `nexis` não tem `.env.local` no checkout (segredos vivem na Vercel). Testes de backend mockam `auth`/repository — não sobem servidor nem banco. O deploy que serve a API é a Vercel de produção.

---

## File Structure

### Repo `nexis` (aditivo)

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `src/routes/api/mobile/dashboard.ts` | rota REST GET, sessão → 401 ou JSON do dashboard | 1 |
| `src/routes/api/mobile/dashboard.test.ts` | teste vitest do handler (mock auth + repo) | 1 |
| `src/lib/auth.ts` | + `plugins: [expo()]` + `trustedOrigins` | 2 |
| `package.json` / lock | + `@better-auth/expo` | 2 |

### Repo `nexis-mobile` (novo)

| Arquivo | Responsabilidade | Task |
|---|---|---|
| scaffold (`app/`, `app.json`, `tsconfig.json`, `metro.config.js`, `package.json`) | projeto Expo Router | 3 |
| `global.css`, `postcss.config.mjs`, `metro.config.js` | NativeWind v5 (per skill) | 3 |
| `src/tw/index.tsx`, `src/tw/image.tsx` | wrappers `useCssElement` (per skill) | 4 |
| `src/theme/colors.ts` | tokens hex em JS | 4 |
| `src/lib/format.ts` + `.test.ts` | `fmtBRL`, `fmtDate` | 4 |
| `src/auth/client.ts` | `createAuthClient` + `expoClient` | 5 |
| `src/auth/session.tsx` | `SessionProvider` / `useSession` | 5 |
| `src/api/client.ts` + `.test.ts` | `apiGet<T>`, `ApiError` | 6 |
| `src/schemas/dashboard.ts` + `.test.ts` | `DashboardResponseSchema`, `DashboardData` | 7 |
| `src/api/dashboard.ts` | `getDashboard()`, `dashboardQuery` | 8 |
| `app/_layout.tsx` | providers + gate de auth | 8 |
| `app/index.tsx` | `<Redirect>` conforme sessão | 8 |
| `app/(auth)/_layout.tsx`, `app/(auth)/login.tsx` | tela de login (caminho A) | 8 |
| `app/(app)/_layout.tsx` | `<Tabs>` nativo (só Dashboard) | 8 |
| `app/(app)/index.tsx` + `index.test.tsx` | tela Dashboard | 9 |
| `.env` | `EXPO_PUBLIC_API_URL` | 3 |

---

## Task 1: Rota REST `GET /api/mobile/dashboard` (repo `nexis`)

**Files:**
- Create: `src/routes/api/mobile/dashboard.ts`
- Create: `src/routes/api/mobile/dashboard.test.ts`

**Interfaces:**
- Consumes: `auth` de `#/lib/auth` (`auth.api.getSession({ headers })`), `getDashboardData` de `#/server/repositories/dashboard.repository`.
- Produces: `GET /api/mobile/dashboard` — 401 `{ error: 'Unauthorized' }` sem sessão; 200 com o retorno de `getDashboardData(session.user.id)` como JSON.

- [ ] **Step 1: Criar branch**

```bash
cd /c/Users/welbert.barbosa/Documents/study/nexis
git checkout main && git pull --ff-only
git checkout -b feat/mobile-slice-1-backend
```

- [ ] **Step 2: Escrever o teste que deve falhar**

Create `src/routes/api/mobile/dashboard.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const getDashboardData = vi.fn()

vi.mock('#/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('#/server/repositories/dashboard.repository', () => ({
  getDashboardData: (...a: unknown[]) => getDashboardData(...a),
}))

// A rota exporta `Route`; o handler está em Route.options.server.handlers.GET
async function callGet(headers: Record<string, string> = {}) {
  const { Route } = await import('./dashboard')
  const handler = (Route.options as any).server.handlers.GET as (ctx: { request: Request }) => Promise<Response>
  return handler({ request: new Request('http://x/api/mobile/dashboard', { headers }) })
}

const FIXTURE = {
  totalBalance: 100,
  hasWallets: true,
  monthly: { income: 50, expenses: 20 },
  recent: [],
  categoryBreakdown: [],
}

describe('GET /api/mobile/dashboard', () => {
  beforeEach(() => {
    getSession.mockReset()
    getDashboardData.mockReset()
  })

  it('responde 401 sem sessão', async () => {
    getSession.mockResolvedValue(null)
    const res = await callGet()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(getDashboardData).not.toHaveBeenCalled()
  })

  it('responde 200 com o dashboard do usuário da sessão', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-42' } })
    getDashboardData.mockResolvedValue(FIXTURE)
    const res = await callGet({ cookie: 'better-auth.session_token=abc' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(FIXTURE)
    expect(getDashboardData).toHaveBeenCalledWith('user-42')
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/routes/api/mobile/dashboard.test.ts`
Expected: FAIL — `./dashboard` não existe (`import` lança).

- [ ] **Step 4: Criar a rota**

Create `src/routes/api/mobile/dashboard.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getDashboardData } from '#/server/repositories/dashboard.repository'

export const Route = createFileRoute('/api/mobile/dashboard')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
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

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/routes/api/mobile/dashboard.test.ts`
Expected: PASS — 2 testes.

Se o acesso a `Route.options.server.handlers.GET` estiver errado (a forma interna do `createFileRoute` pode diferir): inspecionar `Object.keys(Route)` e `Route.options` num teste temporário, ajustar o `callGet` helper pra alcançar o handler, e manter os `expect` iguais. Não mudar `dashboard.ts`.

- [ ] **Step 6: Regenerar a árvore de rotas e checar build**

Run: `npm run dev` por ~5s (gera `src/routeTree.gen.ts` com a rota nova) e `Ctrl+C`. Depois:
Run: `npx tsc --noEmit`
Expected: sem erros. `src/routeTree.gen.ts` inclui `/api/mobile/dashboard` (é gerado — commitar junto).

- [ ] **Step 7: Suíte completa**

Run: `npm run test`
Expected: PASS — 40 testes (38 + 2 novos).

- [ ] **Step 8: Commit**

```bash
git add src/routes/api/mobile/dashboard.ts src/routes/api/mobile/dashboard.test.ts src/routeTree.gen.ts
git commit -m "feat: rota GET /api/mobile/dashboard para o app mobile

Reusa getDashboardData sem tocar no repository. Sessão via
auth.api.getSession (resolve o cookie Better Auth) -> 401 ou JSON.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 2: Better Auth `expo()` plugin (repo `nexis`)

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: —
- Produces: o `auth` do backend passa a servir o fluxo OAuth pra app (redirect ao scheme) e `signIn.social({ idToken })`. Nenhuma mudança pro web.

- [ ] **Step 1: Instalar a dep**

```bash
cd /c/Users/welbert.barbosa/Documents/study/nexis   # mesma branch feat/mobile-slice-1-backend
npm install @better-auth/expo
```

- [ ] **Step 2: Editar `src/lib/auth.ts`**

Adicionar o import (junto dos outros, respeitando `verbatimModuleSyntax` — é import de valor, `import` normal):

```ts
import { expo } from '@better-auth/expo'
```

No objeto `betterAuth({ ... })`, adicionar duas chaves (manter todo o resto — `database`, `baseURL`, `secret`, `socialProviders`, `account`, `session` — intacto):

```ts
  plugins: [expo()],
  trustedOrigins: ['nexismobile://', 'nexismobile://**', 'exp://**'],
```

- [ ] **Step 3: Typecheck + suíte**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros de tipo; **40 testes** ainda passando (nenhuma regressão — os testes não exercem OAuth).

- [ ] **Step 4: Smoke do servidor**

Run: `npm run dev` por ~8s. Confirmar no log que o servidor sobe sem erro (o `betterAuth({...})` é construído no import de `#/lib/auth`; um plugin mal configurado quebraria aqui). `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts package.json package-lock.json
git commit -m "feat: plugin @better-auth/expo no backend para o app mobile

Habilita o fluxo OAuth pra app (redirect ao scheme nexismobile://) e o
sign-in por id_token do fallback. trustedOrigins inclui o scheme + os
wildcards exp:// para dev no Expo Go. Sessão do mobile continua sendo o
mesmo cookie Better Auth do web; comportamento web inalterado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

- [ ] **Step 6: Push + abrir PR (não mergear ainda)**

```bash
git push -u origin feat/mobile-slice-1-backend
```

Abrir PR pra `main` com título "feat: backend para o Nexis Mobile (Fatia 1)". **Não mergear** — o deploy de produção só é necessário na Task 10 (verificação no device). O PR fica aberto até lá; se preferir, mergear agora é seguro (é aditivo, 40 testes verdes) e faz a Vercel deployar. Decisão do usuário no handoff.

---

## Task 3: Scaffold `nexis-mobile` + NativeWind v5 (gate de fast-fail)

**Files:** cria o repo `nexis-mobile` inteiro (scaffold) + config NativeWind.

**Interfaces:**
- Consumes: —
- Produces: um app Expo que abre no Expo Go e renderiza uma tela com classes Tailwind aplicadas (cor de fundo, cor de texto). Se isso não funcionar, a Fatia inteira muda de abordagem de styling.

- [ ] **Step 1: Scaffold**

```bash
cd /c/Users/welbert.barbosa/Documents/study
npx create-expo-app@latest nexis-mobile
cd nexis-mobile
```

Aceitar o template default (TypeScript + Expo Router). Confirmar que criou `app/`, `app.json`, `tsconfig.json`, `package.json`. **NÃO** rodar `expo prebuild`.

- [ ] **Step 2: Limpar o boilerplate do template**

- Remover as telas de exemplo (`app/(tabs)/explore.tsx` etc.) e componentes de exemplo que o template traz, deixando só um `app/_layout.tsx` mínimo e um `app/index.tsx` placeholder.
- `app.json` → no bloco `expo`: `"scheme": "nexismobile"`, `"name": "Nexis"`, `"slug": "nexis-mobile"`, `"userInterfaceStyle": "dark"`. Adicionar `ios.bundleIdentifier: "com.welbert.nexis"` e `android.package: "com.welbert.nexis"` (sem efeito no Expo Go, prontos pro futuro).
- Criar `.env` com uma linha: `EXPO_PUBLIC_API_URL=https://nexis-virid.vercel.app`
- Criar `.gitignore` (o template já traz um; garantir que `.env` **não** está ignorado — precisamos dele versionado; segredo não há, é só a URL pública).
- `tsconfig.json`: adicionar `"paths": { "#/*": ["./src/*"] }` em `compilerOptions`.

- [ ] **Step 3: Ler a skill de styling e instalar NativeWind v5**

O executor DEVE ler: `C:\Users\welbert.barbosa\.claude\plugins\cache\claude-plugins-official\expo\1.12.3\skills\expo-tailwind-setup\SKILL.md`

Seguir a seção "Installation" dela verbatim:

```bash
npx expo install tailwindcss@^4 nativewind@5.0.0-preview.2 react-native-css@0.0.0-nightly.5ce6396 @tailwindcss/postcss tailwind-merge clsx
```

(Se `expo install` recomendar versões diferentes, usar as que ele recomendar e anotar no report.)

Adicionar em `package.json`: `"resolutions": { "lightningcss": "1.30.1" }` e rodar `npm install` de novo.

- [ ] **Step 4: Aplicar os arquivos de config da skill verbatim**

- `metro.config.js` — o bloco `withNativewind` da skill (com `inlineVariables: false`, `globalClassNamePolyfill: false`).
- `postcss.config.mjs` — `{ plugins: { "@tailwindcss/postcss": {} } }`.
- `global.css` — o conteúdo da skill (os 3 `@import "tailwindcss/..."` + os blocos `@media android`/`@media ios` de fontes). Adicionar o bloco `@theme` com os tokens (ver Task 4 Step 2 — pode adicionar já aqui vazio e preencher na Task 4, ou preencher agora).
- **Deletar `babel.config.js`** se ele só tiver config de NativeWind. Se tiver `babel-preset-expo`, manter só isso.
- Garantir `import "./global.css"` no topo de `app/_layout.tsx` (ou no entry).

- [ ] **Step 5: Tela de tede de render**

`app/index.tsx` — usando o wrapper `View`/`Text` (criar um `src/tw/index.tsx` mínimo agora com só `View` e `Text` a partir do exemplo da skill, ou o completo já — Task 4 completa):

```tsx
import { View, Text } from '#/tw'

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Text className="text-2xl font-bold text-white">Nexis</Text>
      <Text className="mt-2 text-sm text-green-400">NativeWind v5 OK</Text>
    </View>
  )
}
```

- [ ] **Step 6: Rodar no Expo Go — O GATE**

```bash
npx expo start
```

Abrir o QR no **Expo Go** do iPhone (mesma rede, ou `npx expo start --tunnel`).

**Critério de sucesso:** a tela aparece com **fundo preto** e o texto "Nexis" **branco e grande** e "NativeWind v5 OK" **verde**. Ou seja: as classes Tailwind aplicaram.

**Se as classes NÃO aplicarem** (texto sem estilo, erro de Metro sobre `react-native-css`/`nativewind`, crash): NÃO insistir. Reportar **DONE_WITH_CONCERNS** ou **BLOCKED** com o erro exato. O controller decide entre (a) debugar a config v5, ou (b) fallback: `npx expo install nativewind@^4 tailwindcss@^3`, `tailwind.config.js` v3 (`content`, `presets: ['nativewind/preset']`), `babel.config.js` com `jsxImportSource: "nativewind"` + `"nativewind/babel"`, `global.css` com `@tailwind base/components/utilities`, e **sem** os wrappers `#/tw` (usar `View`/`Text` de `react-native` direto com `className`). As Tasks 4+ seriam ajustadas pra não importar de `#/tw`.

- [ ] **Step 7: Commit inicial do repo**

```bash
cd /c/Users/welbert.barbosa/Documents/study/nexis-mobile
git add -A
git commit -m "chore: scaffold Expo Router + NativeWind v5 + render OK no Expo Go

create-expo-app (SDK 57), scheme nexismobile, EXPO_PUBLIC_API_URL de
produção, NativeWind v5 preview conforme skill expo-tailwind-setup.
Tela de teste renderiza estilizada no Expo Go do iPhone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 4: Wrappers `#/tw`, tema e formatadores (repo `nexis-mobile`)

**Files:**
- Create/complete: `src/tw/index.tsx`, `src/tw/image.tsx`
- Create: `src/theme/colors.ts`
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`
- Modify: `global.css` (bloco `@theme`), `package.json` (deps de teste)

**Interfaces:**
- Consumes: `react-native-css`, `expo-image`, `expo-router` (Link).
- Produces:
  - `#/tw` exporta `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Link` (todos aceitam `className`).
  - `#/tw/image` exporta `Image` (aceita `className`).
  - `#/theme/colors` exporta `colors` — `{ bg, card, border, fg, muted, accent, positive, negative }` (strings hex).
  - `#/lib/format` exporta `fmtBRL(n: number): string` e `fmtDate(d: Date): string`.

- [ ] **Step 1: `src/tw/index.tsx` e `src/tw/image.tsx`**

Copiar da skill `expo-tailwind-setup` (seções "Main Components" e "Image Component") verbatim, **removendo** o que a fatia não usa: manter `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Link`; pode remover `TouchableHighlight`, `AnimatedScrollView`, `useCSSVariable` se não forem usados (YAGNI). `src/tw/image.tsx` como na skill (usa `expo-image` + `react-native-reanimated`). Rodar `npx expo install expo-image react-native-reanimated` se ainda não instalados.

- [ ] **Step 2: `global.css` — bloco `@theme`**

Adicionar ao `global.css` (dentro de `@layer theme { @theme { ... } }`):

```css
@layer theme {
  @theme {
    --color-bg: #09090b;
    --color-card: #18181b;
    --color-border: #27272a;
    --color-fg: #fafafa;
    --color-muted: #71717a;
    --color-accent: #60a5fa;
    --color-positive: #34d399;
    --color-negative: #f87171;
  }
}
```

- [ ] **Step 3: `src/theme/colors.ts`**

```ts
export const colors = {
  bg: '#09090b',
  card: '#18181b',
  border: '#27272a',
  fg: '#fafafa',
  muted: '#71717a',
  accent: '#60a5fa',
  positive: '#34d399',
  negative: '#f87171',
} as const
```

- [ ] **Step 4: Configurar jest**

```bash
npx expo install -- --save-dev jest-expo jest @testing-library/react-native react-test-renderer
```

`package.json`: adicionar
```json
"scripts": { "test": "jest" },
"jest": { "preset": "jest-expo" }
```

- [ ] **Step 5: Escrever `src/lib/format.test.ts` (falha primeiro)**

```ts
import { fmtBRL, fmtDate } from './format'

describe('fmtBRL', () => {
  it('formata reais com 2 casas e separadores pt-BR', () => {
    expect(fmtBRL(1234.5)).toBe('R$\u00a01.234,50')
  })
  it('zero', () => {
    expect(fmtBRL(0)).toBe('R$\u00a00,00')
  })
  it('negativo', () => {
    expect(fmtBRL(-78)).toBe('-R$\u00a078,00')
  })
})

describe('fmtDate', () => {
  it('dia e mês abreviado pt-BR', () => {
    // 2026-09-03 -> "03 de set."
    expect(fmtDate(new Date(2026, 8, 3))).toMatch(/03 de set/)
  })
})
```

Run: `npm test -- src/lib/format.test.ts` → FAIL (módulo não existe).

Nota: o separador do `Intl` pt-BR é `\u00a0` (no-break space), não espaço normal. Se o Hermes divergir (ex: usa espaço normal, ou não implementa pt-BR), ajustar os `expect` pro que o Hermes produz **e** anotar no report — o objetivo do teste é travar o formato real, seja qual for.

- [ ] **Step 6: `src/lib/format.ts`**

```ts
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

export function fmtBRL(value: number): string {
  return brl.format(value)
}

export function fmtDate(date: Date): string {
  return dateFmt.format(date)
}
```

- [ ] **Step 7: Rodar o teste e ver passar**

Run: `npm test -- src/lib/format.test.ts`
Expected: PASS (ajustando os literais se o Hermes divergir, por Step 5).

- [ ] **Step 8: Typecheck + suíte + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "feat: wrappers #/tw, tokens de tema e formatadores BRL/data

#/tw (View/Text/Pressable/ScrollView/TextInput/Link) e #/tw/image via
useCssElement, conforme a skill. #/theme/colors com os hex pra uso fora
de className. #/lib/format com Intl pt-BR. jest-expo configurado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 5: Auth client + SessionProvider (repo `nexis-mobile`)

**Files:**
- Create: `src/auth/client.ts`
- Create: `src/auth/session.tsx`
- Modify: `package.json` (deps de auth)

**Interfaces:**
- Consumes: `better-auth/react`, `@better-auth/expo/client`, `expo-secure-store`.
- Produces:
  - `#/auth/client` exporta `authClient` e `{ signIn, signOut, useSession, getSession }`.
  - `authClient.getCookie(): Promise<string>` (fornecido pelo `expoClient`).
  - `#/auth/session` exporta `<SessionProvider>` e `useAuthSession()` → `{ session, isPending }`.

- [ ] **Step 1: Instalar deps**

```bash
npx expo install @better-auth/expo expo-secure-store expo-network expo-web-browser expo-linking expo-constants
npm install better-auth
```

- [ ] **Step 2: `src/auth/client.ts`**

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

- [ ] **Step 3: `src/auth/session.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react'
import { useSession } from './client'

type SessionValue = ReturnType<typeof useSession>
const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useSession()
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuthSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuthSession fora do SessionProvider')
  return { session: v.data ?? null, isPending: v.isPending }
}
```

(Confirmar na implementação a forma do retorno de `useSession` do `better-auth/react` — provavelmente `{ data, isPending, error }`. Ajustar os campos se preciso; a interface pública `{ session, isPending }` é o contrato.)

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: auth client (@better-auth/expo) + SessionProvider

authClient com expoClient (scheme nexismobile, storage SecureStore).
SessionProvider expõe { session, isPending } via contexto.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 6: API client tipado (repo `nexis-mobile`)

**Files:**
- Create: `src/api/client.ts`
- Create: `src/api/client.test.ts`

**Interfaces:**
- Consumes: `authClient.getCookie` de `#/auth/client`; `global.fetch`.
- Produces: `apiGet<T>(path: string, parse: (raw: unknown) => T): Promise<T>` e `class ApiError extends Error { status: number }`.

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/api/client.test.ts`:

```ts
import { apiGet, ApiError } from './client'

jest.mock('#/auth/client', () => ({
  authClient: { getCookie: jest.fn().mockResolvedValue('better-auth.session_token=abc') },
}))

const okJson = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }) as unknown as Promise<Response>

const errStatus = (status: number) =>
  Promise.resolve({
    ok: false,
    status,
    statusText: 'err',
    text: () => Promise.resolve(''),
  }) as unknown as Promise<Response>

describe('apiGet', () => {
  afterEach(() => jest.restoreAllMocks())

  it('anexa o cookie, parseia e valida o JSON', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockReturnValue(okJson({ n: 1 }))
    const out = await apiGet('/api/mobile/x', (raw) => (raw as { n: number }).n)
    expect(out).toBe(1)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Cookie).toBe('better-auth.session_token=abc')
    expect(init.credentials).toBe('omit')
  })

  it('joga ApiError com o status em resposta não-ok', async () => {
    jest.spyOn(global, 'fetch').mockReturnValue(errStatus(401))
    await expect(apiGet('/api/mobile/x', (r) => r)).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    })
    await expect(apiGet('/api/mobile/x', (r) => r)).rejects.toBeInstanceOf(ApiError)
  })
})
```

Run: `npm test -- src/api/client.test.ts` → FAIL (módulo não existe).

- [ ] **Step 2: `src/api/client.ts`**

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

- [ ] **Step 3: Rodar o teste e ver passar**

Run: `npm test -- src/api/client.test.ts`
Expected: PASS — 2 testes.

- [ ] **Step 4: Typecheck + suíte + commit**

```bash
npx tsc --noEmit
npm test
git add -A
git commit -m "feat: apiGet tipado (cookie header + Zod parse + ApiError)

apiGet(path, parse) lê o cookie via authClient.getCookie(), manda como
header Cookie com credentials omit, joga ApiError{status} em !ok.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 7: Schema Zod do Dashboard (repo `nexis-mobile`)

**Files:**
- Create: `src/schemas/dashboard.ts`
- Create: `src/schemas/dashboard.test.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces: `DashboardResponseSchema` (Zod) e `type DashboardData = z.infer<...>`.

Shape do contrato (de `getDashboardData` no `nexis`, campo `recent[].category` é a Category completa serializada — pegamos o subconjunto usado pela tela):

- [ ] **Step 1: Instalar zod + escrever o teste que deve falhar**

```bash
npx expo install zod
```

Create `src/schemas/dashboard.test.ts`:

```ts
import { DashboardResponseSchema } from './dashboard'

const VALID = {
  totalBalance: 2395,
  hasWallets: true,
  monthly: { income: 5077, expenses: 2682 },
  recent: [
    {
      id: 't1', type: 'INCOME', amount: 3577, description: 'Salário',
      date: '2026-09-03T12:00:00.000Z',
      category: { id: 'c1', name: 'Salário', color: '#22c55e', icon: 'briefcase', type: 'INCOME', userId: 'u1' },
      wallet: { id: 'w1', name: 'Santander', color: '#ef4444' },
    },
    {
      id: 't2', type: 'EXPENSE', amount: 25, description: null,
      date: '2026-09-03T12:00:00.000Z',
      category: null,
      wallet: { id: 'w2', name: 'Nubank', color: null },
    },
  ],
  categoryBreakdown: [{ id: 'c1', name: 'Alimentação', color: '#f97316', amount: 25 }],
}

describe('DashboardResponseSchema', () => {
  it('parseia um payload válido e ignora campos extras da category', () => {
    const out = DashboardResponseSchema.parse(VALID)
    expect(out.totalBalance).toBe(2395)
    expect(out.recent).toHaveLength(2)
    expect(out.recent[0].category?.name).toBe('Salário')
    // campos extras (type, userId) não quebram nem aparecem tipados
  })

  it('parseia recent vazio e hasWallets false', () => {
    const out = DashboardResponseSchema.parse({ ...VALID, recent: [], hasWallets: false })
    expect(out.recent).toEqual([])
    expect(out.hasWallets).toBe(false)
  })

  it('rejeita amount não-numérico', () => {
    const bad = { ...VALID, recent: [{ ...VALID.recent[0], amount: '3577' }] }
    expect(() => DashboardResponseSchema.parse(bad)).toThrow()
  })
})
```

Run: `npm test -- src/schemas/dashboard.test.ts` → FAIL.

- [ ] **Step 2: `src/schemas/dashboard.ts`**

```ts
import { z } from 'zod'

const RecentTx = z.object({
  id: z.string(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number(),
  description: z.string().nullable(),
  date: z.string(),
  category: z
    .object({
      id: z.string(),
      name: z.string(),
      color: z.string().nullable(),
      icon: z.string().nullable(),
    })
    .nullable(),
  wallet: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().nullable(),
  }),
})

export const DashboardResponseSchema = z.object({
  totalBalance: z.number(),
  hasWallets: z.boolean(),
  monthly: z.object({ income: z.number(), expenses: z.number() }),
  recent: z.array(RecentTx),
  categoryBreakdown: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
      amount: z.number(),
    }),
  ),
})

export type DashboardData = z.infer<typeof DashboardResponseSchema>
```

- [ ] **Step 3: Rodar o teste e ver passar**

Run: `npm test -- src/schemas/dashboard.test.ts`
Expected: PASS — 3 testes. (Zod `.object` é não-strict por padrão: `type`/`userId` extras na `category` são ignorados.)

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: schema Zod da resposta do /api/mobile/dashboard

Cópia do contrato do getDashboardData. category pega só name/color/icon
(ignora type/userId extras). date como string ISO.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 8: Navegação, providers e tela de login (repo `nexis-mobile`)

**Files:**
- Create: `src/api/dashboard.ts`
- Modify/Create: `app/_layout.tsx`
- Create: `app/index.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/login.tsx`, `app/(app)/_layout.tsx`
- (o `app/index.tsx` de teste da Task 3 é substituído)

**Interfaces:**
- Consumes: `#/auth/session` (`SessionProvider`, `useAuthSession`), `#/auth/client` (`signIn`), `expo-router` (`Stack`, `Tabs`, `Redirect`), `@tanstack/react-query`.
- Produces:
  - `#/api/dashboard` exporta `getDashboard(): Promise<DashboardData>` e `dashboardQuery` (`{ queryKey, queryFn, staleTime, gcTime }`).
  - App: rota `/` redireciona pra `/(app)` (com sessão) ou `/(auth)/login` (sem). `(app)` tem um `<Tabs>` com a aba Dashboard.

- [ ] **Step 1: Instalar react-query**

```bash
npx expo install @tanstack/react-query
```

- [ ] **Step 2: `src/api/dashboard.ts`**

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

- [ ] **Step 3: `app/_layout.tsx`**

```tsx
import '../global.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SessionProvider, useAuthSession } from '#/auth/session'
import { View, Text } from '#/tw'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnReconnect: true },
  },
})

function Gate() {
  const { isPending } = useAuthSession()
  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Carregando…</Text>
      </View>
    )
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090b' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="light" />
        <Gate />
      </SessionProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 4: `app/index.tsx`** (substitui o de teste da Task 3)

```tsx
import { Redirect } from 'expo-router'
import { useAuthSession } from '#/auth/session'

export default function Index() {
  const { session } = useAuthSession()
  return <Redirect href={session ? '/(app)' : '/(auth)/login'} />
}
```

- [ ] **Step 5: `app/(auth)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router'
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090b' } }} />
}
```

- [ ] **Step 6: `app/(auth)/login.tsx` — caminho A**

```tsx
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, Pressable } from '#/tw'
import { signIn } from '#/auth/client'

export default function Login() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    try {
      await signIn.social({ provider: 'google', callbackURL: '/' })
      // ao voltar, useSession atualiza e app/index redireciona
      router.replace('/')
    } catch {
      // usuário cancelou o browser — sem erro ruidoso
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-bg px-8">
      <Text className="text-3xl font-bold text-fg">Nexis</Text>
      <Text className="text-center text-sm text-muted">Seu sistema financeiro pessoal</Text>
      <Pressable
        onPress={handleGoogle}
        disabled={loading}
        className="w-full items-center rounded-xl bg-accent py-4 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-white">
          {loading ? 'Abrindo…' : 'Entrar com Google'}
        </Text>
      </Pressable>
    </View>
  )
}
```

- [ ] **Step 7: `app/(app)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router'
import { LayoutDashboard } from 'lucide-react-native'
import { Redirect } from 'expo-router'
import { useAuthSession } from '#/auth/session'

export default function AppLayout() {
  const { session } = useAuthSession()
  if (!session) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#09090b', borderTopColor: '#27272a' },
        tabBarActiveTintColor: '#60a5fa',
        tabBarInactiveTintColor: '#71717a',
        sceneStyle: { backgroundColor: '#09090b' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }}
      />
    </Tabs>
  )
}
```

```bash
npx expo install lucide-react-native react-native-svg
```

- [ ] **Step 8: `app/(app)/index.tsx` placeholder temporário**

Um placeholder só pra navegação compilar (a Task 9 implementa de verdade):

```tsx
import { View, Text } from '#/tw'
export default function Dashboard() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="text-muted">Dashboard (Task 9)</Text>
    </View>
  )
}
```

- [ ] **Step 9: Typecheck + boot + commit**

Run: `npx tsc --noEmit`
Run: `npx expo start` — abrir no Expo Go. Verificar: abre na **tela de login** (fundo escuro, "Nexis", botão azul). Tocar em "Entrar com Google" **abre o browser do sistema** com a tela do Google. (O round-trip completo — voltar logado — é verificado na Task 10; aqui basta o browser abrir sem crash.) `Ctrl+C`.

```bash
git add -A
git commit -m "feat: navegação (Stack + Tabs), providers e tela de login

_layout com QueryClientProvider + SessionProvider + gate de isPending.
app/index redireciona por sessão. (auth)/login com signIn.social Google
(caminho A). (app) com Tabs nativo (aba Dashboard, placeholder).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 9: Tela Dashboard (repo `nexis-mobile`)

**Files:**
- Replace: `app/(app)/index.tsx`
- Create: `app/(app)/index.test.tsx`
- Create: `src/components/dashboard/` (subcomponentes, se ajudar a legibilidade)

**Interfaces:**
- Consumes: `dashboardQuery` de `#/api/dashboard`, `useAuthSession`, `#/tw`, `#/tw/image`, `#/lib/format`, `#/theme/colors`, `lucide-react-native`, `@tanstack/react-query` (`useQuery`, `useQueryClient`), `react-native` (`RefreshControl`, `ActivityIndicator`).
- Produces: a tela `/(app)/index` renderizando o dashboard.

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `app/(app)/index.test.tsx`:

```tsx
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './index'

jest.mock('#/auth/session', () => ({
  useAuthSession: () => ({ session: { user: { name: 'Welbert Soares', image: null } }, isPending: false }),
}))
jest.mock('expo-router', () => ({ Link: ({ children }: any) => children }))

const FIXTURE = {
  totalBalance: 2395,
  hasWallets: true,
  monthly: { income: 5077, expenses: 2682 },
  recent: [
    { id: 't1', type: 'INCOME', amount: 3577, description: 'Salário', date: '2026-09-03T12:00:00.000Z',
      category: { id: 'c1', name: 'Salário', color: '#22c55e', icon: null }, wallet: { id: 'w1', name: 'Santander', color: null } },
  ],
  categoryBreakdown: [],
}

function renderWith(data: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['dashboard'], data)
  return render(
    <QueryClientProvider client={qc}>
      <Dashboard />
    </QueryClientProvider>,
  )
}

describe('Dashboard', () => {
  it('mostra saudação, receitas/despesas e as transações recentes', () => {
    const { getByText } = renderWith(FIXTURE)
    expect(getByText(/Olá, Welbert/)).toBeTruthy()
    expect(getByText('Receitas')).toBeTruthy()
    expect(getByText('Despesas')).toBeTruthy()
    expect(getByText('Salário')).toBeTruthy()
  })

  it('mostra o onboarding quando não há carteiras', () => {
    const { getByText } = renderWith({ ...FIXTURE, hasWallets: false, recent: [] })
    expect(getByText(/Criar carteira|primeira carteira/i)).toBeTruthy()
  })
})
```

Run: `npm test -- "app/(app)/index.test.tsx"` → FAIL (a tela ainda é o placeholder).

- [ ] **Step 2: Implementar `app/(app)/index.tsx`**

Porta o layout do web (`src/routes/_authenticated/dashboard.tsx` do `nexis`). Estrutura:

```tsx
import { ScrollView, View, Text } from '#/tw'
import { Image } from '#/tw/image'
import { RefreshControl, ActivityIndicator } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react-native'
import { Link } from 'expo-router'
import { dashboardQuery } from '#/api/dashboard'
import { useAuthSession } from '#/auth/session'
import { fmtBRL, fmtDate } from '#/lib/format'
import { colors } from '#/theme/colors'

export default function Dashboard() {
  const { session } = useAuthSession()
  const qc = useQueryClient()
  const { data, isLoading, isFetching, refetch } = useQuery(dashboardQuery)
  const firstName = session?.user?.name?.split(' ')[0] ?? ''

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="px-4 pb-8 pt-14 gap-6"
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={() => qc.invalidateQueries({ queryKey: ['dashboard'] })}
          tintColor={colors.muted}
        />
      }
    >
      {/* Header */}
      <View className="flex-row items-start justify-between">
        <View className="gap-1">
          <Text className="text-sm text-muted">Olá, {firstName}</Text>
          {isLoading && !data ? (
            <View className="h-10 w-40 rounded-lg bg-card" />
          ) : (
            <Text className="text-4xl font-bold text-fg">{fmtBRL(data?.totalBalance ?? 0)}</Text>
          )}
          <Text className="text-xs text-muted">Saldo total · todas as carteiras</Text>
        </View>
        {session?.user?.image ? (
          <Image source={session.user.image} className="h-10 w-10 rounded-full" />
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-card">
            <Text className="text-sm text-fg">{firstName.slice(0, 1)}</Text>
          </View>
        )}
      </View>

      {/* Onboarding OU resumo + recentes */}
      {!isLoading && data && !data.hasWallets ? (
        <OnboardingCard />
      ) : (
        <>
          <View className="flex-row gap-3">
            <SummaryCard label="Receitas" value={data?.monthly.income ?? 0} kind="in" loading={isLoading && !data} />
            <SummaryCard label="Despesas" value={data?.monthly.expenses ?? 0} kind="out" loading={isLoading && !data} />
          </View>

          <View className="gap-3">
            <Text className="text-xs font-medium uppercase tracking-widest text-muted">Recentes</Text>
            {isLoading && !data ? (
              <ListSkeleton />
            ) : !data?.recent.length ? (
              <EmptyRecent />
            ) : (
              <View className="gap-1">
                {data.recent.map((t) => (
                  <TxRow key={t.id} tx={t} />
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  )
}
```

Subcomponentes (`SummaryCard`, `TxRow`, `ListSkeleton`, `EmptyRecent`, `OnboardingCard`) — portar do web, com:
- `SummaryCard`: `<View className="flex-1 gap-3 rounded-2xl border border-border bg-card p-4">`, ícone `TrendingUp`/`TrendingDown` com `color={kind==='in' ? colors.positive : colors.negative}`, valor `fmtBRL` com `text-positive`/`text-negative`.
- `TxRow`: linha com bolinha/ícone colorido (`backgroundColor` inline = `${cor}20`), label = `tx.description ?? tx.category?.name ?? 'Sem descrição'`, subtítulo `${tx.wallet.name} · ${fmtDate(new Date(tx.date))}`, valor à direita `+`/`-` + `fmtBRL(tx.amount)`. Ícone Lucide por `tx.category?.icon` — se não houver mapa de ícones ainda, usar sempre a bolinha colorida (o mapa `CATEGORY_ICONS` completo fica pra Fatia 2).
- `OnboardingCard`: card com passos 1-2-3 e botão "Criar carteira" (`<Link href="/(app)/index">` como placeholder — não há tela de carteiras ainda; ou desabilitar o toque).
- `ListSkeleton` / `EmptyRecent`: Views cinza / texto "Nenhuma transação ainda".

**Regras:** sem animação de entrada. Skeleton só quando `isLoading && !data`. Nada de `FlatList` (≤5 itens).

- [ ] **Step 3: Rodar o teste e ver passar**

Run: `npm test -- "app/(app)/index.test.tsx"`
Expected: PASS — 2 testes. Ajustar textos dos `getByText` se a cópia final diferir (manter o sentido).

- [ ] **Step 4: Suíte + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: tela Dashboard nativa (leitura)

Porta o layout do web: header (saudação + avatar), SummaryCard x2,
Recentes (<=5 linhas), OnboardingCard sem carteiras, RefreshControl.
Render imediato (cache/vazio) + dados depois; skeleton só em cold load;
sem animação de entrada.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 10: Integração ponta a ponta no device

**Files:** possivelmente `app/(auth)/login.tsx` + `src/auth/` (só se o caminho A falhar → implementar caminho B). Senão, nenhum arquivo — é verificação.

**Interfaces:** —

- [ ] **Step 1: Deployar o backend**

Mergear o PR da Task 1+2 (`feat/mobile-slice-1-backend`) pra `main` do `nexis` → a Vercel deploya `https://nexis-virid.vercel.app` com a rota `/api/mobile/dashboard` e o plugin `expo()`.

Verificar o deploy: `curl -i https://nexis-virid.vercel.app/api/mobile/dashboard` → deve responder **401** `{"error":"Unauthorized"}` (sem cookie). Se responder 404, a rota não subiu — investigar o build da Vercel (`routeTree.gen.ts` commitado?).

- [ ] **Step 2: Rodar o app e logar**

```bash
cd /c/Users/welbert.barbosa/Documents/study/nexis-mobile
npx expo start   # ou --tunnel
```

Abrir no Expo Go do iPhone. Na tela de login, tocar "Entrar com Google".

- [ ] **Step 3: Avaliar o resultado do OAuth**

- **Se voltar pro app logado** → caminho A funciona. Seguir pro Step 5.
- **Se o browser abrir, logar, mas NÃO voltar pro app** (fica preso no browser, ou volta pro app deslogado): caminho A falhou no Expo Go. Ir pro Step 4.

- [ ] **Step 4: (condicional) Implementar caminho B**

Em `app/(auth)/login.tsx`, trocar o `handleGoogle` por: `expo-auth-session` com `AuthSession.makeRedirectUri()` faz o OAuth OIDC direto com o Google (client ID do Google — **precisa** de um OAuth client "iOS"/"Web" no Google Console apontando pro redirect do Expo; documentar o valor em `.env` como `EXPO_PUBLIC_GOOGLE_CLIENT_ID`), obtém o `id_token`, e:

```ts
await signIn.social({ provider: 'google', idToken: { token: idToken } })
```

O backend (`expo()` + provider `google` já configurado com `GOOGLE_CLIENT_ID/SECRET`) valida o `id_token`, cria a `Session`, e o `expoClient` guarda o cookie.

Testar de novo no device. Commit:

```bash
git add -A
git commit -m "fix: OAuth via expo-auth-session + signIn.social(idToken)

Caminho A (@better-auth/expo redirect) não retorna ao app no Expo Go.
Fallback: expo-auth-session obtém o id_token do Google e entrega ao
backend, que cria a sessão Better Auth.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

- [ ] **Step 5: Verificar o Dashboard com dados reais**

Depois de logado, o app redireciona pra `(app)` e mostra o Dashboard. Confirmar:
- [ ] O saldo total, Receitas e Despesas batem com o que o PWA mostra pra mesma conta.
- [ ] As transações recentes aparecem (mesmas do PWA).
- [ ] Pull-to-refresh atualiza.
- [ ] Trocar de app e voltar (sessão persiste no SecureStore) → continua logado, Dashboard aparece na hora (cache).
- [ ] Fechar e reabrir o Expo Go → ainda logado.

- [ ] **Step 6: Verificar performance de navegação**

- [ ] A tela de login → Dashboard não tem "flash" de tela branca nem spinner longo bloqueando.
- [ ] Tocar na aba (única) não re-monta / não pisca.

- [ ] **Step 7: Rodar as suítes dos dois repos uma última vez**

```bash
cd /c/Users/welbert.barbosa/Documents/study/nexis && npm run test          # 40
cd /c/Users/welbert.barbosa/Documents/study/nexis-mobile && npm test       # todos verdes
```

- [ ] **Step 8: Finalizar**

Se tudo verde e o Dashboard mostra dados reais no iPhone → invocar `superpowers:finishing-a-development-branch` pro `nexis-mobile` (primeiro push do repo — decidir remote no GitHub) e confirmar o merge do PR do `nexis`.

---

## Self-Review (feito pelo autor do plano)

**Cobertura do spec:**
- A1 (plugin `expo()`) → Task 2. ✔
- A2 (rota `/api/mobile/dashboard`) → Task 1. ✔
- A3 (teste backend) → Task 1 Step 2. ✔
- A4 (trustedOrigins / Google) → Task 2 Step 2 + Task 10 Step 4 (Google Console só se cair no caminho B). ✔
- B1 (scaffold) → Task 3. ✔
- B2 (deps) → distribuídas: styling Task 3, tw/format Task 4, auth Task 5, api/react-query Task 6/8, zod Task 7, ícones Task 8. ✔
- B3 (estrutura de pastas) → materializada ao longo das Tasks 3-9. ✔
- B4 (auth client) → Task 5. ✔
- B5 (`apiGet`) → Task 6. ✔
- B6 (schema Zod) → Task 7. ✔
- B7 (`dashboardQuery`) → Task 8 Step 2. ✔
- B8 (root layout + gate) → Task 8 Step 3. ✔
- B9 (login, caminhos A e B) → Task 8 Step 6 (A) + Task 10 Step 4 (B). ✔
- B10 (Dashboard) → Task 9. ✔
- B11 (tema) → Task 4 Steps 2-3. ✔
- B12 (testes mobile) → schema Task 7, client Task 6, format Task 4, index Task 9. ✔
- B13 (rodar) → Task 10. ✔
- Seção de performance → Task 8 Step 3 (config do QueryClient, `<Tabs>` nativo), Task 9 Step 2 (render imediato, sem animação), Task 10 Step 6 (verificação). ✔
- Riscos: NativeWind v5 → Task 3 Step 6 é o gate com fallback explícito. OAuth Expo Go → Task 10 Steps 3-4. `Intl` Hermes → Task 4 Step 5. `getCookie` formato → Task 6 (teste fixa o header) + Task 10 (real). ✔

**Placeholder scan:** sem "TBD". Os pontos "confirmar na implementação" (forma de `Route.options` no teste da Task 1; forma do retorno de `useSession` na Task 5; literais de `Intl` na Task 4) são known-unknowns de APIs de terceiros, cada um com instrução concreta do que fazer (inspecionar e ajustar mantendo a interface pública). O caminho B (Task 10 Step 4) é condicional e detalhado o suficiente pra executar se disparado.

**Consistência de tipos/nomes:** `apiGet<T>(path, parse)` + `ApiError{status}` (Task 6) → consumido na Task 8. `dashboardQuery` `queryKey: ['dashboard']` (Task 8) → mesma key no `invalidateQueries` (Task 9) e no `setQueryData` do teste (Task 9). `DashboardResponseSchema`/`DashboardData` (Task 7) → Task 8. `useAuthSession()` → `{ session, isPending }` (Task 5) → usado nas Tasks 8 e 9. `authClient.getCookie()` (Task 5) → Task 6. `#/tw` exports (Task 4) → Tasks 3, 8, 9. `colors` (Task 4) → Task 9. `fmtBRL`/`fmtDate` (Task 4) → Task 9.

**Risco aberto registrado:** a forma interna de `createFileRoute(...).options.server.handlers` (Task 1 Step 5) e a compatibilidade NativeWind v5 + SDK 57 (Task 3 Step 6) são os dois pontos onde o plano pode precisar de adaptação real — ambos com fallback escrito.
