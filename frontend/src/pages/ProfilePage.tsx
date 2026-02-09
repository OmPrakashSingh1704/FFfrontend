import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, uploadRequest } from '../lib/api'
import { resolveMediaUrl } from '../lib/env'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { normalizeList } from '../lib/pagination'
import {
  User,
  Mail,
  Phone,
  Shield,
  Star,
  Calendar,
  Camera,
  Save,
  Loader2,
  Pencil,
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  Lock,
  Users,
  Eye,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { StartupListItem } from '../types/startup'

type StartupDoc = {
  id: string
  name?: string
  document_type?: string
  file_url?: string
  file_size?: number | null
  access_level?: string
  uploaded_by_name?: string
  created_at?: string
}

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

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { pushToast } = useToast()

  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'profile' | 'background' | null>(null)

  const profileInputRef = useRef<HTMLInputElement | null>(null)
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)

  // My startups & documents
  const [myStartups, setMyStartups] = useState<StartupListItem[]>([])
  const [loadingStartups, setLoadingStartups] = useState(true)
  const [expandedStartup, setExpandedStartup] = useState<string | null>(null)
  const [startupDocs, setStartupDocs] = useState<Record<string, StartupDoc[]>>({})
  const [loadingDocs, setLoadingDocs] = useState<string | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [docType, setDocType] = useState('pitch_deck')
  const [accessLevel, setAccessLevel] = useState('investor')
  const docInputRef = useRef<HTMLInputElement | null>(null)
  const activeStartupRef = useRef<string | null>(null)

  const avatarUrl = resolveMediaUrl(user?.picture ?? user?.avatar_url)
  const backgroundUrl = resolveMediaUrl(user?.background_picture)

  // Load user's startups
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingStartups(true)
      try {
        const data = await apiRequest<StartupListItem[] | { results: StartupListItem[] }>(
          '/founders/my-startups/',
        )
        if (!cancelled) setMyStartups(normalizeList(data))
      } catch {
        // no startups
      } finally {
        if (!cancelled) setLoadingStartups(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // Load docs when a startup is expanded
  const toggleStartup = async (startupId: string) => {
    if (expandedStartup === startupId) {
      setExpandedStartup(null)
      return
    }
    setExpandedStartup(startupId)

    if (startupDocs[startupId]) return // already loaded

    setLoadingDocs(startupId)
    try {
      const data = await apiRequest<StartupDoc[] | { results: StartupDoc[] }>(
        `/founders/startups/${startupId}/documents/`,
      )
      setStartupDocs((prev) => ({ ...prev, [startupId]: normalizeList(data) }))
    } catch {
      pushToast('Failed to load documents', 'error')
    } finally {
      setLoadingDocs(null)
    }
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const startupId = activeStartupRef.current
    if (!file || !startupId) return

    setUploadingDoc(startupId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)
      formData.append('document_type', docType)
      formData.append('access_level', accessLevel)

      await uploadRequest(`/founders/startups/${startupId}/documents/`, formData)

      // Refresh docs list
      const data = await apiRequest<StartupDoc[] | { results: StartupDoc[] }>(
        `/founders/startups/${startupId}/documents/`,
      )
      setStartupDocs((prev) => ({ ...prev, [startupId]: normalizeList(data) }))
      pushToast('Document uploaded successfully', 'success')
    } catch {
      pushToast('Failed to upload document', 'error')
    } finally {
      setUploadingDoc(null)
      if (docInputRef.current) docInputRef.current.value = ''
    }
  }

  const handleDocDelete = async (startupId: string, docId: string) => {
    try {
      await apiRequest(`/founders/startups/${startupId}/documents/${docId}/`, {
        method: 'DELETE',
      })
      setStartupDocs((prev) => ({
        ...prev,
        [startupId]: (prev[startupId] ?? []).filter((d) => d.id !== docId),
      }))
      pushToast('Document removed', 'success')
    } catch {
      pushToast('Failed to remove document', 'error')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiRequest('/users/me/profile/', {
        method: 'PATCH',
        body: { full_name: fullName, phone: phone || null },
      })
      await refreshUser()
      pushToast('Profile updated', 'success')
      setEditing(false)
    } catch {
      pushToast('Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (target: 'profile' | 'background', file?: File | null) => {
    if (!file) return
    setUploading(target)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const path = target === 'profile' ? '/upload/profile-picture/' : '/upload/background-picture/'
      await uploadRequest(path, formData)
      await refreshUser()
      pushToast(`${target === 'profile' ? 'Profile picture' : 'Background'} updated`, 'success')
    } catch {
      pushToast('Upload failed', 'error')
    } finally {
      setUploading(null)
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <section className="content-section">
      {/* Profile Header */}
      <div className="profile-page-header content-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="profile-page-bg"
          style={
            backgroundUrl
              ? { backgroundImage: `url(${backgroundUrl})` }
              : undefined
          }
        >
          <button
            className="profile-page-bg-upload btn ghost"
            type="button"
            data-testid="upload-background"
            disabled={uploading !== null}
            onClick={() => backgroundInputRef.current?.click()}
          >
            {uploading === 'background' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Camera size={16} />
            )}
          </button>
          <input
            type="file"
            accept="image/*"
            ref={backgroundInputRef}
            className="sr-only"
            onChange={(e) => handleUpload('background', e.target.files?.[0])}
          />
        </div>

        <div className="profile-page-avatar-section">
          <div className="profile-page-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user?.full_name ?? 'Avatar'} />
            ) : (
              <User size={40} strokeWidth={1.5} />
            )}
            <button
              className="profile-page-avatar-upload"
              type="button"
              data-testid="upload-profile-picture"
              disabled={uploading !== null}
              onClick={() => profileInputRef.current?.click()}
            >
              {uploading === 'profile' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Camera size={14} />
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              ref={profileInputRef}
              className="sr-only"
              onChange={(e) => handleUpload('profile', e.target.files?.[0])}
            />
          </div>

          <div className="profile-page-info">
            <h1>{user?.full_name || 'User'}</h1>
            <p className="profile-page-email">
              <Mail size={14} strokeWidth={1.5} />
              {user?.email}
            </p>
          </div>
        </div>

        <div className="profile-page-stats">
          <div className="profile-page-stat">
            <Shield size={16} strokeWidth={1.5} />
            <span className="profile-page-stat-label">Role</span>
            <span className="profile-page-stat-value">{user?.role ?? 'Member'}</span>
          </div>
          <div className="profile-page-stat">
            <Star size={16} strokeWidth={1.5} />
            <span className="profile-page-stat-label">League</span>
            <span className="profile-page-stat-value">{user?.league ?? '—'}</span>
          </div>
          {memberSince && (
            <div className="profile-page-stat">
              <Calendar size={16} strokeWidth={1.5} />
              <span className="profile-page-stat-label">Member since</span>
              <span className="profile-page-stat-value">{memberSince}</span>
            </div>
          )}
          {user?.credits != null && (
            <div className="profile-page-stat">
              <Star size={16} strokeWidth={1.5} />
              <span className="profile-page-stat-label">Credits</span>
              <span className="profile-page-stat-value">{user.credits}</span>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <div className="content-card">
        <div className="profile-edit-header">
          <h2>Profile details</h2>
          {!editing && (
            <button
              className="btn ghost"
              type="button"
              data-testid="edit-profile"
              onClick={() => {
                setFullName(user?.full_name ?? '')
                setPhone(user?.phone ?? '')
                setEditing(true)
              }}
            >
              <Pencil size={14} strokeWidth={1.5} />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form
            className="profile-edit-form"
            onSubmit={(e) => {
              e.preventDefault()
              void handleSave()
            }}
          >
            <label className="profile-field">
              <span className="profile-field-label">
                <User size={14} strokeWidth={1.5} />
                Full name
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="input-full-name"
                placeholder="Your full name"
              />
            </label>

            <label className="profile-field">
              <span className="profile-field-label">
                <Phone size={14} strokeWidth={1.5} />
                Phone
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
                placeholder="Phone number"
              />
            </label>

            <div className="profile-edit-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                type="submit"
                data-testid="save-profile"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-view-fields">
            <div className="profile-view-row">
              <span className="profile-field-label">
                <User size={14} strokeWidth={1.5} />
                Full name
              </span>
              <span>{user?.full_name || '—'}</span>
            </div>
            <div className="profile-view-row">
              <span className="profile-field-label">
                <Mail size={14} strokeWidth={1.5} />
                Email
              </span>
              <span>{user?.email}</span>
            </div>
            <div className="profile-view-row">
              <span className="profile-field-label">
                <Phone size={14} strokeWidth={1.5} />
                Phone
              </span>
              <span>{user?.phone || '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* My Startups & Documents */}
      <div className="content-card">
        <div className="startup-docs-header">
          <h2>
            <Building2 size={18} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8 }} />
            My Startups &amp; Documents
          </h2>
        </div>

        {loadingStartups ? (
          <div className="page-loader">Loading startups...</div>
        ) : myStartups.length === 0 ? (
          <p className="startup-docs-empty">
            You are not a member of any startup yet.{' '}
            <Link to="/app/startups" style={{ textDecoration: 'underline' }}>
              Browse startups
            </Link>
          </p>
        ) : (
          <div className="profile-startups-list">
            {/* Hidden file input shared across startups */}
            <input
              ref={docInputRef}
              type="file"
              className="sr-only"
              onChange={handleDocUpload}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
              data-testid="profile-doc-file-input"
            />

            {myStartups.map((s) => {
              const isExpanded = expandedStartup === s.id
              const docs = startupDocs[s.id] ?? []
              const isLoadingThis = loadingDocs === s.id
              const isUploadingThis = uploadingDoc === s.id

              return (
                <div key={s.id} className="profile-startup-card" data-testid={`startup-${s.id}`}>
                  <button
                    className="profile-startup-toggle"
                    onClick={() => void toggleStartup(s.id)}
                    data-testid={`toggle-startup-${s.id}`}
                  >
                    <div className="profile-startup-info">
                      {s.logo_url ? (
                        <img
                          src={resolveMediaUrl(s.logo_url) ?? ''}
                          alt={s.name}
                          className="profile-startup-logo"
                        />
                      ) : (
                        <div className="profile-startup-logo-placeholder">
                          <Building2 size={16} />
                        </div>
                      )}
                      <div>
                        <span className="profile-startup-name">{s.name}</span>
                        {s.industry && (
                          <span className="profile-startup-meta">{s.industry}</span>
                        )}
                      </div>
                    </div>
                    <div className="profile-startup-right">
                      {docs.length > 0 && (
                        <span className="profile-startup-doc-count">
                          {docs.length} doc{docs.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="profile-startup-docs">
                      {/* Upload controls */}
                      <div className="startup-docs-upload-controls" style={{ marginBottom: '0.75rem' }}>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          className="startup-docs-select"
                          data-testid={`doc-type-${s.id}`}
                        >
                          {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        <select
                          value={accessLevel}
                          onChange={(e) => setAccessLevel(e.target.value)}
                          className="startup-docs-select"
                          data-testid={`doc-access-${s.id}`}
                        >
                          <option value="private">Private</option>
                          <option value="team">Team</option>
                          <option value="investor">Investor</option>
                          <option value="public">Public</option>
                        </select>
                        <button
                          className="btn primary"
                          disabled={isUploadingThis}
                          onClick={() => {
                            activeStartupRef.current = s.id
                            docInputRef.current?.click()
                          }}
                          data-testid={`upload-doc-${s.id}`}
                        >
                          {isUploadingThis ? (
                            <Loader2 size={16} className="icon-spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          {isUploadingThis ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>

                      {/* Docs list */}
                      {isLoadingThis ? (
                        <div className="page-loader" style={{ padding: '1rem 0' }}>
                          Loading documents...
                        </div>
                      ) : docs.length === 0 ? (
                        <p className="startup-docs-empty" style={{ padding: '1rem 0' }}>
                          No documents yet. Upload a pitch deck to get started.
                        </p>
                      ) : (
                        <div className="startup-docs-list">
                          {docs.map((doc) => {
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
                                  <button
                                    className="btn ghost small danger"
                                    onClick={() => void handleDocDelete(s.id, doc.id)}
                                    data-testid={`delete-doc-${doc.id}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
