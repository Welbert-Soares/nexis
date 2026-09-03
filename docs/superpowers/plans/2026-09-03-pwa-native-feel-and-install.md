# PWA: sensação nativa + instalação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o PWA Nexis com cara de app nativo instalado — ícones/splash corretos, manifest completo, meta tags iOS, gate no convite de instalação, haptics nos 2 pontos que faltam, skeletons consolidados e transições de rota — sem tocar em dados, offline ou auth.

**Architecture:** Oito frentes independentes sobre código existente, precedidas pela criação da infra de teste (vitest/jsdom, hoje ausente). Geração de assets é um script Node manual (`sharp`) que **nunca** roda no build da Vercel. Metadados de `<head>` são extraídos para um módulo testável. Frentes 5 e 6 (install prompt, haptics) já existem no repo em ~80% — o trabalho é fechar lacunas.

**Tech Stack:** TanStack Start (SSR) + React 19, TanStack Router/Query, Tailwind v4 (CSS-first), vaul, framer-motion, vitest 4 + jsdom + @testing-library/react, sharp (novo, devDep).

**Spec:** `docs/superpowers/specs/2026-09-03-pwa-native-feel-and-install-design.md`

## Global Constraints

- **Branch:** `feat/pwa-native-feel`. Nunca commitar na `main`.
- **TypeScript strict** com `noUnusedLocals` e `noUnusedParameters`: zero erros de tipo antes de cada commit. `verbatimModuleSyntax: true` → imports só de tipo usam `import type`.
- **Path aliases:** `#/*` e `@/*` → `src/*`.
- **Ícones:** Lucide React exclusivamente.
- **Tailwind v4 CSS-first:** sem `tailwind.config.js`; classes utilitárias em `src/styles.css`. Usar `cn()` de `#/lib/utils` para merge de classes.
- **Geração de assets NUNCA acoplada ao `build`** — o build da Vercel já quebrou uma vez por tooling de PWA no pipeline.
- **Sem novas dependências de teste** além das já instaladas: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@vitejs/plugin-react`. Asserções com o `expect` nativo do vitest (sem `@testing-library/jest-dom`).
- **Haptics:** usar somente os 4 métodos que `src/hooks/use-haptic.ts` expõe (`tap`, `success`, `error`, `heavy`). Não inventar padrões.
- **Copy do manifest e da UI:** pt-BR.
- **Mudança visível intencional única:** `apple-mobile-web-app-status-bar-style` de `black` → `black-translucent`.
- **Cada commit** termina com:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd
  ```

---

## File Structure

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `vitest.config.ts` | Config de teste (jsdom, alias, setup) | 1 |
| `src/test/setup.ts` | Setup global: cleanup, stub de `matchMedia` | 1 |
| `src/test/smoke.test.ts` | Prova que o runner funciona | 1 |
| `src/test/structure.test.ts` | Afirmações de "arquivo morto removido" / conteúdo de `sw.js` / `package.json` | 2, 6 |
| `scripts/generate-pwa-assets.mjs` | Gera ícones + splash a partir de 1 fonte | 3 |
| `src/test/generate-pwa-assets.test.ts` | Roda o script em tmpdir, confere dimensões | 3 |
| `public/icons/*`, `public/splash/*` | Assets gerados (commitados) | 3 |
| `public/manifest.json` | Metadados de instalação | 4 |
| `src/test/manifest.test.ts` | Valida shape + resolução de arquivos do manifest | 4 |
| `src/lib/pwa-head.ts` | Arrays de `meta`/`link` PWA (testável) | 5 |
| `src/lib/pwa-head.test.ts` | Valida os arrays | 5 |
| `src/routes/__root.tsx` | Consome `pwa-head.ts` no `head()` | 5 |
| `public/sw.js` | Só push/notificationclick | 2 |
| `src/hooks/use-install-prompt.ts` | + contagem de sessão + `showAutoPrompt` | 6 |
| `src/hooks/use-install-prompt.test.ts` | Testa o gate de sessão | 6 |
| `src/components/ui/app-toasts.tsx` | Usa `showAutoPrompt` no convite automático | 6 |
| `src/components/ui/install-prompt.tsx` | **Deletado** (código morto) | 6 |
| `src/hooks/use-haptic.ts` | Refactor mínimo p/ checar `vibrate` em call-time | 7 |
| `src/hooks/use-haptic.test.ts` | Testa padrões por método | 7 |
| `src/components/transactions/transaction-sheet.tsx` | `haptic.success()` ao salvar/excluir | 7 |
| `src/routes/_authenticated/transactions.tsx` | `haptic.error()` ao confirmar exclusão; `keepPreviousData` | 7, 8b |
| `src/components/ui/skeleton.tsx` | Primitivo `<Skeleton>` | 8a |
| `src/components/ui/skeleton.test.tsx` | Testa o primitivo | 8a |
| `src/routes/_authenticated/{dashboard,transactions,wallets,analytics,goals}.tsx` | Migram para `<Skeleton>` | 8b |
| `src/router.tsx` | `defaultViewTransition: true` | 9 |
| `src/styles.css` | `@view-transition` + guarda `prefers-reduced-motion` | 9 |
| `src/test/view-transitions.test.ts` | Afirma opt-in + CSS | 9 |
| `CLAUDE.md` | Documenta `npm run gen:pwa-assets` | 3 |

---

## Task 1: Infra de teste (vitest + jsdom)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `npm run test` funcional; alias `#/` e `@/` resolvidos em testes; `window.matchMedia` stub disponível globalmente nos testes; `localStorage`/`sessionStorage` limpos após cada teste.

