import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  FileText,
  Upload,
  Loader2,
  Trash2,
  ExternalLink,
  Shield,
  Users,
  Eye,
  Lock,
  ArrowLeft,
  Building2,
  TrendingUp,
  Globe,
  Briefcase,
  Handshake,
  ShieldCheck,
  X,
} from 'lucide-react'
import { apiRequest, uploadRequest } from '../lib/api'
import { resolveMediaUrl } from '../lib/env'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { StartupDetail } from '../types/startup'
import type { InvestorProfile } from '../types/investor'
import type { FounderProfile } from '../types/founder'
import type { PaginatedResponse } from '../lib/pagination'

const DOC_TYPE_LABELS: Record<string, string> = {
  pitch_deck: 'Pitch Deck',
  financial_projections: 'Financial Projections',
  cap_table: 'Cap Table',
  incorporation_docs: 'Incorporation Docs',
  founder_agreement: 'Founder Agreement',
  product_demo: 'Product Demo',
  other: 'Other',
}

const ACCESS_ICONS: Record<string, typeof Lock> = {
  private: Lock,
  team: Users,
  investor: Eye,
  public: Shield,
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function toRelativeApiPath(url: string | null | undefined) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url)
      return `${parsed.pathname}${parsed.search}`
    } catch {
      return null
    }
  }
  return url.startsWith('/') ? url : `/${url}`
}

