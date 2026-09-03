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
