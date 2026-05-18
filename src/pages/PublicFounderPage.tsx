import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Linkedin, Twitter, Globe, MapPin, TrendingUp, UserPlus, UserCheck,
  MessageCircle, Handshake, Users, Calendar, BadgeCheck, Building2, Rocket,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fetchConnectionStatuses, type ConnectionStatus } from '../lib/connections'
import { parseSlugId, buildProfileUrl } from '../lib/slugId'
import { PageHead } from '../components/PageHead'
import { JsonLd } from '../components/JsonLd'
import { StartDealRoomModal } from '../components/StartDealRoomModal'
import { ProfilePosts } from '../components/ProfilePosts'
import { DetailPageSkeleton } from '../components/skeletons'

type PublicFounder = {
  id: string
  slug: string
  headline: string
  bio: string
  location: string
  current_stage: string
  fundraising_status: string
  skills: string[]
  linkedin_url: string | null
  twitter_url: string | null
  website_url: string | null
  profile_photo: string | null
  profile_created_year: number | null
  user: {
    id: string
    full_name: string
    avatar_url: string | null
    connection_count: number
    league: string | null
    joined_year: number | null
  }
  startups: Array<{
    id: string
    slug: string
    name: string
    tagline: string
    industry: string
    stage: string | null
    logo_url: string | null
    location: string | null
    fundraising_status: string | null
    hiring_status: boolean | null
    verification_tier: number | null
  }>
  startup_count: number
}

const SITE_URL = 'https://www.founderslib.in'

