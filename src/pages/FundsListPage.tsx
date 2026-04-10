import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, Building2, Calendar, DollarSign, Gift, Star, ExternalLink, Search, X, CheckCircle2 } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { formatLabel } from '../lib/format'
import { useToast } from '../context/ToastContext'
import { Pagination } from '../components/Pagination'
import type { FundListItem } from '../types/fund'

const PAGE_SIZE = 20

const PENDING_APPLY_KEY = 'ff_pending_apply'
const CLAIMED_BENEFITS_KEY = 'ff_claimed_benefits'

type PendingApply = { type: 'fund' | 'benefit'; id: string; name: string }

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
  is_active?: boolean
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

type FundStatus = { label: string; color: string; bg: string; dot: string }

function getFundStatus(deadline: string | null | undefined, isActive?: boolean): FundStatus {
  if (isActive === false) return { label: 'Closed', color: '#6b7280', bg: '#6b728015', dot: '#6b7280' }
  if (!deadline) return { label: 'Open', color: '#22c55e', bg: '#22c55e15', dot: '#22c55e' }
  const now = new Date()
  const d = new Date(deadline)
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { label: 'Expired', color: '#6b7280', bg: '#6b728015', dot: '#6b7280' }
  if (daysLeft <= 7) return { label: 'Closing Soon', color: '#f59e0b', bg: '#f59e0b15', dot: '#f59e0b' }
  if (daysLeft <= 30) return { label: 'Taking Applications', color: '#3b82f6', bg: '#3b82f615', dot: '#3b82f6' }
  return { label: 'Open', color: '#22c55e', bg: '#22c55e15', dot: '#22c55e' }
}

function StatusPill({ status }: { status: FundStatus }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600,
      background: status.bg, color: status.color,
      border: `1px solid ${status.color}33`,
      flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.dot, flexShrink: 0 }} />
      {status.label}
    </span>
  )
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

