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
