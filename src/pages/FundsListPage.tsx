import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Building2, Calendar, DollarSign, Gift, Star, ExternalLink, Search, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { FundListItem } from '../types/fund'

type Benefit = {
  id: string
  title: string
  slug: string
  provider?: string | null
  category?: string | null
  value?: string | null
  website_url?: string | null
  tags?: string[]
  is_featured?: boolean
}

function getDeadlineInfo(deadline: string | null | undefined): { label: string; urgent: boolean } | null {
  if (!deadline) return null
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return { label: 'Closed', urgent: false }
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, urgent: true }
  return { label: deadlineDate.toLocaleDateString(), urgent: false }
}

function formatTicketSize(min: number | null | undefined, max: number | null | undefined): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`
    return `$${n}`
  }
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  if (max) return `Up to ${fmt(max)}`
  return null
}

const CATEGORY_COLORS: Record<string, string> = {
  cloud: '#a1a1a1',
  software: '#737373',
  legal: '#f59e0b',
  banking: '#22c55e',
  marketing: '#ec4899',
  hr: '#f97316',
  productivity: '#8b5cf6',
  other: '#94a3b8',
}

function BenefitCard({ benefit }: { benefit: Benefit }) {
  const color = CATEGORY_COLORS[benefit.category?.toLowerCase() ?? 'other'] ?? CATEGORY_COLORS.other
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 2 }}>{benefit.title}</div>
          {benefit.provider && (
            <div style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{benefit.provider}</div>
          )}
        </div>
        {benefit.is_featured && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', flexShrink: 0 }}>
            <Star size={10} /> Featured
          </span>
        )}
      </div>

      {benefit.value && (
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#22c55e' }}>
          {benefit.value}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: 2 }}>
        {benefit.category && (
          <span
            className="tag"
            style={{ background: `${color}18`, color, border: `1px solid ${color}33`, textTransform: 'capitalize' }}
          >
            {benefit.category}
          </span>
        )}
        {(benefit.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>

      {benefit.website_url && (
        <a
          href={benefit.website_url}
          target="_blank"
          rel="noreferrer"
          className="btn-sm ghost"
          style={{ alignSelf: 'flex-start', marginTop: 4 }}
        >
          <ExternalLink size={12} />
          Claim benefit
        </a>
      )}
    </div>
  )
}

type Tab = 'funds' | 'benefits'

export function FundsListPage() {
  const [activeTab, setActiveTab] = useState<Tab>('funds')

  // Funds state
  const [funds, setFunds] = useState<FundListItem[]>([])
  const [fundsLoading, setFundsLoading] = useState(true)
  const [fundsError, setFundsError] = useState<string | null>(null)

  // Benefits state
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [benefitsLoading, setBenefitsLoading] = useState(false)
  const [benefitsLoaded, setBenefitsLoaded] = useState(false)
  const [benefitsError, setBenefitsError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [featuredOnly, setFeaturedOnly] = useState(false)

  // Load funds on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setFundsLoading(true)
      setFundsError(null)
      try {
        const data = await apiRequest<FundListItem[] | { results: FundListItem[] }>('/funds/')
        if (!cancelled) setFunds(normalizeList(data))
      } catch {
        if (!cancelled) setFundsError('Unable to load funds.')
      } finally {
        if (!cancelled) setFundsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // Load benefits when tab is first activated
  useEffect(() => {
    if (activeTab !== 'benefits' || benefitsLoaded) return
    let cancelled = false
    const load = async () => {
      setBenefitsLoading(true)
      setBenefitsError(null)
      try {
        const data = await apiRequest<Benefit[] | { results: Benefit[] }>('/funds/benefits/')
        if (!cancelled) {
          setBenefits(normalizeList(data))
          setBenefitsLoaded(true)
        }
      } catch {
        if (!cancelled) setBenefitsError('Unable to load benefits.')
      } finally {
        if (!cancelled) setBenefitsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [activeTab, benefitsLoaded])

  // Derive filtered benefits
  const categories = [...new Set(benefits.map((b) => b.category).filter(Boolean))] as string[]
  const filtered = benefits.filter((b) => {
    if (featuredOnly && !b.is_featured) return false
    if (categoryFilter && b.category !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        b.title.toLowerCase().includes(q) ||
        (b.provider ?? '').toLowerCase().includes(q) ||
        (b.value ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '0.5rem 1.25rem',
    borderRadius: '0.5rem 0.5rem 0 0',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
    border: 'none',
    background: activeTab === tab ? 'hsl(var(--card))' : 'transparent',
    color: activeTab === tab ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
    borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
    transition: 'color 150ms, border-color 150ms',
  })

  return (
    <div data-testid="funds-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">Funds &amp; Benefits</h1>
          <p className="page-description">Browse active funds, opportunities, and startup perks.</p>
        </div>
        <Link className="btn-sm ghost" to="/app/applications" data-testid="view-applications-btn">
          View applications
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid hsl(var(--border))', marginBottom: '1.5rem' }}>
        <button style={tabStyle('funds')} onClick={() => setActiveTab('funds')} data-testid="tab-funds">
          <Wallet size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
          Funds
          {!fundsLoading && !fundsError && (
            <span className="badge" style={{ marginLeft: 6, verticalAlign: 'middle' }}>{funds.length}</span>
          )}
        </button>
        <button style={tabStyle('benefits')} onClick={() => setActiveTab('benefits')} data-testid="tab-benefits">
          <Gift size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
          Benefits
          {benefitsLoaded && (
            <span className="badge" style={{ marginLeft: 6, verticalAlign: 'middle' }}>{benefits.length}</span>
          )}
        </button>
      </div>

      {/* ── Funds Tab ── */}
      {activeTab === 'funds' && (
        <>
          {fundsLoading && (
            <div className="empty-state">
              <Wallet className="empty-icon" strokeWidth={1.5} />
              <p className="empty-description">Loading funds...</p>
            </div>
          )}
          {fundsError && <div className="badge error" style={{ marginBottom: '1rem' }}>{fundsError}</div>}
          {!fundsLoading && !fundsError && funds.length === 0 && (
            <div className="empty-state">
              <Wallet className="empty-icon" strokeWidth={1.5} />
              <h3 className="empty-title">No funds available</h3>
              <p className="empty-description">Check back soon!</p>
            </div>
          )}
          {!fundsLoading && !fundsError && funds.length > 0 && (
            <div className="grid-3" data-testid="funds-grid">
              {funds.map((fund) => {
                const deadlineInfo = getDeadlineInfo(fund.deadline)
                const ticketSize = formatTicketSize(fund.min_ticket_size, fund.max_ticket_size)
                return (
                  <Link
                    key={fund.id}
                    to={`/app/funds/${fund.id}`}
                    className="card"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                    data-testid={`fund-card-${fund.id}`}
                  >
                    <div style={{ fontWeight: 500, fontSize: '1rem', marginBottom: '0.25rem' }}>{fund.name}</div>
                    {fund.organization && (
                      <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem' }}>
                        {fund.organization}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                      {fund.fund_type && (
                        <span className="tag">
                          <Building2 style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                          {fund.fund_type}
                        </span>
                      )}
                      {fund.opportunity_type && <span className="tag">{fund.opportunity_type}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {ticketSize && (
                        <span className="badge" style={{ gap: '0.25rem', display: 'inline-flex', alignItems: 'center' }}>
                          <DollarSign style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                          {ticketSize}
                        </span>
                      )}
                      {deadlineInfo && (
                        <span className={`badge ${deadlineInfo.urgent ? 'error' : ''}`} style={{ gap: '0.25rem', display: 'inline-flex', alignItems: 'center' }}>
                          <Calendar style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                          {deadlineInfo.label}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Benefits Tab ── */}
      {activeTab === 'benefits' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
              <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
              <input
                className="input"
                type="text"
                placeholder="Search benefits..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 32 }}
                data-testid="benefits-search"
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2 }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <select
              className="select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ flex: '0 0 auto', minWidth: 140 }}
              data-testid="benefits-category-filter"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat} style={{ textTransform: 'capitalize' }}>{cat}</option>
              ))}
            </select>
            <button
              className={featuredOnly ? 'btn-sm primary' : 'btn-sm ghost'}
              type="button"
              onClick={() => setFeaturedOnly(!featuredOnly)}
              data-testid="benefits-featured-filter"
            >
              <Star size={12} />
              Featured only
            </button>
          </div>

          {benefitsLoading && (
            <div className="empty-state">
              <Gift className="empty-icon" strokeWidth={1.5} />
              <p className="empty-description">Loading benefits...</p>
            </div>
          )}
          {benefitsError && <div className="badge error" style={{ marginBottom: '1rem' }}>{benefitsError}</div>}
          {!benefitsLoading && !benefitsError && filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Gift size={28} /></div>
              <h3 className="empty-title">No benefits found</h3>
              <p className="empty-description">
                {benefits.length === 0 ? 'No benefits are available yet.' : 'Try adjusting your filters.'}
              </p>
            </div>
          )}
          {!benefitsLoading && !benefitsError && filtered.length > 0 && (
            <div className="grid-3" data-testid="benefits-grid">
              {filtered.map((benefit) => (
                <BenefitCard key={benefit.id} benefit={benefit} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
