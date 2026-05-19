/**
 * /app/saved — your saved startups and saved funds, in one place.
 *
 * Two tabs:
 *   - Startups  ← /investors/saved-startups/  (investor-saved startups)
 *   - Funds     ← /funds/saved/               (saved funds / opportunities)
 *
 * Tab selection persists in the URL via ?tab=startups|funds so refreshing
 * or sharing the link lands you back on the right tab. The default tab
 * picks based on user role: investors land on Startups, founders on Funds.
 *
 * Each row links to the canonical detail page and exposes an inline
 * Unsave button so you can prune the list without leaving the page.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Briefcase,
  FolderHeart,
  Loader2,
  MapPin,
  Trash2,
  Wallet,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { buildProfileUrl } from '../lib/slugId'

type Tab = 'startups' | 'funds'

// Row returned by /investors/saved-startups/. SavedStartupSerializer
// flattens a few fields from the related Startup so we don't have to
// fetch detail per row.
type SavedStartupRow = {
  id: string                 // SavedStartup row id (used for unsave)
  startup: string            // Startup id (used to build URL)
  startup_name: string
  startup_tagline: string
  startup_industry: string
  notes: string
  created_at: string
}

// Row returned by /funds/saved/. SavedFundSerializer embeds the full
// FundListSerializer payload under `fund`.
type SavedFundRow = {
  id: string                 // SavedFund row id
  fund: {
    id: string
    name: string
    slug: string
    fund_type: string
    opportunity_type: string
    organization: string
    logo_url: string | null
    stages: string[]
    industries: string[]
    min_ticket_size: string | null
    max_ticket_size: string | null
    headquarters_city: string
    headquarters_country: string
    is_featured: boolean
    is_sponsored: boolean
    deadline: string | null
    website_url: string | null
    application_link: string | null
  }
  notes: string
  created_at: string
}

function emptyState(label: string, hint: string) {
  return (
    <div className="empty-state" data-testid="saved-empty" style={{ padding: '3rem 0', textAlign: 'center' }}>
      <FolderHeart className="empty-icon" strokeWidth={1.5} />
      <h3 className="empty-title">{label}</h3>
      <p className="empty-description" style={{ color: 'hsl(var(--muted-foreground))' }}>{hint}</p>
    </div>
  )
}

export function SavedPage() {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Default tab follows role: investors care about saved startups, founders
  // about saved funds. Both roles get both tabs — the default is just a
  // good first guess. `?tab=` in the URL always wins so deep links work.
  const isInvestor = user?.role === 'investor' || user?.role === 'both'
  const initialTab: Tab = (() => {
    const t = searchParams.get('tab')
    if (t === 'startups' || t === 'funds') return t
    return isInvestor ? 'startups' : 'funds'
  })()
  const [tab, setTab] = useState<Tab>(initialTab)

  const [startups, setStartups] = useState<SavedStartupRow[]>([])
  const [funds, setFunds] = useState<SavedFundRow[]>([])
  const [loading, setLoading] = useState(true)
  const [unsavingId, setUnsavingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch both in parallel — most users will switch tabs once and the
      // pre-fetch keeps that switch instant. allSettled because one
      // endpoint failing (e.g. permissions) shouldn't blank the page.
      const [s, f] = await Promise.allSettled([
        apiRequest<SavedStartupRow[] | { results: SavedStartupRow[] }>('/investors/saved-startups/'),
        apiRequest<SavedFundRow[] | { results: SavedFundRow[] }>('/funds/saved/'),
      ])
      if (s.status === 'fulfilled') setStartups(normalizeList(s.value))
      if (f.status === 'fulfilled') setFunds(normalizeList(f.value))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Sync tab → URL so refresh / share preserves position.
  const handleTabChange = (next: Tab) => {
    setTab(next)
    const sp = new URLSearchParams(searchParams)
    sp.set('tab', next)
    setSearchParams(sp, { replace: true })
  }

  // Toggle endpoint — /save-startup/<id>/ flips state, so calling it on a
  // currently-saved row unsaves. Optimistically remove from local state.
  const handleUnsaveStartup = async (row: SavedStartupRow) => {
    if (unsavingId) return
    setUnsavingId(row.id)
    const previous = startups
    setStartups((prev) => prev.filter((r) => r.id !== row.id))
    try {
      await apiRequest(`/investors/save-startup/${row.startup}/`, { method: 'POST' })
      pushToast('Removed from saved', 'success')
    } catch (err) {
      // Roll back on failure so the row reappears.
      setStartups(previous)
      const apiErr = err as { details?: { detail?: string }; message?: string }
      pushToast(apiErr?.details?.detail ?? apiErr?.message ?? 'Failed to unsave', 'error')
    } finally {
      setUnsavingId(null)
    }
  }

  const handleUnsaveFund = async (row: SavedFundRow) => {
    if (unsavingId) return
    setUnsavingId(row.id)
    const previous = funds
    setFunds((prev) => prev.filter((r) => r.id !== row.id))
    try {
      // Saved funds delete by FUND id (per backend: SavedFundDeleteView uses
      // fund pk, not the SavedFund row pk).
      await apiRequest(`/funds/saved/${row.fund.id}/`, { method: 'DELETE' })
      pushToast('Removed from saved', 'success')
    } catch (err) {
      setFunds(previous)
      const apiErr = err as { details?: { detail?: string }; message?: string }
      pushToast(apiErr?.details?.detail ?? apiErr?.message ?? 'Failed to unsave', 'error')
    } finally {
      setUnsavingId(null)
    }
  }

  const startupCount = startups.length
  const fundCount = funds.length

  const tabs: Array<{ key: Tab; label: string; icon: typeof Briefcase; count: number; testid: string }> = useMemo(() => [
    { key: 'startups', label: 'Startups', icon: Briefcase, count: startupCount, testid: 'tab-saved-startups' },
    { key: 'funds', label: 'Funds', icon: Wallet, count: fundCount, testid: 'tab-saved-funds' },
  ], [startupCount, fundCount])

  return (
    <section className="content-section" data-testid="saved-page" style={{ maxWidth: '48rem', margin: '0 auto' }}>
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FolderHeart className="w-5 h-5" style={{ color: 'var(--gold)' }} />
            <span className="data-eyebrow">Saved</span>
          </div>
          <h1>Saved items</h1>
          <p>Startups and funds you've bookmarked. Click any row to revisit, or use the bin icon to remove.</p>
        </div>
      </header>

      {/* Tab strip — same visual idiom as InvitationsPage. */}
      <div
        role="tablist"
        aria-label="Saved item categories"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid hsl(var(--border))',
          marginBottom: '1rem',
        }}
      >
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleTabChange(t.key)}
              data-testid={t.testid}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.625rem 0.875rem',
                background: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
                color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontWeight: active ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              <Icon size={14} />
              {t.label}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  padding: '0 6px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  borderRadius: 999,
                  background: active ? 'var(--gold)' : 'hsl(var(--muted))',
                  color: active ? '#000' : 'hsl(var(--muted-foreground))',
                }}
              >
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: '3rem 0' }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <span className="empty-description">Loading…</span>
        </div>
      ) : tab === 'startups' ? (
        startups.length === 0 ? (
          emptyState(
            'No saved startups yet',
            'Open a startup profile and tap the bookmark icon to save it here.',
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {startups.map((row) => (
              <article
                key={row.id}
                className="card"
                data-testid={`saved-startup-${row.startup}`}
                style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={buildProfileUrl('startups', row.startup_name, row.startup)}
                    style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'hsl(var(--foreground))', textDecoration: 'none' }}
                    data-testid={`saved-startup-link-${row.startup}`}
                  >
                    {row.startup_name}
                  </Link>
                  {row.startup_tagline ? (
                    <div style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                      {row.startup_tagline}
                    </div>
                  ) : null}
                  {row.startup_industry ? (
                    <div style={{ marginTop: 6 }}>
                      <span className="badge">{row.startup_industry}</span>
                    </div>
                  ) : null}
                  {row.notes ? (
                    <p
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.8125rem',
                        color: 'hsl(var(--muted-foreground))',
                        fontStyle: 'italic',
                        borderLeft: '2px solid hsl(var(--border))',
                        paddingLeft: '0.5rem',
                      }}
                    >
                      {row.notes}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={() => void handleUnsaveStartup(row)}
                  disabled={unsavingId === row.id}
                  aria-label="Remove from saved"
                  title="Remove from saved"
                  data-testid={`unsave-startup-${row.startup}`}
                  style={{ flexShrink: 0, color: '#ef4444' }}
                >
                  {unsavingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </article>
            ))}
          </div>
        )
      ) : funds.length === 0 ? (
        emptyState(
          'No saved funds yet',
          'Browse funds and tap the bookmark icon to add one here.',
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {funds.map((row) => {
            const f = row.fund
            const location = [f.headquarters_city, f.headquarters_country].filter(Boolean).join(', ')
            return (
              <article
                key={row.id}
                className="card"
                data-testid={`saved-fund-${f.id}`}
                style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={`/app/funds/${f.id}`}
                    style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'hsl(var(--foreground))', textDecoration: 'none' }}
                    data-testid={`saved-fund-link-${f.id}`}
                  >
                    {f.name}
                  </Link>
                  {f.organization ? (
                    <div style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                      {f.organization}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    {f.fund_type ? <span className="badge">{f.fund_type}</span> : null}
                    {f.is_featured ? (
                      <span className="badge" style={{ background: '#fef3c722', color: '#d97706', border: '1px solid #d9770644' }}>
                        Featured
                      </span>
                    ) : null}
                    {location ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        <MapPin size={11} /> {location}
                      </span>
                    ) : null}
                  </div>
                  {row.notes ? (
                    <p
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.8125rem',
                        color: 'hsl(var(--muted-foreground))',
                        fontStyle: 'italic',
                        borderLeft: '2px solid hsl(var(--border))',
                        paddingLeft: '0.5rem',
                      }}
                    >
                      {row.notes}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={() => void handleUnsaveFund(row)}
                  disabled={unsavingId === row.id}
                  aria-label="Remove from saved"
                  title="Remove from saved"
                  data-testid={`unsave-fund-${f.id}`}
                  style={{ flexShrink: 0, color: '#ef4444' }}
                >
                  {unsavingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </article>
            )
          })}
        </div>
      )}

    </section>
  )
}

export default SavedPage
