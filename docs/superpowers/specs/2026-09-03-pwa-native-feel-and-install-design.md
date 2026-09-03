# PWA: sensação nativa + instalação — Design

**Data:** 2026-09-03
**Status:** aprovado, pronto para planejamento
**Escopo:** melhorias de experiência do PWA Nexis focadas em "parecer um app nativo" e em instalabilidade. **Sem offline, sem envio de push server-side.** Offline fica para a futura versão React Native.

---

## Contexto

Estado atual relevante no repo:

- **Service worker quebrado para offline.** `public/sw.js` é hand-rolled e só trata `push` + `notificationclick`; define `CACHE_NAME` mas nunca grava nada em cache. `src/sw.ts` é um SW baseado em Workbox escrito para ser compilado pelo `vite-plugin-pwa`, que foi removido do `vite.config.ts` no commit `d42aa92` ("fix: remove VitePWA plugin to fix Vercel build"). Resultado: `src/sw.ts` é código morto e os pacotes `workbox-*` nem estão instalados. `vite-plugin-pwa` continua no `package.json` sem uso.
- **Registro do SW:** `src/routes/_authenticated.tsx` registra `/sw.js` no `window load`.
- **Push:** infra de subscription completa — `src/hooks/use-push-notifications.ts`, `src/server/services/push.service.ts` (VAPID, subscribe/unsubscribe), componente `NotificationPermission`. Falta só o disparo server-side. **Fora do escopo deste design.**
- **Manifest:** `public/manifest.json` mínimo — reaproveita um único `logo-nexis-fundo.webp` em dois `sizes` com `purpose: "any maskable"` (anti-pattern).
- **`<head>`:** `src/routes/__root.tsx` já tem `theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black`, `apple-mobile-web-app-title`, `viewport-fit=cover`. `apple-touch-icon` aponta para `/logo-nexis-fundo.webp` (iOS ignora WebP em touch icon).
- **Skeletons:** já existem nas 5 telas (`TransactionsSkeleton`, `AnalyticsSkeleton`, `WalletsSkeleton`, `GoalsSkeleton`, `ListSkeleton` + `@utility shimmer` em `src/styles.css`), implementados ad-hoc como funções locais e `<div className="shimmer">` duplicados. Todas as telas usam `useQuery` + `isLoading` (não `useSuspenseQuery`).
- **Install prompt:** `src/hooks/use-install-prompt.ts` já existe e cobre `beforeinstallprompt`, `appinstalled`, `isStandalone`, `isIOS`, `dismiss` (chave `localStorage` `pwa-install-dismissed`). O convite é renderizado por `src/components/ui/app-toasts.tsx` (montado em `_authenticated.tsx`, fila com `INITIAL_DELAY` de 2.5s). `src/components/ui/install-prompt.tsx` é uma quase-duplicata **não montada em lugar nenhum** (código morto). `src/components/profile/profile-sheet.tsx:121` já tem a linha "Instalar". **Falta:** um gate de "só a partir da 3ª sessão" para o convite automático.
- **Haptics:** `src/hooks/use-haptic.ts` já existe (`tap`=8ms, `success`=[10,40,10], `error`=[30,20,30], `heavy`=25ms; usa `navigator.vibrate` direto, já é Android-only). Fiado em `bottom-nav.tsx` (FAB), `install-prompt.tsx`, `app-toasts.tsx`. **Falta:** `success` no sucesso de salvar transação e `error` na confirmação de excluir.
- **Infra de teste:** **não configurada.** Não há `vitest.config.ts`, arquivo de setup, nem nenhum `*.test.*`. `jsdom`, `@testing-library/react`, `@testing-library/dom` e `@vitejs/plugin-react` estão em `devDependencies`. `npm run test` = `vitest run`.
- **Shortcut do FAB:** `bottom-nav.tsx` abre criação via `<Link to="/transactions" search={{ action: 'new' }}>` → a URL de shortcut do manifest é `/transactions?action=new`.
- **Router:** `src/router.tsx` — `createTanStackRouter` com `scrollRestoration`, `defaultPreload: 'intent'`. Sem `defaultViewTransition`.
- **Layout:** `src/routes/_authenticated.tsx` é `fixed inset-0 flex flex-col`, com overlays montados (`OfflineBanner`, `BudgetAlertsBanner`, `NotificationPermission`, `NavigationOverlay`, `AppToasts`).