// Inline icon link style — small circular hover affordance for social/web
// links sitting next to a profile name. Matches PublicStartupPage and
// PublicInvestorPage; intentionally duplicated rather than lifted, since
// it's 4 properties and lives next to its consumers.
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
 * Founder profile page — one URL for anon + signed-in viewers.
 *
 * Anon flow: fetch `/api/v1/public/founders/<slug>/` only. Page renders
 * the SEO-indexable public shape.
 *
 * Signed-in flow: same public fetch (sets the structured-data + most of
 * the visible content), then optionally enriches with connection status
 * and exposes Connect / Chat affordances.
 *
 * URL pattern is `<slug>-<short-uuid>`. The slug part drives the public
 * fetch (backend key is slug). The short-uuid is just decorative for
 * permanence (slug can change; suffix doesn't).
 *
 * Still JS-rendered. Google's second-pass crawler picks it up after a
 * few hours/days; ChatGPT and Perplexity see only the shell until we
 * add prerendering. Tracking that as Phase B6.
 */
export function PublicFounderPage() {
  const { slugId } = useParams<{ slugId: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { pushToast } = useToast()
  const [data, setData] = useState<PublicFounder | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [dealRoomOpen, setDealRoomOpen] = useState(false)

  // Pull the slug out of `<slug>-<short-uuid>`. The short-uuid is for
  // permanence (lets us rename slugs without breaking links); only the
  // slug part is needed to hit the slug-keyed public endpoint.
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
        const res = await apiRequest<PublicFounder>(`/public/founders/${slug}/`)
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

  // Canonicalize the URL once we know the founder's name. Visitors
  // arriving via /founders/<bare-uuid> (from a notification deep-link
  // or stale bookmark) get bumped to /founders/<slug>-founder-<half-uuid>
  // via history.replaceState — no new history entry, back button stays
  // intuitive.
  useEffect(() => {
    if (!data) return
    const display = data.user?.full_name ?? data.slug
    const canonical = buildProfileUrl('founders', display, data.id)
    if (canonical && window.location.pathname !== canonical) {
      window.history.replaceState({}, '', canonical)
    }
  }, [data])

  // Pre-populate the Connect button state once we know who we're viewing.
  useEffect(() => {
    const targetUserId = data?.user?.id
    if (!targetUserId || !currentUser?.id) return
    fetchConnectionStatuses(currentUser.id)
      .then((statuses) => { setConnectionStatus(statuses.get(targetUserId) ?? null) })
      .catch(() => {})
  }, [data?.user?.id, currentUser?.id])

  const handleConnect = async () => {
    const targetUserId = data?.user?.id
    if (!targetUserId) return
    setConnecting(true)
    try {
      await apiRequest('/connections/send/', { method: 'POST', body: { user_id: targetUserId } })
      setConnectionStatus('pending')
      pushToast('Connection request sent!', 'success')
    } catch (err: unknown) {
      const msg = (err as { details?: { detail?: string } })?.details?.detail ?? 'Failed to send request.'
      pushToast(msg, 'error')
    } finally {
      setConnecting(false)
    }
  }

  const handleChat = () => {
    const targetUserId = data?.user?.id
    if (!targetUserId || !data) return
    navigate(`/app/chat?newChat=${targetUserId}&name=${encodeURIComponent(data.user.full_name)}`)
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
          title="Founder not found"
          description="This founder profile is private or doesn't exist."
          path={`/founders/${slugId ?? ''}`}
          noindex
        />
        <section className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold mb-3">Founder not found</h1>
          <p style={{ color: 'hsl(var(--muted-foreground))' }} className="mb-6">
            This profile is either private or doesn't exist.
          </p>
          <Link to="/" className="btn primary">Back to FoundersLib</Link>
        </section>
      </>
    )
  }

  const fullName = data.user.full_name
  const description = data.bio || data.headline || `${fullName} on FoundersLib`
  const truncatedDescription = description.slice(0, 155)
  // Canonical URL always carries the slug+short-uuid suffix even if the
  // user reached us via a slug-only legacy URL. Keeps Google's index
  // pointing at the durable form so it doesn't lose history on renames.
  const path = buildProfileUrl('founders', data.slug, data.id)
  const canonicalUrl = `${SITE_URL}${path}`
  const isOwnProfile = currentUser?.id === data.user.id
  // Only investors (or both-role users) can start a deal room. Backend
  // enforces the same gate via ExpressInterestView — this just hides a
  // button that would otherwise return 403 for plain-founder viewers.
  const viewerCanStartDealRoom =
    !!currentUser
    && !isOwnProfile
    && (currentUser.role === 'investor' || currentUser.role === 'both')
    && data.startups.length > 0
  const dealRoomTargets = data.startups.map((s) => ({
    id: s.id,
    name: s.name,
    hint: [s.industry, s.stage].filter(Boolean).join(' · ') || undefined,
  }))

  // JSON-LD Person schema — Google uses this for rich knowledge-panel
  // results. We pair it with an affiliation pointer back to the org
  // (FoundersLib itself) so the connection between this person and the
  // platform shows up to AI search engines.
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: fullName,
    description: data.headline,
    url: canonicalUrl,
    image: data.user.avatar_url ?? undefined,
    sameAs: [data.linkedin_url, data.twitter_url, data.website_url].filter(Boolean),
    homeLocation: data.location ? { '@type': 'Place', name: data.location } : undefined,
    affiliation: { '@type': 'Organization', name: 'FoundersLib', url: SITE_URL },
  }

  return (
    <section
      className="max-w-3xl mx-auto px-6 py-12 flex flex-col"
      // Anonymous viewers see the CTA footer pinned to the bottom of the
      // viewport, which needs a 100vh min-height. Signed-in viewers don't
      // get the footer, AND they're inside AppShell which already provides
      // header chrome — forcing 100vh there would create scroll on short
      // profiles. So apply 100vh only when anon.
      style={currentUser ? undefined : { minHeight: '100vh' }}
      data-testid="public-founder-page"
    >
      <PageHead
        title={`${fullName} — ${data.headline}`}
        description={truncatedDescription}
        path={path}
        image={data.user.avatar_url ?? undefined}
      />
      <JsonLd data={personSchema} />

      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          {(data.profile_photo || data.user.avatar_url) ? (
            <img
              src={data.profile_photo || data.user.avatar_url || ''}
              alt={fullName}
              className="rounded-full"
              style={{ width: '5rem', height: '5rem', objectFit: 'cover' }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center font-bold text-2xl"
              style={{
                width: '5rem', height: '5rem',
                background: 'var(--gold)', color: '#000',
              }}
            >
              {fullName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold inline-flex items-center gap-2 flex-wrap">
              {fullName}
              {data.user.league ? (
                <span
                  className="badge"
                  style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  title={`${data.user.league} league`}
                >
                  {data.user.league}
                </span>
              ) : null}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {data.headline}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {data.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {data.location}
                </span>
              ) : null}
              {data.fundraising_status && data.fundraising_status !== 'not_raising' ? (
                <span
                  className="badge inline-flex items-center gap-1"
                  style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}
                >
                  <TrendingUp className="w-3 h-3" />
                  {data.fundraising_status === 'raising' ? 'Raising' : 'Round closed'}
                  {data.current_stage ? ` · ${data.current_stage}` : ''}
                </span>
              ) : data.current_stage ? (
                <span className="badge">{data.current_stage}</span>
              ) : null}
              {data.user.connection_count > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {data.user.connection_count} connection{data.user.connection_count === 1 ? '' : 's'}
                </span>
              ) : null}
              {data.user.joined_year ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Joined {data.user.joined_year}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right cluster: social icons (always) + auth-only actions (signed-in
            non-self viewers). Column layout so icons sit above the buttons
            when both render; on mobile flex-wrap drops the cluster below. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
          {(data.website_url || data.linkedin_url || data.twitter_url) ? (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {data.website_url ? (
                <a
                  href={data.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Website"
                  title={data.website_url}
                  style={iconLinkStyle}
                  data-testid="founder-website-icon"
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
                  data-testid="founder-linkedin-icon"
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
                  data-testid="founder-twitter-icon"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              ) : null}
            </div>
          ) : null}
        {currentUser && !isOwnProfile ? (
          <div className="flex items-center gap-2 flex-wrap" style={{ justifyContent: 'flex-end' }}>
            {viewerCanStartDealRoom ? (
              <button
                type="button"
                className="btn-sm ghost"
                style={{ color: 'var(--gold)' }}
                onClick={() => setDealRoomOpen(true)}
                title="Start a private workspace with chat, calls, documents, and a mutual-consent workflow"
                data-testid="start-deal-room-btn"
              >
                <Handshake className="w-3.5 h-3.5" />
                Deal room
              </button>
            ) : null}
            <button
              type="button"
              className="btn-sm ghost"
              onClick={handleChat}
              data-testid="chat-founder-btn"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </button>
            {connectionStatus === 'accepted' ? (
              <span
                className="btn-sm ghost"
                style={{ cursor: 'default', color: 'var(--gold)' }}
                data-testid="founder-connected-badge"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Connected
              </span>
            ) : (
              <button
                type="button"
                className="btn-sm primary"
                disabled={connecting || connectionStatus === 'pending'}
                onClick={() => void handleConnect()}
                data-testid="connect-founder-btn"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {connecting ? 'Sending...' : connectionStatus === 'pending' ? 'Requested' : 'Connect'}
              </button>
            )}
          </div>
        ) : null}
        </div>
      </header>

      {data.bio ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            About
          </h2>
          <p className="text-base leading-relaxed">{data.bio}</p>
        </section>
      ) : null}

      {data.skills.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.skills.map((s) => (
              <span key={s} className="badge">{s}</span>
            ))}
          </div>
        </section>
      ) : null}

      {data.startups.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 inline-flex items-center gap-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <Rocket className="w-3.5 h-3.5" />
            Building
            <span className="badge" style={{ fontSize: '0.7rem' }}>{data.startup_count}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.startups.map((s) => (
              <Link
                key={s.slug}
                to={buildProfileUrl('startups', s.slug, s.id)}
                className="card"
                style={{
                  display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                  textDecoration: 'none', padding: '1rem',
                }}
              >
                {s.logo_url ? (
                  <img
                    src={s.logo_url}
                    alt={`${s.name} logo`}
                    style={{
                      width: 44, height: 44, borderRadius: '0.5rem',
                      objectFit: 'cover', flexShrink: 0,
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 44, height: 44, borderRadius: '0.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'hsl(var(--muted))', flexShrink: 0,
                    color: 'hsl(var(--muted-foreground))',
                  }}>
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="font-semibold mb-1 inline-flex items-center gap-2 flex-wrap">
                    {s.name}
                    {s.verification_tier && s.verification_tier > 0 ? (
                      <BadgeCheck
                        className="w-4 h-4"
                        style={{ color: 'var(--gold)', flexShrink: 0 }}
                        aria-label="Verified"
                      />
                    ) : null}
                  </h3>
                  {s.tagline ? (
                    <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {s.tagline}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {s.industry ? <span className="badge">{s.industry}</span> : null}
                    {s.stage ? <span className="badge">{s.stage}</span> : null}
                    {s.fundraising_status && s.fundraising_status !== 'not_raising' ? (
                      <span
                        className="badge"
                        style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}
                      >
                        {s.fundraising_status === 'raising' ? 'Raising' : 'Round closed'}
                      </span>
                    ) : null}
                    {s.hiring_status ? (
                      <span
                        className="badge"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}
                      >
                        Hiring
                      </span>
                    ) : null}
                    {s.location ? (
                      <span className="inline-flex items-center gap-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        <MapPin className="w-3 h-3" />
                        {s.location}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <ProfilePosts founderUserId={data.user.id} />

      {/* Social/web links moved inline next to the founder name in the header. */}

      {viewerCanStartDealRoom ? (
        <StartDealRoomModal
          open={dealRoomOpen}
          onClose={() => setDealRoomOpen(false)}
          targets={dealRoomTargets}
          contextLine={`Engaging with ${fullName}`}
        />
      ) : null}

      {/* CTA footer for anonymous visitors only — signed-in users already
          have the platform open and don't need a sign-up nudge. mt-auto
          pushes the strip to the bottom of the viewport when the profile
          content is short. */}
      {currentUser ? null : (
        <footer
          className="mt-auto pt-8 border-t text-center text-sm"
          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
        >
          Profile on{' '}
          <Link to="/" style={{ color: 'var(--gold)' }}>FoundersLib</Link>
          {' · '}
          <Link to="/signup" style={{ color: 'var(--gold)' }}>Join the network</Link>
        </footer>
      )}
    </section>
  )
}
