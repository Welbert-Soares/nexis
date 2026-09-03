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
