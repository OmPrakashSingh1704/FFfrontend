import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Loader2, Linkedin, Twitter, Globe, MapPin, Handshake,
  FileText, BadgeCheck, Briefcase, TrendingUp, Building2,
  DollarSign, Sparkles, Upload, UserPlus, X,
} from 'lucide-react'
import { apiRequest, uploadRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { parseSlugId, buildProfileUrl } from '../lib/slugId'
import { PageHead } from '../components/PageHead'
import { JsonLd } from '../components/JsonLd'
import { StartDealRoomModal } from '../components/StartDealRoomModal'
import { ProfilePosts } from '../components/ProfilePosts'
import { DetailPageSkeleton } from '../components/skeletons'

type PublicFounder = {
  user_id: string
  full_name: string
  avatar_url: string | null
  // null when the founder has no FounderProfile, or has is_public=false.
  // In that case we render the name as plain text (no link out to a 404).
  founder_profile_slug: string | null
}

type PublicStartup = {
  // Identity
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  logo_url: string | null
  pitch_summary: string

  // Classification
  industry: string
  sub_industries: string[]
  business_model: string
  legal_structure: string
  current_stage: string | null
  product_status: string

  // Location
  headquarters_city: string
  headquarters_country: string
  operating_countries: string[]
  founded_year: number | null

  // Links
  website_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  deck_url: string | null

  // Pitch narrative
  problem_statement: string
  solution_description: string
  unique_value_proposition: string
  why_now: string

  // Public status flags
  fundraising_status: string | null
  hiring_status: boolean | null
  verification_tier: number | null

  // Historic public funding
  total_funding_raised: string | null
  currency_code: string | null

  // Marketing-safe traction
  partnerships: string[]

  // People
  founders?: PublicFounder[]

  // Viewer-scoped flags
  viewer_can_edit?: boolean
}

const SITE_URL = 'https://www.founderslib.in'

// Inline icon link style — small circular hover affordance for social/web
// links sitting next to a profile name. Shared across all three public
// profile pages; intentionally not lifted to a separate file since it's
// 4 properties and identical everywhere.
const iconLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: '999px',
  color: 'hsl(var(--muted-foreground))',
  border: '1px solid hsl(var(--border))',
  textDecoration: 'none',
  transition: 'color 0.15s, background 0.15s',
}

/**
 * Public startup profile page — SEO-indexable, no auth required.
 *
 * Uses JSON-LD Organization schema (not LocalBusiness, since the founders
 * platform isn't a directory of brick-and-mortar businesses; startups
 * usually serve a wider market than a single locality).
 */
