import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export type Toast = {
  id: string
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  toasts: Toast[]
  pushToast: (message: string, tone?: ToastTone) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 4200)
  }, [dismissToast])

  const value = useMemo(() => ({ toasts, pushToast, dismissToast }), [toasts, pushToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
