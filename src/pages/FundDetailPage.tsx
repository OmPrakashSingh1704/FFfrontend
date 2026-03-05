import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Calendar,
  TrendingUp,
  Target,
  Globe,
  ExternalLink,
  User,
  Wallet,
  Send,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { Markdown } from '../components/Markdown'
import { useToast } from '../context/ToastContext'
import type { FundDetail } from '../types/fund'

type SavedFundEntry = { id: string; fund: { id: string } }

export function FundDetailPage() {
  const { id } = useParams()
  const { pushToast } = useToast()
  const [fund, setFund] = useState<FundDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FundDetail>(`/funds/${id}/`)
        if (!cancelled) {
          setFund(data)
          // If already saved, find the saved entry ID so we can delete it
          if (data.is_saved) {
            try {
              const savedList = await apiRequest<SavedFundEntry[] | { results: SavedFundEntry[] }>('/funds/saved/')
              const entries = normalizeList(savedList)
              const match = entries.find((e) => e.fund?.id === id)
              if (!cancelled && match) setSavedEntryId(match.id)
            } catch {
              // non-critical
            }
          }
        }
      } catch {
        if (!cancelled) setError('Unable to load fund details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [id])

  const handleSave = async () => {
    if (!fund || !id) return
    setSaving(true)
    try {
      if (savedEntryId) {
        await apiRequest(`/funds/saved/${savedEntryId}/`, { method: 'DELETE' })
        setSavedEntryId(null)
        setFund((prev) => prev ? { ...prev, is_saved: false } : prev)
        pushToast('Fund removed from saved', 'success')
      } else {
        const entry = await apiRequest<SavedFundEntry>('/funds/saved/', {
          method: 'POST',
          body: { fund: id },
        })
        setSavedEntryId(entry.id)
        setFund((prev) => prev ? { ...prev, is_saved: true } : prev)
        pushToast('Fund saved', 'success')
      }
    } catch {
      pushToast('Action failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatTicket = (min?: number | null, max?: number | null) => {
    if (!min && !max) return 'Not specified'
    const fmt = (n: number) => {
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
      if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`
      return `$${n}`
    }
    if (min && max) return `${fmt(min)} – ${fmt(max)}`
    if (min) return `${fmt(min)}+`
    return `Up to ${fmt(max!)}`
  }

  return (
    <div>
      <Link to="/app/funds" className="back-btn">
        <ArrowLeft style={{ width: '1rem', height: '1rem' }} strokeWidth={1.5} />
        Back to Funds
      </Link>

      {loading && (
        <div className="empty-state">
          <Wallet className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading fund...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {fund && (
        <>
          {/* Fund Header */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {fund.name}
                </h1>
                {fund.organization && (
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                    {fund.organization}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: fund.description ? '0.75rem' : 0 }}>
                  {fund.is_featured && <span className="badge warning">Featured</span>}
                  {fund.is_sponsored && <span className="badge info">Sponsored</span>}
                  {fund.fund_type && <span className="tag"><Building2 size={11} strokeWidth={1.5} />{fund.fund_type}</span>}
                  {fund.opportunity_type && <span className="tag">{fund.opportunity_type}</span>}
                </div>
                {fund.description && <Markdown>{fund.description}</Markdown>}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                <button
                  className={fund.is_saved ? 'btn-sm primary' : 'btn-sm ghost'}
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  data-testid="save-fund-btn"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : fund.is_saved ? (
                    <BookmarkCheck size={14} />
                  ) : (
                    <Bookmark size={14} />
                  )}
                  {fund.is_saved ? 'Saved' : 'Save'}
                </button>
                {fund.application_link && (
                  <a
                    href={fund.application_link}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-sm primary"
                  >
                    <Send style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Apply Now
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="section">
            <div className="card">
              <div className="grid-2">
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <DollarSign style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Ticket Size
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{formatTicket(fund.min_ticket_size, fund.max_ticket_size)}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Stages
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{fund.stages?.join(', ') || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Target style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Industries
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{fund.industries?.join(', ') || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Deadline
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>
                    {fund.deadline ? new Date(fund.deadline).toLocaleDateString() : 'Open'}
                  </p>
                </div>
                {fund.geographies && fund.geographies.length > 0 && (
                  <div>
                    <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Geographies
                    </div>
                    <p style={{ fontSize: '0.875rem' }}>{fund.geographies.join(', ')}</p>
                  </div>
                )}
                {(fund.applicant_count !== undefined || fund.funded_count !== undefined) && (
                  <div>
                    <div className="section-label">Stats</div>
                    <p style={{ fontSize: '0.875rem' }}>
                      {fund.applicant_count ?? 0} applicants · {fund.funded_count ?? 0} funded
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Eligibility */}
          {fund.eligibility && (
            <div className="section">
              <div className="card">
                <div className="section-label">Eligibility</div>
                <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
                  {fund.eligibility}
                </p>
              </div>
            </div>
          )}

          {/* Posted By */}
          {fund.posted_by && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Posted By
                </div>
                <p style={{ fontSize: '0.875rem' }}>
                  {fund.posted_by.display_name}
                  {fund.posted_by.fund_name ? ` · ${fund.posted_by.fund_name}` : ''}
                  {fund.posted_by.is_verified ? ' ✓' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Tags */}
          {fund.tags && fund.tags.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label">Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {fund.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Links */}
          {(fund.website_url || fund.application_link) && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Links
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {fund.website_url && (
                    <a href={fund.website_url} target="_blank" rel="noreferrer" className="btn-sm ghost">
                      <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Website
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {fund.application_link && (
                    <a href={fund.application_link} target="_blank" rel="noreferrer" className="btn-sm primary">
                      <Send style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Apply
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
