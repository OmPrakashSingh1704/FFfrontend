import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Building2,
  DollarSign,
  Globe,
  Linkedin,
  ExternalLink,
  User,
  Target,
  Layers,
  Handshake,
  Loader2,
  X,
  UserPlus,
  UserCheck,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { fetchConnectedUserIds } from '../lib/connections'
import { resolveMediaUrl } from '../lib/env'
import { formatLabel } from '../lib/format'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { normalizeList } from '../lib/pagination'
import type { InvestorProfile } from '../types/investor'
import type { StartupListItem } from '../types/startup'

export function InvestorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { pushToast } = useToast()
  const [investor, setInvestor] = useState<InvestorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isFounder = user?.role === 'founder' || user?.role === 'both'
  const [myStartups, setMyStartups] = useState<StartupListItem[]>([])
  const [showInterestForm, setShowInterestForm] = useState(false)
  const [selectedStartupId, setSelectedStartupId] = useState('')
  const [interestMessage, setInterestMessage] = useState('')
  const [expressing, setExpressing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [requested, setRequested] = useState(false)
  const [showConnectPrompt, setShowConnectPrompt] = useState(false)

  // Pre-populate button state after investor loads
  useEffect(() => {
    const targetId = investor?.user?.id
    if (!targetId || !user?.id) return
    fetchConnectedUserIds(user.id)
      .then((ids) => { if (ids.has(targetId)) setRequested(true) })
      .catch(() => {})
  }, [investor?.user?.id, user?.id])

  const handleConnectDirect = async () => {
    const userId = investor?.user?.id
    if (!userId) return
    setConnecting(true)
    try {
      await apiRequest('/connections/send/', { method: 'POST', body: { user_id: userId } })
      setRequested(true)
      pushToast('Connection request sent!', 'success')
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? 'Failed to send request.'
      pushToast(msg, 'error')
    } finally {
      setConnecting(false)
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<InvestorProfile>(`/investors/${id}/`)
        if (!cancelled) {
          setInvestor(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load investor profile.')
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
  }, [id])

  // Load founder's startups so they can pick which one to express interest from
  useEffect(() => {
    if (!isFounder) return
    apiRequest<StartupListItem[] | { results: StartupListItem[] }>('/founders/my-startups/')
      .then((data) => {
        const list = normalizeList(data)
        setMyStartups(list)
        if (list.length > 0) setSelectedStartupId(list[0].id)
      })
      .catch(() => {})
  }, [isFounder])

  const handleExpressInterest = async () => {
    if (!selectedStartupId || !id) return
    setExpressing(true)
    try {
      await apiRequest('/deals/interest/', {
        method: 'POST',
        body: { startup_id: selectedStartupId, investor_id: id, message: interestMessage },
      })
      pushToast('Interest expressed — a deal room opens when the investor reciprocates.', 'success')
      setShowInterestForm(false)
      setInterestMessage('')
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? 'Failed to express interest'
      pushToast(msg, 'error')
    } finally {
      setExpressing(false)
    }
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <Link to="/app/investors" className="back-btn" style={{ margin: 0 }}>
          <ArrowLeft style={{ width: '1rem', height: '1rem' }} strokeWidth={1.5} />
          Back to Investors
        </Link>
        {investor && <CopyLinkButton />}
      </div>

      {loading && (
        <div className="empty-state">
          <User className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading investor...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {investor && (
        <>
          {/* Profile Header */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="avatar xl">
                  {resolveMediaUrl(investor.profile_photo ?? investor.user?.picture ?? investor.user?.avatar_url) ? (
                    <img src={resolveMediaUrl(investor.profile_photo ?? investor.user?.picture ?? investor.user?.avatar_url)!} alt={investor.display_name} />
                  ) : (
                    getInitials(investor.display_name || 'I')
                  )}
                </div>
                <div>
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {investor.display_name ?? 'Investor profile'}
                  </h1>
                  {investor.headline && (
                    <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                      {investor.headline}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions — not your own profile */}
              {investor.user?.id !== user?.id && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {isFounder && myStartups.length > 0 && (
                    <button
                      className="btn-sm ghost"
                      type="button"
                      onClick={() => setShowInterestForm((v) => !v)}
                    >
                      <Handshake size={14} strokeWidth={1.5} />
                      Express Interest
                    </button>
                  )}
                  <button
                    className="btn-sm primary"
                    type="button"
                    disabled={connecting || requested}
                    onClick={() => setShowConnectPrompt(true)}
                    data-testid="connect-investor-btn"
                  >
                    <UserPlus size={14} strokeWidth={1.5} />
                    {connecting ? 'Sending...' : requested ? 'Requested' : 'Connect'}
                  </button>
                </div>
              )}
            </div>

            {/* Connect prompt */}
            {showConnectPrompt && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowConnectPrompt(false) }}>
                <div className="card" style={{ width: '100%', maxWidth: '30rem' }}>
                  <div className="card-header">
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>How would you like to connect?</h2>
                    <button type="button" className="btn-sm ghost" onClick={() => setShowConnectPrompt(false)}><X size={16} /></button>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem' }}>
                    A Warm Introduction carries context about who you are and why you want to connect — it gets accepted far more often than a cold request.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button type="button" className="btn primary"
                      style={{ flexDirection: 'column', height: 'auto', padding: '1rem', gap: '0.5rem', textAlign: 'center' }}
                      onClick={() => { setShowConnectPrompt(false); navigate('/app/intros', { state: { openForm: true, target_user_id: investor?.user?.id ? String(investor.user.id) : undefined } }) }}>
                      <UserCheck size={20} strokeWidth={1.5} />
                      <span style={{ fontWeight: 600 }}>Warm Introduction</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.85 }}>Include your pitch and why you're a fit</span>
                    </button>
                    <button type="button" className="btn"
                      style={{ flexDirection: 'column', height: 'auto', padding: '1rem', gap: '0.5rem', textAlign: 'center', background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                      onClick={() => { setShowConnectPrompt(false); void handleConnectDirect() }}>
                      <UserPlus size={20} strokeWidth={1.5} />
                      <span style={{ fontWeight: 600 }}>Connection Request</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.7 }}>Quick request with an optional note</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Inline interest form */}
            {showInterestForm && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'hsl(var(--muted))', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Express interest as</span>
                  <button className="btn-sm ghost" style={{ padding: '0.25rem' }} onClick={() => setShowInterestForm(false)}>
                    <X size={14} />
                  </button>
                </div>
                {myStartups.length > 1 && (
                  <select
                    className="select"
                    value={selectedStartupId}
                    onChange={(e) => setSelectedStartupId(e.target.value)}
                  >
                    {myStartups.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
                {myStartups.length === 1 && (
                  <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    From: <strong>{myStartups[0].name}</strong>
                  </p>
                )}
                <textarea
                  className="input"
                  placeholder="Add a message (optional)"
                  value={interestMessage}
                  onChange={(e) => setInterestMessage(e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical', fontSize: '0.8125rem' }}
                />
                <button
                  className="btn-sm primary"
                  type="button"
                  disabled={expressing || !selectedStartupId}
                  onClick={() => void handleExpressInterest()}
                >
                  {expressing ? (
                    <><Loader2 size={12} className="animate-spin" /> Sending...</>
                  ) : (
                    <><Handshake size={12} /> Send interest</>
                  )}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {investor.investor_type && (
                <span className="badge">{formatLabel(investor.investor_type)}</span>
              )}
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
            </div>
          </div>

          {/* Details Section */}
          <div className="section">
            <div className="card">
              <div className="grid-2">
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Type
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{formatLabel(investor.investor_type) || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Fund
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{investor.fund_name || 'Independent'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <DollarSign style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Check Size
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>
                    {investor.check_size_min || investor.check_size_max
                      ? `$${investor.check_size_min ?? '\u2014'} - $${investor.check_size_max ?? '\u2014'}`
                      : 'Not specified'}
                  </p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Location
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{investor.location || 'Not shared'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Industries Focus */}
          {investor.industries_focus && investor.industries_focus.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Target style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Industries
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {investor.industries_focus.map((industry) => (
                    <span key={industry} className="tag">
                      {formatLabel(industry)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stages Focus */}
          {investor.stages_focus && investor.stages_focus.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Stages
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {investor.stages_focus.map((stage) => (
                    <span key={stage} className="tag">
                      {formatLabel(stage)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Links Section */}
          {(investor.linkedin_url || investor.website_url) && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Links
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {investor.linkedin_url && (
                    <a
                      href={investor.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                    >
                      <Linkedin style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      LinkedIn
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {investor.website_url && (
                    <a
                      href={investor.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                    >
                      <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Website
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