- [ ] **Step 1: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^#\//, replacement: `${src}/` },
      { find: /^@\//, replacement: `${src}/` },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 2: Criar `src/test/setup.ts`**

```ts
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom não implementa matchMedia — stub mínimo (sempre "não corresponde").
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  cleanup()
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // ambientes sem storage
  }
})
```

- [ ] **Step 3: Criar `src/test/smoke.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { cn } from '#/lib/utils'

describe('infra de teste', () => {
  it('roda o runner', () => {
    expect(1 + 1).toBe(2)
  })

  it('tem jsdom', () => {
    const el = document.createElement('div')
    el.className = 'x'
    expect(el.tagName).toBe('DIV')
  })

  it('resolve o alias #/', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('tem o stub de matchMedia', () => {
    expect(window.matchMedia('(display-mode: standalone)').matches).toBe(false)
  })
})
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npm run test`
Expected: PASS — 4 testes em `src/test/smoke.test.ts`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos. (Se `vitest.config.ts` acusar tipo de `defineConfig`, confirmar que `vitest` está nas `devDependencies` — está.)

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/test/setup.ts src/test/smoke.test.ts
git commit -m "test: configura vitest + jsdom

Adiciona vitest.config.ts (environment jsdom, alias #/ e @/, setupFiles),
setup global com cleanup e stub de matchMedia, e um smoke test.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 2: Limpeza do service worker

**Files:**
- Delete: `src/sw.ts`
- Modify: `public/sw.js`
- Modify: `package.json` (remove `vite-plugin-pwa`)
- Create: `src/test/structure.test.ts`

**Interfaces:**
- Consumes: infra de teste (Task 1).
- Produces: `public/sw.js` sem lógica de cache; nenhuma referência a `vite-plugin-pwa` no repo.

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/test/structure.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8')

describe('service worker', () => {
  it('não tem o sw.ts órfão do Workbox', () => {
    expect(existsSync(path.join(repoRoot, 'src/sw.ts'))).toBe(false)
  })

  it('public/sw.js só trata push, sem cache', () => {
    const sw = read('public/sw.js')
    expect(sw).toContain("addEventListener('push'")
    expect(sw).toContain("addEventListener('notificationclick'")
    expect(sw).not.toContain('caches')
    expect(sw).not.toContain('CACHE_NAME')
  })

  it('package.json não tem vite-plugin-pwa', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(Object.keys(all)).not.toContain('vite-plugin-pwa')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/test/structure.test.ts`
Expected: FAIL — `src/sw.ts` existe, `sw.js` contém `caches`/`CACHE_NAME`, `package.json` tem `vite-plugin-pwa`.

- [ ] **Step 3: Deletar o SW órfão**

Run: `git rm src/sw.ts`

- [ ] **Step 4: Reescrever `public/sw.js`**

Conteúdo completo:

```js
// Nexis service worker — transporte de Web Push apenas.
// Sem cache/offline por decisão de projeto.
// Ver docs/superpowers/specs/2026-09-03-pwa-native-feel-and-install-design.md.
// Offline fica para a futura versão React Native.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'Nexis'
  const body = data.body ?? ''
  const url = data.url ?? '/dashboard'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo-nexis-fundo.webp',
      badge: '/logo-nexis-fundo.webp',
      vibrate: [200, 100, 200],
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 5: Remover a dependência morta**

Run: `npm uninstall vite-plugin-pwa`
Expected: `package.json` e `package-lock.json` atualizados; `node_modules` sem `vite-plugin-pwa`.

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npx vitest run src/test/structure.test.ts`
Expected: PASS.

- [ ] **Step 7: Confirmar que o build ainda passa**

Run: `npm run build`
Expected: build conclui sem erro (o `vite.config.ts` não referencia `vite-plugin-pwa`, então nada quebra).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: enxuga service worker para só push

Remove src/sw.ts (Workbox órfão, nunca compilado desde a saída do
vite-plugin-pwa do vite.config), tira vite-plugin-pwa do package.json e
reduz public/sw.js a push + notificationclick. Sem offline por decisão
de projeto.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 3: Script de geração de assets

**Files:**
- Modify: `package.json` (add `sharp` devDep + script `gen:pwa-assets`)
- Create: `scripts/generate-pwa-assets.mjs`
- Create: `src/test/generate-pwa-assets.test.ts`
- Create (gerados, commitados): `public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon,favicon-32,favicon-16}.png`, `public/splash/apple-splash-{750-1334,1080-2340,1170-2532,1284-2778,1179-2556,1290-2796,1320-2868}.png`
- Modify: `CLAUDE.md` (linha do comando)

**Interfaces:**
- Consumes: infra de teste (Task 1); `public/logo-nexis-fundo.webp` (1185×1185, existe).
- Produces: os PNGs acima em `public/`. O script aceita `PWA_ASSETS_OUT` (env) para redirecionar a saída — usado pelo teste.

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/test/generate-pwa-assets.test.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))

function pngSize(file: string) {
  const buf = readFileSync(file)
  // PNG: assinatura de 8 bytes, depois IHDR (len 4 + "IHDR" 4 + width 4 + height 4), big-endian
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

describe('generate-pwa-assets', () => {
  let out: string

  beforeAll(() => {
    out = mkdtempSync(path.join(tmpdir(), 'pwa-assets-'))
    execFileSync('node', ['scripts/generate-pwa-assets.mjs'], {
      cwd: repoRoot,
      env: { ...process.env, PWA_ASSETS_OUT: out },
      stdio: 'pipe',
    })
  }, 60_000)

  it.each([
    ['icons/icon-192.png', 192, 192],
    ['icons/icon-512.png', 512, 512],
    ['icons/icon-maskable-512.png', 512, 512],
    ['icons/apple-touch-icon.png', 180, 180],
    ['icons/favicon-32.png', 32, 32],
    ['icons/favicon-16.png', 16, 16],
    ['splash/apple-splash-750-1334.png', 750, 1334],
    ['splash/apple-splash-1170-2532.png', 1170, 2532],
    ['splash/apple-splash-1320-2868.png', 1320, 2868],
  ])('%s tem %ix%i', (rel, w, h) => {
    const file = path.join(out, rel as string)
    expect(existsSync(file)).toBe(true)
    expect(pngSize(file)).toEqual({ width: w, height: h })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/test/generate-pwa-assets.test.ts`
Expected: FAIL — `scripts/generate-pwa-assets.mjs` não existe (`execFileSync` lança).

- [ ] **Step 3: Instalar `sharp`**

Run: `npm install -D sharp`

- [ ] **Step 4: Criar `scripts/generate-pwa-assets.mjs`**

```js
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SRC = path.join(repoRoot, 'public', 'logo-nexis-fundo.webp')
const BG = '#09090b'

const outDir = process.env.PWA_ASSETS_OUT
  ? path.resolve(process.env.PWA_ASSETS_OUT)
  : path.join(repoRoot, 'public')
const iconsDir = path.join(outDir, 'icons')
const splashDir = path.join(outDir, 'splash')

const ICONS = [
  { file: 'icon-192.png', size: 192, maskable: false, flatten: false },
  { file: 'icon-512.png', size: 512, maskable: false, flatten: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true, flatten: false },
  { file: 'apple-touch-icon.png', size: 180, maskable: false, flatten: true },
  { file: 'favicon-32.png', size: 32, maskable: false, flatten: false },
  { file: 'favicon-16.png', size: 16, maskable: false, flatten: false },
]

// [largura, altura] em pixels — iPhones atuais, portrait.
const SPLASH = [
  [750, 1334],
  [1080, 2340],
  [1170, 2532],
  [1284, 2778],
  [1179, 2556],
  [1290, 2796],
  [1320, 2868],
]

async function buildIcon({ file, size, maskable, flatten }) {
  // maskable: a marca ocupa ~72% do quadro, resto é padding com a cor da marca.
  const inner = maskable ? Math.round(size * 0.72) : size
  const logo = await sharp(SRC).resize(inner, inner, { fit: 'contain', background: BG }).toBuffer()
  let img = sharp({ create: { width: size, height: size, channels: 4, background: BG } }).composite([
    { input: logo, gravity: 'center' },
  ])
  if (flatten) img = img.flatten({ background: BG })
  await img.png().toFile(path.join(iconsDir, file))
}

async function buildSplash([w, h]) {
  const logoSize = Math.round(w * 0.4)
  const logo = await sharp(SRC).resize(logoSize, logoSize, { fit: 'contain', background: BG }).toBuffer()
  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(splashDir, `apple-splash-${w}-${h}.png`))
}

await mkdir(iconsDir, { recursive: true })
await mkdir(splashDir, { recursive: true })
await Promise.all([...ICONS.map(buildIcon), ...SPLASH.map((s) => buildSplash(s))])
console.log(`PWA assets gerados em ${outDir}`)
```

- [ ] **Step 5: Adicionar o script npm**

Em `package.json`, na seção `scripts`, adicionar (depois de `"preview"`):

```json
"gen:pwa-assets": "node scripts/generate-pwa-assets.mjs",
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npx vitest run src/test/generate-pwa-assets.test.ts`
Expected: PASS — 9 casos.

- [ ] **Step 7: Gerar os assets reais**

Run: `npm run gen:pwa-assets`
Expected: log `PWA assets gerados em .../public`; 13 arquivos novos em `public/icons/` e `public/splash/`.

- [ ] **Step 8: Conferir visualmente 1 ícone**

Abrir `public/icons/icon-512.png` e `public/icons/icon-maskable-512.png` num visualizador. Confirmar: `icon-512` nítido, sem artefato de upscale; `icon-maskable-512` com a marca centralizada e folga visível nas 4 bordas.

- [ ] **Step 9: Documentar o comando no `CLAUDE.md`**

Em `CLAUDE.md`, na lista de comandos (bloco ```bash logo após "## Commands"), adicionar uma linha após `npm run storybook`:

```
npm run gen:pwa-assets  # regenera ícones e splash do PWA (manual, fora do build)
```

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. (O `.mjs` não é checado; o teste `.ts` sim.)

- [ ] **Step 11: Commit**

```bash
git add scripts/generate-pwa-assets.mjs src/test/generate-pwa-assets.test.ts package.json package-lock.json public/icons public/splash CLAUDE.md
git commit -m "feat: script de geração de assets PWA (ícones + splash)

Adiciona sharp (devDep) e scripts/generate-pwa-assets.mjs — roda manual
via npm run gen:pwa-assets, NUNCA no build. Gera icon-192/512, maskable
512 com safe zone, apple-touch-icon 180, favicons e 7 splash de iPhone
a partir de public/logo-nexis-fundo.webp. Assets commitados.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 4: `public/manifest.json`

**Files:**
- Modify: `public/manifest.json`
- Create: `src/test/manifest.test.ts`

**Interfaces:**
- Consumes: os arquivos de `public/icons/` (Task 3).
- Produces: manifest com `id`, `icons` separados por `purpose`, `shortcuts`.

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/test/manifest.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
const pub = path.join(repoRoot, 'public')

interface Manifest {
  id?: string
  name?: string
  start_url?: string
  display?: string
  icons: Array<{ src: string; sizes?: string; type?: string; purpose?: string }>
  shortcuts?: Array<{ name: string; url: string }>
}

const manifest = JSON.parse(readFileSync(path.join(pub, 'manifest.json'), 'utf8')) as Manifest

describe('manifest.json', () => {
  it('tem os campos obrigatórios', () => {
    expect(manifest.id).toBeTruthy()
    expect(manifest.name).toBe('Nexis')
    expect(manifest.start_url).toBe('/dashboard')
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons)).toBe(true)
  })

  it('tem exatamente 1 ícone maskable e ao menos 1 "any"', () => {
    const purposes = manifest.icons.map((i) => i.purpose)
    expect(purposes.filter((p) => p === 'maskable')).toHaveLength(1)
    expect(purposes.filter((p) => p === 'any').length).toBeGreaterThanOrEqual(1)
  })

  it('todo icons[].src resolve para um arquivo em public/', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(path.join(pub, icon.src))).toBe(true)
    }
  })

  it('todo shortcut aponta para uma rota do app', () => {
    for (const s of manifest.shortcuts ?? []) {
      expect(s.url.startsWith('/')).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/test/manifest.test.ts`
Expected: FAIL — o manifest atual não tem `id`, usa `purpose: "any maskable"` num arquivo só, e `icons[].src` aponta para `logo-nexis-fundo.webp` (existe) mas não há entrada maskable separada.

- [ ] **Step 3: Reescrever `public/manifest.json`**

```json
{
  "id": "/",
  "scope": "/",
  "name": "Nexis",
  "short_name": "Nexis",
  "description": "Seu sistema operacional financeiro pessoal",
  "lang": "pt-BR",
  "dir": "ltr",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#09090b",
  "background_color": "#09090b",
  "categories": ["finance", "productivity"],
  "prefer_related_applications": false,
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Novo gasto",
      "short_name": "Novo gasto",
      "description": "Registrar uma nova transação",
      "url": "/transactions?action=new",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    }
  ]
}
```

Nota: só 1 shortcut. "Nova receita" fica de fora porque `/transactions` não tem param de tipo confirmado; adicionar depois se a rota passar a aceitar.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/test/manifest.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Rodar a suíte toda**

Run: `npm run test`
Expected: PASS — tudo verde.

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json src/test/manifest.test.ts
git commit -m "feat: manifest.json completo com id, icons por purpose e shortcut

Separa entradas any/maskable (antes era 'any maskable' num webp só),
adiciona id/scope/lang/dir/prefer_related_applications e um shortcut
'Novo gasto' -> /transactions?action=new.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 5: `<head>` iOS — módulo testável + `__root.tsx`

**Files:**
- Create: `src/lib/pwa-head.ts`
- Create: `src/lib/pwa-head.test.ts`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes: arquivos de `public/icons/` e `public/splash/` (Task 3) — só por referência de string, o teste não lê os arquivos.
- Produces: `pwaMeta: Array<Record<string,string>>`, `pwaLinks: Array<Record<string,string>>`.

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/lib/pwa-head.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pwaLinks, pwaMeta } from './pwa-head'

describe('pwaMeta', () => {
  it('define a status bar do iOS como black-translucent', () => {
    const bar = pwaMeta.find((m) => m.name === 'apple-mobile-web-app-status-bar-style')
    expect(bar?.content).toBe('black-translucent')
  })

  it('mantém as capabilities de web app', () => {
    expect(pwaMeta.find((m) => m.name === 'apple-mobile-web-app-capable')?.content).toBe('yes')
    expect(pwaMeta.find((m) => m.name === 'mobile-web-app-capable')?.content).toBe('yes')
  })
})

describe('pwaLinks', () => {
  it('apple-touch-icon é um png', () => {
    expect(pwaLinks.find((l) => l.rel === 'apple-touch-icon')?.href).toBe(
      '/icons/apple-touch-icon.png',
    )
  })

  it('tem 7 splash de iPhone, todas portrait e apontando para /splash/*.png', () => {
    const splash = pwaLinks.filter((l) => l.rel === 'apple-touch-startup-image')
    expect(splash).toHaveLength(7)
    for (const s of splash) {
      expect(s.media).toContain('orientation: portrait')
      expect(s.href).toMatch(/^\/splash\/apple-splash-\d+-\d+\.png$/)
    }
  })

  it('referencia o manifest', () => {
    expect(pwaLinks.some((l) => l.rel === 'manifest')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/pwa-head.test.ts`
Expected: FAIL — `./pwa-head` não existe.

- [ ] **Step 3: Criar `src/lib/pwa-head.ts`**

```ts
// Metadados PWA para o <head>. Extraídos de __root.tsx para permitir teste unitário.

type MetaTag = Record<string, string>
type LinkTag = Record<string, string>

// [largura px, altura px, device-pixel-ratio] — iPhones atuais, portrait.
const IPHONE_SPLASH: Array<[number, number, number]> = [
  [750, 1334, 2],
  [1080, 2340, 3],
  [1170, 2532, 3],
  [1284, 2778, 3],
  [1179, 2556, 3],
  [1290, 2796, 3],
  [1320, 2868, 3],
]

export const pwaMeta: MetaTag[] = [
  { name: 'theme-color', content: '#09090b' },
  { name: 'mobile-web-app-capable', content: 'yes' },
  { name: 'apple-mobile-web-app-capable', content: 'yes' },
  { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
  { name: 'apple-mobile-web-app-title', content: 'Nexis' },
  { name: 'application-name', content: 'Nexis' },
]

export const pwaLinks: LinkTag[] = [
  { rel: 'manifest', href: '/manifest.json' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/favicon-16.png' },
  { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  ...IPHONE_SPLASH.map(([w, h, ratio]) => ({
    rel: 'apple-touch-startup-image',
    media: `(device-width: ${w / ratio}px) and (device-height: ${h / ratio}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
    href: `/splash/apple-splash-${w}-${h}.png`,
  })),
]
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/pwa-head.test.ts`
Expected: PASS.

- [ ] **Step 5: Consumir em `src/routes/__root.tsx`**

Trocar o objeto retornado por `head()`. O `head()` atual tem `meta` com `charSet`/`viewport`/`theme-color`/apple-* e `links` com stylesheet/manifest/apple-touch-icon(webp). Substituir por:

```tsx
import { pwaLinks, pwaMeta } from '#/lib/pwa-head'
// ...
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      ...pwaMeta,
      { title: 'Nexis' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      ...pwaLinks,
    ],
  }),
