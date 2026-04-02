import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, MapPin, TrendingUp, MessageCircle, Search, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { resolveMediaUrl } from '../lib/env'
import { formatLabel } from '../lib/format'
import type { FounderProfile } from '../types/founder'

export function FoundersListPage() {
  const [founders, setFounders] = useState<FounderProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
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
    const userId = founder.user?.id || founder.id
    navigate(`/app/chat?newChat=${userId}&name=${encodeURIComponent(founder.user?.full_name || 'Founder')}`)
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const getAvatarUrl = (founder: FounderProfile) =>
    resolveMediaUrl(
      founder.user?.avatar_url ??
      founder.user?.avatar ??
      founder.user?.picture ??
      founder.profile_photo,
    )

  const getBannerUrl = (founder: FounderProfile) =>
    resolveMediaUrl(
      founder.user?.background_image ??
      founder.user?.background_picture,
    )

  const filtered = founders.filter((f) => {
    if (!search) return true
    const q = search.toLowerCase()
    return [
      f.user?.full_name,
      f.headline,
      f.location,
      f.current_stage,
      f.fundraising_status,
      ...(f.skills ?? []),
    ].some((v) => (v ?? '').toLowerCase().includes(q))
  })

  return (
    <div data-testid="founders-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Founders
            {!loading && !error && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {search ? `${filtered.length} / ${founders.length}` : founders.length}
              </span>
            )}
          </h1>
          <p className="page-description">Browse founder profiles and reach out with context.</p>
        </div>
      </div>

      {/* Search */}
      {!loading && !error && founders.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
          <Search size={15} strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
          <input
            className="input"
            type="text"
            placeholder="Search by name, location, stage, skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38, paddingRight: search ? 36 : undefined }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2, display: 'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

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

      {!loading && !error && founders.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <Users className="empty-icon" strokeWidth={1.5} />
          <h3 className="empty-title">No results</h3>
          <p className="empty-description">Try a different search term.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid-3" data-testid="founders-grid">
          {filtered.map((founder) => {
            const name = founder.user?.full_name ?? 'Founder'
            const avatarUrl = getAvatarUrl(founder)
            const bannerUrl = getBannerUrl(founder)

            return (
              <Link
                key={founder.id}
                to={`/app/founders/${founder.id}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: 0, overflow: 'hidden' }}
                data-testid={`founder-card-${founder.id}`}
              >
                {/* Banner */}
                <div
                  style={{
                    height: '80px',
                    background: bannerUrl
                      ? `url(${bannerUrl}) center/cover no-repeat`
                      : 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--border)) 100%)',
                    position: 'relative',
                  }}
                />

                {/* Avatar — overlaps banner */}
                <div style={{ padding: '0 1rem', position: 'relative' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      border: '3px solid hsl(var(--card))',
                      background: 'hsl(var(--muted))',
                      overflow: 'hidden',
                      marginTop: '-28px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      getInitials(name)
                    )}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '0.5rem 1rem 1rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.125rem' }}>
                    {name}
                  </div>

                  {founder.headline && (
                    <p style={{
                      fontSize: '0.8125rem',
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

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    {founder.location && (
                      <span className="tag">
                        <MapPin style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                        {founder.location}
                      </span>
                    )}
                    {founder.current_stage && (
                      <span className="tag">
                        <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                        {formatLabel(founder.current_stage)}
                      </span>
                    )}
                    {founder.fundraising_status && (
                      <span className="badge warning">{formatLabel(founder.fundraising_status)}</span>
                    )}
                  </div>

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
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
