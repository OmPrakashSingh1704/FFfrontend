import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCheck, UserPlus, Clock, X, Check, Trash2, Users, Calendar, Search, Loader2 } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { ListRowsSkeleton } from '../components/skeletons'
import type { ConnectionRequest } from '../types/connection'

type UserSearchResult = {
  id: string
  full_name: string
  email?: string
  avatar_url?: string
  league?: string
  is_online?: boolean
}

type Tab = 'connections' | 'pending'

const statusBadgeClass: Record<string, string> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'error',
  expired: '',
}

export function ConnectionsPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('connections')
  const [showIntroPrompt, setShowIntroPrompt] = useState(false)
  const [items, setItems] = useState<ConnectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Send form state — search+pick replaces the old UUID input.
  const [showForm, setShowForm] = useState(false)
  const [pickQuery, setPickQuery] = useState('')
  const [pickResults, setPickResults] = useState<UserSearchResult[]>([])
  const [pickSearching, setPickSearching] = useState(false)
  const [picked, setPicked] = useState<UserSearchResult | null>(null)
  const [pickMessage, setPickMessage] = useState('')
  const [sendLoading, setSendLoading] = useState(false)

  // Debounced search against /chat/messageable-users/. Same endpoint used by
  // the new-chat flow on ChatPage — keeps user-search behavior consistent
  // across the app and means we never see UUIDs in this form again.
  useEffect(() => {
    if (!showForm || picked) {
      setPickResults([])
      return
    }
    const q = pickQuery.trim()
    if (!q) {
      setPickResults([])
      return
    }
    setPickSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const data = await apiRequest<UserSearchResult[]>(
          `/chat/messageable-users/?search=${encodeURIComponent(q)}`,
        )
        setPickResults(Array.isArray(data) ? data : [])
      } catch {
        setPickResults([])
      } finally {
        setPickSearching(false)
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [pickQuery, showForm, picked])

  const resetSendForm = () => {
    setPickQuery('')
    setPickResults([])
    setPicked(null)
    setPickMessage('')
  }

  // Action loading (per-item)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadItems = async (cancelled: { current: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = tab === 'pending' ? '/connections/pending/' : '/connections/'
      const data = await apiRequest<ConnectionRequest[] | { results: ConnectionRequest[] }>(endpoint)
      if (!cancelled.current) setItems(normalizeList(data))
    } catch {
      if (!cancelled.current) setError('Unable to load connections.')
    } finally {
      if (!cancelled.current) setLoading(false)
    }
  }

  useEffect(() => {
    const cancelled = { current: false }
    void loadItems(cancelled)
    return () => { cancelled.current = true }
  }, [tab])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!picked) {
      pushToast('Search for a person and pick them first.', 'warning')
      return
    }
    setSendLoading(true)
    try {
      await apiRequest<ConnectionRequest>('/connections/send/', {
        method: 'POST',
        body: { user_id: picked.id, message: pickMessage || undefined },
      })
      pushToast(`Connection request sent to ${picked.full_name}!`, 'success')
      setShowForm(false)
      resetSendForm()
      const cancelled = { current: false }
      void loadItems(cancelled)
    } catch (err: unknown) {
      // Surface the backend's actual reason (409 already connected, 429
      // rate-limited, 403 league-blocked) instead of a generic "failed".
      const detail =
        (err as { details?: { detail?: string } })?.details?.detail
        ?? (err as { message?: string })?.message
        ?? 'Failed to send request.'
      pushToast(detail, 'error')
    } finally {
      setSendLoading(false)
    }
  }

  const handleAccept = async (req: ConnectionRequest) => {
    setActionLoading(req.id)
    try {
      const updated = await apiRequest<ConnectionRequest>(`/connections/${req.id}/accept/`, { method: 'POST' })
      pushToast('Connection accepted!', 'success')
      setItems((prev) => prev.map((item) => (item.id === req.id ? updated : item)))
    } catch {
      pushToast('Failed to accept.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (req: ConnectionRequest) => {
    setActionLoading(req.id)
    try {
      const updated = await apiRequest<ConnectionRequest>(`/connections/${req.id}/decline/`, { method: 'POST' })
      pushToast('Request declined.', 'success')
      setItems((prev) => prev.map((item) => (item.id === req.id ? updated : item)))
    } catch {
      pushToast('Failed to decline.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisconnect = async (req: ConnectionRequest) => {
    if (!confirm('Remove this connection?')) return
    setActionLoading(req.id)
    try {
      await apiRequest(`/connections/${req.id}/`, { method: 'DELETE' })
      pushToast('Connection removed.', 'success')
      setItems((prev) => prev.filter((item) => item.id !== req.id))
    } catch {
      pushToast('Failed to disconnect.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const otherUser = (req: ConnectionRequest) =>
    req.sender?.id === user?.id ? req.receiver : req.sender

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Connections</h1>
          <p className="page-description">Manage your network and pending requests.</p>
        </div>
        <button
          type="button"
          className="btn-sm primary"
          onClick={() => setShowIntroPrompt(true)}
          data-testid="send-connection-btn"
        >
          <UserPlus style={{ width: 14, height: 14 }} />
          Connect
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {(['connections', 'pending'] as Tab[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`tab ${tab === option ? 'active' : ''}`}
            onClick={() => setTab(option)}
            data-testid={`tab-${option}`}
          >
            {option === 'connections' ? 'My Connections' : 'Pending'}
          </button>
        ))}
      </div>

      {/* Warm Intro Prompt */}
      {showIntroPrompt && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowIntroPrompt(false) }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '30rem' }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>How would you like to connect?</h2>
              <button type="button" className="btn-sm ghost" onClick={() => setShowIntroPrompt(false)}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem' }}>
              A Warm Introduction carries context about who you are and why you want to connect — it gets accepted far more often than a cold request.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn primary"
                style={{ flexDirection: 'column', height: 'auto', padding: '0.5rem 0.625rem', gap: '0.125rem', textAlign: 'center' }}
                onClick={() => { setShowIntroPrompt(false); navigate('/app/intros', { state: { openForm: true } }) }}
              >
                <UserCheck style={{ width: 14, height: 14 }} />
                <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Warm Introduction</span>
                <span style={{ fontSize: '0.625rem', fontWeight: 400, opacity: 0.85, lineHeight: 1.25 }}>Include your pitch and why you're a fit</span>
              </button>
              <button
                type="button"
                className="btn"
                style={{ flexDirection: 'column', height: 'auto', padding: '0.5rem 0.625rem', gap: '0.125rem', textAlign: 'center', background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                onClick={() => { setShowIntroPrompt(false); setShowForm(true) }}
              >
                <UserPlus style={{ width: 14, height: 14 }} />
                <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Connection Request</span>
                <span style={{ fontSize: '0.625rem', fontWeight: 400, opacity: 0.7, lineHeight: 1.25 }}>Quick request with an optional note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Connection Modal */}
      {showForm && (
        <div
          data-testid="send-connection-form"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '28rem' }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Send Connection Request</h2>
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => { setShowForm(false); resetSendForm() }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleSend}>
              <div className="form-group">
                <label>Search by name or email *</label>
                {picked ? (
                  // Selected user chip — clear to pick a different one.
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.625rem 0.75rem',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      background: 'hsl(var(--muted) / 0.4)',
                    }}
                    data-testid="picked-user"
                  >
                    <div
                      className="avatar"
                      style={{
                        width: '2rem',
                        height: '2rem',
                        background: 'var(--gold)',
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}
                    >
                      {picked.full_name?.charAt(0) ?? '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {picked.full_name}
                      </div>
                      {picked.email ? (
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {picked.email}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn-sm ghost"
                      onClick={() => { setPicked(null); setPickQuery('') }}
                      title="Pick a different person"
                      data-testid="picked-user-clear"
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <Search
                      style={{
                        position: 'absolute',
                        left: '0.625rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 14,
                        height: 14,
                        color: 'hsl(var(--muted-foreground))',
                      }}
                    />
                    <input
                      className="input"
                      type="text"
                      value={pickQuery}
                      onChange={(e) => setPickQuery(e.target.value)}
                      placeholder="Type a name or email…"
                      style={{ paddingLeft: '2rem' }}
                      autoFocus
                      data-testid="user-search-input"
                    />
                    {pickQuery.trim() && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          maxHeight: '14rem',
                          overflowY: 'auto',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.5rem',
                          background: 'hsl(var(--card))',
                        }}
                        data-testid="user-search-results"
                      >
                        {pickSearching && pickResults.length === 0 ? (
                          <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem' }}>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Searching…
                          </div>
                        ) : pickResults.length === 0 ? (
                          <div style={{ padding: '0.75rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem' }}>
                            No matches.
                          </div>
                        ) : (
                          pickResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setPicked(u)}
                              data-testid={`user-search-option-${u.id}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                width: '100%',
                                padding: '0.5rem 0.625rem',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px solid hsl(var(--border))',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <div
                                className="avatar"
                                style={{
                                  width: '1.75rem',
                                  height: '1.75rem',
                                  background: 'var(--gold)',
                                  color: '#000',
                                  fontWeight: 700,
                                  fontSize: '0.6875rem',
                                }}
                              >
                                {u.full_name?.charAt(0) ?? '?'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {u.full_name}
                                </div>
                                {u.email ? (
                                  <div style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {u.email}
                                  </div>
                                ) : null}
                              </div>
                              {u.is_online ? (
                                <span
                                  title="Online"
                                  style={{
                                    width: '0.5rem',
                                    height: '0.5rem',
                                    borderRadius: '50%',
                                    background: '#22c55e',
                                    flexShrink: 0,
                                  }}
                                />
                              ) : null}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Message (optional)</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={pickMessage}
                  onChange={(e) => setPickMessage(e.target.value)}
                  placeholder="Say why you'd like to connect..."
                  data-testid="message-input"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => { setShowForm(false); resetSendForm() }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={sendLoading || !picked}
                  data-testid="submit-send-btn"
                >
                  <UserPlus style={{ width: 14, height: 14, marginRight: 4 }} />
                  {sendLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <ListRowsSkeleton count={5} />}

      {/* Error */}
      {error && (
        <div className="card" style={{ borderColor: '#ef4444', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state" data-testid="empty-connections">
          <Users className="empty-icon" />
          <h3 className="empty-title">
            {tab === 'pending' ? 'No pending requests' : 'No connections yet'}
          </h3>
          <p className="empty-description">
            {tab === 'pending'
              ? "You're all caught up — no incoming requests."
              : 'Start building your network by connecting with founders and investors.'}
          </p>
        </div>
      )}

      {/* List */}
      {!loading && !error && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((req) => {
            const other = otherUser(req)
            const busy = actionLoading === req.id
            return (
              <div key={req.id} className="card" data-testid="connection-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* User info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="avatar" style={{ background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: '1rem' }}>
                      {other?.full_name?.charAt(0) ?? '?'}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{other?.full_name ?? 'Unknown'}</p>
                      <span className={`badge ${statusBadgeClass[req.status] ?? ''}`} style={{ fontSize: '0.75rem' }}>
                        {req.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {tab === 'pending' && req.status === 'pending' && req.receiver?.id === user?.id && (
                      <>
                        <button
                          type="button"
                          className="btn-sm primary"
                          disabled={busy}
                          onClick={() => handleAccept(req)}
                          data-testid="accept-btn"
                        >
                          <Check style={{ width: 14, height: 14 }} />
                          {busy ? '...' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          className="btn-sm ghost"
                          disabled={busy}
                          onClick={() => handleDecline(req)}
                          data-testid="decline-btn"
                        >
                          <X style={{ width: 14, height: 14 }} />
                          {busy ? '...' : 'Decline'}
                        </button>
                      </>
                    )}
                    {tab === 'connections' && req.status === 'accepted' && (
                      <button
                        type="button"
                        className="btn-sm ghost"
                        disabled={busy}
                        onClick={() => handleDisconnect(req)}
                        data-testid="disconnect-btn"
                        title="Remove connection"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Message preview */}
                {req.message && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
                    "{req.message}"
                  </p>
                )}

                {/* Timestamps */}
                <hr className="divider" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar style={{ width: 12, height: 12 }} />
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                  {req.status === 'pending' && req.expires_at && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock style={{ width: 12, height: 12 }} />
                      Expires {new Date(req.expires_at).toLocaleDateString()}
                    </span>
                  )}
                  {req.responded_at && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <UserCheck style={{ width: 12, height: 12 }} />
                      Connected {new Date(req.responded_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
