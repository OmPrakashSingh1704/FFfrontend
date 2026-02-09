import { useEffect, useRef, useState } from 'react'
import { Heart, Plus, X } from 'lucide-react'
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

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Respect</h1>
          <p>Endorsements and credibility signals in your network.</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setShowForm(!showForm)}
          data-testid="give-respect-btn"
        >
          <Heart style={{ width: 16, height: 16, marginRight: 4 }} />
          Give Respect
        </button>
      </header>

      {/* Give Respect Form */}
      {showForm && (
        <div className="inline-form" data-testid="give-respect-form">
          <div className="inline-form-header">
            <h3>Give Respect</h3>
            <button type="button" className="btn ghost sm" onClick={() => setShowForm(false)} data-testid="close-respect-form">
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <form onSubmit={handleGiveRespect}>
            <div className="form-field" style={{ position: 'relative' }}>
              <label>To user *</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search for a user..."
                data-testid="user-search-input"
              />
              {searchResults.length > 0 && (
                <div className="search-results" data-testid="user-search-results">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      data-testid="user-search-option"
                    >
                      {user.full_name}{user.role ? ` (${user.role})` : ''}
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <span className="data-eyebrow" style={{ marginTop: 4, display: 'inline-block' }}>
                  Selected: {selectedUser.full_name}
                </span>
              )}
            </div>
            <div className="form-field">
              <label>Reason (optional)</label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you respect this person?"
                data-testid="respect-reason-input"
              />
            </div>
            <div className="inline-form-actions">
              <button type="submit" className="btn primary" disabled={formLoading || !selectedUser} data-testid="submit-respect-btn">
                <Plus style={{ width: 14, height: 14, marginRight: 4 }} />
                {formLoading ? 'Sending...' : 'Give Respect'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="page-loader">Loading respect...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid">
          <div className="data-card" data-testid="respect-received-card">
            <span className="data-eyebrow">Received</span>
            <h3>{received.length}</h3>
            {received.length === 0 ? (
              <p>No respect received yet.</p>
            ) : (
              <ul className="timeline">
                {received.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{item.from_user?.full_name || 'Someone'}</strong>
                      {item.reason ? ` — ${item.reason}` : ''}
                    </span>
                    <span className="timeline-meta">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                      {item.expires_at ? ` (expires ${new Date(item.expires_at).toLocaleDateString()})` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="data-card" data-testid="respect-given-card">
            <span className="data-eyebrow">Given</span>
            <h3>{given.length}</h3>
            {given.length === 0 ? (
              <p>You haven't given any respect yet.</p>
            ) : (
              <ul className="timeline">
                {given.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{item.to_user?.full_name || 'Someone'}</strong>
                      {item.reason ? ` — ${item.reason}` : ''}
                    </span>
                    <span className="timeline-meta">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                      {item.expires_at ? ` (expires ${new Date(item.expires_at).toLocaleDateString()})` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
