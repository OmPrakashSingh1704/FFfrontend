import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, Linkedin, Twitter, Globe, MapPin, Handshake } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { parseSlugId, buildProfileUrl } from '../lib/slugId'
import { PageHead } from '../components/PageHead'
import { JsonLd } from '../components/JsonLd'
import { StartDealRoomModal } from '../components/StartDealRoomModal'

type PublicStartup = {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  industry: string
  sub_industries: string[]
  business_model: string
  current_stage: string | null
  headquarters_city: string
  headquarters_country: string
  founded_year: number | null
  website_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  problem_statement: string
  solution_description: string
  unique_value_proposition: string
}

const SITE_URL = 'https://www.founderslib.in'

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
  const [data, setData] = useState<PublicStartup | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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
        <div style={{ minWidth: 0 }}>
          <h1 className="text-3xl font-semibold mb-2">{data.name}</h1>
          {data.tagline ? (
            <p className="text-lg" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {data.tagline}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {data.industry ? <span className="badge">{data.industry}</span> : null}
            {data.current_stage ? <span className="badge">{data.current_stage}</span> : null}
            {data.founded_year ? <span>Founded {data.founded_year}</span> : null}
            {locationStr ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {locationStr}
              </span>
            ) : null}
          </div>
        </div>
        {viewerCanStartDealRoom ? (
          <button
            type="button"
            className="btn-sm primary flex-shrink-0"
            onClick={() => setDealRoomOpen(true)}
            title="Start a private workspace with chat, calls, documents, and a mutual-consent workflow"
            data-testid="start-deal-room-btn"
          >
            <Handshake className="w-3.5 h-3.5" />
            Start deal room
          </button>
        ) : null}
      </header>

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

      <section className="flex flex-wrap gap-3 text-sm">
        {data.website_url ? (
          <a href={data.website_url} target="_blank" rel="noopener noreferrer" className="btn-sm ghost">
            <Globe className="w-3.5 h-3.5" /> Website
          </a>
        ) : null}
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
      </section>

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
