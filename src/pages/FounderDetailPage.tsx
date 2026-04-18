import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, TrendingUp, ExternalLink, Linkedin, Twitter, Globe, User, Briefcase, Sparkles, UserPlus, MessageCircle } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { resolveMediaUrl } from '../lib/env'
import { formatLabel } from '../lib/format'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { fetchConnectedUserIds } from '../lib/connections'
import type { FounderProfile } from '../types/founder'

export function FounderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const { user: currentUser } = useAuth()
  const [founder, setFounder] = useState<FounderProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [requested, setRequested] = useState(false)

  // Pre-populate button state after founder loads
  useEffect(() => {
    const targetId = founder?.user?.id
    if (!targetId || !currentUser?.id) return
    fetchConnectedUserIds(currentUser.id)
      .then((ids) => { if (ids.has(targetId)) setRequested(true) })
      .catch(() => {})
  }, [founder?.user?.id, currentUser?.id])

  const handleConnect = async () => {
    const userId = founder?.user?.id
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

  const handleChat = () => {
    const userId = founder?.user?.id
    const name = founder?.user?.full_name ?? 'Founder'
    if (userId) navigate(`/app/chat?newChat=${userId}&name=${encodeURIComponent(name)}`)
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FounderProfile>(`/founders/${id}/`)
        if (!cancelled) {
          setFounder(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load founder profile.')
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div data-testid="founder-detail">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <Link to="/app/founders" className="back-btn" style={{ margin: 0 }}>
          <ArrowLeft style={{ width: '1rem', height: '1rem' }} strokeWidth={1.5} />
          Back to Founders
        </Link>
        {founder && <CopyLinkButton />}
      </div>

      {loading && (
        <div className="empty-state">
          <User className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading profile...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {founder && (
        <>
          {/* Profile Header */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="avatar xl">
                  {resolveMediaUrl(founder.profile_photo ?? founder.user?.picture ?? founder.user?.avatar_url) ? (
                    <img src={resolveMediaUrl(founder.profile_photo ?? founder.user?.picture ?? founder.user?.avatar_url)!} alt={founder.user?.full_name ?? 'Founder'} />
                  ) : (
                    getInitials(founder.user?.full_name ?? 'F')
                  )}
                </div>
                <div>
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {founder.user?.full_name ?? 'Founder profile'}
                  </h1>
                  {founder.headline && (
                    <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                      {founder.headline}
                    </p>
                  )}
                </div>
              </div>
              {founder.user?.id && founder.user.id !== currentUser?.id && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button type="button" className="btn-sm ghost" onClick={handleChat} data-testid="chat-founder-btn">
                    <MessageCircle size={14} strokeWidth={1.5} />
                    Chat
                  </button>
                  <button type="button" className="btn-sm primary" disabled={connecting || requested} onClick={() => void handleConnect()} data-testid="connect-founder-btn">
                    <UserPlus size={14} strokeWidth={1.5} />
                    {connecting ? 'Sending...' : requested ? 'Requested' : 'Connect'}
                  </button>
                </div>
              )}
            </div>

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
                  {formatLabel(founder.current_stage)}
                </span>
              )}
              {founder.fundraising_status && (
                <span className="badge warning">{formatLabel(founder.fundraising_status)}</span>
              )}
            </div>
          </div>

          {/* Bio Section */}
          <div className="section" data-testid="founder-profile-card">
            <div className="card">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                Bio
              </div>
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
                {founder.bio || 'No bio provided yet.'}
              </p>
            </div>
          </div>

          {/* Details Section */}
          <div className="section">
            <div className="card">
              <div className="grid-2">
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Location
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{founder.location || 'Not shared'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Briefcase style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Fundraising Status
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{formatLabel(founder.fundraising_status) || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Stage
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{formatLabel(founder.current_stage) || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Skills Section */}
          {founder.skills && founder.skills.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Skills
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {founder.skills.map((skill) => (
                    <span key={skill} className="tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Links Section */}
          {(founder.linkedin_url || founder.twitter_url || founder.website_url) && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Links
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {founder.linkedin_url && (
                    <a
                      href={founder.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                    >
                      <Linkedin style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      LinkedIn
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {founder.twitter_url && (
                    <a
                      href={founder.twitter_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                    >
                      <Twitter style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Twitter
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {founder.website_url && (
                    <a
                      href={founder.website_url}
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