export function StartupDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { pushToast } = useToast()
  const [startup, setStartup] = useState<StartupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Document upload state
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  type DocQueueItem = { localId: string; file: File; docType: string; accessLevel: string }
  const [docQueue, setDocQueue] = useState<DocQueueItem[]>([])
  const [founderProfileIds, setFounderProfileIds] = useState<Record<string, string>>({})

  const isInvestor = user?.role === 'investor' || user?.role === 'both'
  const isMember = startup?.members?.some((m) => m.user === user?.id) ?? false

  // Express Interest state
  const [investorProfile, setInvestorProfile] = useState<InvestorProfile | null>(null)
  const [showInterestForm, setShowInterestForm] = useState(false)
  const [interestMessage, setInterestMessage] = useState('')
  const [expressingInterest, setExpressingInterest] = useState(false)

  const fetchFounderProfilesForUsers = useCallback(async (userIds: string[]) => {
    const remaining = new Set(userIds.filter(Boolean))
    const found: Record<string, string> = {}

    if (remaining.size === 0) return found

    let nextPath: string | null = '/founders/'
    while (nextPath && remaining.size > 0) {
      const data = await apiRequest<PaginatedResponse<FounderProfile> | FounderProfile[]>(nextPath)
      const results = Array.isArray(data) ? data : data.results ?? []

      for (const profile of results) {
        const userId = profile.user?.id
        if (userId && remaining.has(userId) && !found[userId]) {
          found[userId] = profile.id
          remaining.delete(userId)
        }
      }

      if (remaining.size === 0) break
      if (!Array.isArray(data) && data.next) {
        nextPath = toRelativeApiPath(data.next)
      } else {
        nextPath = null
      }
    }

    return found
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<StartupDetail>(`/founders/startups/${id}/`)
        if (!cancelled) {
          setStartup(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load startup details.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [id])

  // Load investor profile for investors
  useEffect(() => {
    if (!isInvestor) return
    let cancelled = false
    apiRequest<InvestorProfile>('/investors/profile/me/')
      .then((data) => { if (!cancelled) setInvestorProfile(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isInvestor])

  useEffect(() => {
    if (!startup?.founders_list?.length) return

    const missingUserIds = startup.founders_list
      .map((founder) => founder.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && !founderProfileIds[id])

    if (missingUserIds.length === 0) return

    let cancelled = false
    const resolveProfiles = async () => {
      try {
        const mapping = await fetchFounderProfilesForUsers(missingUserIds)
        if (!cancelled && Object.keys(mapping).length > 0) {
          setFounderProfileIds((prev) => ({ ...prev, ...mapping }))
        }
      } catch {
        // ignore errors; founders will remain unlinked
      }
    }

    void resolveProfiles()
    return () => {
      cancelled = true
    }
  }, [startup?.founders_list, founderProfileIds, fetchFounderProfilesForUsers])

  const handleExpressInterest = async () => {
    if (!startup || !investorProfile) return
    setExpressingInterest(true)
    try {
      await apiRequest('/deals/interest/', {
        method: 'POST',
        body: { startup_id: startup.id, investor_id: investorProfile.id, message: interestMessage },
      })
      pushToast('Interest expressed — a deal room will open when the founder reciprocates.', 'success')
      setShowInterestForm(false)
      setInterestMessage('')
    } catch {
      pushToast('Failed to express interest', 'error')
    } finally {
      setExpressingInterest(false)
    }
  }

  const addFilesToQueue = (files: File[]) => {
    setDocQueue((prev) => [
      ...prev,
      ...files.map((f) => ({ localId: crypto.randomUUID(), file: f, docType: 'pitch_deck', accessLevel: 'investor' })),
    ])
  }

  const updateQueueItem = (localId: string, field: 'docType' | 'accessLevel', value: string) => {
    setDocQueue((prev) => prev.map((item) => item.localId === localId ? { ...item, [field]: value } : item))
  }

  const removeFromQueue = (localId: string) => {
    setDocQueue((prev) => prev.filter((item) => item.localId !== localId))
  }

  const handleUpload = async () => {
    if (!docQueue.length || !id) return
    setUploading(true)
    let failed = 0
    try {
      await Promise.all(
        docQueue.map(async (item) => {
          const formData = new FormData()
          formData.append('file', item.file)
          formData.append('name', item.file.name)
          formData.append('document_type', item.docType)
          formData.append('access_level', item.accessLevel)
          try {
            await uploadRequest(`/founders/startups/${id}/documents/`, formData)
          } catch {
            failed++
          }
        }),
      )
      const data = await apiRequest<StartupDetail>(`/founders/startups/${id}/`)
      setStartup(data)
      setDocQueue([])

      const succeeded = docQueue.length - failed
      if (succeeded > 0) pushToast(`${succeeded} document${succeeded !== 1 ? 's' : ''} uploaded`, 'success')
      if (failed > 0) pushToast(`${failed} upload${failed !== 1 ? 's' : ''} failed`, 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (docId: string) => {
    if (!id) return
    try {
      await apiRequest(`/founders/startups/${id}/documents/${docId}/`, {
        method: 'DELETE',
      })
      setStartup((prev) =>
        prev
          ? { ...prev, documents: prev.documents?.filter((d) => d.id !== docId) }
          : prev,
      )
      pushToast('Document removed', 'success')
    } catch {
      pushToast('Failed to remove document', 'error')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <Link to="/app/startups" className="back-btn" style={{ margin: 0 }}>
          <ArrowLeft style={{ width: '1rem', height: '1rem' }} strokeWidth={1.5} />
          Back to Startups
        </Link>
        {startup && <CopyLinkButton />}
      </div>

      {loading && (
        <div className="empty-state">
          <Briefcase className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading startup...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {startup && (
        <>
          {/* Startup Header */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                {resolveMediaUrl(startup.logo ?? startup.logo_url) ? (
                  <img
                    src={resolveMediaUrl(startup.logo ?? startup.logo_url)!}
                    alt={startup.name}
                    style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid hsl(var(--border))' }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Briefcase size={20} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.125rem' }}>
                    {startup.name}
                  </h1>
                  {startup.tagline && (
                    <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                      {startup.tagline}
                    </p>
                  )}
                </div>
              </div>

              {/* Express Interest (investors only, non-members) */}
              {isInvestor && !isMember && investorProfile && (
                <button
                  className="btn-sm primary"
                  type="button"
                  onClick={() => setShowInterestForm(true)}
                  style={{ flexShrink: 0 }}
                >
                  <Handshake size={14} />
                  Express Interest
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {startup.industry && (
                <span className="tag">
                  <Building2 style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                  {startup.industry}
                </span>
              )}
              {startup.current_stage && (
                <span className="tag">
                  <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                  {startup.current_stage}
                </span>
              )}
              {startup.fundraising_status && (
                <span className="badge warning">{startup.fundraising_status}</span>
              )}
              {(startup.verification_tier ?? 0) >= 2 && (
                <span
                  className="badge"
                  style={{
                    background: startup.verification_tier === 3 ? '#6366f122' : '#22c55e22',
                    color: startup.verification_tier === 3 ? '#6366f1' : '#22c55e',
                    border: `1px solid ${startup.verification_tier === 3 ? '#6366f144' : '#22c55e44'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ShieldCheck size={11} />
                  {startup.verification_tier === 3 ? 'Premium Verified' : 'Verified'}
                </span>
              )}
            </div>

            {/* Express Interest Form (inline) */}
            {showInterestForm && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'hsl(var(--muted))', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Express Interest</span>
                  <button className="btn-sm ghost" style={{ padding: 4 }} onClick={() => setShowInterestForm(false)}>
                    <X size={14} />
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem' }}>
                  A deal room opens automatically when both sides express interest.
                </p>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Optional message to the founder..."
                  value={interestMessage}
                  onChange={(e) => setInterestMessage(e.target.value)}
                  style={{ resize: 'vertical', marginBottom: '0.5rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn-sm ghost" onClick={() => setShowInterestForm(false)} disabled={expressingInterest}>
                    Cancel
                  </button>
                  <button className="btn-sm primary" onClick={() => void handleExpressInterest()} disabled={expressingInterest}>
                    {expressingInterest ? <><Loader2 size={12} className="animate-spin" /> Sending...</> : <><Handshake size={12} /> Send Interest</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Description & Details */}
          <div className="section">
            <div className="card">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                Description
              </div>
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
                {startup.description || 'No description yet.'}
              </p>

              <hr className="divider" />

              <div className="grid-2">
                <div>
                  <div className="section-label">Industry</div>
                  <p style={{ fontSize: '0.875rem' }}>{startup.industry || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label">Stage</div>
                  <p style={{ fontSize: '0.875rem' }}>{startup.current_stage || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label">Fundraising Status</div>
                  <p style={{ fontSize: '0.875rem' }}>{startup.fundraising_status || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Founders */}
          {startup.founders_list && startup.founders_list.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Founders
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {startup.founders_list.map((founder) => {
                    const userId = founder.id ?? founder.user_id ?? founder.user ?? null
                    const founderProfileId =
                      founder.founder_profile_id ??
                      founder.profile_id ??
                      (typeof (founder as Record<string, unknown>).profile === 'object' &&
                      founder &&
                      (founder as { profile?: { id?: string | null } }).profile?.id
                        ? (founder as { profile?: { id?: string | null } }).profile?.id ?? null
                        : null) ??
                      (userId ? founderProfileIds[userId] ?? null : null)

                    if (!founderProfileId) {
                      return (
                        <span key={`${userId ?? founder.full_name}-fallback`} className="tag">
                          {founder.full_name}
                        </span>
                      )
                    }
                    return (
                      <Link
                        key={`${founderProfileId}-${userId ?? founder.full_name}`}
                        to={`/app/founders/${founderProfileId}`}
                        className="tag"
                        style={{ textDecoration: 'none' }}
                        data-testid={`founder-link-${founderProfileId}`}
                      >
                        {founder.full_name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Links */}
          {(startup.website_url || startup.deck_url) && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Links
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {startup.website_url && (
                    <a href={startup.website_url} target="_blank" rel="noreferrer" className="btn-sm ghost">
                      <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Website
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {startup.deck_url && (
                    <a href={startup.deck_url} target="_blank" rel="noreferrer" className="btn-sm ghost">
                      <FileText style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Deck
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Documents Section */}
          <div className="section">
            <div className="card">
              <div className="card-header">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                  <FileText style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Documents
                </div>
                {isMember && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      onChange={(e) => { addFilesToQueue(Array.from(e.target.files ?? [])); e.target.value = '' }}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                      multiple
                      data-testid="doc-file-input"
                    />
                    <button
                      className="btn-sm ghost"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="add-files-btn"
                    >
                      <Upload size={14} />
                      Add files
                    </button>
                    {docQueue.length > 0 && (
                      <button
                        className="btn-sm primary"
                        disabled={uploading}
                        onClick={() => void handleUpload()}
                        data-testid="upload-doc-btn"
                      >
                        {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <>Upload {docQueue.length}</>}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Staging queue */}
              {isMember && docQueue.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid hsl(var(--border))' }}>
                  {docQueue.map((item) => (
                    <div key={item.localId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <FileText size={13} strokeWidth={1.5} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 80, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.file.name}
                      </span>
                      <select
                        className="select"
                        value={item.docType}
                        onChange={(e) => updateQueueItem(item.localId, 'docType', e.target.value)}
                        style={{ flex: '0 0 auto', minWidth: 130, fontSize: '0.75rem', padding: '0.25rem 2rem 0.25rem 0.5rem' }}
                        data-testid={`queue-type-${item.localId}`}
                      >
                        {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <select
                        className="select"
                        value={item.accessLevel}
                        onChange={(e) => updateQueueItem(item.localId, 'accessLevel', e.target.value)}
                        style={{ flex: '0 0 auto', minWidth: 100, fontSize: '0.75rem', padding: '0.25rem 2rem 0.25rem 0.5rem' }}
                        data-testid={`queue-access-${item.localId}`}
                      >
                        <option value="private">Private</option>
                        <option value="team">Team</option>
                        <option value="investor">Investor</option>
                        <option value="public">Public</option>
                      </select>
                      <button
                        className="btn-sm ghost"
                        style={{ padding: '0.25rem', flexShrink: 0 }}
                        onClick={() => removeFromQueue(item.localId)}
                        data-testid={`remove-queue-${item.localId}`}
                      >
                        <Trash2 size={12} style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {startup.documents && startup.documents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {startup.documents.map((doc) => {
                    const AccessIcon = ACCESS_ICONS[doc.access_level ?? 'private'] ?? Lock
                    return (
                      <div key={doc.id} className="list-item" data-testid={`doc-${doc.id}`}>
                        <FileText size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} strokeWidth={1.5} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                            {DOC_TYPE_LABELS[doc.document_type ?? ''] ?? doc.document_type}
                            {doc.file_size ? ` \u00B7 ${formatFileSize(doc.file_size)}` : ''}
                            {doc.uploaded_by_name ? ` \u00B7 ${doc.uploaded_by_name}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                          <span className="tag" title={doc.access_level ?? 'private'} style={{ padding: '0.25rem' }}>
                            <AccessIcon size={12} />
                          </span>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-sm ghost"
                              style={{ padding: '0.25rem 0.5rem' }}
                              data-testid={`view-doc-${doc.id}`}
                            >
                              <ExternalLink size={12} strokeWidth={1.5} />
                            </a>
                          )}
                          {isMember && (
                            <button
                              className="btn-sm ghost"
                              style={{ padding: '0.25rem 0.5rem', color: '#ef4444' }}
                              onClick={() => void handleDelete(doc.id)}
                              data-testid={`delete-doc-${doc.id}`}
                            >
                              <Trash2 size={12} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
                  <FileText className="empty-icon" strokeWidth={1.5} />
                  <p className="empty-description">No documents uploaded yet.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