```

Remover as linhas antigas de `theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-*`, `application-name` e o `apple-touch-icon` apontando para `/logo-nexis-fundo.webp` e o `manifest` duplicado (agora vêm de `pwaMeta`/`pwaLinks`).

- [ ] **Step 6: Typecheck + suíte**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros de tipo; todos os testes verdes.

- [ ] **Step 7: Smoke visual no dev**

Run: `npm run dev`, abrir `http://localhost:3000`, ver o `<head>` no DevTools. Confirmar: 1 `apple-touch-icon` png, 7 `apple-touch-startup-image`, `apple-mobile-web-app-status-bar-style` = `black-translucent`, sem duplicatas de `manifest`/`theme-color`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/pwa-head.ts src/lib/pwa-head.test.ts src/routes/__root.tsx
git commit -m "feat: meta tags iOS — apple-touch-icon png, 7 splash, status bar translucent

Extrai pwaMeta/pwaLinks para src/lib/pwa-head.ts (testável). apple-touch-icon
passa de .webp (iOS ignora) para /icons/apple-touch-icon.png; adiciona 7
apple-touch-startup-image para iPhones atuais; status bar black -> black-translucent
para casar com viewport-fit=cover + safe-area já usados no layout.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 6: Install prompt — gate de sessão + remover duplicata

