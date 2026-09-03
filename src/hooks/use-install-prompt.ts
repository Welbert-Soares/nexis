import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function bumpSessionCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const current = Number(localStorage.getItem('pwa-session-count')) || 0
    if (sessionStorage.getItem('pwa-session-counted') === '1') return current
    const next = current + 1
    localStorage.setItem('pwa-session-count', String(next))
    sessionStorage.setItem('pwa-session-counted', '1')
    return next
  } catch {
    return 0
  }
}

export function useInstallPrompt() {
  const [sessionCount] = useState(bumpSessionCount)
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('pwa-install-dismissed') === '1',
  )

  const isIOS =
    typeof window !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window.navigator as Navigator & { standalone?: boolean }).standalone

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

  useEffect(() => {
    if (isStandalone) { setInstalled(true); return }

    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isStandalone])

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }

  function dismiss() {
    localStorage.setItem('pwa-install-dismissed', '1')
    setDismissed(true)
  }

  const showPrompt = !installed && !dismissed && (!!promptEvent || isIOS)
  const showAutoPrompt = showPrompt && sessionCount >= 3

  return { showPrompt, showAutoPrompt, isIOS, install, dismiss }
}
