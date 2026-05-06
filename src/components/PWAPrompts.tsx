import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, RefreshCw, X } from 'lucide-react'
import { Button } from './ui/button'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_DISMISSED_KEY = 'ff_pwa_install_dismissed_at'
const INSTALL_DISMISS_DAYS = 14

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function shouldHideInstallByCooldown(): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISSED_KEY)
    if (!raw) return false
    const dismissedAt = Number(raw)
    if (!Number.isFinite(dismissedAt)) return false
    const ageMs = Date.now() - dismissedAt
    return ageMs < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function PromptCard({
  children,
  testId,
}: {
  children: React.ReactNode
  testId: string
}) {
  return (
    <div
      data-testid={testId}
      className="fixed bottom-4 left-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 rounded-lg border border-border bg-card p-4 shadow-lg"
      role="dialog"
      aria-live="polite"
    >
      {children}
    </div>
  )
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('[pwa] service worker registration failed', error)
    },
  })

  if (!needRefresh) return null

  return (
    <PromptCard testId="pwa-update-prompt">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Update available</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A new version of FoundersLib is ready. Reload to get it.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => updateServiceWorker(true)}
              data-testid="pwa-update-reload"
            >
              Reload
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNeedRefresh(false)}
              data-testid="pwa-update-dismiss"
            >
              Later
            </Button>
          </div>
        </div>
      </div>
    </PromptCard>
  )
}

function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    if (installed) return
    if (shouldHideInstallByCooldown()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [installed])

  if (installed || !event) return null

  const handleInstall = async () => {
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'dismissed') {
        localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()))
      }
    } finally {
      setEvent(null)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()))
    setEvent(null)
  }

  return (
    <PromptCard testId="pwa-install-prompt">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Install FoundersLib</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add to your home screen for faster access and offline support.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleInstall} data-testid="pwa-install-accept">
              Install
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              data-testid="pwa-install-dismiss"
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </PromptCard>
  )
}

export function PWAPrompts() {
  return (
    <>
      <UpdatePrompt />
      <InstallPrompt />
    </>
  )
}
