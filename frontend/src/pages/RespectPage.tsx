import { useEffect, useRef, useState } from 'react'
import { Heart, Plus, X, Calendar } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import type { RespectReceived, RespectGiven } from '../types/respect'
import type { PublicUser } from '../types/founder'

export function RespectPage() {
  const { pushToast } = useToast()
  const [received, setReceived] = useState<RespectReceived[]>([])
  const [given, setGiven] = useState<RespectGiven[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Give respect form state
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PublicUser[]>([])
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null)
  const [reason, setReason] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRespect = async (cancelled: { current: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const [receivedData, givenData] = await Promise.all([
        apiRequest<RespectReceived[] | { results: RespectReceived[] }>('/respects/received/'),
        apiRequest<RespectGiven[] | { results: RespectGiven[] }>('/respects/given/'),
      ])
      if (!cancelled.current) {
        setReceived(normalizeList(receivedData))
        setGiven(normalizeList(givenData))
      }
    } catch {
      if (!cancelled.current) {
        setError('Unable to load respect data.')
      }
    } finally {
      if (!cancelled.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const cancelled = { current: false }
    void loadRespect(cancelled)
    return () => { cancelled.current = true }
  }, [])

  // Debounced user search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedUser(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.length < 2) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await apiRequest<PublicUser[] | { results: PublicUser[] }>(
          `/search/users/?q=${encodeURIComponent(value)}`
        )
        setSearchResults(normalizeList(data))
      } catch {
        setSearchResults([])
      }
    }, 300)
  }

  const handleSelectUser = (user: PublicUser) => {
    setSelectedUser(user)
    setSearchQuery(user.full_name)
    setSearchResults([])
  }

  const handleGiveRespect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) {
      pushToast('Please select a user.', 'warning')
      return
    }
    setFormLoading(true)
    try {
      await apiRequest('/respects/give/', {
        method: 'POST',
        body: { to_user_id: selectedUser.id, reason: reason || undefined },
      })
      pushToast('Respect given!', 'success')
      setShowForm(false)
      setSearchQuery('')
      setSelectedUser(null)
      setReason('')
      // Refresh lists
      const cancelled = { current: false }
      void loadRespect(cancelled)
    } catch {
      pushToast('Failed to give respect.', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Respect</h1>
          <p className="page-description">Endorsements and credibility signals in your network.</p>
        </div>
        <button
          type="button"
          className="btn-sm primary"
          onClick={() => setShowForm(!showForm)}
          data-testid="give-respect-btn"
        >
          <Heart style={{ width: 14, height: 14 }} />
          Give Respect
        </button>
      </div>

      {/* Give Respect Inline Form */}
      {showForm && (
        <div className="card section" data-testid="give-respect-form">
          <div className="card-header">
            <span className="card-title">Give Respect</span>
            <button type="button" className="btn-sm ghost" onClick={() => setShowForm(false)} data-testid="close-respect-form">
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <form onSubmit={handleGiveRespect}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label>To user *</label>
              <input
                className="input"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search for a user..."
                data-testid="user-search-input"
              />
              {searchResults.length > 0 && (
                <div
                  data-testid="user-search-results"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    maxHeight: '12rem',
                    overflowY: 'auto',
                    marginTop: '0.25rem',
                  }}
                >
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="list-item"
                      style={{ width: '100%', textAlign: 'left' }}
                      onClick={() => handleSelectUser(user)}
                      data-testid="user-search-option"
                    >
                      <div className="avatar">
                        {getInitials(user.full_name)}
                      </div>
                      <span style={{ fontSize: '0.875rem' }}>
                        {user.full_name}{user.role ? ` (${user.role})` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <div style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="avatar" style={{ width: '1.25rem', height: '1.25rem', fontSize: '0.625rem' }}>
                    {getInitials(selectedUser.full_name)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>
                    Selected: {selectedUser.full_name}
                  </span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Reason (optional)</label>
              <textarea
                className="textarea"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you respect this person?"
                data-testid="respect-reason-input"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn-sm primary" disabled={formLoading || !selectedUser} data-testid="submit-respect-btn">
                <Plus style={{ width: 14, height: 14 }} />
                {formLoading ? 'Sending...' : 'Give Respect'}
              </button>
              <button type="button" className="btn-sm ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading / Error */}
      {loading ? (
        <div className="empty-state">
          <p className="empty-description">Loading respect...</p>
        </div>
      ) : null}

      {error ? (
        <div className="card" style={{ borderColor: '#ef4444', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
        </div>
      ) : null}

      {/* Two-column layout: Received + Given */}
      {!loading && !error ? (
        <div className="grid-2">
          {/* Received Column */}
          <div data-testid="respect-received-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <Heart style={{ width: 20, height: 20 }} />
                </div>
              </div>
              <span className="stat-value">{received.length}</span>
              <span className="stat-label">Received</span>
            </div>

            {received.length === 0 ? (
              <div className="card">
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <Heart className="empty-icon" />
                  <p className="empty-description">No respect received yet.</p>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {received.map((item, index) => (
                  <div
                    key={item.id}
                    className="list-item"
                    style={{
                      borderBottom: index < received.length - 1 ? '1px solid hsl(var(--border) / 0.5)' : undefined,
                      cursor: 'default',
                    }}
                  >
                    <div className="avatar">
                      {getInitials(item.from_user?.full_name || 'S')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {item.from_user?.full_name || 'Someone'}
                      </div>
                      {item.reason && (
                        <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.125rem' }}>
                          {item.reason}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem', flexShrink: 0 }}>
                      {item.created_at && (
                        <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar style={{ width: 10, height: 10 }} />
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      )}
                      {item.expires_at && (
                        <span style={{ fontSize: '0.625rem', color: 'hsl(var(--muted-foreground))' }}>
                          exp {new Date(item.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Given Column */}
          <div data-testid="respect-given-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <Heart style={{ width: 20, height: 20 }} />
                </div>
              </div>
              <span className="stat-value">{given.length}</span>
              <span className="stat-label">Given</span>
            </div>

            {given.length === 0 ? (
              <div className="card">
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <Heart className="empty-icon" />
                  <p className="empty-description">You haven't given any respect yet.</p>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {given.map((item, index) => (
                  <div
                    key={item.id}
                    className="list-item"
                    style={{
                      borderBottom: index < given.length - 1 ? '1px solid hsl(var(--border) / 0.5)' : undefined,
                      cursor: 'default',
                    }}
                  >
                    <div className="avatar">
                      {getInitials(item.to_user?.full_name || 'S')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {item.to_user?.full_name || 'Someone'}
                      </div>
                      {item.reason && (
                        <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.125rem' }}>
                          {item.reason}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem', flexShrink: 0 }}>
                      {item.created_at && (
                        <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar style={{ width: 10, height: 10 }} />
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      )}
                      {item.expires_at && (
                        <span style={{ fontSize: '0.625rem', color: 'hsl(var(--muted-foreground))' }}>
                          exp {new Date(item.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
