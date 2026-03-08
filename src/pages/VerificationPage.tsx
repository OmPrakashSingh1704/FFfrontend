import { useEffect, useRef, useState } from 'react'
import { apiRequest, uploadRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import {
  ShieldCheck, Upload, CheckCircle, XCircle, Clock,
  Loader2, FileText, ChevronDown, ChevronRight
} from 'lucide-react'

type VerificationDoc = {
  id: string
  document_type: string
  file_name?: string
  status: string
  review_notes?: string | null
  uploaded_by_name?: string
  reviewed_by_name?: string | null
  reviewed_at?: string | null
  created_at: string
}

type VerificationSubmission = {
  id: string
  tier_requested: number
  status: string
  review_notes?: string | null
  reviewed_by_name?: string | null
  reviewed_at?: string | null
  submitted_at: string
  documents: VerificationDoc[]
}

type VerificationStatus = {
  startup_id: string
  startup_name: string
  current_tier: number
  tier_label: string
  pending_submission: VerificationSubmission | null
  documents: VerificationDoc[]
  required_for_tier_2: string[]
  required_for_tier_3: string[]
}

const DOC_TYPE_LABELS: Record<string, string> = {
  incorporation_cert: 'Incorporation Certificate',
  pan_card: 'PAN Card',
  financial_statement: 'Financial Statement',
  ca_certified: 'CA Certified Report',
  cap_table: 'Cap Table',
  other: 'Other',
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle }> = {
  pending: { color: '#f59e0b', icon: Clock },
  approved: { color: '#22c55e', icon: CheckCircle },
  rejected: { color: '#ef4444', icon: XCircle },
}

function DocStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: '0.6875rem',
        fontWeight: 600,
        background: `${cfg.color}22`,
        color: cfg.color,
        border: `1px solid ${cfg.color}44`,
        textTransform: 'capitalize',
      }}
    >
      <Icon size={10} />
      {status}
    </span>
  )
}

const TIER_COLORS = ['', '#94a3b8', '#f59e0b', '#a1a1a1']