**Files:**
- Modify: `src/hooks/use-install-prompt.ts`
- Modify: `src/components/ui/app-toasts.tsx`
- Delete: `src/components/ui/install-prompt.tsx`
- Create: `src/hooks/use-install-prompt.test.ts`
- Modify: `src/test/structure.test.ts` (adiciona 1 asserção)

**Interfaces:**
- Consumes: infra de teste (Task 1).
- Produces: `useInstallPrompt()` → `{ showPrompt: boolean, showAutoPrompt: boolean, isIOS: boolean, install: () => Promise<void>, dismiss: () => void }`. `showPrompt` inalterado (linha de Perfil). `showAutoPrompt = showPrompt && sessionCount >= 3` (convite automático em `app-toasts.tsx`).

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/hooks/use-install-prompt.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useInstallPrompt } from './use-install-prompt'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('useInstallPrompt — contagem de sessão', () => {
  it('conta 1 por carga de app e não recolta na mesma sessão', () => {
    renderHook(() => useInstallPrompt())
    expect(localStorage.getItem('pwa-session-count')).toBe('1')
    renderHook(() => useInstallPrompt())
    expect(localStorage.getItem('pwa-session-count')).toBe('1')
  })

  it('incrementa a cada nova sessão', () => {
    renderHook(() => useInstallPrompt())
    sessionStorage.clear()
    renderHook(() => useInstallPrompt())
    sessionStorage.clear()
    renderHook(() => useInstallPrompt())
    expect(localStorage.getItem('pwa-session-count')).toBe('3')
  })
})

