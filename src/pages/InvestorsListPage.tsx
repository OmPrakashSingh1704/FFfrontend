import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, MapPin, Building2, MessageCircle, Search, X, UserPlus, UserCheck } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { resolveMediaUrl } from '../lib/env'
import { formatLabel } from '../lib/format'
import { Pagination } from '../components/Pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { fetchConnectedUserIds } from '../lib/connections'
import type { InvestorProfile } from '../types/investor'

const PAGE_SIZE = 20

type PaginatedResponse = { count: number; next: string | null; previous: string | null; results: InvestorProfile[] }

export function InvestorsListPage() {
  const { pushToast } = useToast()
  const { user: currentUser } = useAuth()
  const [investors, setInvestors] = useState<InvestorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [requested, setRequested] = useState<Set<string>>(new Set())
  const [pendingConnect, setPendingConnect] = useState<InvestorProfile | null>(null)

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
        const data = await apiRequest<PaginatedResponse>(`/investors/?${params}`)
        if (!cancelled) {
          setInvestors(data.results ?? [])
          setTotalCount(data.count ?? 0)
        }
      } catch {
        if (!cancelled) setError('Unable to load investors.')
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

  const handleConnectDirect = async (investor: InvestorProfile) => {
    const userId = investor.user?.id
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

  const handleConnectClick = (e: React.MouseEvent, investor: InvestorProfile) => {
    e.preventDefault()
    e.stopPropagation()
    setPendingConnect(investor)
  }

  const handleStartChat = (e: React.MouseEvent, investor: InvestorProfile) => {
    e.preventDefault()
    e.stopPropagation()
    const userId = investor.user?.id || investor.id
    navigate(`/app/chat?newChat=${userId}&name=${encodeURIComponent(investor.display_name || 'Investor')}`)
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const getAvatarUrl = (investor: InvestorProfile) =>
    resolveMediaUrl(
      investor.user?.avatar_url ??
      investor.user?.avatar ??
      investor.user?.picture ??
      investor.profile_photo,
    )

  const getBannerUrl = (investor: InvestorProfile) =>
    resolveMediaUrl(
      investor.user?.background_image ??
      investor.user?.background_picture,
    )

  return (
    <div data-testid="investors-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Investors
            {!loading && !error && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {totalCount}
              </span>
            )}
          </h1>
          <p className="page-description">Discover investors and their focus areas.</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={15} strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
        <input
          className="input"
          type="text"
          placeholder="Search by name, fund, location, stage, industry…"
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
          <TrendingUp className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading investors...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {!loading && !error && investors.length === 0 && (
        <div className="empty-state">
          <TrendingUp className="empty-icon" strokeWidth={1.5} />
          <h3 className="empty-title">{search ? 'No results' : 'No investors found'}</h3>
          <p className="empty-description">{search ? 'Try a different search term.' : 'Check back soon!'}</p>
        </div>
      )}

      {!loading && !error && investors.length > 0 && (
        <>
          <div className="grid-3" data-testid="investors-grid">
            {investors.map((investor) => {
              const name = investor.display_name || investor.user?.full_name || 'Investor'
              const avatarUrl = getAvatarUrl(investor)
              const bannerUrl = getBannerUrl(investor)

              return (
                <Link
                  key={investor.id}
                  to={`/app/investors/${investor.id}`}
                  className="card"
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: 0, overflow: 'hidden' }}
                  data-testid={`investor-card-${investor.id}`}
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
                      {investor.is_verified && (
                        <span style={{ marginLeft: '0.25rem', color: '#3b82f6', fontSize: '0.75rem' }}>✓</span>
                      )}
                    </div>

                    {(investor.headline || investor.investment_thesis) && (
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
                        {investor.headline || investor.investment_thesis}
                      </p>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                      {investor.fund_name && (
                        <span className="tag">
                          <Building2 style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                          {investor.fund_name}
                        </span>
                      )}
                      {investor.location && (
                        <span className="tag">
                          <MapPin style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                          {investor.location}
                        </span>
                      )}
                      {investor.investor_type && (
                        <span className="tag">
                          <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                          {formatLabel(investor.investor_type)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        type="button"
                        className="btn-sm ghost"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={(e) => handleStartChat(e, investor)}
                        data-testid={`chat-investor-${investor.id}`}
                      >
                        <MessageCircle style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                        Chat
                      </button>
                      {investor.user?.id && investor.user.id !== currentUser?.id && (
                        <button
                          type="button"
                          className="btn-sm ghost"
                          style={{ flex: 1, justifyContent: 'center' }}
                          disabled={connecting === investor.user.id || requested.has(investor.user.id)}
                          onClick={(e) => handleConnectClick(e, investor)}
                          data-testid={`connect-investor-${investor.id}`}
                        >
                          <UserPlus style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                          {connecting === investor.user.id ? '...' : requested.has(investor.user.id) ? 'Requested' : 'Connect'}
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
                onClick={() => { const inv = pendingConnect; setPendingConnect(null); navigate('/app/intros', { state: { openForm: true, target_user_id: inv?.user?.id ? String(inv.user.id) : undefined } }) }}>
                <UserCheck size={20} strokeWidth={1.5} />
                <span style={{ fontWeight: 600 }}>Warm Introduction</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.85 }}>Include your pitch and why you're a fit</span>
              </button>
              <button type="button" className="btn"
                style={{ flexDirection: 'column', height: 'auto', padding: '1rem', gap: '0.5rem', textAlign: 'center', background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                onClick={() => { const inv = pendingConnect; setPendingConnect(null); void handleConnectDirect(inv) }}>
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