Assets de marca disponíveis (só estes):

| Arquivo | Dimensões | Notas |
|---|---|---|
| `public/logo-nexis-fundo.webp` | 1185×1185 | Quadrado, fundo sólido, **sem** alpha. Desenho encosta nas bordas. Fonte dos ícones. |
| `public/logo-nexis.webp` | 685×592 | Marca com alpha, não-quadrada. Não usar para ícone. |
| `public/nexis-logo-texto.webp` | 1426×661 | Wordmark com texto. Não usar para ícone. |
| `public/favicon.ico` | multi-size | Manter. |

Não há fonte vetorial (SVG).

---

## Objetivo

Ao instalar o Nexis na home (iOS e Android), o app deve ter ícone nítido e correto, splash screen própria no iOS, status bar coerente, atalhos no long-press, um convite de instalação bem-feito, feedback tátil no Android e transições/estados de carregamento sem "piscar". Nenhuma mudança em dados, sincronização ou autenticação.

---

## Frentes de trabalho

As oito frentes são independentes entre si e podem ser implementadas/testadas em qualquer ordem, **depois** da infra de teste (ver "Testes"). Frentes 5 e 6 já estão ~80% prontas no repo — o trabalho é fechar lacunas, não construir do zero.

### 1. Limpeza do service worker

- **Deletar** `src/sw.ts`.
- **Remover** `vite-plugin-pwa` de `devDependencies` no `package.json` (e do lockfile).
- **`public/sw.js`:** reduzir para apenas os handlers `push` e `notificationclick` (comportamento atual). Remover a constante `CACHE_NAME` e o handler `activate` de limpeza de cache — não cacheiam nada.
- **Não** mexer no registro em `src/routes/_authenticated.tsx`.
- Racional: sem offline no escopo, o SW serve só como transporte de push. Documentar isso num comentário no topo de `sw.js`.

### 2. Geração de assets

- Adicionar `sharp` como **devDependency**.
- Criar `scripts/generate-pwa-assets.mjs` + script npm `"gen:pwa-assets": "node scripts/generate-pwa-assets.mjs"`.
- **Não** acoplar ao `build`. Roda manual; as saídas são commitadas. Racional: o build da Vercel já quebrou uma vez por causa de tooling de PWA no pipeline.
- Fonte: `public/logo-nexis-fundo.webp`.
- Saídas em `public/icons/`:
  - `icon-192.png` — 192×192, resize direto (contain), fundo `#09090b`.
  - `icon-512.png` — 512×512, idem.
  - `icon-maskable-512.png` — 512×512; a marca ocupa ~72% (≈368px), centralizada, resto preenchido com `#09090b`. Garante safe zone do mask circular/squircle do Android.
  - `apple-touch-icon.png` — 180×180, resize direto, **sem** canal alpha (achatado sobre `#09090b`).
  - `favicon-16.png`, `favicon-32.png`.
- Saídas em `public/splash/` — 7 PNGs portrait, marca centralizada (~40% da largura) sobre `#09090b`, nas resoluções em pixels:
  | Device | px (W×H) |
  |---|---|
  | iPhone SE 2/3, 8 | 750×1334 |
  | iPhone 13 mini / 12 mini | 1080×2340 |
  | iPhone 13/14, 12 | 1170×2532 |
  | iPhone 14 Plus / 13 Pro Max | 1284×2778 |
  | iPhone 14 Pro / 15 / 16 | 1179×2556 |
  | iPhone 14 Pro Max / 15 Pro Max / 15 Plus | 1290×2796 |
  | iPhone 16 Pro Max | 1320×2868 |
- O script é idempotente: sobrescreve as saídas a cada run.

### 3. `public/manifest.json`

Reescrever completo:

- `id: "/"`, `scope: "/"`, `start_url: "/dashboard"` (mantém), `lang: "pt-BR"`, `dir: "ltr"`.
- `name: "Nexis"`, `short_name: "Nexis"`, `description` (mantém), `categories: ["finance", "productivity"]` (mantém).
- `display: "standalone"`, `orientation: "portrait"`, `theme_color: "#09090b"`, `background_color: "#09090b"` (mantém).
- `prefer_related_applications: false`.
- `icons` — **entradas separadas** por purpose:
  ```json
  [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
  ```
- `shortcuts` — validar contra o que `/transactions` aceita como search param na implementação; alvo:
  - "Novo gasto" → `/transactions?new=1` (ou o param real de abertura do sheet)
  - "Nova receita" → `/transactions?new=1&type=income`
  - cada um com `icons` apontando para `icon-192.png` (aceitável) ou um ícone próprio se trivial.
- `screenshots` — 2 entradas, `form_factor: "narrow"`, capturadas do dev server em viewport 390×844 (`/dashboard` e `/analytics`). Se a captura não for viável no momento da implementação, **omitir `screenshots`** e seguir (não bloqueia instalação).

### 4. `<head>` iOS — `src/routes/__root.tsx`

No objeto retornado por `head()`:

- **`links`:**
  - `apple-touch-icon` → `/icons/apple-touch-icon.png` (substitui o `.webp`).
  - `icon` 16/32 → `/icons/favicon-16.png`, `/icons/favicon-32.png` (mantém `favicon.ico` como fallback via `links` ou o default).
  - 7× `{ rel: 'apple-touch-startup-image', media: '<media query por device>', href: '/splash/<arquivo>.png' }`. As media queries seguem o padrão `(device-width: Xpx) and (device-height: Ypx) and (-webkit-device-pixel-ratio: Z) and (orientation: portrait)`.
  - `manifest` (mantém).
- **`meta`:**
  - `apple-mobile-web-app-status-bar-style`: **`black` → `black-translucent`**. Mudança visível: a status bar passa a sobrepor o conteúdo. O layout já usa `viewport-fit=cover` e `env(safe-area-inset-top)` no `fixed inset-0`, então o efeito é o esperado (sem faixa preta sólida). Se em teste real ficar ruim, reverter para `black` é 1 linha.
  - Demais metas mantidas.

### 5. Prompt de instalação — gate de sessão + limpar duplicata

O grosso já existe (`use-install-prompt.ts` + `app-toasts.tsx` + linha em Perfil). Duas mudanças pontuais:

- **`src/hooks/use-install-prompt.ts`** — adicionar contagem de sessões:
  - Incrementar `localStorage` `pwa-session-count` **uma vez por carga de app**; guardar em `sessionStorage` `pwa-session-counted` que esta sessão já contou (evita recontagem a cada re-render / re-mount do hook). Todo acesso em `try/catch`, guardado por `typeof window`.
  - Expor dois booleanos:
    - `showPrompt` (atual, inalterado) = `!installed && !dismissed && (!!promptEvent || isIOS)` — usado pela **linha em Perfil** (aparece assim que instalável).
    - **`showAutoPrompt`** (novo) = `showPrompt && sessionCount >= 3` — usado pelo **convite automático** em `app-toasts.tsx`.
  - `dismiss` continua permanente (chave `pwa-install-dismissed`).
- **`src/components/ui/app-toasts.tsx`** — trocar `showInstall` (hoje `showPrompt`) por `showAutoPrompt` na montagem da fila (`if (showAutoPrompt) queue.push('install')` e nas duas guardas de render `current === 'install' && showAutoPrompt`). Nada mais muda no arquivo.
- **`src/components/ui/install-prompt.tsx`** — **deletar** (código morto, não montado, duplica o branch de install do `app-toasts.tsx`).
- **`src/components/profile/profile-sheet.tsx`** — sem mudança (já usa `showPrompt`/`install`).

### 6. Haptics — fiar os 2 pontos que faltam

`src/hooks/use-haptic.ts` já existe e já está no FAB (`bottom-nav.tsx`). Só faltam:

- **`src/components/transactions/transaction-sheet.tsx`** — importar `useHaptic`, chamar `haptic.success()` no início do `onSuccess` de `saveMutation` (linha ~199).
- **`src/routes/_authenticated/transactions.tsx`** — chamar `haptic.error()` no handler que confirma a exclusão (o efeito disparado quando `confirmingTx` é confirmado, ~linha 109) e no `deleteMutation.onSuccess` de `transaction-sheet.tsx` (linha ~211) usar `haptic.success()`. Importar `useHaptic` onde faltar.
- Auditar rapidamente outros gestos destrutivos/confirmatórios (excluir carteira, excluir meta) e aplicar o mesmo padrão se o toque estiver faltando — sem inventar novos padrões além dos 4 que o hook já expõe.

### 7. Skeletons — consolidar

- **`src/components/ui/skeleton.tsx`** (novo, padrão shadcn): componente `Skeleton` que aplica a classe `shimmer` existente (definida em `src/styles.css`) + `rounded-*` via props/className.
- Substituir os `<div className="shimmer ...">` inline e as funções locais `*Skeleton()` das 5 telas por composições do `<Skeleton>`, **preservando o layout visual de cada tela** (mesmas dimensões e posições).
- Adicionar `placeholderData: keepPreviousData` (import de `@tanstack/react-query`) nas queries de **lista que respondem a filtro/período**: `transactions` (filtro de wallet/categoria/busca) e `analytics` (troca de mês). Evita a lista sumir para skeleton a cada mudança de filtro.
- Auditar cada uma das 5 telas por sub-seções que hoje aparecem/somem sem estado de carregamento (ex.: blocos condicionais `!isLoading && data?.x.length`). Onde houver "pop-in" perceptível, adicionar skeleton da seção.

### 8. View Transitions — `src/router.tsx` + `src/styles.css`

- `src/router.tsx`: passar `defaultViewTransition: true` para `createTanStackRouter`. O router usa `document.startViewTransition` quando disponível (Chrome/Android, Safari 18+) e degrada silenciosamente onde não há.
- `src/styles.css`:
  - `@view-transition { navigation: auto; }`
  - Regras `::view-transition-old(root)` / `::view-transition-new(root)` com um cross-fade curto (~150–200ms).
  - `@media (prefers-reduced-motion: reduce)` — desativar a animação (duração 0 / `animation: none`).
- framer-motion continua responsável pelas animações in-page (listas, cards, sheets). View Transitions cobre só a troca de rota.

---

## Arquitetura e isolamento

| Unidade | O que faz | Interface | Depende de |
|---|---|---|---|
| `scripts/generate-pwa-assets.mjs` | Gera ícones e splash a partir de 1 fonte | CLI (`npm run gen:pwa-assets`) | `sharp`, `public/logo-nexis-fundo.webp` |
| `src/hooks/use-haptic.ts` (existe) | Feedback tátil best-effort | `useHaptic()` → `{ tap, success, error, heavy }` | Vibration API (opcional) |
| `src/hooks/use-install-prompt.ts` (existe, +gate) | Estado de instalabilidade | hook → `{ showPrompt, showAutoPrompt, isIOS, install, dismiss }` | `beforeinstallprompt`, `matchMedia`, `localStorage` |
| `src/components/ui/skeleton.tsx` (novo) | Primitivo de loading | `<Skeleton className>` | `@utility shimmer` |
| `public/manifest.json`, `<head>` | Metadados de instalação | estático | assets de `public/icons` e `public/splash` |
| `public/sw.js` | Transporte de push | eventos SW | — |
| `defaultViewTransition` + CSS | Transição de rota | config do router | View Transitions API (opcional) |

Nenhuma unidade depende do estado interno de outra. As frentes 5, 6 e 7 tocam arquivos existentes (`app-toasts.tsx`, rotas, sheets); as demais são aditivas.

---

## Testes

### Infra de teste (pré-requisito — Task 1 do plano)