describe('useInstallPrompt — showAutoPrompt', () => {
  it('é false antes da 3ª sessão mesmo instalável', () => {
    localStorage.setItem('pwa-session-count', '1') // esta carga vira 2
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(result.current.showPrompt).toBe(true)
    expect(result.current.showAutoPrompt).toBe(false)
  })

  it('vira true na 3ª sessão quando instalável', () => {
    localStorage.setItem('pwa-session-count', '2') // esta carga vira 3
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(result.current.showAutoPrompt).toBe(true)
  })

  it('dismiss zera os dois e grava a flag permanente', () => {
    localStorage.setItem('pwa-session-count', '5')
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    act(() => result.current.dismiss())
    expect(localStorage.getItem('pwa-install-dismissed')).toBe('1')
    expect(result.current.showPrompt).toBe(false)
    expect(result.current.showAutoPrompt).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/use-install-prompt.test.ts`
Expected: FAIL — `showAutoPrompt` é `undefined`; `pwa-session-count` nunca é gravado.

- [ ] **Step 3: Editar `src/hooks/use-install-prompt.ts`**

Adicionar, no topo do arquivo (após os imports), a função de contagem:

```ts
function bumpSessionCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const current = Number(localStorage.getItem('pwa-session-count') ?? '0')
    if (sessionStorage.getItem('pwa-session-counted') === '1') return current
    const next = current + 1
    localStorage.setItem('pwa-session-count', String(next))
    sessionStorage.setItem('pwa-session-counted', '1')
    return next
  } catch {
    return 0
  }
}
```

Dentro de `useInstallPrompt()`, adicionar (junto dos outros `useState`):

```ts
const [sessionCount] = useState(bumpSessionCount)
```

Trocar o `return` final. Hoje é:

```ts
const showPrompt = !installed && !dismissed && (!!promptEvent || isIOS)

return { showPrompt, isIOS, install, dismiss }
```

Passa a ser:

```ts
const showPrompt = !installed && !dismissed && (!!promptEvent || isIOS)
const showAutoPrompt = showPrompt && sessionCount >= 3

return { showPrompt, showAutoPrompt, isIOS, install, dismiss }
```

`useState` já é importado no arquivo (linha 1). Sem outras mudanças.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/hooks/use-install-prompt.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Atualizar `src/components/ui/app-toasts.tsx`**

Linha ~16, trocar o campo desestruturado:

```ts
// antes
const { showPrompt: showInstall, isIOS, install, dismiss: dismissInstall } = useInstallPrompt()
// depois
const { showAutoPrompt: showInstall, isIOS, install, dismiss: dismissInstall } = useInstallPrompt()
```

Nenhuma outra linha muda — o resto do arquivo já usa a variável local `showInstall`.

- [ ] **Step 6: Deletar o componente morto**

Confirmar que nada importa o componente (só o hook é importado em outros lugares):

Run: `grep -rn "components/ui/install-prompt'" src/`
Expected: nenhum resultado (só `use-install-prompt` aparece em outros arquivos, que é o hook).

Run: `git rm src/components/ui/install-prompt.tsx`

- [ ] **Step 7: Adicionar asserção estrutural**

Em `src/test/structure.test.ts`, dentro de um novo `describe`:

```ts
describe('componentes mortos', () => {
  it('install-prompt.tsx (duplicata) foi removido', () => {
    expect(existsSync(path.join(repoRoot, 'src/components/ui/install-prompt.tsx'))).toBe(false)
  })
})
```

- [ ] **Step 8: Typecheck + suíte**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros; tudo verde. (Se `tsc` reclamar de `install` não usado em algum lugar, revisar — não deve, `app-toasts` usa.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: convite de instalação só a partir da 3ª sessão

use-install-prompt passa a contar sessões (localStorage pwa-session-count,
guarda de sessionStorage) e expõe showAutoPrompt = showPrompt && count>=3.
app-toasts usa showAutoPrompt; a linha em Perfil segue com showPrompt.
Remove src/components/ui/install-prompt.tsx (código morto, não montado,
duplicava o branch de install do app-toasts).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 7: Haptics — fiar os pontos que faltam

**Files:**
- Modify: `src/hooks/use-haptic.ts` (refactor mínimo p/ testabilidade)
- Create: `src/hooks/use-haptic.test.ts`
- Modify: `src/components/transactions/transaction-sheet.tsx`
- Modify: `src/routes/_authenticated/transactions.tsx`

**Interfaces:**
- Consumes: infra de teste (Task 1).
- Produces: `useHaptic()` → `{ tap, success, error, heavy }` (assinatura inalterada; só a checagem de suporte passa para call-time).

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/hooks/use-haptic.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHaptic } from './use-haptic'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useHaptic', () => {
  it('chama navigator.vibrate com o padrão certo por método', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })

    const { result } = renderHook(() => useHaptic())
    result.current.tap()
    result.current.success()
    result.current.error()
    result.current.heavy()

    expect(vibrate.mock.calls).toEqual([[8], [[10, 40, 10]], [[30, 20, 30]], [25]])
  })

  it('não lança quando a Vibration API não existe', () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => useHaptic())
    expect(() => result.current.tap()).not.toThrow()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/use-haptic.test.ts`
Expected: FAIL — o `canVibrate` é calculado no load do módulo; com `navigator` real do jsdom (sem `vibrate`) as chamadas viram no-op e `vibrate.mock.calls` fica `[]`.

- [ ] **Step 3: Refatorar `src/hooks/use-haptic.ts`**

Conteúdo completo novo:

```ts
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

export function useHaptic() {
  return {
    tap: () => vibrate(8),
    success: () => vibrate([10, 40, 10]),
    error: () => vibrate([30, 20, 30]),
    heavy: () => vibrate(25),
  }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/hooks/use-haptic.test.ts`
Expected: PASS — 2 testes. Rodar a suíte toda (`npm run test`) para garantir que `bottom-nav` etc. não quebraram (não há teste deles, mas o build/typecheck cobre).

- [ ] **Step 5: `haptic.success()` ao salvar/excluir transação**

Em `src/components/transactions/transaction-sheet.tsx`:

1. Adicionar aos imports:

```ts
import { useHaptic } from '#/hooks/use-haptic'
```

2. Dentro do componente, junto dos outros hooks:

```ts
const haptic = useHaptic()
```

3. Em `saveMutation`, no `onSuccess` (linha ~199), primeira instrução:

```ts
onSuccess: () => {
  haptic.success()
  invalidateAll()
  setSaved(true)
  // ...resto inalterado
},
```

4. Em `deleteMutation`, no `onSuccess` (linha ~211):

```ts
onSuccess: () => {
  haptic.success()
  invalidateAll()
  handleClose()
},
```

- [ ] **Step 6: `haptic.error()` ao confirmar exclusão na lista**

Em `src/routes/_authenticated/transactions.tsx`:

1. Adicionar aos imports:

```ts
import { useHaptic } from '#/hooks/use-haptic'
```

2. Dentro do componente, junto dos outros hooks:

```ts
const haptic = useHaptic()
```

3. Em `handleConfirmDelete` (linha ~109), logo após a guarda:

```ts
function handleConfirmDelete(mode?: InstallmentMode) {
  if (!confirmingTx) return
  haptic.error()
  const tx = confirmingTx
  // ...resto inalterado
}
```

- [ ] **Step 7: Auditar outros confirmes destrutivos**

Run: `grep -rn "removeWallet\|removeGoal\|deleteMutation\|confirmDelete\|ConfirmDelete" src/components/wallets src/components/goals`

Para cada handler de confirmação de exclusão encontrado que ainda **não** chame `haptic.*`: importar `useHaptic`, e aplicar o mesmo par — `haptic.error()` no momento do confirm, `haptic.success()` no `onSuccess` da mutation. Se nada for encontrado, seguir (a auditoria fica registrada aqui).

- [ ] **Step 8: Typecheck + suíte + smoke**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros; verde.

Run: `npm run dev`, criar uma transação num device/emulador Android (ou Chrome com `navigator.vibrate` — desktop não vibra mas não deve dar erro no console). Confirmar ausência de exceção.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/use-haptic.ts src/hooks/use-haptic.test.ts src/components/transactions/transaction-sheet.tsx src/routes/_authenticated/transactions.tsx
git commit -m "feat: haptics ao salvar e ao excluir transação

use-haptic passa a checar a Vibration API em call-time (antes era no load
do módulo — não testável e falho em SSR). Fia haptic.success() no sucesso
de salvar/excluir no transaction-sheet e haptic.error() ao confirmar a
exclusão na lista.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 8a: Primitivo `<Skeleton>`

**Files:**
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/skeleton.test.tsx`

**Interfaces:**
- Consumes: `cn` de `#/lib/utils`; `@utility shimmer` de `src/styles.css`.
- Produces: `Skeleton` — `(props: ComponentProps<'div'>) => JSX.Element`, aplica `shimmer rounded-md` + `className` do consumidor.

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/components/ui/skeleton.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('renderiza um div com a utility shimmer', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.className).toContain('shimmer')
  })

  it('faz merge da className do consumidor', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    const cls = (container.firstElementChild as HTMLElement).className
    expect(cls).toContain('h-4')
    expect(cls).toContain('w-20')
  })

  it('repassa outros props (ex: data-testid)', () => {
    const { getByTestId } = render(<Skeleton data-testid="sk" />)
    expect(getByTestId('sk')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/ui/skeleton.test.tsx`
Expected: FAIL — `./skeleton` não existe.

- [ ] **Step 3: Criar `src/components/ui/skeleton.tsx`**

```tsx
import type { ComponentProps } from 'react'
import { cn } from '#/lib/utils'

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('shimmer rounded-md', className)} {...props} />
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/components/ui/skeleton.test.tsx`
Expected: PASS — 3 testes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/skeleton.tsx src/components/ui/skeleton.test.tsx
git commit -m "feat: primitivo <Skeleton> sobre a utility shimmer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 8b: Migrar as 5 telas para `<Skeleton>` + `keepPreviousData`

**Files:**
- Modify: `src/routes/_authenticated/dashboard.tsx`
- Modify: `src/routes/_authenticated/transactions.tsx`
- Modify: `src/routes/_authenticated/wallets.tsx`
- Modify: `src/routes/_authenticated/analytics.tsx`
- Modify: `src/routes/_authenticated/goals.tsx`

**Interfaces:**
- Consumes: `Skeleton` de `#/components/ui/skeleton` (Task 8a); `keepPreviousData` de `@tanstack/react-query`.
- Produces: nenhum símbolo novo. Comportamento: trocar filtro/mês em Transações e Análise não pisca para branco.

Sem teste automatizado novo (comportamento visual; coberto por typecheck + build + QA manual da Task 10). Cada arquivo é um passo isolado com commit no fim.

- [ ] **Step 1: `transactions.tsx` — `keepPreviousData` na query de lista**

1. Import:

```ts
import { useQuery, useQueryClient, useMutation, keepPreviousData } from '@tanstack/react-query'
```

2. Na query `['transactions', year, month, filter, walletFilter]` (linha ~141), adicionar a opção:

```ts
const { data: transactions = [], isLoading } = useQuery({
  queryKey: ['transactions', year, month, filter, walletFilter],
  queryFn: () =>
    listTransactions({
      data: {
        year,
        month,
        type: filter === 'ALL' ? undefined : filter,
        walletId: walletFilter ?? undefined,
      },
    }),
  placeholderData: keepPreviousData,
})
```

- [ ] **Step 2: `transactions.tsx` — trocar `ListSkeleton` por `<Skeleton>`**

Import: `import { Skeleton } from '#/components/ui/skeleton'`

Substituir o corpo de `function ListSkeleton()` (linha ~792). Antes:

```tsx
function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-1">
          <div className="h-2 w-2 rounded-full shimmer" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 shimmer rounded" />
            <div className="h-3 w-20 shimmer rounded opacity-60" />
          </div>
          <div className="h-3.5 w-16 shimmer rounded" />
        </div>
      ))}
    </div>
  )
}
```

Depois:

```tsx
function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-1">
          <Skeleton className="h-2 w-2 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20 opacity-60" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: `analytics.tsx` — `keepPreviousData` na query de budgets + Skeleton**

1. Import: `import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'` e `import { Skeleton } from '#/components/ui/skeleton'`.

2. Na query `['budgets', budgetMonth, budgetYear]` (linha ~48):

```ts
const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
  queryKey: ['budgets', budgetMonth, budgetYear],
  queryFn: () => getBudgets({ data: { month: budgetMonth, year: budgetYear } }),
  placeholderData: keepPreviousData,
})
```

3. `function AnalyticsSkeleton()` (linha ~451). Antes:

```tsx
function AnalyticsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-40 shimmer rounded-2xl" />
      ))}
    </div>
  )
}
```

Depois:

```tsx
function AnalyticsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  )
}
```

4. Linha ~190 (fora do `AnalyticsSkeleton`): trocar `<div className="h-5 w-16 shimmer rounded" />` por `<Skeleton className="h-5 w-16" />`.

- [ ] **Step 4: `dashboard.tsx` — Skeleton**

Import: `import { Skeleton } from '#/components/ui/skeleton'`.

`grep -n "shimmer" src/routes/_authenticated/dashboard.tsx` deve listar as linhas ~51, ~150, ~251, ~253, ~254, ~256. Trocas:

- Linha ~51: `<div className="h-10 w-40 shimmer rounded-lg" />` → `<Skeleton className="h-10 w-40 rounded-lg" />`
- Linha ~150: `<div className="h-6 w-24 shimmer rounded" />` → `<Skeleton className="h-6 w-24" />`
- `function TransactionsSkeleton()` (linha ~246). Antes:

```tsx
function TransactionsSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-1 py-2.5">
          <div className="h-8 w-8 shrink-0 shimmer rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-28 shimmer rounded" />
            <div className="h-3 w-20 shimmer rounded opacity-60" />
          </div>
          <div className="h-3.5 w-14 shimmer rounded" />
        </div>
      ))}
    </div>
  )
}
```

Depois:

```tsx
function TransactionsSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-1 py-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20 opacity-60" />
          </div>
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: `wallets.tsx` — Skeleton**

Import `Skeleton`. `function WalletsSkeleton()` (linha ~185). Antes:

```tsx
function WalletsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-[72px] shimmer rounded-2xl" />
      ))}
    </div>
  )
}
```

Depois:

```tsx
function WalletsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-[72px] rounded-2xl" />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: `goals.tsx` — Skeleton**