function BenefitCard({ benefit, isClaimed, onClaim }: { benefit: Benefit; isClaimed: boolean; onClaim: (id: string, name: string) => void }) {
  const color = CATEGORY_COLORS[benefit.category?.toLowerCase() ?? 'other'] ?? CATEGORY_COLORS.other
  const isActive = benefit.is_active !== false
  const benefitStatus: FundStatus = isActive
    ? { label: 'Available', color: '#22c55e', bg: '#22c55e15', dot: '#22c55e' }
    : { label: 'Unavailable', color: '#6b7280', bg: '#6b728015', dot: '#6b7280' }
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 2 }}>{benefit.title}</div>
          {benefit.provider && (
            <div style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{benefit.provider}</div>
          )}
        </div>
        <StatusPill status={benefitStatus} />
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

      {isClaimed && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: '#22c55e', fontWeight: 500 }}>
          <CheckCircle2 size={13} /> Claimed
        </span>
      )}
      {!isClaimed && benefit.website_url && (
        <a
          href={benefit.website_url}
          target="_blank"
          rel="noreferrer"
          className="btn-sm ghost"
          style={{ alignSelf: 'flex-start', marginTop: 4 }}
          onClick={() => onClaim(benefit.id, benefit.title)}
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
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('funds')

  // Funds state
  const [funds, setFunds] = useState<FundListItem[]>([])
  const [fundsLoading, setFundsLoading] = useState(true)
  const [fundsError, setFundsError] = useState<string | null>(null)
  const [fundsPage, setFundsPage] = useState(1)
  const [fundsTotalCount, setFundsTotalCount] = useState(0)
  const fundsSearchTimer = useRef<number | null>(null)
  const fundsTotalPages = Math.ceil(fundsTotalCount / PAGE_SIZE)

  // Benefits state
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [benefitsLoading, setBenefitsLoading] = useState(false)
  const [benefitsLoaded, setBenefitsLoaded] = useState(false)
  const [benefitsError, setBenefitsError] = useState<string | null>(null)
  const [benefitsPage, setBenefitsPage] = useState(1)
  const [fundsSearch, setFundsSearch] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [featuredOnly, setFeaturedOnly] = useState(false)

  // Apply tracking state
  const [appliedFundIds, setAppliedFundIds] = useState<Set<string>>(new Set())
  const [claimedBenefitIds, setClaimedBenefitIds] = useState<Set<string>>(new Set())
  const [pendingDialog, setPendingDialog] = useState<PendingApply | null>(null)

  // Load funds
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setFundsLoading(true)
      setFundsError(null)
      try {
        const params = new URLSearchParams({ page: String(fundsPage) })
        if (fundsSearch) params.set('search', fundsSearch)
        const data = await apiRequest<{ count: number; results: FundListItem[] }>(`/funds/?${params}`)
        if (!cancelled) {
          setFunds(data.results ?? [])
          setFundsTotalCount(data.count ?? 0)
        }
      } catch {
        if (!cancelled) setFundsError('Unable to load funds.')
      } finally {
        if (!cancelled) setFundsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [fundsPage, fundsSearch])

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

  // Pre-load applied fund IDs from existing applications
  useEffect(() => {
    apiRequest<{ results: { fund: string }[] } | { fund: string }[]>('/applications/')
      .then((data) => {
        const ids = new Set(normalizeList(data).map((a) => a.fund))
        setAppliedFundIds(ids)
      })
      .catch(() => {})
  }, [])

  // Pre-load claimed benefit IDs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAIMED_BENEFITS_KEY)
      if (raw) setClaimedBenefitIds(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])

  // Show "Did you apply?" dialog when tab regains focus
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return
      const raw = sessionStorage.getItem(PENDING_APPLY_KEY)
      if (!raw) return
      try {
        setPendingDialog(JSON.parse(raw) as PendingApply)
      } catch {}
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const trackExternalApply = (type: 'fund' | 'benefit', id: string, name: string) => {
    sessionStorage.setItem(PENDING_APPLY_KEY, JSON.stringify({ type, id, name }))
  }

  const handleDialogConfirm = async () => {
    if (!pendingDialog) return
    sessionStorage.removeItem(PENDING_APPLY_KEY)
    const { type, id, name } = pendingDialog
    setPendingDialog(null)
    if (type === 'fund') {
      try {
        await apiRequest('/applications/', { method: 'POST', body: { fund: id } })
        setAppliedFundIds((prev) => new Set([...prev, id]))
        pushToast(`Application to "${name}" recorded!`, 'success')
      } catch {
        pushToast('Could not record application.', 'error')
      }
    } else {
      const claimed = [...claimedBenefitIds, id]
      localStorage.setItem(CLAIMED_BENEFITS_KEY, JSON.stringify(claimed))
      setClaimedBenefitIds(new Set(claimed))
      pushToast(`"${name}" marked as claimed.`, 'success')
    }
  }

  const handleDialogDismiss = () => {
    sessionStorage.removeItem(PENDING_APPLY_KEY)
    setPendingDialog(null)
  }

  const handleFundsSearchChange = (value: string) => {
    if (fundsSearchTimer.current) window.clearTimeout(fundsSearchTimer.current)
    fundsSearchTimer.current = window.setTimeout(() => {
      setFundsSearch(value)
      setFundsPage(1)
    }, 300)
  }

  // funds are now server-filtered; use as-is
  const filteredFunds = funds

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
  const benefitsTotalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pagedBenefits = filtered.slice((benefitsPage - 1) * PAGE_SIZE, benefitsPage * PAGE_SIZE)

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
            <span className="badge" style={{ marginLeft: 6, verticalAlign: 'middle' }}>
              {fundsTotalCount}
            </span>
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
          {/* Funds Search */}
          <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <Search size={15} strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
            <input
              className="input"
              type="text"
              placeholder="Search by name, type, opportunity…"
              defaultValue={fundsSearch}
              onChange={(e) => handleFundsSearchChange(e.target.value)}
              style={{ paddingLeft: 38, paddingRight: fundsSearch ? 36 : undefined }}
              data-testid="funds-search"
            />
            {fundsSearch && (
              <button onClick={() => { setFundsSearch(''); setFundsPage(1) }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2, display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

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
          {!fundsLoading && !fundsError && funds.length > 0 && filteredFunds.length === 0 && (
            <div className="empty-state">
              <Wallet className="empty-icon" strokeWidth={1.5} />
              <h3 className="empty-title">No results</h3>
              <p className="empty-description">Try a different search term.</p>
            </div>
          )}
          {!fundsLoading && !fundsError && filteredFunds.length > 0 && (
            <>
            <div className="grid-3" data-testid="funds-grid">
              {filteredFunds.map((fund) => {
                const deadlineInfo = getDeadlineInfo(fund.deadline)
                const ticketSize = formatTicketSize(fund.min_ticket_size, fund.max_ticket_size)
                const status = getFundStatus(fund.deadline)
                return (
                  <div
                    key={fund.id}
                    className="card"
                    style={{ cursor: 'pointer', display: 'block' }}
                    onClick={() => navigate(`/app/funds/${fund.id}`)}
                    data-testid={`fund-card-${fund.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <div style={{ fontWeight: 500, fontSize: '1rem' }}>{fund.name}</div>
                      <StatusPill status={status} />
                    </div>
                    {fund.organization && (
                      <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem' }}>
                        {fund.organization}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                      {fund.fund_type && (
                        <span className="tag">
                          <Building2 style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                          {formatLabel(fund.fund_type)}
                        </span>
                      )}
                      {fund.opportunity_type && <span className="tag">{formatLabel(fund.opportunity_type)}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
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

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {appliedFundIds.has(fund.id) ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#22c55e', fontWeight: 500 }}>
                          <CheckCircle2 size={12} /> Applied
                        </span>
                      ) : fund.application_link ? (
                        <a
                          href={fund.application_link}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-sm primary"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => trackExternalApply('fund', fund.id, fund.name)}
                        >
                          <ExternalLink style={{ width: 12, height: 12 }} />
                          Apply now
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="btn-sm primary"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => navigate(`/app/funds/${fund.id}`)}
                        >
                          Apply
                        </button>
                      )}
                      {fund.website_url && (
                        <a
                          href={fund.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-sm ghost"
                          style={{ fontSize: '0.75rem' }}
                        >
                          <ExternalLink style={{ width: 12, height: 12 }} />
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <Pagination page={fundsPage} totalPages={fundsTotalPages} onChange={setFundsPage} />
            </>
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
                onChange={(e) => { setSearch(e.target.value); setBenefitsPage(1) }}
                style={{ paddingLeft: 32 }}
                data-testid="benefits-search"
              />
              {search && (
                <button onClick={() => { setSearch(''); setBenefitsPage(1) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2 }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <select
              className="select"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setBenefitsPage(1) }}
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
              onClick={() => { setFeaturedOnly(!featuredOnly); setBenefitsPage(1) }}
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
            <>
            <div className="grid-3" data-testid="benefits-grid">
              {pagedBenefits.map((benefit) => (
                <BenefitCard
                  key={benefit.id}
                  benefit={benefit}
                  isClaimed={claimedBenefitIds.has(benefit.id)}
                  onClaim={(id, name) => trackExternalApply('benefit', id, name)}
                />
              ))}
            </div>
            <Pagination page={benefitsPage} totalPages={benefitsTotalPages} onChange={setBenefitsPage} />
            </>
          )}
        </>
      )}

      {/* "Did you apply/claim?" dialog */}
      {pendingDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {pendingDialog.type === 'fund' ? 'Did you apply?' : 'Did you claim this?'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem' }}>
              {pendingDialog.type === 'fund'
                ? <><strong>{pendingDialog.name}</strong> — did you submit an application?</>
                : <><strong>{pendingDialog.name}</strong> — did you claim this benefit?</>
              }
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-sm ghost" onClick={handleDialogDismiss}>No</button>
              <button type="button" className="btn-sm primary" onClick={() => void handleDialogConfirm()}>
                <CheckCircle2 size={13} />
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
