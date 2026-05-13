import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2, Linkedin, Twitter, Globe, MapPin, BadgeCheck, DollarSign, UserPlus, UserCheck, MessageCircle } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fetchConnectionStatuses, type ConnectionStatus } from '../lib/connections'
import { parseSlugId, buildProfileUrl } from '../lib/slugId'
import { PageHead } from '../components/PageHead'
import { JsonLd } from '../components/JsonLd'

type PublicInvestor = {
  id: string
  slug: string
  display_name: string
  fund_name: string | null
  investor_type: string
  headline: string
  bio: string
  investment_thesis: string
  location: string
  check_size_min: number | null
  check_size_max: number | null
  stages_focus: string[]
  industries_focus: string[]
  geography_focus: string[]
  linkedin_url: string | null
  twitter_url: string | null
  website_url: string | null
  is_verified: boolean
  user: { id: string; full_name: string; avatar_url: string | null }
}

const SITE_URL = 'https://www.founderslib.in'

function formatCheckSize(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n}`
}

/**
 * Public investor profile page — SEO-indexable, no auth required.
 *
 * Backend gates on discoverability_mode='open'. selective/closed investors
 * return 404 so a probing crawler can't enumerate who has a profile.
 */
export function PublicInvestorPage() {
  const { slugId } = useParams<{ slugId: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { pushToast } = useToast()
  const [data, setData] = useState<PublicInvestor | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)

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
        const res = await apiRequest<PublicInvestor>(`/public/investors/${slug}/`)
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

  // Pre-populate Connect button state for authed viewers
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
    navigate(`/app/chat?newChat=${targetUserId}&name=${encodeURIComponent(data.display_name)}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <>
        <PageHead
          title="Investor not found"
          description="This investor profile is private or doesn't exist."
          path={`/investors/${slugId ?? ''}`}
          noindex
        />
        <section className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold mb-3">Investor not found</h1>
          <p style={{ color: 'hsl(var(--muted-foreground))' }} className="mb-6">
            This profile is either private or doesn't exist.
          </p>
          <Link to="/" className="btn primary">Back to FoundersLib</Link>
        </section>
      </>
    )
  }

  const checkSize =
    data.check_size_min && data.check_size_max
      ? `${formatCheckSize(data.check_size_min)} – ${formatCheckSize(data.check_size_max)}`
      : data.check_size_min
        ? `From ${formatCheckSize(data.check_size_min)}`
        : null

  const title = data.fund_name
    ? `${data.display_name} · ${data.fund_name}`
    : data.display_name
  const description = (data.bio || data.headline || data.investment_thesis || '').slice(0, 155)
  const path = buildProfileUrl('investors', data.slug, data.id)
  const canonicalUrl = `${SITE_URL}${path}`
  const isOwnProfile = currentUser?.id === data.user.id

  // JSON-LD: Person plus Organization (for the fund). Pair them so Google
  // can render the relationship in a knowledge panel — investor X works at
  // fund Y, fund Y is an organization in fintech, etc.
  const schema: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: data.display_name,
      description: data.headline,
      url: canonicalUrl,
      jobTitle: data.investor_type,
      image: data.user.avatar_url ?? undefined,
      sameAs: [data.linkedin_url, data.twitter_url, data.website_url].filter(Boolean),
      ...(data.fund_name
        ? { worksFor: { '@type': 'Organization', name: data.fund_name } }
        : {}),
    },
  ]
  if (data.fund_name) {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: data.fund_name,
      description: data.investment_thesis || data.headline,
      address: data.location
        ? { '@type': 'PostalAddress', addressLocality: data.location }
        : undefined,
    })
  }

  return (
    <section
      className="max-w-3xl mx-auto px-6 py-12 flex flex-col"
      // 100vh only when the CTA footer is rendered (anon viewers).
      // See PublicFounderPage for the full rationale.
      style={currentUser ? undefined : { minHeight: '100vh' }}
      data-testid="public-investor-page"
    >
      <PageHead
        title={title}
        description={description}
        path={path}
        image={data.user.avatar_url ?? undefined}
      />
      <JsonLd data={schema} />

      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          {data.user.avatar_url ? (
            <img
              src={data.user.avatar_url}
              alt={data.display_name}
              className="rounded-full"
              style={{ width: '5rem', height: '5rem', objectFit: 'cover' }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center font-bold text-2xl"
              style={{ width: '5rem', height: '5rem', background: 'var(--gold)', color: '#000' }}
            >
              {data.display_name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              {data.display_name}
              {data.is_verified ? <BadgeCheck className="w-5 h-5" style={{ color: 'var(--gold)' }} /> : null}
            </h1>
            {data.fund_name ? (
              <p className="text-sm font-medium mt-0.5">{data.fund_name}</p>
            ) : null}
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
              {checkSize ? (
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Check size {checkSize}
                </span>
              ) : null}
              <span className="badge" style={{ textTransform: 'capitalize' }}>
                {data.investor_type.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Auth-only actions for signed-in viewers */}
        {currentUser && !isOwnProfile ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" className="btn-sm ghost" onClick={handleChat} data-testid="chat-investor-btn">
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </button>
            {connectionStatus === 'accepted' ? (
              <span
                className="btn-sm ghost"
                style={{ cursor: 'default', color: 'var(--gold)' }}
                data-testid="investor-connected-badge"
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
                data-testid="connect-investor-btn"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {connecting ? 'Sending...' : connectionStatus === 'pending' ? 'Requested' : 'Connect'}
              </button>
            )}
          </div>
        ) : null}
      </header>

      {data.investment_thesis ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Investment thesis
          </h2>
          <p className="text-base leading-relaxed">{data.investment_thesis}</p>
        </section>
      ) : null}

      {data.bio ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            About
          </h2>
          <p className="text-base leading-relaxed">{data.bio}</p>
        </section>
      ) : null}

      <section
        className="grid gap-6 mb-8"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))' }}
      >
        {data.stages_focus.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Stages
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.stages_focus.map((s) => <span key={s} className="badge">{s}</span>)}
            </div>
          </div>
        ) : null}
        {data.industries_focus.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Industries
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.industries_focus.map((i) => <span key={i} className="badge">{i}</span>)}
            </div>
          </div>
        ) : null}
        {data.geography_focus.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Geography
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.geography_focus.map((g) => <span key={g} className="badge">{g}</span>)}
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-wrap gap-3 text-sm">
        {data.linkedin_url ? (
          <a href={data.linkedin_url} target="_blank" rel="noopener noreferrer" className="btn-sm ghost">
            <Linkedin className="w-3.5 h-3.5" /> LinkedIn
          </a>
        ) : null}
        {data.twitter_url ? (
          <a href={data.twitter_url} target="_blank" rel="noopener noreferrer" className="btn-sm ghost">
            <Twitter className="w-3.5 h-3.5" /> Twitter
          </a>
        ) : null}
        {data.website_url ? (
          <a href={data.website_url} target="_blank" rel="noopener noreferrer" className="btn-sm ghost">
            <Globe className="w-3.5 h-3.5" /> Website
          </a>
        ) : null}
      </section>

      {/* CTA footer for anonymous visitors only — see PublicFounderPage
          for the rationale. */}
      {currentUser ? null : (
        <footer
          className="mt-auto pt-8 border-t text-center text-sm"
          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
        >
          Investor on{' '}
          <Link to="/" style={{ color: 'var(--gold)' }}>FoundersLib</Link>
          {' · '}
          <Link to="/signup" style={{ color: 'var(--gold)' }}>Join the network</Link>
        </footer>
      )}
    </section>
  )
}
