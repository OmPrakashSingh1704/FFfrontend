import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Landmark, Pencil, Plus, Search, X, Gift } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList, type PaginatedResponse } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { MarkdownTextarea } from '../components/MarkdownTextarea'
import type { FundDetail, FundListItem } from '../types/fund'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminFund = FundListItem & {
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

type FundFormData = {
  name: string
  organization: string
  fund_type: string
  opportunity_type: string
  description: string
  min_ticket_size: string
  max_ticket_size: string
  funding_amount: string
  fund_size: string
  vintage_year: string
  aum: string
  headquarters_city: string
  headquarters_country: string
  website_url: string
  application_link: string
  logo_url: string
  eligibility: string
  application_process: string
  deadline: string
  stages: string
  industries: string
  geographies: string
  tags: string
  is_active: boolean
  is_featured: boolean
  is_sponsored: boolean
}

type AdminBenefit = {
  id: string
  title: string
  provider?: string | null
  category?: string | null
  value?: string | null
  website_url?: string | null
  tags?: string[]
  is_active?: boolean
  is_featured?: boolean
  created_at?: string
}

type BenefitFormData = {
  title: string
  provider: string
  category: string
  description: string
  value: string
  website_url: string
  eligibility: string
  redemption_steps: string
  tags: string
  is_active: boolean
  is_featured: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const emptyFundForm: FundFormData = {
  name: '', organization: '', fund_type: 'vc', opportunity_type: '', description: '',
  min_ticket_size: '', max_ticket_size: '', funding_amount: '', fund_size: '',
  vintage_year: '', aum: '', headquarters_city: '', headquarters_country: '',
  website_url: '', application_link: '', logo_url: '', eligibility: '',
  application_process: '', deadline: '', stages: '', industries: '', geographies: '',
  tags: '', is_active: true, is_featured: false, is_sponsored: false,
}

const emptyBenefitForm: BenefitFormData = {
  title: '', provider: '', category: 'other', description: '', value: '',
  website_url: '', eligibility: '', redemption_steps: '', tags: '',
  is_active: true, is_featured: false,
}

function csvToArray(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminFundsPage() {
  const { pushToast } = useToast()
  const [activeTab, setActiveTab] = useState<'funds' | 'benefits'>('funds')

  // ── Funds state ─────────────────────────────────────────────────────────────
  const [funds, setFunds] = useState<AdminFund[]>([])
  const [fundsLoading, setFundsLoading] = useState(true)
  const [fundsError, setFundsError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    search: '', active: '', featured: '', sponsored: '', fund_type: '', opportunity_type: '',
  })
  const [showFundModal, setShowFundModal] = useState(false)
  const [editingFundId, setEditingFundId] = useState<string | null>(null)
  const [fundForm, setFundForm] = useState<FundFormData>(emptyFundForm)
  const [fundFormLoading, setFundFormLoading] = useState(false)
  const [fundFormError, setFundFormError] = useState<string | null>(null)
  const [fundsReloadKey, setFundsReloadKey] = useState(0)

  // ── Benefits state ──────────────────────────────────────────────────────────
  const [benefits, setBenefits] = useState<AdminBenefit[]>([])
  const [benefitsLoading, setBenefitsLoading] = useState(false)
  const [benefitsError, setBenefitsError] = useState<string | null>(null)
  const [benefitsLoaded, setBenefitsLoaded] = useState(false)
  const [showBenefitModal, setShowBenefitModal] = useState(false)
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null)
  const [benefitForm, setBenefitForm] = useState<BenefitFormData>(emptyBenefitForm)
  const [benefitFormLoading, setBenefitFormLoading] = useState(false)
  const [benefitFormError, setBenefitFormError] = useState<string | null>(null)
  const [benefitsReloadKey, setBenefitsReloadKey] = useState(0)

  // ── Load funds ──────────────────────────────────────────────────────────────
  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    params.set('page', String(page))
    return params.toString()
  }, [filters, page])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setFundsLoading(true)
      setFundsError(null)
      try {
        const data = await apiRequest<AdminFund[] | PaginatedResponse<AdminFund>>(`/admin/funds/?${query}`)
        const list = normalizeList(data)
        if (!cancelled) {
          setFunds(list)
          setTotal(!Array.isArray(data) ? data.count ?? null : null)
        }
      } catch {
        if (!cancelled) setFundsError('Unable to load funds.')
      } finally {
        if (!cancelled) setFundsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [query, fundsReloadKey])

  // ── Load benefits (lazy) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'benefits' || benefitsLoaded) return
    let cancelled = false
    const load = async () => {
      setBenefitsLoading(true)
      setBenefitsError(null)
      try {
        const data = await apiRequest<AdminBenefit[] | PaginatedResponse<AdminBenefit>>('/admin/benefits/')
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
  }, [activeTab, benefitsLoaded, benefitsReloadKey])

  // Reload benefits when key changes
  useEffect(() => {
    if (benefitsReloadKey === 0) return
    setBenefitsLoaded(false)
  }, [benefitsReloadKey])

  // ── Fund CRUD ────────────────────────────────────────────────────────────────
  const openCreateFund = () => {
    setEditingFundId(null)
    setFundForm(emptyFundForm)
    setFundFormError(null)
    setShowFundModal(true)
  }

  const openEditFund = async (fundId: string) => {
    setEditingFundId(fundId)
    setFundFormError(null)
    setShowFundModal(true)
    try {
      const data = await apiRequest<FundDetail>(`/admin/funds/${fundId}/`)
      setFundForm({
        name: data.name || '',
        organization: data.organization || '',
        fund_type: data.fund_type || 'vc',
        opportunity_type: data.opportunity_type || '',
        description: data.description || '',
        min_ticket_size: data.min_ticket_size != null ? String(data.min_ticket_size) : '',
        max_ticket_size: data.max_ticket_size != null ? String(data.max_ticket_size) : '',
        funding_amount: data.funding_amount || '',
        fund_size: data.fund_size != null ? String(data.fund_size) : '',
        vintage_year: data.vintage_year != null ? String(data.vintage_year) : '',
        aum: data.aum != null ? String(data.aum) : '',
        headquarters_city: data.headquarters_city || '',
        headquarters_country: data.headquarters_country || '',
        website_url: data.website_url || '',
        application_link: data.application_link || '',
        logo_url: data.logo_url || '',
        eligibility: data.eligibility || '',
        application_process: data.application_process || '',
        deadline: data.deadline ? data.deadline.slice(0, 16) : '',
        stages: (data.stages || []).join(', '),
        industries: (data.industries || []).join(', '),
        geographies: (data.geographies || []).join(', '),
        tags: (data.tags || []).join(', '),
        is_active: data.is_active ?? true,
        is_featured: data.is_featured ?? false,
        is_sponsored: data.is_sponsored ?? false,
      })
    } catch {
      setFundFormError('Failed to load fund details.')
    }
  }

  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fundForm.name.trim()) { setFundFormError('Name is required.'); return }
    setFundFormLoading(true)
    setFundFormError(null)
    const body: Record<string, unknown> = {
      name: fundForm.name, organization: fundForm.organization, fund_type: fundForm.fund_type,
      opportunity_type: fundForm.opportunity_type || null, description: fundForm.description,
      headquarters_city: fundForm.headquarters_city,
      headquarters_country: fundForm.headquarters_country.toUpperCase(),
      website_url: fundForm.website_url || null, application_link: fundForm.application_link || null,
      logo_url: fundForm.logo_url || null, funding_amount: fundForm.funding_amount || null,
      eligibility: fundForm.eligibility, application_process: fundForm.application_process,
      deadline: fundForm.deadline || null,
      stages: csvToArray(fundForm.stages), industries: csvToArray(fundForm.industries),
      geographies: csvToArray(fundForm.geographies), tags: csvToArray(fundForm.tags),
      is_active: fundForm.is_active, is_featured: fundForm.is_featured, is_sponsored: fundForm.is_sponsored,
    }
    if (fundForm.min_ticket_size) body.min_ticket_size = fundForm.min_ticket_size
    if (fundForm.max_ticket_size) body.max_ticket_size = fundForm.max_ticket_size
    if (fundForm.fund_size) body.fund_size = fundForm.fund_size
    if (fundForm.vintage_year) body.vintage_year = Number(fundForm.vintage_year)
    if (fundForm.aum) body.aum = fundForm.aum
    try {
      if (editingFundId) {
        await apiRequest(`/admin/funds/${editingFundId}/`, { method: 'PATCH', body })
        pushToast('Fund updated', 'success')
      } else {
        await apiRequest('/admin/funds/', { method: 'POST', body })
        pushToast('Fund created', 'success')
      }
      setShowFundModal(false)
      setFundsReloadKey((k) => k + 1)
    } catch {
      setFundFormError(editingFundId ? 'Failed to update fund.' : 'Failed to create fund.')
    } finally {
      setFundFormLoading(false)
    }
  }

  // ── Benefit CRUD ─────────────────────────────────────────────────────────────
  const openCreateBenefit = () => {
    setEditingBenefitId(null)
    setBenefitForm(emptyBenefitForm)
    setBenefitFormError(null)
    setShowBenefitModal(true)
  }

  const openEditBenefit = async (id: string) => {
    setEditingBenefitId(id)
    setBenefitFormError(null)
    setShowBenefitModal(true)
    try {
      const data = await apiRequest<AdminBenefit & { description?: string; eligibility?: string; redemption_steps?: string }>(`/admin/benefits/${id}/`)
      setBenefitForm({
        title: data.title || '',
        provider: data.provider || '',
        category: data.category || 'other',
        description: (data as { description?: string }).description || '',
        value: data.value || '',
        website_url: data.website_url || '',
        eligibility: (data as { eligibility?: string }).eligibility || '',
        redemption_steps: (data as { redemption_steps?: string }).redemption_steps || '',
        tags: (data.tags || []).join(', '),
        is_active: data.is_active ?? true,
        is_featured: data.is_featured ?? false,
      })
    } catch {
      setBenefitFormError('Failed to load benefit details.')
    }
  }

  const handleBenefitSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!benefitForm.title.trim()) { setBenefitFormError('Title is required.'); return }
    setBenefitFormLoading(true)
    setBenefitFormError(null)
    const body = {
      title: benefitForm.title, provider: benefitForm.provider, category: benefitForm.category,
      description: benefitForm.description, value: benefitForm.value || null,
      website_url: benefitForm.website_url || null, eligibility: benefitForm.eligibility,
      redemption_steps: benefitForm.redemption_steps, tags: csvToArray(benefitForm.tags),
      is_active: benefitForm.is_active, is_featured: benefitForm.is_featured,
    }
    try {
      if (editingBenefitId) {
        await apiRequest(`/admin/benefits/${editingBenefitId}/`, { method: 'PATCH', body })
        pushToast('Benefit updated', 'success')
      } else {
        await apiRequest('/admin/benefits/', { method: 'POST', body })
        pushToast('Benefit created', 'success')
      }
      setShowBenefitModal(false)
      setBenefitsReloadKey((k) => k + 1)
    } catch {
      setBenefitFormError(editingBenefitId ? 'Failed to update benefit.' : 'Failed to create benefit.')
    } finally {
      setBenefitFormLoading(false)
    }
  }

  const updateFundField = (field: keyof FundFormData, value: string | boolean) =>
    setFundForm((prev) => ({ ...prev, [field]: value }))
  const updateBenefitField = (field: keyof BenefitFormData, value: string | boolean) =>
    setBenefitForm((prev) => ({ ...prev, [field]: value }))

  const tabStyle = (tab: 'funds' | 'benefits'): React.CSSProperties => ({
    padding: '0.5rem 1.25rem', borderRadius: '0.5rem 0.5rem 0 0', fontWeight: 500,
    fontSize: '0.875rem', cursor: 'pointer', border: 'none',
    background: activeTab === tab ? 'hsl(var(--card))' : 'transparent',
    color: activeTab === tab ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
    borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
  })

  const statusBadge = (isActive: boolean | undefined) =>
    isActive !== false
      ? <span className="badge success">Active</span>
      : <span className="badge" style={{ color: 'hsl(var(--muted-foreground))' }}>Inactive</span>

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div data-testid="admin-funds-page">
      <Link className="back-btn" to="/app/admin">
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Admin
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Funds &amp; Benefits</h1>
          <p className="page-description">Manage funding opportunities and startup perks.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {activeTab === 'funds' && total !== null && <span className="badge info">{total} total</span>}
          {activeTab === 'funds' && (
            <button type="button" className="btn-sm primary" onClick={openCreateFund} data-testid="create-fund-btn">
              <Plus style={{ width: 14, height: 14 }} /> New Fund
            </button>
          )}
          {activeTab === 'benefits' && (
            <button type="button" className="btn-sm primary" onClick={openCreateBenefit} data-testid="create-benefit-btn">
              <Plus style={{ width: 14, height: 14 }} /> New Benefit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid hsl(var(--border))', marginBottom: '1.5rem' }}>
        <button style={tabStyle('funds')} onClick={() => setActiveTab('funds')}>
          <Landmark size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
          Funds
        </button>
        <button style={tabStyle('benefits')} onClick={() => setActiveTab('benefits')}>
          <Gift size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
          Benefits
        </button>
      </div>

      {/* ── Funds Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'funds' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header"><h2 className="card-title">Filters</h2></div>
            <div className="grid-3" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label>Search</label>
                <input className="input" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Name or organization" />
              </div>
              <div className="form-group">
                <label>Active</label>
                <select className="select" value={filters.active} onChange={(e) => setFilters((p) => ({ ...p, active: e.target.value }))}>
                  <option value="">Any</option><option value="true">Active</option><option value="false">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label>Featured</label>
                <select className="select" value={filters.featured} onChange={(e) => setFilters((p) => ({ ...p, featured: e.target.value }))}>
                  <option value="">Any</option><option value="true">Featured</option><option value="false">Not featured</option>
                </select>
              </div>
              <div className="form-group">
                <label>Sponsored</label>
                <select className="select" value={filters.sponsored} onChange={(e) => setFilters((p) => ({ ...p, sponsored: e.target.value }))}>
                  <option value="">Any</option><option value="true">Sponsored</option><option value="false">Not sponsored</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fund type</label>
                <input className="input" value={filters.fund_type} onChange={(e) => setFilters((p) => ({ ...p, fund_type: e.target.value }))} placeholder="vc, angel, accelerator" />
              </div>
              <div className="form-group">
                <label>Opportunity type</label>
                <input className="input" value={filters.opportunity_type} onChange={(e) => setFilters((p) => ({ ...p, opportunity_type: e.target.value }))} placeholder="grant, vc_program" />
              </div>
            </div>
          </div>

          {fundsLoading && <div className="empty-state"><Landmark className="empty-icon" strokeWidth={1.5} /><p className="empty-description">Loading funds...</p></div>}
          {fundsError && <div className="empty-state"><p className="empty-description" style={{ color: '#ef4444' }}>{fundsError}</p></div>}

          {!fundsLoading && !fundsError && (
            <>
              {funds.length === 0 ? (
                <div className="empty-state"><Search className="empty-icon" strokeWidth={1.5} /><h3 className="empty-title">No funds found</h3><p className="empty-description">Try adjusting your filters.</p></div>
              ) : (
                <div className="card">
                  <table className="data-table" data-testid="funds-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Organization</th><th>Type</th><th>Opportunity</th>
                        <th>Location</th><th>Status</th><th>Flags</th><th>Deadline</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funds.map((fund) => {
                        const expired = fund.deadline ? new Date(fund.deadline) < new Date() : false
                        const isLive = fund.is_active !== false && !expired
                        return (
                          <tr key={fund.id} data-testid={`fund-row-${fund.id}`}>
                            <td style={{ fontWeight: 500 }}>
                              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isLive ? '#22c55e' : '#6b7280', marginRight: 8, flexShrink: 0 }} />
                              {fund.name}
                            </td>
                            <td>{fund.organization || '—'}</td>
                            <td><span className="tag">{fund.fund_type || 'fund'}</span></td>
                            <td>{fund.opportunity_type ? <span className="tag">{fund.opportunity_type}</span> : '—'}</td>
                            <td>{fund.headquarters_city || fund.headquarters_country ? `${fund.headquarters_city || ''}${fund.headquarters_city && fund.headquarters_country ? ', ' : ''}${fund.headquarters_country || ''}` : '—'}</td>
                            <td>{statusBadge(fund.is_active)}</td>
                            <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                              {fund.is_featured ? <span className="badge info">Featured</span> : null}
                              {fund.is_sponsored ? <span className="badge warning">Sponsored</span> : null}
                            </td>
                            <td style={{ color: expired ? '#ef4444' : undefined }}>{fund.deadline ? new Date(fund.deadline).toLocaleDateString() : '—'}</td>
                            <td>
                              <button type="button" className="btn-sm ghost" onClick={() => void openEditFund(fund.id)} data-testid={`edit-fund-${fund.id}`}>
                                <Pencil style={{ width: 14, height: 14 }} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn-sm ghost" type="button" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>Previous</button>
                <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Page {page}{total ? ` of ${Math.ceil(total / 20)}` : ''}</span>
                <button className="btn-sm ghost" type="button" onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Benefits Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'benefits' && (
        <>
          {benefitsLoading && <div className="empty-state"><Gift className="empty-icon" strokeWidth={1.5} /><p className="empty-description">Loading benefits...</p></div>}
          {benefitsError && <div className="empty-state"><p className="empty-description" style={{ color: '#ef4444' }}>{benefitsError}</p></div>}

          {!benefitsLoading && !benefitsError && (
            benefits.length === 0 ? (
              <div className="empty-state">
                <Gift className="empty-icon" strokeWidth={1.5} />
                <h3 className="empty-title">No benefits yet</h3>
                <p className="empty-description">Click "New Benefit" to add your first startup perk.</p>
              </div>
            ) : (
              <div className="card">
                <table className="data-table" data-testid="benefits-table">
                  <thead>
                    <tr><th>Title</th><th>Provider</th><th>Category</th><th>Value</th><th>Status</th><th>Flags</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {benefits.map((benefit) => (
                      <tr key={benefit.id} data-testid={`benefit-row-${benefit.id}`}>
                        <td style={{ fontWeight: 500 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: benefit.is_active !== false ? '#22c55e' : '#6b7280', marginRight: 8 }} />
                          {benefit.title}
                        </td>
                        <td>{benefit.provider || '—'}</td>
                        <td>{benefit.category ? <span className="tag" style={{ textTransform: 'capitalize' }}>{benefit.category}</span> : '—'}</td>
                        <td style={{ fontSize: '0.8125rem', color: '#22c55e', fontWeight: 500 }}>{benefit.value || '—'}</td>
                        <td>{statusBadge(benefit.is_active)}</td>
                        <td>{benefit.is_featured ? <span className="badge info">Featured</span> : null}</td>
                        <td>
                          <button type="button" className="btn-sm ghost" onClick={() => void openEditBenefit(benefit.id)} data-testid={`edit-benefit-${benefit.id}`}>
                            <Pencil style={{ width: 14, height: 14 }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {/* ── Fund Modal ─────────────────────────────────────────────────────────── */}
      {showFundModal && (
        <div data-testid="fund-modal" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowFundModal(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: '40rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{editingFundId ? 'Edit Fund' : 'Create Fund'}</h2>
              <button type="button" className="btn-sm ghost" onClick={() => setShowFundModal(false)}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            {fundFormError && <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '0.375rem', background: 'hsl(0 70% 50% / 0.15)', color: '#ef4444', fontSize: '0.875rem' }}>{fundFormError}</div>}
            <form onSubmit={(e) => void handleFundSubmit(e)}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>Basic Info</h3>
              <div className="form-group"><label>Name *</label><input className="input" value={fundForm.name} onChange={(e) => updateFundField('name', e.target.value)} /></div>
              <div className="form-group"><label>Organization</label><input className="input" value={fundForm.organization} onChange={(e) => updateFundField('organization', e.target.value)} /></div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Fund Type</label>
                  <select className="select" value={fundForm.fund_type} onChange={(e) => updateFundField('fund_type', e.target.value)}>
                    <option value="vc">Venture Capital</option><option value="angel">Angel Investor</option>
                    <option value="accelerator">Accelerator</option><option value="grant">Grant</option>
                    <option value="corporate_vc">Corporate VC</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Opportunity Type</label>
                  <select className="select" value={fundForm.opportunity_type} onChange={(e) => updateFundField('opportunity_type', e.target.value)}>
                    <option value="">None</option><option value="grant">Grant</option><option value="accelerator">Accelerator</option>
                    <option value="vc_program">VC Program</option><option value="syndicate">Syndicate</option>
                    <option value="government">Government</option><option value="competition">Competition</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Description</label><MarkdownTextarea className="textarea" rows={3} value={fundForm.description} onChange={(e) => updateFundField('description', e.target.value)} /></div>

              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: '1rem 0 0.5rem' }}>Investment Details</h3>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group"><label>Min Ticket Size</label><input className="input" type="number" value={fundForm.min_ticket_size} onChange={(e) => updateFundField('min_ticket_size', e.target.value)} /></div>
                <div className="form-group"><label>Max Ticket Size</label><input className="input" type="number" value={fundForm.max_ticket_size} onChange={(e) => updateFundField('max_ticket_size', e.target.value)} /></div>
                <div className="form-group"><label>Funding Amount</label><input className="input" value={fundForm.funding_amount} onChange={(e) => updateFundField('funding_amount', e.target.value)} placeholder="e.g. Up to $50K" /></div>
                <div className="form-group"><label>Vintage Year</label><input className="input" type="number" value={fundForm.vintage_year} onChange={(e) => updateFundField('vintage_year', e.target.value)} /></div>
              </div>

              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: '1rem 0 0.5rem' }}>Location &amp; Links</h3>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group"><label>HQ City</label><input className="input" value={fundForm.headquarters_city} onChange={(e) => updateFundField('headquarters_city', e.target.value)} /></div>
                <div className="form-group"><label>HQ Country (ISO)</label><input className="input" value={fundForm.headquarters_country} onChange={(e) => updateFundField('headquarters_country', e.target.value)} placeholder="US" maxLength={2} /></div>
                <div className="form-group"><label>Website URL</label><input className="input" value={fundForm.website_url} onChange={(e) => updateFundField('website_url', e.target.value)} /></div>
                <div className="form-group"><label>Application Link</label><input className="input" value={fundForm.application_link} onChange={(e) => updateFundField('application_link', e.target.value)} /></div>
              </div>

              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: '1rem 0 0.5rem' }}>Eligibility &amp; Tags</h3>
              <div className="form-group"><label>Eligibility</label><MarkdownTextarea className="textarea" rows={2} value={fundForm.eligibility} onChange={(e) => updateFundField('eligibility', e.target.value)} /></div>
              <div className="form-group"><label>Application Process</label><MarkdownTextarea className="textarea" rows={2} value={fundForm.application_process} onChange={(e) => updateFundField('application_process', e.target.value)} /></div>
              <div className="form-group"><label>Deadline</label><input className="input" type="datetime-local" value={fundForm.deadline} onChange={(e) => updateFundField('deadline', e.target.value)} /></div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group"><label>Stages (comma-separated)</label><input className="input" value={fundForm.stages} onChange={(e) => updateFundField('stages', e.target.value)} placeholder="pre_seed, seed, series_a" /></div>
                <div className="form-group"><label>Industries (comma-separated)</label><input className="input" value={fundForm.industries} onChange={(e) => updateFundField('industries', e.target.value)} placeholder="fintech, healthtech" /></div>
                <div className="form-group"><label>Geographies (comma-separated)</label><input className="input" value={fundForm.geographies} onChange={(e) => updateFundField('geographies', e.target.value)} placeholder="US, IN, GB" /></div>
                <div className="form-group"><label>Tags (comma-separated)</label><input className="input" value={fundForm.tags} onChange={(e) => updateFundField('tags', e.target.value)} placeholder="climate, ai, b2b" /></div>
              </div>

              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: '1rem 0 0.5rem' }}>Admin Flags</h3>
              <div className="grid-3" style={{ gap: '0.75rem' }}>
                <label className="toggle-switch"><input type="checkbox" checked={fundForm.is_active} onChange={(e) => updateFundField('is_active', e.target.checked)} /><span>Active</span></label>
                <label className="toggle-switch"><input type="checkbox" checked={fundForm.is_featured} onChange={(e) => updateFundField('is_featured', e.target.checked)} /><span>Featured</span></label>
                <label className="toggle-switch"><input type="checkbox" checked={fundForm.is_sponsored} onChange={(e) => updateFundField('is_sponsored', e.target.checked)} /><span>Sponsored</span></label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn-sm ghost" onClick={() => setShowFundModal(false)}>Cancel</button>
                <button type="submit" className="btn-sm primary" disabled={fundFormLoading}>{fundFormLoading ? (editingFundId ? 'Saving...' : 'Creating...') : (editingFundId ? 'Save' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Benefit Modal ───────────────────────────────────────────────────────── */}
      {showBenefitModal && (
        <div data-testid="benefit-modal" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBenefitModal(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: '36rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{editingBenefitId ? 'Edit Benefit' : 'Create Benefit'}</h2>
              <button type="button" className="btn-sm ghost" onClick={() => setShowBenefitModal(false)}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            {benefitFormError && <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '0.375rem', background: 'hsl(0 70% 50% / 0.15)', color: '#ef4444', fontSize: '0.875rem' }}>{benefitFormError}</div>}
            <form onSubmit={(e) => void handleBenefitSubmit(e)}>
              <div className="form-group"><label>Title *</label><input className="input" value={benefitForm.title} onChange={(e) => updateBenefitField('title', e.target.value)} /></div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group"><label>Provider</label><input className="input" value={benefitForm.provider} onChange={(e) => updateBenefitField('provider', e.target.value)} placeholder="e.g. AWS, Stripe" /></div>
                <div className="form-group">
                  <label>Category</label>
                  <select className="select" value={benefitForm.category} onChange={(e) => updateBenefitField('category', e.target.value)}>
                    <option value="credits">Cloud Credits</option><option value="tools">Tools &amp; Software</option>
                    <option value="legal">Legal</option><option value="finance">Finance</option>
                    <option value="marketing">Marketing</option><option value="community">Community</option>
                    <option value="education">Education</option><option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Description</label><MarkdownTextarea className="textarea" rows={3} value={benefitForm.description} onChange={(e) => updateBenefitField('description', e.target.value)} /></div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group"><label>Value / Offer</label><input className="input" value={benefitForm.value} onChange={(e) => updateBenefitField('value', e.target.value)} placeholder="e.g. $10,000 in credits" /></div>
                <div className="form-group"><label>Website / Claim URL</label><input className="input" value={benefitForm.website_url} onChange={(e) => updateBenefitField('website_url', e.target.value)} /></div>
              </div>
              <div className="form-group"><label>Eligibility</label><MarkdownTextarea className="textarea" rows={2} value={benefitForm.eligibility} onChange={(e) => updateBenefitField('eligibility', e.target.value)} /></div>
              <div className="form-group"><label>Redemption Steps</label><MarkdownTextarea className="textarea" rows={2} value={benefitForm.redemption_steps} onChange={(e) => updateBenefitField('redemption_steps', e.target.value)} /></div>
              <div className="form-group"><label>Tags (comma-separated)</label><input className="input" value={benefitForm.tags} onChange={(e) => updateBenefitField('tags', e.target.value)} placeholder="cloud, devtools, legal" /></div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <label className="toggle-switch"><input type="checkbox" checked={benefitForm.is_active} onChange={(e) => updateBenefitField('is_active', e.target.checked)} /><span>Active</span></label>
                <label className="toggle-switch"><input type="checkbox" checked={benefitForm.is_featured} onChange={(e) => updateBenefitField('is_featured', e.target.checked)} /><span>Featured</span></label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn-sm ghost" onClick={() => setShowBenefitModal(false)}>Cancel</button>
                <button type="submit" className="btn-sm primary" disabled={benefitFormLoading}>{benefitFormLoading ? (editingBenefitId ? 'Saving...' : 'Creating...') : (editingBenefitId ? 'Save' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