Import `Skeleton`. `function GoalsSkeleton()` (linha ~424). Antes:

```tsx
function GoalsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-[104px] shimmer rounded-2xl" />
      ))}
    </div>
  )
}
```

Depois:

```tsx
function GoalsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-[104px] rounded-2xl" />
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Conferir que não sobrou `shimmer` solto nas rotas**

Run: `grep -rn "shimmer" src/routes/`
Expected: nenhum resultado (todos migraram para `<Skeleton>`). A `@utility shimmer` continua em `src/styles.css` — usada pelo primitivo.

- [ ] **Step 8: Typecheck + suíte + smoke**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros; verde.

Run: `npm run dev`. Em Transações, com throttling "Slow 4G" no DevTools, trocar o filtro de tipo várias vezes: a lista anterior permanece visível (sem flash de `ListSkeleton`) e atualiza quando a nova chega. Idem trocando o mês em Análise.

- [ ] **Step 9: Commit**

```bash
git add src/routes/_authenticated/dashboard.tsx src/routes/_authenticated/transactions.tsx src/routes/_authenticated/wallets.tsx src/routes/_authenticated/analytics.tsx src/routes/_authenticated/goals.tsx
git commit -m "refactor: skeletons via primitivo <Skeleton> + keepPreviousData

Troca os <div className='shimmer'> ad-hoc e as funções *Skeleton locais
das 5 telas por <Skeleton>. Adiciona placeholderData: keepPreviousData
nas queries de lista de Transações e de budgets em Análise para trocar
filtro/mês não piscar em branco.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 9: View Transitions nas rotas

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/styles.css`
- Create: `src/test/view-transitions.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: router com `defaultViewTransition: true`; CSS `@view-transition` + guarda `prefers-reduced-motion`.

