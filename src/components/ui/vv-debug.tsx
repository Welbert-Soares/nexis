import { useEffect, useRef, useState } from 'react'

/**
 * Leitor de diagnóstico temporário — mostra os valores de viewport ao vivo
 * para depurar o bug do teclado no PWA iOS. NÃO deve ir para produção.
 * Remover junto com o fix.
 */
export function VvDebug() {
  const [state, setState] = useState({
    innerH: 0,
    innerW: 0,
    vvH: 0,
    vvW: 0,
    vvTop: 0,
    vvScale: 0,
    resizeN: 0,
    scrollN: 0,
    focus: '-',
    standalone: '-',
  })
  const resizeN = useRef(0)
  const scrollN = useRef(0)

  useEffect(() => {
    const vv = window.visualViewport

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
        ? 'SIM'
        : 'nao'

    const read = () => {
      setState({
        innerH: window.innerHeight,
        innerW: window.innerWidth,
        vvH: vv ? Math.round(vv.height) : -1,
        vvW: vv ? Math.round(vv.width) : -1,
        vvTop: vv ? Math.round(vv.offsetTop) : -1,
        vvScale: vv ? Number(vv.scale.toFixed(2)) : -1,
        resizeN: resizeN.current,
        scrollN: scrollN.current,
        focus:
          document.activeElement?.tagName +
          (document.activeElement && 'type' in document.activeElement
            ? ':' + (document.activeElement as HTMLInputElement).type
            : ''),
        standalone,
      })
    }

    const onResize = () => {
      resizeN.current += 1
      read()
    }
    const onScroll = () => {
      scrollN.current += 1
      read()
    }
    const onFocusIn = () => read()
    const onFocusOut = () => setTimeout(read, 50)

    read()
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', onScroll)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    const id = setInterval(read, 500)

    return () => {
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', onScroll)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      clearInterval(id)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top)',
        left: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.82)',
        color: '#4ade80',
        font: '11px/1.35 ui-monospace, Menlo, monospace',
        padding: '6px 8px',
        pointerEvents: 'none',
        whiteSpace: 'pre',
        maxWidth: '62vw',
      }}
    >
      {`standalone: ${state.standalone}
innerH x innerW: ${state.innerH} x ${state.innerW}
vv.height x width: ${state.vvH} x ${state.vvW}
vv.offsetTop: ${state.vvTop}   scale: ${state.vvScale}
keyboard(inner-vv): ${state.innerH - state.vvH}
vv resize#: ${state.resizeN}   vv scroll#: ${state.scrollN}
focus: ${state.focus}`}
    </div>
  )
}
