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
- **Skeletons:** já existem nas 5 telas (`TransactionsSkeleton`, `AnalyticsSkeleton`, `WalletsSkeleton`, `GoalsSkeleton`, `ListSkeleton` + classe CSS `shimmer`), implementados ad-hoc como funções locais e `<div className="shimmer">` duplicados. Todas as telas usam `useQuery` + `isLoading` (não `useSuspenseQuery`).
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

As oito frentes são independentes entre si e podem ser implementadas/testadas em qualquer ordem.

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

### 5. Prompt de instalação

- **`src/hooks/use-install-prompt.ts`** (novo):
  - Estado: `{ canInstall, isIOS, isStandalone, promptInstall, dismiss, dismissed }`.
  - Captura `beforeinstallprompt` (previne default, guarda o evento) — Chrome/Android.
  - Escuta `appinstalled` → marca instalado em `localStorage`.
  - `isStandalone` = `matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true`.
  - `isIOS` = teste de UA (`/iphone|ipad|ipod/i`) e não-standalone.
  - Contador de sessões: incrementa uma chave `nexis:pwa:session-count` no `localStorage` uma vez por carga de app (guardar em `sessionStorage` que já contou nesta sessão).
  - `shouldShow` = `!isStandalone && !dismissed && !installed && sessionCount >= 3 && (canInstall || isIOS)`.
  - Persistência de `dismissed`: chave booleana `nexis:pwa:install-dismissed` no `localStorage`. Dismiss é **permanente** (só volta a aparecer se o usuário limpar dados do site). A linha em Perfil continua sendo o caminho para instalar depois de dispensar.
  - Todo acesso a `localStorage`/`matchMedia` em `try/catch` e guardado por `typeof window`.
- **`src/components/ui/install-prompt-card.tsx`** (novo):
  - Bottom sheet no padrão `vaul` do app, dismissível.
  - **Android** (`canInstall`): copy curta + botão "Instalar" que chama `promptInstall()`.
  - **iOS** (`isIOS`): passo a passo ilustrado — ícone de Compartilhar → "Adicionar à Tela de Início" → "Adicionar". Sem botão de ação (iOS não expõe API).
  - Botão/gesto de dispensar chama `dismiss()`.
- **Montagem:** incluir `<InstallPromptCard />` na lista de overlays de `src/routes/_authenticated.tsx`. O componente decide sozinho se renderiza (via `shouldShow`).
- **`src/components/profile/profile-sheet.tsx`:** adicionar uma linha "Instalar o app" visível quando `(canInstall || isIOS) && !isStandalone`. Android → `promptInstall()`. iOS → abre o `InstallPromptCard` em modo instrução (estado compartilhado simples — ex. um `useState` no profile sheet ou um pequeno store/context).

### 6. Haptics — `src/lib/haptics.ts` (Android-only)

- `export function haptic(kind: 'tap' | 'success' | 'warning'): void`
  - Padrões: `tap` → `10`; `success` → `[10, 40, 20]`; `warning` → `[20, 60, 20]`.
  - Implementação: `if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)`. No-op em iOS/desktop (iOS Safari não implementa Vibration API, nem em standalone).
- Fios:
  - `src/components/layout/bottom-nav.tsx` — `haptic('tap')` no clique do FAB (+).
  - `src/components/transactions/transaction-sheet.tsx` — `haptic('success')` no `onSuccess` da mutation de criar/editar.
  - Confirmação de excluir transação — `haptic('warning')` ao confirmar a exclusão (localizar o ponto na implementação; provavelmente em `transactions.tsx` ou no sheet).

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
| `src/lib/haptics.ts` | Feedback tátil best-effort | `haptic(kind)` | Vibration API (opcional) |
| `src/hooks/use-install-prompt.ts` | Estado de instalabilidade | hook → objeto de estado + ações | `beforeinstallprompt`, `matchMedia`, `localStorage` |
| `src/components/ui/install-prompt-card.tsx` | UI do convite | monta-se sozinho; lê o hook | `use-install-prompt`, `vaul` |
| `src/components/ui/skeleton.tsx` | Primitivo de loading | `<Skeleton className>` | classe CSS `shimmer` |
| `public/manifest.json`, `<head>` | Metadados de instalação | estático | assets de `public/icons` e `public/splash` |
| `public/sw.js` | Transporte de push | eventos SW | — |
| `defaultViewTransition` + CSS | Transição de rota | config do router | View Transitions API (opcional) |

Nenhuma unidade depende do estado interno de outra. As frentes 5 e 7 tocam `_authenticated.tsx` e as rotas; as demais são aditivas.

---

## Testes

### Automatizados (vitest — `npm run test`)

- `src/lib/haptics.test.ts` — mock de `navigator.vibrate`; verifica padrão chamado por `kind`; no-op quando a API não existe.
- `src/hooks/use-install-prompt.test.ts` — com `localStorage`/`matchMedia` mockados: não mostra antes da 3ª sessão; não mostra em standalone; não mostra após dismiss; mostra no caminho iOS sem `beforeinstallprompt`.
- `manifest.test.ts` — lê `public/manifest.json`: JSON válido; campos obrigatórios presentes; todo `icons[].src` e `shortcuts[].url` existem em `public/`; há exatamente uma entrada `maskable` e ao menos uma `any`.
- `scripts/generate-pwa-assets.test.ts` (ou parte do teste de manifest) — roda o script num tmpdir e afirma que os arquivos saem com as dimensões esperadas (lê o header PNG).

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
- **`shortcuts` URLs** dependem de como `/transactions` abre o sheet de criação hoje. Verificar o search param real na implementação antes de fixar o manifest.
- **`screenshots`** exigem captura de imagens reais. Se bloquear, omitir e seguir.
- **WebP → PNG via sharp**: a fonte é lossy; validar visualmente o `icon-512.png` resultante. 1185px de origem é suficiente para 512 sem upscale.
- **View Transitions no TanStack Start (SSR)**: confirmar que `defaultViewTransition` não conflita com `scrollRestoration`. Degradação é automática, mas testar em Chrome e em Safari < 18.
