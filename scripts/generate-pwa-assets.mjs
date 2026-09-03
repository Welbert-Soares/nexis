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