- [ ] **Step 1: Escrever o teste que deve falhar**

Create `src/test/view-transitions.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const srcDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (rel: string) => readFileSync(path.join(srcDir, rel), 'utf8')

describe('view transitions', () => {
  it('o router opta por defaultViewTransition', () => {
    expect(read('router.tsx')).toMatch(/defaultViewTransition:\s*true/)
  })

  it('o CSS define @view-transition e respeita reduced motion', () => {
    const css = read('styles.css')
    expect(css).toContain('@view-transition')
    expect(css).toContain('::view-transition-old(root)')
    expect(css).toContain('prefers-reduced-motion')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/test/view-transitions.test.ts`
Expected: FAIL — nenhum dos dois arquivos contém os trechos.

- [ ] **Step 3: Editar `src/router.tsx`**

No `createTanStackRouter({...})`, adicionar a opção (após `defaultPreloadStaleTime: 30_000,`):

```ts
  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000,
    defaultViewTransition: true,
  })
```

- [ ] **Step 4: Editar `src/styles.css`**

Adicionar ao final do arquivo:

```css
/* Transição entre rotas (View Transitions API). Degrada sozinho onde não há suporte. */
@view-transition {
  navigation: auto;
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 180ms;
  animation-timing-function: ease;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/test/view-transitions.test.ts`
