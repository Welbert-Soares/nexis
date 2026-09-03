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
