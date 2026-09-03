import { describe, expect, it } from 'vitest'
import { pwaLinks, pwaMeta } from './pwa-head'

describe('pwaMeta', () => {
  it('define a status bar do iOS como black (opaca)', () => {
    // black-translucent estica a webview p/ tela cheia no standalone e
    // desalinha o shell `fixed inset-0` (faixa morta embaixo da nav no iOS).
    const bar = pwaMeta.find((m) => m.name === 'apple-mobile-web-app-status-bar-style')
    expect(bar?.content).toBe('black')
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