Criar `vitest.config.ts` (via `defineConfig` de `vitest/config` + `@vitejs/plugin-react`): `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`, `include: ['src/**/*.test.{ts,tsx}']`. `src/test/setup.ts` mínimo (por ora vazio ou com `cleanup` do `@testing-library/react`). Sem novas dependências de teste além das já instaladas (`jsdom`, `@testing-library/react`, `@testing-library/dom`, `@vitejs/plugin-react`) — asserções via `expect` nativo do vitest, sem `@testing-library/jest-dom`.

### Automatizados (vitest — `npm run test`)

- `src/hooks/use-haptic.test.ts` — mock de `navigator.vibrate`; verifica o array chamado por método (`tap`→`8`, `success`→`[10,40,10]`, `error`→`[30,20,30]`, `heavy`→`25`); não lança quando `vibrate` ausente.
- `src/hooks/use-install-prompt.test.ts` — com `localStorage`/`sessionStorage`/`matchMedia` mockados (`renderHook`): `showAutoPrompt` é `false` antes da 3ª sessão e `true` na 3ª (simulando 3 montagens com `sessionStorage` limpo entre elas); `showPrompt` independe da contagem; `dismiss()` zera ambos; standalone força `installed`.
- `manifest.test.ts` (em `src/test/`) — lê `public/manifest.json`: JSON válido; campos obrigatórios (`id`, `name`, `start_url`, `display`, `icons`); todo `icons[].src` e `shortcuts[].url` (parte de path) resolve para um arquivo em `public/`; exatamente uma entrada `purpose: "maskable"` e ≥1 `purpose: "any"`.
- `src/test/generate-pwa-assets.test.ts` — roda `generate-pwa-assets.mjs` apontando a saída para um tmpdir; afirma que cada arquivo esperado existe e tem as dimensões certas (lê os 24 primeiros bytes do PNG: `width` em BE nos bytes 16–19, `height` em 20–23).

### Manual (checklist — executar antes de considerar concluído)

- [ ] `npm run build` passa; deploy de preview na Vercel sobe sem erro.
- [ ] Lighthouse (aba PWA / "Installable") sem erros de instalabilidade nem de ícone maskable.
- [ ] Android (Chrome): `beforeinstallprompt` capturado; card aparece na 3ª sessão; "Instalar" instala; ícone na home nítido e sem corte no mask; long-press mostra os `shortcuts`; haptics sentidos no FAB e ao salvar transação.
- [ ] iOS (Safari): "Adicionar à Tela de Início" usa `apple-touch-icon.png`; abrir da home mostra a splash correta do device; status bar `black-translucent` coerente com o safe-area; card iOS mostra as instruções.
- [ ] Troca de abas com rede lenta (DevTools throttling) não "pisca" branco; trocar filtro em Transações mantém a lista anterior visível.
- [ ] `prefers-reduced-motion` desliga a transição de rota.

---

## Fora de escopo (explícito)

- Qualquer forma de offline (cache de assets, cache de dados, fila de mutações).
- Envio server-side de push (recorrentes, orçamento, metas).
- Mudanças em autenticação.
- Qualquer trabalho de React Native / Expo.
- Refactor não relacionado às oito frentes acima.

---

## Riscos / pontos de atenção

- **`black-translucent`** é a única mudança visível de comportamento. Mitigação: reversível em 1 linha; validar no checklist manual em device real.
- **`shortcuts` URLs**: confirmado que `/transactions` abre a criação com `?action=new` (`bottom-nav.tsx` usa `search={{ action: 'new' }}`). "Nova receita" pode não ter param de tipo — se `/transactions` não aceitar `type`, usar só `?action=new` para os dois ou omitir o segundo shortcut.
- **`screenshots`** exigem captura de imagens reais. Se bloquear, omitir e seguir.
- **WebP → PNG via sharp**: a fonte é lossy; validar visualmente o `icon-512.png` resultante. 1185px de origem é suficiente para 512 sem upscale.
- **View Transitions no TanStack Start (SSR)**: confirmar que `defaultViewTransition` não conflita com `scrollRestoration`. Degradação é automática, mas testar em Chrome e em Safari < 18.
