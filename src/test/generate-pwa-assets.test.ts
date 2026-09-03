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
