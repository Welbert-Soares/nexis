import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useInstallPrompt } from './use-install-prompt'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('useInstallPrompt — contagem de sessão', () => {
  it('conta 1 por carga de app e não recolta na mesma sessão', () => {
    renderHook(() => useInstallPrompt())
    expect(localStorage.getItem('pwa-session-count')).toBe('1')
    renderHook(() => useInstallPrompt())
    expect(localStorage.getItem('pwa-session-count')).toBe('1')
  })

  it('incrementa a cada nova sessão', () => {
    renderHook(() => useInstallPrompt())
    sessionStorage.clear()
    renderHook(() => useInstallPrompt())
    sessionStorage.clear()
    renderHook(() => useInstallPrompt())
    expect(localStorage.getItem('pwa-session-count')).toBe('3')
  })
})

describe('useInstallPrompt — showAutoPrompt', () => {
  it('é false antes da 3ª sessão mesmo instalável', () => {
    localStorage.setItem('pwa-session-count', '1') // esta carga vira 2
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(result.current.showPrompt).toBe(true)
    expect(result.current.showAutoPrompt).toBe(false)
  })

  it('vira true na 3ª sessão quando instalável', () => {
    localStorage.setItem('pwa-session-count', '2') // esta carga vira 3
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(result.current.showAutoPrompt).toBe(true)
  })

  it('dismiss zera os dois e grava a flag permanente', () => {
    localStorage.setItem('pwa-session-count', '5')
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    act(() => result.current.dismiss())
    expect(localStorage.getItem('pwa-install-dismissed')).toBe('1')
    expect(result.current.showPrompt).toBe(false)
    expect(result.current.showAutoPrompt).toBe(false)
  })
})
