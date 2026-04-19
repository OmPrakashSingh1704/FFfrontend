import { useEffect, useState } from 'react'
import { UserCheck, UserPlus, Clock, X, Check, Trash2, Users, Calendar } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import type { ConnectionRequest, SendConnectionRequest } from '../types/connection'

type Tab = 'connections' | 'pending'

const statusBadgeClass: Record<string, string> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'error',
  expired: '',
}

export function ConnectionsPage() {
  const { pushToast } = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('connections')
  const [items, setItems] = useState<ConnectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Send form state
  const [showForm, setShowForm] = useState(false)
  const [sendForm, setSendForm] = useState<SendConnectionRequest>({ user_id: '', message: '' })
  const [sendLoading, setSendLoading] = useState(false)

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
    if (!sendForm.user_id.trim()) {
      pushToast('Enter a user ID to connect with.', 'warning')
      return
    }
    setSendLoading(true)
    try {
      await apiRequest<ConnectionRequest>('/connections/send/', {
        method: 'POST',
        body: { user_id: sendForm.user_id, message: sendForm.message || undefined },
      })
      pushToast('Connection request sent!', 'success')
      setShowForm(false)
      setSendForm({ user_id: '', message: '' })
      const cancelled = { current: false }
      void loadItems(cancelled)
    } catch (err: unknown) {
      const msg =
        err != null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to send request.'
      pushToast(msg, 'error')
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
          onClick={() => setShowForm(true)}
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
              <button type="button" className="btn-sm ghost" onClick={() => setShowForm(false)}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleSend}>
              <div className="form-group">
                <label>User ID *</label>
                <input
                  className="input"
                  type="text"
                  value={sendForm.user_id}
                  onChange={(e) => setSendForm((f) => ({ ...f, user_id: e.target.value }))}
                  placeholder="Paste the user's UUID..."
                  data-testid="user-id-input"
                />
              </div>
              <div className="form-group">
                <label>Message (optional)</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={sendForm.message}
                  onChange={(e) => setSendForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Say why you'd like to connect..."
                  data-testid="message-input"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={sendLoading} data-testid="submit-send-btn">
                  <UserPlus style={{ width: 14, height: 14, marginRight: 4 }} />
                  {sendLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <p className="empty-description">Loading...</p>
        </div>
      )}

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
