/**
 * Modal for inviting a user to join a startup.
 *
 * Existing members open this from the Members section on
 * StartupDetailPage. The flow is:
 *   1. Type to search for users (reuses /chat/messageable-users/)
 *   2. Pick one from the result list
 *   3. Choose a role + optional message
 *   4. POST /founders/startups/<id>/invite/
 * The recipient receives the invitation in their /app/invitations inbox.
 *
 * Constraints enforced server-side and reflected in error responses
 * we surface here:
 *   - Cannot invite yourself
 *   - Cannot invite an existing member
 *   - Cannot duplicate a pending invitation for the same user
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Search, ShieldCheck, UserPlus, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'

type SearchResult = {
  id: string
  full_name: string
  email?: string
  avatar_url?: string | null
}

const ROLE_OPTIONS = [
  { value: 'founder', label: 'Founder' },
  { value: 'co_founder', label: 'Co-Founder' },
  { value: 'executive', label: 'Executive' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'employee', label: 'Employee' },
] as const

type Props = {
  startupId: string
  startupName: string
  onClose: () => void
  onSent: () => void
}

export function StartupInviteModal({ startupId, startupName, onClose, onSent }: Props) {
  const { pushToast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<SearchResult | null>(null)
  const [role, setRole] = useState<typeof ROLE_OPTIONS[number]['value']>('employee')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<number | null>(null)

  // ESC closes the modal. Disabled while a POST is in flight so a stray
  // press doesn't orphan the request mid-send.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sending])

  // Debounced search. 250ms is short enough to feel snappy but long
  // enough that we don't fire a request per keystroke for a typist.
  useEffect(() => {
    if (picked) return
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    searchTimer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const data = await apiRequest<SearchResult[] | { results: SearchResult[] }>(
          `/chat/messageable-users/?search=${encodeURIComponent(trimmed)}`,
        )
        // Normalize paginated and bare-array shapes — the endpoint has
        // returned both depending on filters over the project's history.
        const list = Array.isArray(data) ? data : data.results ?? []
        setResults(list)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current)
    }
  }, [query, picked])

  const handleSend = useCallback(async () => {
    if (!picked || sending) return
    setSending(true)
    setError(null)
    try {
      await apiRequest(`/founders/startups/${startupId}/invite/`, {
        method: 'POST',
        body: {
          invitee: picked.id,
          role,
          message: message.trim(),
        },
      })
      pushToast('Invitation sent', 'success')
      onSent()
    } catch (err) {
      const e = err as { details?: { invitee?: string[]; detail?: string } }
      // Server returns either { detail: "..." } for global errors or
      // { invitee: ["..."] } for serializer validation. Both end up as
      // a single string in the error banner.
      const msg =
        e.details?.detail
          ?? e.details?.invitee?.[0]
          ?? 'Failed to send invitation.'
      setError(msg)
    } finally {
      setSending(false)
    }
  }, [picked, role, message, sending, startupId, pushToast, onSent])

  return (
    <div
      data-testid="invite-modal-backdrop"
      onClick={() => { if (!sending) onClose() }}
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
        data-testid="invite-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Invite member to ${startupName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
          width: 'min(560px, 92vw)',
          maxHeight: '85vh',
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
          <UserPlus size={16} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0, flex: 1 }}>
            Invite to {startupName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            data-testid="invite-modal-close"
            style={{
              padding: 4, border: 'none', background: 'transparent',
              color: 'hsl(var(--muted-foreground))',
              cursor: sending ? 'default' : 'pointer', borderRadius: 6,
            }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!picked ? (
            <>
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  border: '1px solid hsl(var(--border))', borderRadius: 8,
                  background: 'hsl(var(--muted))',
                  padding: '0.5rem 0.75rem',
                }}
              >
                <Search size={14} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  autoFocus
                  data-testid="invite-modal-search"
                  style={{
                    flex: 1, border: 'none', background: 'transparent',
                    color: 'hsl(var(--foreground))', fontSize: '0.875rem',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                {searching ? (
                  <Loader2 size={12} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                ) : null}
              </label>

              {query.trim().length >= 2 && results.length === 0 && !searching ? (
                <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', margin: 0, padding: '1rem 0' }}>
                  No matches.
                </p>
              ) : null}

              <div
                role="listbox"
                style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}
              >
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => setPicked(u)}
                    data-testid={`invite-modal-result-${u.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '0.5rem 0.625rem',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      background: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))',
                      cursor: 'pointer', textAlign: 'left',
                      font: 'inherit', fontSize: '0.875rem',
                    }}
                  >
                    <div
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'hsl(var(--background))', overflow: 'hidden',
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6875rem', fontWeight: 600,
                        color: 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        u.full_name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{u.full_name}</span>
                      {u.email ? (
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>{u.email}</span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Picked-user summary + change button */}
              <div
                data-testid="invite-modal-picked"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.625rem 0.75rem',
                  border: '1px solid hsl(var(--primary))',
                  background: 'hsl(var(--primary) / 0.12)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'hsl(var(--muted))', overflow: 'hidden',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6875rem', fontWeight: 600,
                    color: 'hsl(var(--muted-foreground))',
                  }}
                >
                  {picked.avatar_url ? (
                    <img src={picked.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    picked.full_name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>{picked.full_name}</span>
                  {picked.email ? (
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>{picked.email}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => { setPicked(null); setError(null) }}
                  className="btn-sm ghost"
                  data-testid="invite-modal-change"
                  style={{ fontSize: '0.6875rem', flexShrink: 0 }}
                >
                  Change
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="invite-role" style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Role</label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  data-testid="invite-modal-role"
                  style={{
                    padding: '0.5rem 0.625rem', borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--muted))',
                    color: 'hsl(var(--foreground))',
                    fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
                  }}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="invite-message" style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Optional message</label>
                <textarea
                  id="invite-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Tell them why you'd like them on board…"
                  data-testid="invite-modal-message"
                  style={{
                    padding: '0.5rem 0.625rem', borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--muted))',
                    color: 'hsl(var(--foreground))',
                    fontSize: '0.875rem', fontFamily: 'inherit',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              </div>
            </>
          )}

          {error ? (
            <div
              data-testid="invite-modal-error"
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.75rem',
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div
          style={{
            borderTop: '1px solid hsl(var(--border))',
            padding: '0.625rem 1rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            className="btn-sm ghost"
            onClick={onClose}
            disabled={sending}
            data-testid="invite-modal-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-sm primary"
            onClick={() => void handleSend()}
            disabled={!picked || sending}
            data-testid="invite-modal-submit"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            Send invitation
          </button>
        </div>
      </div>
    </div>
  )
}
