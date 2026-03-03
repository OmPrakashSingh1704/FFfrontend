import { useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import { apiRequest, uploadRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { StartupDetail } from '../types/startup'

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

export function StartupDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { pushToast } = useToast()
  const [startup, setStartup] = useState<StartupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Document upload state
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('pitch_deck')
  const [accessLevel, setAccessLevel] = useState('investor')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isMember =
    startup?.members?.some((m) => m.user === user?.id) ?? false

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
    return () => {
      cancelled = true
    }
  }, [id])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)
      formData.append('document_type', docType)
      formData.append('access_level', accessLevel)

      await uploadRequest(`/founders/startups/${id}/documents/`, formData)

      // Reload startup to get updated documents list
      const data = await apiRequest<StartupDetail>(`/founders/startups/${id}/`)
      setStartup(data)
      pushToast('Document uploaded successfully', 'success')
    } catch {
      pushToast('Failed to upload document', 'error')
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
      <Link to="/app/startups" className="back-btn">
        <ArrowLeft style={{ width: '1rem', height: '1rem' }} strokeWidth={1.5} />
        Back to Startups
      </Link>

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
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              {startup.name}
            </h1>
            {startup.tagline && (
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem' }}>
                {startup.tagline}
              </p>
            )}
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
            </div>
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
                  {startup.founders_list.map((founder) => (
                    <span key={founder.id} className="tag">
                      {founder.full_name}
                    </span>
                  ))}
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
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="select"
                      style={{ width: 'auto', fontSize: '0.75rem', padding: '0.25rem 2rem 0.25rem 0.5rem' }}
                      data-testid="doc-type-select"
                    >
                      {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={accessLevel}
                      onChange={(e) => setAccessLevel(e.target.value)}
                      className="select"
                      style={{ width: 'auto', fontSize: '0.75rem', padding: '0.25rem 2rem 0.25rem 0.5rem' }}
                      data-testid="doc-access-select"
                    >
                      <option value="private">Private</option>
                      <option value="team">Team</option>
                      <option value="investor">Investor</option>
                      <option value="public">Public</option>
                    </select>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      onChange={handleUpload}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                      data-testid="doc-file-input"
                    />
                    <button
                      className="btn-sm primary"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="upload-doc-btn"
                    >
                      {uploading ? (
                        <Loader2 size={14} className="icon-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                )}
              </div>

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
