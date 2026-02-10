import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Landmark, Pencil, Plus, Search, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList, type PaginatedResponse } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { MarkdownTextarea } from '../components/MarkdownTextarea'
import type { FundDetail, FundListItem } from '../types/fund'

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

const emptyForm: FundFormData = {
  name: '',
  organization: '',
  fund_type: 'vc',
  opportunity_type: '',
  description: '',
  min_ticket_size: '',
  max_ticket_size: '',
  funding_amount: '',
  fund_size: '',
  vintage_year: '',
  aum: '',
  headquarters_city: '',
  headquarters_country: '',
  website_url: '',
  application_link: '',
  logo_url: '',
  eligibility: '',
  application_process: '',
  deadline: '',
  stages: '',
  industries: '',
  geographies: '',
  tags: '',
  is_active: true,
  is_featured: false,
  is_sponsored: false,
}

function csvToArray(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function AdminFundsPage() {
  const { pushToast } = useToast()
  const [funds, setFunds] = useState<AdminFund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    active: '',
    featured: '',
    sponsored: '',
    fund_type: '',
    opportunity_type: '',
  })

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingFundId, setEditingFundId] = useState<string | null>(null)
  const [form, setForm] = useState<FundFormData>(emptyForm)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    params.set('page', String(page))
    return params.toString()
  }, [filters, page])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<AdminFund[] | PaginatedResponse<AdminFund>>(`/admin/funds/?${query}`)
        const list = normalizeList(data)
        if (!cancelled) {
          setFunds(list)
          setTotal(!Array.isArray(data) ? data.count ?? null : null)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load funds.')
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
  }, [query, reloadKey])

  const statusBadge = (fund: AdminFund) => {
    if (fund.is_active === undefined) return null
    return fund.is_active
      ? <span className="badge success">Active</span>
      : <span className="badge warning">Inactive</span>
  }

  const openCreate = () => {
    setEditingFundId(null)
    setForm(emptyForm)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = async (fundId: string) => {
    setEditingFundId(fundId)
    setFormError(null)
    setShowModal(true)
    try {
      const data = await apiRequest<FundDetail>(`/admin/funds/${fundId}/`)
      setForm({
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
      setFormError('Failed to load fund details.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }

    setFormLoading(true)
    setFormError(null)

    const body: Record<string, unknown> = {
      name: form.name,
      organization: form.organization,
      fund_type: form.fund_type,
      opportunity_type: form.opportunity_type || null,
      description: form.description,
      headquarters_city: form.headquarters_city,
      headquarters_country: form.headquarters_country.toUpperCase(),
      website_url: form.website_url || null,
      application_link: form.application_link || null,
      logo_url: form.logo_url || null,
      funding_amount: form.funding_amount || null,
      eligibility: form.eligibility,
      application_process: form.application_process,
      deadline: form.deadline || null,
      stages: csvToArray(form.stages),
      industries: csvToArray(form.industries),
      geographies: csvToArray(form.geographies),
      tags: csvToArray(form.tags),
      is_active: form.is_active,
      is_featured: form.is_featured,
      is_sponsored: form.is_sponsored,
    }
    if (form.min_ticket_size) body.min_ticket_size = form.min_ticket_size
    if (form.max_ticket_size) body.max_ticket_size = form.max_ticket_size
    if (form.fund_size) body.fund_size = form.fund_size
    if (form.vintage_year) body.vintage_year = Number(form.vintage_year)
    if (form.aum) body.aum = form.aum

    try {
      if (editingFundId) {
        await apiRequest(`/admin/funds/${editingFundId}/`, { method: 'PATCH', body })
        pushToast('Fund updated', 'success')
      } else {
        await apiRequest('/admin/funds/', { method: 'POST', body })
        pushToast('Fund created', 'success')
      }
      setShowModal(false)
      setReloadKey((k) => k + 1)
    } catch {
      setFormError(editingFundId ? 'Failed to update fund.' : 'Failed to create fund.')
    } finally {
      setFormLoading(false)
    }
  }

  const updateField = (field: keyof FundFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div data-testid="admin-funds-page">
      <Link className="back-btn" to="/app/admin">
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Admin
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Funds</h1>
          <p className="page-description">Review all funding opportunities across the platform.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {total !== null && <span className="badge info">{total} total</span>}
          <button type="button" className="btn-sm primary" onClick={openCreate} data-testid="create-fund-btn">
            <Plus style={{ width: 14, height: 14 }} />
            Create Fund
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Filters</h2>
        </div>
        <div className="grid-3" style={{ gap: '0.75rem' }}>
          <div className="form-group">
            <label>Search</label>
            <input
              className="input"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Name or organization"
            />
          </div>
          <div className="form-group">
            <label>Active</label>
            <select className="select" value={filters.active} onChange={(event) => setFilters((prev) => ({ ...prev, active: event.target.value }))}>
              <option value="">Any</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="form-group">
            <label>Featured</label>
            <select className="select" value={filters.featured} onChange={(event) => setFilters((prev) => ({ ...prev, featured: event.target.value }))}>
              <option value="">Any</option>
              <option value="true">Featured</option>
              <option value="false">Not featured</option>
            </select>
          </div>
          <div className="form-group">
            <label>Sponsored</label>
            <select className="select" value={filters.sponsored} onChange={(event) => setFilters((prev) => ({ ...prev, sponsored: event.target.value }))}>
              <option value="">Any</option>
              <option value="true">Sponsored</option>
              <option value="false">Not sponsored</option>
            </select>
          </div>
          <div className="form-group">
            <label>Fund type</label>
            <input
              className="input"
              value={filters.fund_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, fund_type: event.target.value }))}
              placeholder="vc, angel, accelerator"
            />
          </div>
          <div className="form-group">
            <label>Opportunity type</label>
            <input
              className="input"
              value={filters.opportunity_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, opportunity_type: event.target.value }))}
              placeholder="grant, vc_program"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <Landmark className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading funds...</p>
        </div>
      )}
      {error && <div className="empty-state"><p className="empty-description" style={{ color: '#ef4444' }}>{error}</p></div>}

      {!loading && !error && (
        <>
          {funds.length === 0 ? (
            <div className="empty-state">
              <Search className="empty-icon" strokeWidth={1.5} />
              <h3 className="empty-title">No funds found</h3>
              <p className="empty-description">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="card">
              <table className="data-table" data-testid="funds-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Organization</th>
                    <th>Type</th>
                    <th>Opportunity</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Tags</th>
                    <th>Deadline</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map((fund) => (
                    <tr key={fund.id} data-testid={`fund-row-${fund.id}`}>
                      <td style={{ fontWeight: 500 }}>{fund.name}</td>
                      <td>{fund.organization || '\u2014'}</td>
                      <td><span className="tag">{fund.fund_type || 'fund'}</span></td>
                      <td>{fund.opportunity_type ? <span className="tag">{fund.opportunity_type}</span> : '\u2014'}</td>
                      <td>
                        {fund.headquarters_city || fund.headquarters_country
                          ? `${fund.headquarters_city || ''}${fund.headquarters_city && fund.headquarters_country ? ', ' : ''}${fund.headquarters_country || ''}`
                          : '\u2014'}
                      </td>
                      <td>{statusBadge(fund)}</td>
                      <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {fund.is_featured ? <span className="badge info">Featured</span> : null}
                        {fund.is_sponsored ? <span className="badge warning">Sponsored</span> : null}
                      </td>
                      <td>{fund.deadline ? new Date(fund.deadline).toLocaleDateString() : '\u2014'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-sm ghost"
                          onClick={() => openEdit(fund.id)}
                          data-testid={`edit-fund-${fund.id}`}
                        >
                          <Pencil style={{ width: 14, height: 14 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="btn-sm ghost" type="button" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page === 1}>
              Previous
            </button>
            <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
              Page {page}
              {total ? ` of ${Math.ceil(total / 20)}` : ''}
            </span>
            <button className="btn-sm ghost" type="button" onClick={() => setPage((prev) => prev + 1)}>
              Next
            </button>
          </div>
        </>
      )}

      {/* Create/Edit Fund Modal */}
      {showModal && (
        <div
          data-testid="fund-modal"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '40rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                {editingFundId ? 'Edit Fund' : 'Create Fund'}
              </h2>
              <button type="button" className="btn-sm ghost" onClick={() => setShowModal(false)} data-testid="close-fund-modal">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '0.5rem 0.75rem', margin: '0 0 0.75rem', borderRadius: '0.375rem', background: 'hsl(0 70% 50% / 0.15)', color: '#ef4444', fontSize: '0.875rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Section 1 - Basic Info */}
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                Basic Info
              </h3>
              <div className="form-group">
                <label>Name *</label>
                <input className="input" value={form.name} onChange={(e) => updateField('name', e.target.value)} data-testid="fund-name-input" />
              </div>
              <div className="form-group">
                <label>Organization</label>
                <input className="input" value={form.organization} onChange={(e) => updateField('organization', e.target.value)} data-testid="fund-org-input" />
              </div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Fund Type</label>
                  <select className="select" value={form.fund_type} onChange={(e) => updateField('fund_type', e.target.value)} data-testid="fund-type-select">
                    <option value="vc">Venture Capital</option>
                    <option value="angel">Angel Investor</option>
                    <option value="accelerator">Accelerator</option>
                    <option value="grant">Grant</option>
                    <option value="corporate_vc">Corporate VC</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Opportunity Type</label>
                  <select className="select" value={form.opportunity_type} onChange={(e) => updateField('opportunity_type', e.target.value)} data-testid="fund-opp-type-select">
                    <option value="">None</option>
                    <option value="grant">Grant</option>
                    <option value="accelerator">Accelerator</option>
                    <option value="vc_program">VC Program</option>
                    <option value="syndicate">Syndicate</option>
                    <option value="government">Government</option>
                    <option value="competition">Competition</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <MarkdownTextarea className="textarea" rows={3} value={form.description} onChange={(e) => updateField('description', e.target.value)} data-testid="fund-desc-input" />
              </div>

              {/* Section 2 - Investment Details */}
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: '1rem 0 0.5rem' }}>
                Investment Details
              </h3>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Min Ticket Size</label>
                  <input className="input" type="number" value={form.min_ticket_size} onChange={(e) => updateField('min_ticket_size', e.target.value)} data-testid="fund-min-ticket" />
                </div>
                <div className="form-group">
                  <label>Max Ticket Size</label>
                  <input className="input" type="number" value={form.max_ticket_size} onChange={(e) => updateField('max_ticket_size', e.target.value)} data-testid="fund-max-ticket" />
                </div>
                <div className="form-group">
                  <label>Funding Amount</label>
                  <input className="input" value={form.funding_amount} onChange={(e) => updateField('funding_amount', e.target.value)} placeholder="e.g. Up to $50K" data-testid="fund-amount-input" />
                </div>
                <div className="form-group">
                  <label>Fund Size</label>
                  <input className="input" type="number" value={form.fund_size} onChange={(e) => updateField('fund_size', e.target.value)} data-testid="fund-size-input" />
                </div>
                <div className="form-group">
                  <label>Vintage Year</label>
                  <input className="input" type="number" value={form.vintage_year} onChange={(e) => updateField('vintage_year', e.target.value)} data-testid="fund-vintage-input" />
                </div>
                <div className="form-group">
                  <label>AUM</label>
                  <input className="input" type="number" value={form.aum} onChange={(e) => updateField('aum', e.target.value)} data-testid="fund-aum-input" />
                </div>
              </div>

              {/* Section 3 - Location & Links */}
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: '1rem 0 0.5rem' }}>
                Location & Links
              </h3>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label>HQ City</label>
                  <input className="input" value={form.headquarters_city} onChange={(e) => updateField('headquarters_city', e.target.value)} data-testid="fund-city-input" />
                </div>
                <div className="form-group">
                  <label>HQ Country (ISO)</label>
                  <input className="input" value={form.headquarters_country} onChange={(e) => updateField('headquarters_country', e.target.value)} placeholder="US" maxLength={2} data-testid="fund-country-input" />
                </div>
                <div className="form-group">
                  <label>Website URL</label>
                  <input className="input" value={form.website_url} onChange={(e) => updateField('website_url', e.target.value)} data-testid="fund-website-input" />
                </div>
                <div className="form-group">
                  <label>Application Link</label>
                  <input className="input" value={form.application_link} onChange={(e) => updateField('application_link', e.target.value)} data-testid="fund-applink-input" />
                </div>
              </div>
              <div className="form-group">
                <label>Logo URL</label>
                <input className="input" value={form.logo_url} onChange={(e) => updateField('logo_url', e.target.value)} data-testid="fund-logo-input" />
              </div>

              {/* Section 4 - Eligibility & Tags */}
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: '1rem 0 0.5rem' }}>
                Eligibility & Tags
              </h3>
              <div className="form-group">
                <label>Eligibility</label>
                <MarkdownTextarea className="textarea" rows={2} value={form.eligibility} onChange={(e) => updateField('eligibility', e.target.value)} data-testid="fund-eligibility-input" />
              </div>
              <div className="form-group">
                <label>Application Process</label>
                <MarkdownTextarea className="textarea" rows={2} value={form.application_process} onChange={(e) => updateField('application_process', e.target.value)} data-testid="fund-process-input" />
              </div>
              <div className="form-group">
                <label>Deadline</label>
                <input className="input" type="datetime-local" value={form.deadline} onChange={(e) => updateField('deadline', e.target.value)} data-testid="fund-deadline-input" />
              </div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Stages (comma-separated)</label>
                  <input className="input" value={form.stages} onChange={(e) => updateField('stages', e.target.value)} placeholder="pre_seed, seed, series_a" data-testid="fund-stages-input" />
                </div>
                <div className="form-group">
                  <label>Industries (comma-separated)</label>
                  <input className="input" value={form.industries} onChange={(e) => updateField('industries', e.target.value)} placeholder="fintech, healthtech" data-testid="fund-industries-input" />
                </div>
                <div className="form-group">
                  <label>Geographies (comma-separated)</label>
                  <input className="input" value={form.geographies} onChange={(e) => updateField('geographies', e.target.value)} placeholder="US, IN, GB" data-testid="fund-geo-input" />
                </div>
                <div className="form-group">
                  <label>Tags (comma-separated)</label>
                  <input className="input" value={form.tags} onChange={(e) => updateField('tags', e.target.value)} placeholder="climate, ai, b2b" data-testid="fund-tags-input" />
                </div>
              </div>

              {/* Section 5 - Admin Flags */}
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: '1rem 0 0.5rem' }}>
                Admin Flags
              </h3>
              <div className="grid-3" style={{ gap: '0.75rem' }}>
                <label className="toggle-switch" data-testid="fund-active-toggle">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} />
                  <span>Active</span>
                </label>
                <label className="toggle-switch" data-testid="fund-featured-toggle">
                  <input type="checkbox" checked={form.is_featured} onChange={(e) => updateField('is_featured', e.target.checked)} />
                  <span>Featured</span>
                </label>
                <label className="toggle-switch" data-testid="fund-sponsored-toggle">
                  <input type="checkbox" checked={form.is_sponsored} onChange={(e) => updateField('is_sponsored', e.target.checked)} />
                  <span>Sponsored</span>
                </label>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn-sm ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-sm primary" disabled={formLoading} data-testid="fund-submit-btn">
                  {formLoading
                    ? (editingFundId ? 'Saving...' : 'Creating...')
                    : (editingFundId ? 'Save' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
