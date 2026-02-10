import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, MapPin, TrendingUp, MessageCircle } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { FounderProfile } from '../types/founder'

export function FoundersListPage() {
  const [founders, setFounders] = useState<FounderProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FounderProfile[] | { results: FounderProfile[] }>('/founders/')
        if (!cancelled) {
          setFounders(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load founders.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleStartChat = (e: React.MouseEvent, founder: FounderProfile) => {
    e.preventDefault()
    e.stopPropagation()
    // Navigate to chat with founder's user ID as participant
    const userId = founder.user?.id || founder.id
    navigate(`/app/chat?newChat=${userId}&name=${encodeURIComponent(founder.user?.full_name || 'Founder')}`)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div data-testid="founders-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Founders
            {!loading && !error && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {founders.length}
              </span>
            )}
          </h1>
          <p className="page-description">Browse founder profiles and reach out with context.</p>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <Users className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading founders...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {!loading && !error && founders.length === 0 && (
        <div className="empty-state">
          <Users className="empty-icon" strokeWidth={1.5} />
          <h3 className="empty-title">No founders found</h3>
          <p className="empty-description">Check back soon!</p>
        </div>
      )}

      {!loading && !error && founders.length > 0 && (
        <div className="grid-3" data-testid="founders-grid">
          {founders.map((founder) => {
            const name = founder.user?.full_name ?? 'Founder'
            return (
              <Link
                key={founder.id}
                to={`/app/founders/${founder.id}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                data-testid={`founder-card-${founder.id}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="avatar">
                    {founder.user?.avatar_url ? (
                      <img src={founder.user.avatar_url} alt={name} />
                    ) : (
                      getInitials(name)
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </div>
                  </div>
                </div>

                {founder.headline && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {founder.headline}
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {founder.location && (
                    <span className="tag">
                      <MapPin style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                      {founder.location}
                    </span>
                  )}
                  {founder.current_stage && (
                    <span className="tag">
                      <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                      {founder.current_stage}
                    </span>
                  )}
                  {founder.fundraising_status && (
                    <span className="badge warning">{founder.fundraising_status}</span>
                  )}
                </div>

                <hr className="divider" />

                <button
                  type="button"
                  className="btn-sm ghost"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={(e) => handleStartChat(e, founder)}
                  data-testid={`chat-founder-${founder.id}`}
                >
                  <MessageCircle style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Start Chat
                </button>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
