import { useEffect, useRef, useState } from 'react'

/**
 * Leitor de diagnóstico temporário — mostra os valores de viewport ao vivo
 * para depurar o bug do teclado no PWA iOS. NÃO deve ir para produção.
 * Remover junto com o fix.
 */
export function VvDebug() {
  const [s, setS] = useState({
    innerH: 0,
    vvH: 0,
    vvTop: 0,
    maxKbd: 0,
    scrollY: 0,
    docTop: 0,
    bodyTop: 0,
    resizeN: 0,
    scrollN: 0,
    focus: '-',
  })
  const resizeN = useRef(0)
  const scrollN = useRef(0)
  const maxKbd = useRef(0)

  useEffect(() => {
    const vv = window.visualViewport

    const read = () => {
      const kbd = window.innerHeight - (vv ? vv.height : window.innerHeight)
      if (kbd > maxKbd.current) maxKbd.current = Math.round(kbd)
      const docEl = document.scrollingElement ?? document.documentElement
      setS({
        innerH: window.innerHeight,
        vvH: vv ? Math.round(vv.height) : -1,
        vvTop: vv ? Math.round(vv.offsetTop) : -1,
        maxKbd: maxKbd.current,
        scrollY: Math.round(window.scrollY),
        docTop: Math.round(docEl.scrollTop),
        bodyTop: Math.round(document.body.scrollTop),
        resizeN: resizeN.current,
        scrollN: scrollN.current,
        focus:
          (document.activeElement?.tagName ?? '-') +
          (document.activeElement && 'type' in document.activeElement
            ? ':' + (document.activeElement as HTMLInputElement).type
            : ''),
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

    read()
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', onScroll)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('focusin', read)
    document.addEventListener('focusout', () => setTimeout(read, 60))
    const id = setInterval(read, 400)

    return () => {
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('focusin', read)
      clearInterval(id)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: '42%',
        left: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.85)',
        color: '#4ade80',
        font: '11px/1.4 ui-monospace, Menlo, monospace',
        padding: '6px 8px',
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {`innerH: ${s.innerH}   vv.h: ${s.vvH}   vv.top: ${s.vvTop}
kbd agora: ${s.innerH - s.vvH}   kbd max: ${s.maxKbd}
scrollY: ${s.scrollY}   docTop: ${s.docTop}   bodyTop: ${s.bodyTop}
resize#: ${s.resizeN}   scroll#: ${s.scrollN}
focus: ${s.focus}`}
    </div>
  )
}
