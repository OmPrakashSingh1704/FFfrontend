import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, MapPin, TrendingUp, MessageCircle, Search, X, UserPlus, UserCheck } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { resolveMediaUrl } from '../lib/env'
import { formatLabel } from '../lib/format'
import { Pagination } from '../components/Pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { fetchConnectionStatuses, type ConnectionStatus } from '../lib/connections'
import { buildProfileUrl } from '../lib/slugId'
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
  const [statuses, setStatuses] = useState<Map<string, ConnectionStatus>>(new Map())
  const [pendingConnect, setPendingConnect] = useState<FounderProfile | null>(null)

  useEffect(() => {
    if (currentUser?.id) {
      fetchConnectionStatuses(currentUser.id).then(setStatuses).catch(() => {})
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

  const handleConnectDirect = async (founder: FounderProfile) => {
    const userId = founder.user?.id
    if (!userId) return
    setConnecting(userId)
    try {
      await apiRequest('/connections/send/', { method: 'POST', body: { user_id: userId } })
      setStatuses((prev) => {
        const next = new Map(prev)
        next.set(userId, 'pending')
        return next
      })
      pushToast('Connection request sent!', 'success')
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? 'Failed to send request.'
      pushToast(msg, 'error')
    } finally {
      setConnecting(null)
    }
  }

  const handleConnectClick = (e: React.MouseEvent, founder: FounderProfile) => {
    e.preventDefault()
    e.stopPropagation()
    setPendingConnect(founder)
  }

  const handleStartChat = (e: React.MouseEvent, founder: FounderProfile) => {
    e.preventDefault()
    e.stopPropagation()
    // Use the User UUID, NOT the FounderProfile row UUID (`founder.id`).
    // Chat / DM creation expects User PK; falling back to founder.id 404s
    // with "User not found" because that ID isn't in the User table.
    const userId = founder.user?.id
    if (!userId) {
      pushToast('This founder has no associated user account.', 'error')
      return
    }
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
                  to={buildProfileUrl('founders', founder.user?.full_name, founder.id)}
                  className="card"
                  // Flex column with full height so the action row gets pushed
                  // to the bottom via mt-auto. Without this, cards in the grid
                  // have varying button-row positions depending on whether the
                  // founder has a long headline + many tags.
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    padding: 0,
                    overflow: 'hidden',
                  }}
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

                  {/* Content — flex column so the action row at the bottom
                      can use mt-auto to anchor to the card footer. */}
                  <div style={{
                    padding: '0.5rem 1rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                  }}>
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

                    <div
                      // Card footer: pinned to the bottom regardless of how
                      // much content is above. The thin top border + slight
                      // padding visually separates actions from info.
                      style={{
                        display: 'flex',
                        gap: '0.375rem',
                        marginTop: 'auto',
                        paddingTop: '0.625rem',
                        borderTop: '1px solid hsl(var(--border))',
                      }}
                    >
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
                      {founder.user?.id && founder.user.id !== currentUser?.id && (() => {
                        const status = statuses.get(founder.user.id)
                        if (status === 'accepted') {
                          return (
                            <span
                              className="btn-sm ghost"
                              style={{ flex: 1, justifyContent: 'center', cursor: 'default', color: 'var(--gold)' }}
                              data-testid={`founder-connected-${founder.id}`}
                            >
                              <UserCheck style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                              Connected
                            </span>
                          )
                        }
                        return (
                          <button
                            type="button"
                            className="btn-sm ghost"
                            style={{ flex: 1, justifyContent: 'center' }}
                            disabled={connecting === founder.user.id || status === 'pending'}
                            onClick={(e) => handleConnectClick(e, founder)}
                            data-testid={`connect-founder-${founder.id}`}
                          >
                            <UserPlus style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                            {connecting === founder.user.id ? '...' : status === 'pending' ? 'Requested' : 'Connect'}
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {/* Connect prompt */}
      {pendingConnect && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setPendingConnect(null) }}>
          <div className="card" style={{ width: '100%', maxWidth: '30rem' }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>How would you like to connect?</h2>
              <button type="button" className="btn-sm ghost" onClick={() => setPendingConnect(null)}><X size={16} /></button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem' }}>
              A Warm Introduction carries context about who you are and why you want to connect — it gets accepted far more often than a cold request.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button type="button" className="btn primary"
                style={{ flexDirection: 'column', height: 'auto', padding: '1rem', gap: '0.5rem', textAlign: 'center' }}
                onClick={() => { const f = pendingConnect; setPendingConnect(null); navigate('/app/intros', { state: { openForm: true, target_user_id: f?.user?.id ? String(f.user.id) : undefined } }) }}>
                <UserCheck size={20} strokeWidth={1.5} />
                <span style={{ fontWeight: 600 }}>Warm Introduction</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.85 }}>Include your pitch and why you're a fit</span>
              </button>
              <button type="button" className="btn"
                style={{ flexDirection: 'column', height: 'auto', padding: '1rem', gap: '0.5rem', textAlign: 'center', background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                onClick={() => { const f = pendingConnect; setPendingConnect(null); void handleConnectDirect(f) }}>
                <UserPlus size={20} strokeWidth={1.5} />
                <span style={{ fontWeight: 600 }}>Connection Request</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.7 }}>Quick request with an optional note</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
