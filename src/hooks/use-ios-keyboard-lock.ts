import { useEffect } from 'react'

/**
 * No PWA standalone do iOS, focar um input dentro de um elemento
 * `position: fixed` faz o Safari rolar o documento inteiro (incluindo a
 * camada fixed) para cima, jogando o conteúdo para fora da tela. O
 * `overflow: hidden` no body não impede esse scroll.
 *
 * Enquanto `active` é true, este hook força qualquer scroll do documento
 * de volta para 0 — em eventos de scroll e numa rajada de frames logo
 * após o focusin, que é quando o iOS insiste em rolar.
 */
export function useIosKeyboardLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const reset = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0)
      const el = document.scrollingElement ?? document.documentElement
      if (el.scrollTop !== 0) el.scrollTop = 0
      if (document.body.scrollTop !== 0) document.body.scrollTop = 0
    }

    let raf = 0
    let until = 0
    const pump = () => {
      reset()
      if (performance.now() < until) raf = requestAnimationFrame(pump)
    }
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      until = performance.now() + 700
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(pump)
    }

    window.addEventListener('scroll', reset, { passive: true })
    document.addEventListener('scroll', reset, { passive: true, capture: true })
    document.addEventListener('focusin', onFocusIn)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', reset)
      document.removeEventListener('scroll', reset, { capture: true } as EventListenerOptions)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [active])
}