export function PublicStartupPage() {
  const { slugId } = useParams<{ slugId: string }>()
  const { user: currentUser } = useAuth()
  const [dealRoomOpen, setDealRoomOpen] = useState(false)
  // "Request to Join" flow for non-members. Was previously only wired up
  // on the retired StartupDetailPage; ported here so the canonical public
  // route exposes it. `joinRequestSent` flips after a successful POST and
  // after the GET tells us a pending one already exists.
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [joinMessage, setJoinMessage] = useState('')
  const [joiningStartup, setJoiningStartup] = useState(false)
  const [joinRequestSent, setJoinRequestSent] = useState(false)
  const [data, setData] = useState<PublicStartup | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoHover, setLogoHover] = useState(false)
  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const { pushToast } = useToast()

  const parsed = slugId ? parseSlugId(slugId) : null
  const slug = parsed?.slug || slugId || ''

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setData(null)
    void (async () => {
      try {
        const res = await apiRequest<PublicStartup>(`/public/startups/${slug}/`)
        if (!cancelled) setData(res)
      } catch (err: unknown) {
        if (!cancelled) {
          const httpStatus = (err as { status?: number })?.status
          setNotFound(httpStatus === 404)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  // Check whether the viewer already has a pending join request. Skip if
  // they're a member (viewer_can_edit) or anon. 404 / 403 are silently
  // ignored — they just mean "no pending request" for our purposes.
  useEffect(() => {
    const startupId = data?.id
    if (!startupId || !currentUser || data?.viewer_can_edit) return
    let cancelled = false
    apiRequest<{ has_pending: boolean }>(`/founders/startups/${startupId}/join-request/`)
      .then((res) => {
        if (!cancelled && res?.has_pending) setJoinRequestSent(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [data?.id, data?.viewer_can_edit, currentUser])

  const handleJoinRequest = async () => {
    if (!data) return
    setJoiningStartup(true)
    try {
      await apiRequest(`/founders/startups/${data.id}/join-request/`, {
        method: 'POST',
        body: { message: joinMessage },
      })
      setJoinRequestSent(true)
      setShowJoinForm(false)
      setJoinMessage('')
      pushToast('Join request sent!', 'success')
    } catch (err) {
      const apiErr = err as { details?: { detail?: string; error?: string }; message?: string }
      const msg =
        apiErr?.details?.detail
        ?? apiErr?.details?.error
        ?? apiErr?.message
        ?? 'Failed to send join request'
      pushToast(msg, 'error')
    } finally {
      setJoiningStartup(false)
    }
  }

  /**
   * Inline logo upload. Backend at views.py:1144 accepts any StartupMember.
   * The public_startup view exposes `viewer_can_edit` so we can render the
   * affordance without a separate membership probe. On 200 OK we patch
   * data.logo_url optimistically — no full re-fetch needed.
   */
  const handleLogoUpload = async (file?: File | null) => {
    if (!file || !data) return
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await uploadRequest<{ logo_url: string }>(
        `/founders/startups/${data.id}/logo/`,
        formData,
      )
      setData((prev) => prev ? { ...prev, logo_url: res.logo_url } : prev)
      pushToast('Logo updated', 'success')
    } catch {
      pushToast('Logo upload failed', 'error')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
        <DetailPageSkeleton />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <>
        <PageHead
          title="Startup not found"
          description="This startup profile is private or doesn't exist."
          path={`/startups/${slugId ?? ''}`}
          noindex
        />
        <section className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold mb-3">Startup not found</h1>
          <p style={{ color: 'hsl(var(--muted-foreground))' }} className="mb-6">
            This profile is either private or doesn't exist.
          </p>
          <Link to="/" className="btn primary">Back to FoundersLib</Link>
        </section>
      </>
    )
  }

  const description = (data.tagline || data.description || data.unique_value_proposition || '').slice(0, 155)
  const path = buildProfileUrl('startups', data.slug, data.id)
  const canonicalUrl = `${SITE_URL}${path}`
  // Investors (and both-role users) can express interest in a startup; if
  // a founder of this startup tries, the backend returns 403. We gate on
  // role to keep the irrelevant button off the page for plain founders.
  const viewerCanStartDealRoom =
    !!currentUser
    && (currentUser.role === 'investor' || currentUser.role === 'both')
  const locationStr = [data.headquarters_city, data.headquarters_country].filter(Boolean).join(', ')

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    description: data.tagline || data.description,
    url: canonicalUrl,
    sameAs: [data.website_url, data.linkedin_url, data.twitter_url].filter(Boolean),
    foundingDate: data.founded_year ? String(data.founded_year) : undefined,
    address: locationStr
      ? {
          '@type': 'PostalAddress',
          addressLocality: data.headquarters_city || undefined,
          addressCountry: data.headquarters_country || undefined,
        }
      : undefined,
    industry: data.industry,
  }

  return (
    <section
      className="max-w-3xl mx-auto px-6 py-12 flex flex-col"
      // 100vh only when the CTA footer is rendered (anon viewers).
      style={currentUser ? undefined : { minHeight: '100vh' }}
      data-testid="public-startup-page"
    >
      <PageHead
        title={data.tagline ? `${data.name} — ${data.tagline}` : data.name}
        description={description || `${data.name} on FoundersLib`}
        path={path}
      />
      <JsonLd data={orgSchema} />

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div style={{ display: 'flex', gap: '1rem', minWidth: 0, alignItems: 'flex-start' }}>
          {/* Logo. Startup members get an inline upload affordance: click
              the logo (or placeholder) to open the file picker. Non-members
              and anonymous viewers just see the static image. viewer_can_edit
              comes from the public_startup endpoint and is False when the
              viewer is not a member, or not signed in. */}
          <div
            style={{
              position: 'relative',
              width: 64,
              height: 64,
              flexShrink: 0,
              cursor: data.viewer_can_edit ? 'pointer' : 'default',
            }}
            onClick={() => data.viewer_can_edit && !uploadingLogo && logoInputRef.current?.click()}
            onMouseEnter={() => data.viewer_can_edit && setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            role={data.viewer_can_edit ? 'button' : undefined}
            aria-label={data.viewer_can_edit ? 'Change startup logo' : undefined}
            data-testid={data.viewer_can_edit ? 'startup-logo-upload-trigger' : 'startup-logo'}
          >
            {data.logo_url ? (
              <img
                src={data.logo_url}
                alt={`${data.name} logo`}
                style={{
                  width: 64, height: 64, borderRadius: '0.75rem',
                  objectFit: 'cover',
                  border: '1px solid hsl(var(--border))',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: '0.75rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
              }}>
                <Building2 className="w-6 h-6" />
              </div>
            )}
            {/* Overlay for members only. Always-on when no logo (placeholder
                looks obviously editable), on hover when a logo exists,
                always while uploading (spinner). */}
            {data.viewer_can_edit && (() => {
              const visible = uploadingLogo || logoHover || !data.logo_url
              return (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.45)',
                    color: '#fff',
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 0.15s',
                    pointerEvents: 'none',
                  }}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </div>
              )
            })()}
          </div>
          {data.viewer_can_edit && (
            <input
              type="file"
              accept="image/*"
              ref={logoInputRef}
              onChange={(e) => void handleLogoUpload(e.target.files?.[0])}
              style={{ display: 'none' }}
              disabled={uploadingLogo}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="text-3xl font-semibold mb-2 inline-flex items-center gap-2 flex-wrap">
              {data.name}
              {data.verification_tier && data.verification_tier > 0 ? (
                <BadgeCheck
                  className="w-5 h-5"
                  style={{ color: 'var(--gold)' }}
                  aria-label={`Verified tier ${data.verification_tier}`}
                />
              ) : null}
            </h1>
            {data.tagline ? (
              <p className="text-lg" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {data.tagline}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {data.industry ? <span className="badge">{data.industry}</span> : null}
              {data.current_stage ? <span className="badge">{data.current_stage}</span> : null}
              {data.business_model ? <span className="badge">{data.business_model}</span> : null}
              {data.fundraising_status && data.fundraising_status !== 'not_raising' ? (
                <span className="badge" style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                  {data.fundraising_status === 'raising' ? 'Raising' : 'Round closed'}
                </span>
              ) : null}
              {data.hiring_status ? (
                <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>
                  Hiring
                </span>
              ) : null}
              {data.founded_year ? <span>Founded {data.founded_year}</span> : null}
              {locationStr ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {locationStr}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {/* Right cluster: social icons sit to the far right of the header,
            sharing the row with the Start deal room CTA. On mobile the
            whole cluster wraps below the title block. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
          {data.website_url ? (
            <a
              href={data.website_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Website"
              title={data.website_url}
              style={iconLinkStyle}
              data-testid="startup-website-icon"
            >
              <Globe className="w-4 h-4" />
            </a>
          ) : null}
          {data.linkedin_url ? (
            <a
              href={data.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              style={iconLinkStyle}
              data-testid="startup-linkedin-icon"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          ) : null}
          {data.twitter_url ? (
            <a
              href={data.twitter_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              style={iconLinkStyle}
              data-testid="startup-twitter-icon"
            >
              <Twitter className="w-4 h-4" />
            </a>
          ) : null}
          {viewerCanStartDealRoom ? (
            <button
              type="button"
              className="btn-sm primary"
              onClick={() => setDealRoomOpen(true)}
              title="Start a private workspace with chat, calls, documents, and a mutual-consent workflow"
              data-testid="start-deal-room-btn"
            >
              <Handshake className="w-3.5 h-3.5" />
              Start deal room
            </button>
          ) : null}
          {/* Request to Join — any signed-in non-member can ask to join.
              We previously also gated this on role !== 'investor' on the
              theory that investors should use "Express Interest" instead,
              but those are different actions (deal-room handshake vs.
              team membership), and an investor can validly want to join
              as an advisor or operating partner. Backend handles the
              role assignment at approval time. */}
          {currentUser && !data.viewer_can_edit ? (
            joinRequestSent ? (
              <span
                className="badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#3b82f622',
                  color: '#3b82f6',
                  border: '1px solid #3b82f644',
                }}
                data-testid="join-request-sent-badge"
              >
                <UserPlus className="w-3 h-3" />
                Request sent
              </span>
            ) : (
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => setShowJoinForm(true)}
                data-testid="join-request-btn"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Request to Join
              </button>
            )
          ) : null}
        </div>
      </header>

      {/* Inline join-request form. Rendered below the header so it doesn't
          shove the action row around on open/close. */}
      {showJoinForm ? (
        <div
          className="mb-6"
          style={{
            padding: '1rem',
            background: 'hsl(var(--muted))',
            borderRadius: 10,
            border: '1px solid hsl(var(--border))',
          }}
          data-testid="join-request-form"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Request to Join {data.name}</span>
            <button
              type="button"
              className="btn-sm ghost"
              style={{ padding: 4 }}
              onClick={() => setShowJoinForm(false)}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem' }}>
            The startup team will review your request and respond. Add a short note
            about why you want to join — it helps.
          </p>
          <textarea
            className="input"
            rows={3}
            placeholder="Why do you want to join? (optional)"
            value={joinMessage}
            onChange={(e) => setJoinMessage(e.target.value)}
            style={{ resize: 'vertical', marginBottom: '0.5rem', width: '100%' }}
            data-testid="join-message-input"
            maxLength={500}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-sm ghost"
              onClick={() => setShowJoinForm(false)}
              disabled={joiningStartup}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-sm primary"
              onClick={() => void handleJoinRequest()}
              disabled={joiningStartup}
              data-testid="join-request-submit"
            >
              {joiningStartup ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <UserPlus size={12} /> Send Request
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      {data.pitch_summary ? (
        <section
          className="mb-8"
          style={{
            padding: '1rem 1.25rem',
            borderLeft: '3px solid var(--gold)',
            background: 'hsl(var(--muted) / 0.3)',
            borderRadius: '0 0.5rem 0.5rem 0',
          }}
        >
          <p className="text-base leading-relaxed italic">{data.pitch_summary}</p>
        </section>
      ) : null}

      {data.description ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            About
          </h2>
          <p className="text-base leading-relaxed">{data.description}</p>
        </section>
      ) : null}

      {data.problem_statement ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Problem
          </h2>
          <p className="text-base leading-relaxed">{data.problem_statement}</p>
        </section>
      ) : null}

      {data.solution_description ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Solution
          </h2>
          <p className="text-base leading-relaxed">{data.solution_description}</p>
        </section>
      ) : null}

      {data.unique_value_proposition ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Unique value
          </h2>
          <p className="text-base leading-relaxed">{data.unique_value_proposition}</p>
        </section>
      ) : null}

      {data.why_now ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2 inline-flex items-center gap-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <Sparkles className="w-3.5 h-3.5" />
            Why now
          </h2>
          <p className="text-base leading-relaxed">{data.why_now}</p>
        </section>
      ) : null}

      {/* Company facts — surfaces structured details that don't deserve a full prose section.
          Each cell is conditional, so the grid only renders if at least one value exists. */}
      {(() => {
        const facts: Array<{ icon: React.ReactNode; label: string; value: string }> = []
        if (data.product_status) facts.push({ icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Product status', value: data.product_status })
        if (data.legal_structure) facts.push({ icon: <Briefcase className="w-3.5 h-3.5" />, label: 'Legal structure', value: data.legal_structure })
        if (data.total_funding_raised && Number(data.total_funding_raised) > 0) {
          const amount = Number(data.total_funding_raised)
          const formatted = amount >= 1_000_000
            ? `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`
            : amount >= 1_000
              ? `${(amount / 1_000).toFixed(0)}K`
              : amount.toString()
          facts.push({
            icon: <DollarSign className="w-3.5 h-3.5" />,
            label: 'Funding raised',
            value: `${data.currency_code ?? 'USD'} ${formatted}`,
          })
        }
        if (data.operating_countries.length > 0) {
          facts.push({
            icon: <Globe className="w-3.5 h-3.5" />,
            label: 'Operating in',
            value: data.operating_countries.join(', '),
          })
        }

        if (facts.length === 0) return null
        return (
          <section className="mb-8" data-testid="public-startup-facts">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
              At a glance
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {facts.map((f) => (
                <div
                  key={f.label}
                  style={{
                    padding: '0.875rem 1rem',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    background: 'hsl(var(--card))',
                  }}
                >
                  <div
                    className="inline-flex items-center gap-1.5 mb-1 text-xs uppercase tracking-wide"
                    style={{ color: 'hsl(var(--muted-foreground))' }}
                  >
                    {f.icon}
                    {f.label}
                  </div>
                  <div className="text-sm font-medium">{f.value}</div>
                </div>
              ))}
            </div>
          </section>
        )
      })()}

      {data.partnerships.length > 0 ? (
        <section className="mb-8" data-testid="public-startup-partnerships">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Partnerships
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.partnerships.map((p) => (
              <span key={p} className="badge">{p}</span>
            ))}
          </div>
        </section>
      ) : null}

      {data.deck_url ? (
        <section className="mb-8">
          <a
            href={data.deck_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 btn-sm ghost"
            data-testid="public-startup-deck-link"
          >
            <FileText className="w-3.5 h-3.5" />
            View pitch deck
          </a>
        </section>
      ) : null}

      {data.founders && data.founders.length > 0 ? (
        <section className="mb-8" data-testid="public-startup-founders">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Founders
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.founders.map((f) => {
              const isSelf = currentUser?.id === f.user_id
              if (isSelf) {
                return (
                  <Link
                    key={`self-${f.user_id}`}
                    to="/app/me"
                    className="badge"
                    style={{ textDecoration: 'none' }}
                    data-testid="public-founder-link-self"
                  >
                    {f.full_name} <span style={{ opacity: 0.6, fontSize: '0.75em' }}>(you)</span>
                  </Link>
                )
              }
              if (f.founder_profile_slug) {
                return (
                  <Link
                    key={f.user_id}
                    to={`/founders/${f.founder_profile_slug}`}
                    className="badge"
                    style={{ textDecoration: 'none' }}
                    data-testid={`public-founder-link-${f.user_id}`}
                  >
                    {f.full_name}
                  </Link>
                )
              }
              return (
                <span key={f.user_id} className="badge">
                  {f.full_name}
                </span>
              )
            })}
          </div>
        </section>
      ) : null}

      <ProfilePosts startupId={data.id} />

      {data.sub_industries.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.sub_industries.map((t) => <span key={t} className="badge">{t}</span>)}
          </div>
        </section>
      ) : null}

      {/* Social/web links moved inline next to the startup name in the header. */}

      {viewerCanStartDealRoom ? (
        <StartDealRoomModal
          open={dealRoomOpen}
          onClose={() => setDealRoomOpen(false)}
          targets={[{
            id: data.id,
            name: data.name,
            hint: [data.industry, data.current_stage].filter(Boolean).join(' · ') || undefined,
          }]}
        />
      ) : null}

      {/* CTA footer for anonymous visitors only. */}
      {currentUser ? null : (
        <footer
          className="mt-auto pt-8 border-t text-center text-sm"
          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
        >
          Startup on{' '}
          <Link to="/" style={{ color: 'var(--gold)' }}>FoundersLib</Link>
          {' · '}
          <Link to="/signup" style={{ color: 'var(--gold)' }}>Join the network</Link>
        </footer>
      )}
    </section>
  )
}