Expected: PASS — 2 testes.

- [ ] **Step 6: Typecheck + suíte + smoke**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros; verde. (Se `tsc` acusar `defaultViewTransition` como propriedade inválida, checar a versão do `@tanstack/react-router` — a opção existe desde 1.x recente; se não existir, usar `viewTransition: true` por navegação nos `<Link>` não é escopo aqui: registrar como bloqueio.)

Run: `npm run dev` no Chrome. Navegar entre abas pelo BottomNav: um cross-fade curto aparece. Ativar "Emulate CSS prefers-reduced-motion: reduce" no DevTools → a navegação fica instantânea, sem fade.

- [ ] **Step 7: Commit**

```bash
git add src/router.tsx src/styles.css src/test/view-transitions.test.ts
git commit -m "feat: View Transitions nas trocas de rota

defaultViewTransition: true no router + @view-transition no CSS com
cross-fade de 180ms; guarda prefers-reduced-motion desliga a animação.
Degrada sozinho em browsers sem a API.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01H7AdEtpmmrB2mzwpjuCSCd"
```

---

## Task 10: Integração e verificação final

**Files:** nenhum (verificação). Sem commit, a menos que um ajuste seja necessário — nesse caso, commit próprio.

- [ ] **Step 1: Suíte completa**

Run: `npm run test`
Expected: PASS — todos os arquivos (`smoke`, `structure`, `generate-pwa-assets`, `manifest`, `pwa-head`, `use-install-prompt`, `use-haptic`, `skeleton`, `view-transitions`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 4: Deploy de preview**

Push do branch e abrir o preview da Vercel. Confirmar que o build remoto passa.

- [ ] **Step 5: Lighthouse**

No preview, DevTools → Lighthouse → categoria "PWA" (ou "Installable"). Sem erro de instalabilidade nem de ícone maskable.

- [ ] **Step 6: QA manual — Android (Chrome)**

- [ ] Após 3 aberturas do app, o card "Instalar Nexis" aparece via `AppToasts`.
- [ ] "Instalar" instala; ícone na home nítido, sem corte no mask.
- [ ] Long-press no ícone mostra o shortcut "Novo gasto"; tocar abre `/transactions` com o sheet de criação.
- [ ] Vibração ao tocar no FAB, ao salvar transação (`success`) e ao confirmar exclusão (`error`).
- [ ] Perfil mostra a linha "Instalar o app" enquanto não instalado.

- [ ] **Step 7: QA manual — iOS (Safari)**

- [ ] Compartilhar → "Adicionar à Tela de Início" usa `apple-touch-icon.png` (não o webp).
- [ ] Abrir da home mostra a splash correta do device (não o flash preto puro).
- [ ] Status bar `black-translucent` coerente com o safe-area (sem faixa preta sólida, sem conteúdo cortado no topo).
- [ ] O card de instalação iOS mostra o passo a passo "Compartilhar → Adicionar à Tela de Início".

- [ ] **Step 8: QA manual — transições e reduced motion**

- [ ] Navegar pelo BottomNav no Chrome: cross-fade curto entre rotas.
- [ ] `prefers-reduced-motion: reduce` desliga o fade.
- [ ] Trocar filtro em Transações / mês em Análise sob rede lenta: a lista anterior não some para branco.

- [ ] **Step 9: Finalizar**

Se tudo verde, invocar `superpowers:finishing-a-development-branch` para decidir merge/PR de `feat/pwa-native-feel`.

---

## Self-Review (feito pelo autor do plano)

**Cobertura do spec:**
- Frente 1 (limpeza SW) → Task 2. ✔
- Frente 2 (geração de assets) → Task 3. ✔
- Frente 3 (manifest) → Task 4. ✔
- Frente 4 (`<head>` iOS + splash + `black-translucent`) → Task 5. ✔
- Frente 5 (install prompt: gate de sessão + deletar duplicata) → Task 6. ✔
- Frente 6 (haptics nos 2 pontos) → Task 7. ✔
- Frente 7 (skeleton primitivo + consolidação + `keepPreviousData`) → Tasks 8a/8b. ✔
- Frente 8 (View Transitions) → Task 9. ✔
- Infra de teste (pré-requisito) → Task 1. ✔
- QA manual + Lighthouse do spec → Task 10. ✔

**Placeholders:** nenhum "TBD/TODO/depois". A auditoria de haptics na Task 7 Step 7 e a de `shimmer` residual na Task 8b Step 7 são passos de `grep` com o padrão exato a aplicar mostrado — não são vagos.

**Consistência de tipos/nomes:** `showAutoPrompt` (Task 6) é consumido em `app-toasts.tsx` no mesmo Task. `Skeleton` (Task 8a) → consumido em 8b. `pwaMeta`/`pwaLinks` (Task 5) → consumidos no mesmo Task. `PWA_ASSETS_OUT` (Task 3 script) → usado no teste do mesmo Task. `use-haptic` mantém `{ tap, success, error, heavy }` em toda parte.

**Risco aberto registrado no plano:** `defaultViewTransition` depende da versão do `@tanstack/react-router` (Task 9 Step 6 diz o que fazer se não existir).
