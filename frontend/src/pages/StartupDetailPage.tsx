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
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>{startup?.name ?? 'Startup'}</h1>
          <p>{startup?.tagline ?? 'Startup details and metrics.'}</p>
        </div>
        <Link className="btn ghost" to="/app/startups">
          Back to startups
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading startup...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {startup ? (
        <>
          <div className="content-card">
            <div className="detail-grid">
              <div>
                <span className="data-eyebrow">Description</span>
                <p>{startup.description || 'No description yet.'}</p>
              </div>
              <div>
                <span className="data-eyebrow">Industry</span>
                <p>{startup.industry || 'Not specified'}</p>
              </div>
              <div>
                <span className="data-eyebrow">Stage</span>
                <p>{startup.current_stage || 'Not specified'}</p>
              </div>
              <div>
                <span className="data-eyebrow">Fundraising status</span>
                <p>{startup.fundraising_status || 'Not specified'}</p>
              </div>
            </div>

            {startup.founders_list && startup.founders_list.length > 0 ? (
              <div>
                <span className="data-eyebrow">Founders</span>
                <div className="tag-list">
                  {startup.founders_list.map((founder) => (
                    <span key={founder.id} className="tag">
                      {founder.full_name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="link-list">
              {startup.website_url ? (
                <a href={startup.website_url} target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : null}
              {startup.deck_url ? (
                <a href={startup.deck_url} target="_blank" rel="noreferrer">
                  Deck
                </a>
              ) : null}
            </div>
          </div>

          {/* Documents Section */}
          <div className="content-card" style={{ marginTop: '1.5rem' }}>
            <div className="startup-docs-header">
              <h2>Documents</h2>
              {isMember && (
                <div className="startup-docs-upload-controls">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="startup-docs-select"
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
                    className="startup-docs-select"
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
                    className="btn primary"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="upload-doc-btn"
                  >
                    {uploading ? (
                      <Loader2 size={16} className="icon-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              )}
            </div>

            {startup.documents && startup.documents.length > 0 ? (
              <div className="startup-docs-list">
                {startup.documents.map((doc) => {
                  const AccessIcon = ACCESS_ICONS[doc.access_level ?? 'private'] ?? Lock
                  return (
                    <div key={doc.id} className="startup-doc-row" data-testid={`doc-${doc.id}`}>
                      <div className="startup-doc-info">
                        <FileText size={18} />
                        <div>
                          <span className="startup-doc-name">{doc.name}</span>
                          <span className="startup-doc-meta">
                            {DOC_TYPE_LABELS[doc.document_type ?? ''] ?? doc.document_type}
                            {doc.file_size ? ` \u00B7 ${formatFileSize(doc.file_size)}` : ''}
                            {doc.uploaded_by_name ? ` \u00B7 ${doc.uploaded_by_name}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="startup-doc-actions">
                        <span className="startup-doc-access" title={doc.access_level ?? 'private'}>
                          <AccessIcon size={14} />
                        </span>
                        {doc.file_url ? (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn ghost small"
                            data-testid={`view-doc-${doc.id}`}
                          >
                            <ExternalLink size={14} />
                          </a>
                        ) : null}
                        {isMember && (
                          <button
                            className="btn ghost small danger"
                            onClick={() => void handleDelete(doc.id)}
                            data-testid={`delete-doc-${doc.id}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="startup-docs-empty">No documents uploaded yet.</p>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}