export function VerificationPage() {
  const { pushToast } = useToast()
  const [status, setStatus] = useState<VerificationStatus | null>(null)
  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('incorporation_cert')
  const [submitting, setSubmitting] = useState(false)
  const [tierRequested, setTierRequested] = useState<2 | 3>(2)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchStatus = async () => {
    try {
      const [statusData, submissionsData] = await Promise.all([
        apiRequest<VerificationStatus>('/verify/status/'),
        apiRequest<VerificationSubmission[] | { results: VerificationSubmission[] }>('/verify/submissions/'),
      ])
      setStatus(statusData)
      setSubmissions(normalizeList(submissionsData))
    } catch {
      pushToast('Failed to load verification status', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type', docType)
      await uploadRequest('/verify/upload/', formData)
      pushToast('Document uploaded', 'success')
      await fetchStatus()
    } catch {
      pushToast('Upload failed', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (selectedDocIds.length === 0) {
      pushToast('Select at least one document to submit', 'warning')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/verify/submit/', {
        method: 'POST',
        body: { tier_requested: tierRequested, document_ids: selectedDocIds },
      })
      pushToast(`Submitted for Tier ${tierRequested} review`, 'success')
      setSelectedDocIds([])
      await fetchStatus()
    } catch {
      pushToast('Submission failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleDocId = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ paddingTop: '4rem' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <span className="empty-description">Loading verification status...</span>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="empty-state" style={{ paddingTop: '4rem' }}>
        <div className="empty-icon"><ShieldCheck size={28} /></div>
        <span className="empty-title">No startup found</span>
        <span className="empty-description">Create a startup profile first to begin verification.</span>
      </div>
    )
  }


  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Verification</h1>
          <p className="page-description">Upgrade your startup's trust tier by submitting verification documents.</p>
        </div>
      </div>

      {/* Current Status Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">
            <ShieldCheck size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
            {status.startup_name}
          </span>
        </div>
        <div className="grid-3" style={{ gap: '1rem' }}>
          {[1, 2, 3].map((tier) => {
            const isCurrent = status.current_tier === tier
            const isPast = status.current_tier > tier
            const color = TIER_COLORS[tier]
            return (
              <div
                key={tier}
                style={{
                  padding: '1rem',
                  borderRadius: 10,
                  border: `1px solid ${isCurrent ? color : 'hsl(var(--border))'}`,
                  background: isCurrent ? `${color}11` : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: isPast || isCurrent ? color : 'hsl(var(--muted-foreground))' }}>
                  T{tier}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
                  {tier === 1 ? 'Basic' : tier === 2 ? 'Verified' : 'Premium'}
                </span>
                {isCurrent && (
                  <span className="badge" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                    Current
                  </span>
                )}
                {isPast && (
                  <CheckCircle size={16} style={{ color: '#22c55e' }} />
                )}
              </div>
            )
          })}
        </div>

        {status.pending_submission && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f59e0b11', borderRadius: 8, border: '1px solid #f59e0b44', fontSize: '0.8125rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={14} />
            Tier {status.pending_submission.tier_requested} submission is pending admin review.
          </div>
        )}
      </div>

      {/* Upload Document */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Upload Verification Document</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label style={{ fontSize: '0.75rem' }}>Document type</label>
            <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleUpload(f)
              }}
            />
            <button
              className="btn-sm primary"
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <><Loader2 size={12} className="animate-spin" /> Uploading...</>
              ) : (
                <><Upload size={12} /> Upload file</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Documents list */}
      {status.documents.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">My Documents</span>
            <span className="badge">{status.documents.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {status.documents.map((doc) => (
              <div key={doc.id} className="list-item" style={{ cursor: 'default' }}>
                <input
                  type="checkbox"
                  checked={selectedDocIds.includes(doc.id)}
                  onChange={() => toggleDocId(doc.id)}
                  disabled={doc.status === 'rejected'}
                  style={{ flexShrink: 0 }}
                />
                <FileText size={14} strokeWidth={1.5} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 500, fontSize: '0.8125rem' }}>
                    {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
                    {doc.file_name} · {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                  {doc.review_notes && (
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: '#ef4444', marginTop: 2 }}>
                      {doc.review_notes}
                    </span>
                  )}
                </div>
                <DocStatusBadge status={doc.status} />
              </div>
            ))}
          </div>

          {/* Submit for review */}
          {(() => {
            const requiredTypes = tierRequested === 2 ? status.required_for_tier_2 : status.required_for_tier_3
            const selectedDocs = status.documents.filter((d) => selectedDocIds.includes(d.id))
            const selectedTypes = new Set(selectedDocs.map((d) => d.document_type))
            const missingTypes = requiredTypes.filter((t) => !selectedTypes.has(t))
            const canSubmit = missingTypes.length === 0 && selectedDocIds.length > 0 && !status.pending_submission
            return (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border))' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: requiredTypes.length > 0 ? '0.625rem' : 0 }}>
                  <select
                    className="select"
                    value={tierRequested}
                    onChange={(e) => setTierRequested(Number(e.target.value) as 2 | 3)}
                    style={{ width: 'auto' }}
                  >
                    <option value={2}>Request Tier 2</option>
                    <option value={3}>Request Tier 3</option>
                  </select>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                    {selectedDocIds.length} doc{selectedDocIds.length !== 1 ? 's' : ''} selected
                  </div>
                  <button
                    className="btn-sm primary"
                    type="button"
                    disabled={submitting || !canSubmit}
                    onClick={() => void handleSubmit()}
                    title={missingTypes.length > 0 ? `Missing: ${missingTypes.map((t) => DOC_TYPE_LABELS[t] ?? t).join(', ')}` : undefined}
                  >
                    {submitting ? (
                      <><Loader2 size={12} className="animate-spin" /> Submitting...</>
                    ) : (
                      'Submit for review'
                    )}
                  </button>
                </div>
                {requiredTypes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {requiredTypes.map((t) => {
                      const covered = selectedTypes.has(t)
                      return (
                        <span key={t} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 500,
                          background: covered ? '#22c55e22' : '#ef444422',
                          color: covered ? '#22c55e' : '#ef4444',
                          border: `1px solid ${covered ? '#22c55e44' : '#ef444444'}`,
                        }}>
                          {covered ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {DOC_TYPE_LABELS[t] ?? t}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Submission history */}
      {submissions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Submission History</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {submissions.map((sub) => {
              const expanded = expandedSubmission === sub.id
              const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.pending
              const Icon = cfg.icon
              return (
                <div key={sub.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <button
                    className="list-item"
                    onClick={() => setExpandedSubmission(expanded ? null : sub.id)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: expanded ? '0.75rem 0.75rem 0 0' : undefined }}
                  >
                    <Icon size={16} strokeWidth={1.5} style={{ color: cfg.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500, fontSize: '0.8125rem' }}>
                        Tier {sub.tier_requested} Request
                      </span>
                      <span style={{ display: 'block', fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
                        Submitted {new Date(sub.submitted_at).toLocaleDateString()} · {sub.documents.length} document{sub.documents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <DocStatusBadge status={sub.status} />
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expanded && (
                    <div style={{ padding: '0.75rem', borderTop: '1px solid hsl(var(--border))' }}>
                      {sub.review_notes && (
                        <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                          {sub.review_notes}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {sub.documents.map((doc) => (
                          <div key={doc.id} className="list-item" style={{ cursor: 'default', padding: '0.5rem 0.25rem' }}>
                            <FileText size={12} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                            <span style={{ flex: 1, fontSize: '0.75rem' }}>
                              {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                            </span>
                            <DocStatusBadge status={doc.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
