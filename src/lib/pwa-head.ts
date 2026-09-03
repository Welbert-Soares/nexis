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
