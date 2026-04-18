import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, MapPin, TrendingUp, MessageCircle, Search, X, UserPlus } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { resolveMediaUrl } from '../lib/env'
import { formatLabel } from '../lib/format'
import { Pagination } from '../components/Pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { fetchConnectedUserIds } from '../lib/connections'
import type { FounderProfile } from '../types/founder'

const PAGE_SIZE = 20

type PaginatedResponse = { count: number; next: string | null; previous: string | null; results: FounderProfile[] }

export function FoundersListPage() {
  const { pushToast } = useToast()
  const { user: currentUser } = useAuth()
  const [founders, setFounders] = useState<FounderProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [requested, setRequested] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (currentUser?.id) {
      fetchConnectedUserIds(currentUser.id).then(setRequested).catch(() => {})
    }
  }, [currentUser?.id])
  const searchTimer = useRef<number | null>(null)
  const navigate = useNavigate()

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ page: String(page) })
        if (search) params.set('search', search)
        const data = await apiRequest<PaginatedResponse>(`/founders/?${params}`)
        if (!cancelled) {
          setFounders(data.results ?? [])
          setTotalCount(data.count ?? 0)
        }
      } catch {
        if (!cancelled) setError('Unable to load founders.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [page, search])

  const handleSearchChange = (value: string) => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }

  const handleConnect = async (e: React.MouseEvent, founder: FounderProfile) => {
    e.preventDefault()
    e.stopPropagation()
    const userId = founder.user?.id
    if (!userId) return
    setConnecting(userId)
    try {
      await apiRequest('/connections/send/', { method: 'POST', body: { user_id: userId } })
      setRequested((prev) => new Set(prev).add(userId))
      pushToast('Connection request sent!', 'success')
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? 'Failed to send request.'
      pushToast(msg, 'error')
    } finally {
      setConnecting(null)
    }
  }

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

  return (
    <div data-testid="founders-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Founders
            {!loading && !error && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {totalCount}
              </span>
            )}
          </h1>
          <p className="page-description">Browse founder profiles and reach out with context.</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={15} strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
        <input
          className="input"
          type="text"
          placeholder="Search by name, location, stage, skills…"
          defaultValue={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ paddingLeft: 38, paddingRight: search ? 36 : undefined }}
        />
        {search && (
          <button onClick={() => { setSearch(''); setPage(1) }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2, display: 'flex' }}>
            <X size={14} />
          </button>
        )}
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
          <h3 className="empty-title">{search ? 'No results' : 'No founders found'}</h3>
          <p className="empty-description">{search ? 'Try a different search term.' : 'Check back soon!'}</p>
        </div>
      )}

      {!loading && !error && founders.length > 0 && (
        <>
          <div className="grid-3" data-testid="founders-grid">
            {founders.map((founder) => {
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
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
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

                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        type="button"
                        className="btn-sm ghost"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={(e) => handleStartChat(e, founder)}
                        data-testid={`chat-founder-${founder.id}`}
                      >
                        <MessageCircle style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                        Chat
                      </button>
                      {founder.user?.id && founder.user.id !== currentUser?.id && (
                        <button
                          type="button"
                          className="btn-sm ghost"
                          style={{ flex: 1, justifyContent: 'center' }}
                          disabled={connecting === founder.user.id || requested.has(founder.user.id)}
                          onClick={(e) => void handleConnect(e, founder)}
                          data-testid={`connect-founder-${founder.id}`}
                        >
                          <UserPlus style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                          {connecting === founder.user.id ? '...' : requested.has(founder.user.id) ? 'Requested' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
