/**
 * Click-through NDA dialog for a deal room.
 *
 * Fetches the interpolated NDA text from the server, shows it in a
 * scrollable region, and requires the user to:
 *   1. Scroll to the bottom of the text (proves they at least scrolled past it)
 *   2. Check "I have read and agree"
 *   3. Type their full legal name
 *
 * Only then is the Sign button enabled. Submitting posts the
 * server-provided version + sha256 alongside the typed name, so the
 * server can detect tampering or a stale template (and reject).
 *
 * The full agreed text + IP + user-agent end up in
 * DealRoomNDASignature as the legal evidence trail — see
 * ff_backend/deals/models.py.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, ShieldCheck, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'

type NDAResponse = {
  version: string
  sha256: string
  text: string
  founder_signed: boolean
  investor_signed: boolean
  signatures: Array<{
    id: string
    role: 'founder' | 'investor'
    typed_name: string
    template_version: string
    template_sha256: string
    signed_at: string
  }>
}

type Props = {
  conversationDealRoomId: string
  onClose: () => void
  onSigned: () => void
}

export function DealRoomNDAModal({ conversationDealRoomId, onClose, onSigned }: Props) {
  const { pushToast } = useToast()
  const [nda, setNda] = useState<NDAResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textRef = useRef<HTMLPreElement | null>(null)

  // Fetch the NDA text on mount. The sha256 we capture here is what we
  // submit back; if the server's template changes between this fetch
  // and our submit, the server rejects with 400 and we ask the user
  // to refresh.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiRequest<NDAResponse>(`/deals/rooms/${conversationDealRoomId}/nda/`)
      .then((data) => {
        if (cancelled) return
        setNda(data)
      })
      .catch(() => {
        if (cancelled) return
        setError('Unable to load the NDA. Please close this dialog and try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [conversationDealRoomId])

  // ESC closes the modal — keyboard parity with the X button. Disabled
  // while submitting so an accidental ESC mid-POST doesn't leave the
  // request orphaned in an unknown state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  // Detect scroll-to-bottom on the text container. We're lenient by
  // 8px so a slightly-overflowed final line still counts. The gate
  // exists to make the click-through deliberate — once tripped, it
  // stays true even if the user scrolls up to re-read a section.
  const onScroll = useCallback(() => {
    const el = textRef.current
    if (!el) return
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining < 8) setScrolledToBottom(true)
  }, [])

  // If the NDA is short enough that no scrolling is needed, mark the
  // gate as tripped immediately on first render — otherwise the user
  // is stuck unable to sign with no scroll bar to interact with.
  useEffect(() => {
    if (!nda || loading) return
    const el = textRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + 8) setScrolledToBottom(true)
  }, [nda, loading])

  const handleSign = async () => {
    if (!nda) return
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(`/deals/rooms/${conversationDealRoomId}/sign-nda/`, {
        method: 'POST',
        body: {
          typed_name: typedName.trim(),
          agreed_version: nda.version,
          agreed_sha256: nda.sha256,
        },
      })
      pushToast('NDA signed', 'success')
      onSigned()
    } catch (err) {
      const e = err as { details?: { detail?: string } }
      setError(e.details?.detail ?? 'Failed to sign the NDA.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSign = scrolledToBottom && agreed && typedName.trim().length > 0 && !submitting

  return (
    <div
      data-testid="nda-modal-backdrop"
      onClick={() => { if (!submitting) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '2rem',
      }}
    >
      <div
        data-testid="nda-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Mutual Confidentiality Agreement"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
          width: 'min(820px, 92vw)',
          height: 'min(720px, 90vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <ShieldCheck size={16} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0, flex: 1 }}>
            Mutual Confidentiality Agreement
          </h2>
          {nda ? (
            <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
              {nda.version}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            data-testid="nda-modal-close"
            style={{
              padding: 4,
              border: 'none',
              background: 'transparent',
              color: 'hsl(var(--muted-foreground))',
              cursor: submitting ? 'default' : 'pointer',
              borderRadius: 6,
            }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <pre
          ref={textRef}
          onScroll={onScroll}
          data-testid="nda-modal-text"
          style={{
            flex: 1,
            margin: 0,
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: '0.8125rem',
            lineHeight: 1.55,
            color: 'hsl(var(--foreground))',
            background: 'hsl(var(--background))',
          }}
        >
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'hsl(var(--muted-foreground))' }}>
              <Loader2 size={14} className="animate-spin" /> Loading agreement…
            </span>
          ) : error ? (
            <span style={{ color: '#ef4444' }}>{error}</span>
          ) : (
            nda?.text ?? ''
          )}
        </pre>

        <div
          style={{
            borderTop: '1px solid hsl(var(--border))',
            padding: '0.875rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {!scrolledToBottom ? (
            <span
              data-testid="nda-modal-scroll-hint"
              style={{
                fontSize: '0.6875rem',
                color: 'hsl(var(--muted-foreground))',
                fontStyle: 'italic',
              }}
            >
              Please scroll to the bottom of the agreement to continue.
            </span>
          ) : null}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.8125rem',
              cursor: scrolledToBottom ? 'pointer' : 'default',
              opacity: scrolledToBottom ? 1 : 0.55,
            }}
          >
            <input
              type="checkbox"
              checked={agreed}
              disabled={!scrolledToBottom || submitting}
              onChange={(e) => setAgreed(e.target.checked)}
              data-testid="nda-modal-agree-checkbox"
            />
            I have read and agree to be bound by this Agreement.
          </label>

          <input
            type="text"
            placeholder="Type your full legal name as signature"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            disabled={!agreed || submitting}
            data-testid="nda-modal-typed-name"
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />

          {error && !loading ? (
            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</span>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className="btn-sm ghost"
              onClick={onClose}
              disabled={submitting}
              data-testid="nda-modal-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-sm primary"
              onClick={() => void handleSign()}
              disabled={!canSign}
              data-testid="nda-modal-submit"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              Sign as {typedName.trim() || '…'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
