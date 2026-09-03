import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHaptic } from './use-haptic'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useHaptic', () => {
  it('chama navigator.vibrate com o padrão certo por método', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })

    const { result } = renderHook(() => useHaptic())
    result.current.tap()
    result.current.success()
    result.current.error()
    result.current.heavy()

    expect(vibrate.mock.calls).toEqual([[8], [[10, 40, 10]], [[30, 20, 30]], [25]])
  })

  it('não lança quando a Vibration API não existe', () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => useHaptic())
    expect(() => result.current.tap()).not.toThrow()
  })
})
