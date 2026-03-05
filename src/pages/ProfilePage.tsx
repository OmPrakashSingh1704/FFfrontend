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
  Award,
} from 'lucide-react'
import { CopyLinkButton } from '../components/CopyLinkButton'
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

  type DocQueueItem = { localId: string; file: File; docType: string; accessLevel: string }
  const [docQueues, setDocQueues] = useState<Record<string, DocQueueItem[]>>({})
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Shareable profile IDs
  const [founderProfileId, setFounderProfileId] = useState<string | null>(null)
  const [investorProfileId, setInvestorProfileId] = useState<string | null>(null)

  const avatarUrl = resolveMediaUrl(user?.avatar ?? user?.picture ?? user?.avatar_url)
  const backgroundUrl = resolveMediaUrl(user?.background_picture)

  // Load shareable profile IDs
  useEffect(() => {
    const role = user?.role
    if (role === 'founder' || role === 'both') {
      apiRequest<{ id: string }>('/founders/profile/me/')
        .then((d) => setFounderProfileId(d.id))
        .catch(() => {})
    }
    if (role === 'investor' || role === 'both') {
      apiRequest<{ id: string }>('/investors/profile/me/')
        .then((d) => setInvestorProfileId(d.id))
        .catch(() => {})
    }
  }, [user?.role])

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

  const addFilesToQueue = (startupId: string, files: File[]) => {
    setDocQueues((prev) => ({
      ...prev,
      [startupId]: [
        ...(prev[startupId] ?? []),
        ...files.map((f) => ({ localId: crypto.randomUUID(), file: f, docType: 'pitch_deck', accessLevel: 'investor' })),
      ],
    }))
  }

  const updateQueueItem = (startupId: string, localId: string, field: 'docType' | 'accessLevel', value: string) => {
    setDocQueues((prev) => ({
      ...prev,
      [startupId]: (prev[startupId] ?? []).map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item,
      ),
    }))
  }

  const removeFromQueue = (startupId: string, localId: string) => {
    setDocQueues((prev) => ({
      ...prev,
      [startupId]: (prev[startupId] ?? []).filter((item) => item.localId !== localId),
    }))
  }

  const uploadQueue = async (startupId: string) => {
    const queue = docQueues[startupId] ?? []
    if (!queue.length) return
    setUploadingDoc(startupId)
    let failed = 0
    try {
      await Promise.all(
        queue.map(async (item) => {
          const formData = new FormData()
          formData.append('file', item.file)
          formData.append('name', item.file.name)
          formData.append('document_type', item.docType)
          formData.append('access_level', item.accessLevel)
          try {
            await uploadRequest(`/founders/startups/${startupId}/documents/`, formData)
          } catch {
            failed++
          }
        }),
      )
      const data = await apiRequest<StartupDoc[] | { results: StartupDoc[] }>(
        `/founders/startups/${startupId}/documents/`,
      )
      setStartupDocs((prev) => ({ ...prev, [startupId]: normalizeList(data) }))
      setDocQueues((prev) => ({ ...prev, [startupId]: [] }))

      const succeeded = queue.length - failed
      if (succeeded > 0) pushToast(`${succeeded} document${succeeded !== 1 ? 's' : ''} uploaded`, 'success')
      if (failed > 0) pushToast(`${failed} upload${failed !== 1 ? 's' : ''} failed`, 'error')
    } finally {
      setUploadingDoc(null)
      const ref = docInputRefs.current[startupId]
      if (ref) ref.value = ''
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
      const path = target === 'profile' ? '/users/me/avatar/' : '/users/me/background/'
      formData.append(target === 'profile' ? 'avatar' : 'background', file)
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

  const initials = (user?.full_name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-description">View and manage your personal information</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {founderProfileId && (
            <CopyLinkButton
              url={`${window.location.origin}/app/founders/${founderProfileId}`}
              label="Share founder profile"
            />
          )}
          {investorProfileId && (
            <CopyLinkButton
              url={`${window.location.origin}/app/investors/${investorProfileId}`}
              label="Share investor profile"
            />
          )}
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden', padding: 0 }}>
        {/* Background banner */}
        <div
          style={{
            height: 120,
            background: backgroundUrl
              ? `url(${backgroundUrl}) center/cover`
              : 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--card)))',
            position: 'relative',
          }}
        >
          <button
            className="btn-sm ghost"
            type="button"
            data-testid="upload-background"
            disabled={uploading !== null}
            onClick={() => backgroundInputRef.current?.click()}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none' }}
          >
            {uploading === 'background' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
            Change
          </button>
          <input
            type="file"
            accept="image/*"
            ref={backgroundInputRef}
            className="sr-only"
            onChange={(e) => handleUpload('background', e.target.files?.[0])}
          />
        </div>

        {/* Avatar + Info */}
        <div style={{ padding: '0 1.5rem 1.5rem', marginTop: -32 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <div className="avatar xl" style={{ border: '3px solid hsl(var(--card))' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.full_name ?? 'Avatar'} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                data-testid="upload-profile-picture"
                disabled={uploading !== null}
                onClick={() => profileInputRef.current?.click()}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: -4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--gold)',
                  color: '#fff',
                  border: '2px solid hsl(var(--card))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {uploading === 'profile' ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Camera size={10} />
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

            <div style={{ flex: 1, paddingBottom: 4 }}>
              <h2 className="text-xl font-semibold" style={{ marginBottom: 2 }}>
                {user?.full_name || 'User'}
              </h2>
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
                <Mail size={14} strokeWidth={1.5} />
                {user?.email}
              </p>
            </div>

            <span className="badge info" style={{ alignSelf: 'center' }}>
              {user?.role ?? 'Member'}
            </span>
          </div>

          {/* Stats Row */}
          <div className="grid-4">
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">League</span>
                <div className="stat-icon"><Award size={16} strokeWidth={1.5} /></div>
              </div>
              <span className="stat-value">{user?.league ?? '--'}</span>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Credits</span>
                <div className="stat-icon"><Star size={16} strokeWidth={1.5} /></div>
              </div>
              <span className="stat-value">{user?.credits ?? 0}</span>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Member since</span>
                <div className="stat-icon"><Calendar size={16} strokeWidth={1.5} /></div>
              </div>
              <span className="stat-value" style={{ fontSize: '0.875rem' }}>{memberSince ?? '--'}</span>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Role</span>
                <div className="stat-icon"><Shield size={16} strokeWidth={1.5} /></div>
              </div>
              <span className="stat-value" style={{ textTransform: 'capitalize' }}>{user?.role ?? 'Member'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Profile Details</span>
          {!editing && (
            <button
              className="btn-sm ghost"
              type="button"
              data-testid="edit-profile"
              onClick={() => {
                setFullName(user?.full_name ?? '')
                setPhone(user?.phone ?? '')
                setEditing(true)
              }}
            >
              <Pencil size={12} strokeWidth={1.5} />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSave()
            }}
          >
            <div className="form-group">
              <label>
                <User size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                Full name
              </label>
              <input
                className="input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="input-full-name"
                placeholder="Your full name"
              />
            </div>

            <div className="form-group">
              <label>
                <Phone size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                Phone
              </label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
                placeholder="Phone number"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                className="btn-sm ghost"
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn-sm primary"
                type="submit"
                data-testid="save-profile"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={12} />
                    Save
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="list-item" style={{ cursor: 'default' }}>
              <User size={14} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Full name</span>
              <span style={{ fontSize: '0.875rem' }}>{user?.full_name || '--'}</span>
            </div>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="list-item" style={{ cursor: 'default' }}>
              <Mail size={14} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Email</span>
              <span style={{ fontSize: '0.875rem' }}>{user?.email}</span>
            </div>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="list-item" style={{ cursor: 'default' }}>
              <Phone size={14} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Phone</span>
              <span style={{ fontSize: '0.875rem' }}>{user?.phone || '--'}</span>
            </div>
          </div>
        )}
      </div>

      {/* My Startups & Documents */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Building2 size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
            My Startups &amp; Documents
          </span>
        </div>

        {loadingStartups ? (
          <div className="empty-state" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span className="empty-description">Loading startups...</span>
          </div>
        ) : myStartups.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <div className="empty-icon"><Building2 size={24} /></div>
            <span className="empty-title">No startups yet</span>
            <span className="empty-description">
              You are not a member of any startup yet.{' '}
              <Link to="/app/startups" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                Browse startups
              </Link>
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

            {myStartups.map((s) => {
              const isExpanded = expandedStartup === s.id
              const docs = startupDocs[s.id] ?? []
              const isLoadingThis = loadingDocs === s.id
              const isUploadingThis = uploadingDoc === s.id

              return (
                <div
                  key={s.id}
                  className="card"
                  data-testid={`startup-${s.id}`}
                  style={{ padding: 0, overflow: 'hidden' }}
                >
                  <button
                    className="list-item"
                    onClick={() => void toggleStartup(s.id)}
                    data-testid={`toggle-startup-${s.id}`}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: isExpanded ? '0.75rem 0.75rem 0 0' : undefined }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      {s.logo_url ? (
                        <img
                          src={resolveMediaUrl(s.logo_url) ?? ''}
                          alt={s.name}
                          style={{ width: 32, height: 32, borderRadius: '0.5rem', objectFit: 'cover' }}
                        />
                      ) : (
                        <div className="avatar" style={{ borderRadius: '0.5rem' }}>
                          <Building2 size={14} />
                        </div>
                      )}
                      <div style={{ textAlign: 'left', minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{s.name}</span>
                        {s.industry && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{s.industry}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {docs.length > 0 && (
                        <span className="badge">{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
                      )}
                      <span
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'contents' }}
                      >
                        <CopyLinkButton
                          url={`${window.location.origin}/app/startups/${s.id}`}
                          label="Share"
                        />
                      </span>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid hsl(var(--border))' }}>
                      {/* Hidden file input per startup */}
                      <input
                        ref={(el) => { docInputRefs.current[s.id] = el }}
                        type="file"
                        className="sr-only"
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          addFilesToQueue(s.id, Array.from(e.target.files ?? []))
                          e.target.value = ''
                        }}
                        data-testid={`doc-file-input-${s.id}`}
                      />

                      {/* Add files + Upload all bar */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 0', borderBottom: (docQueues[s.id]?.length ?? 0) > 0 ? '1px solid hsl(var(--border))' : undefined }}>
                        <button
                          className="btn-sm ghost"
                          disabled={isUploadingThis}
                          onClick={() => docInputRefs.current[s.id]?.click()}
                          data-testid={`add-files-${s.id}`}
                        >
                          <Upload size={12} />
                          Add files
                        </button>
                        {(docQueues[s.id]?.length ?? 0) > 0 && (
                          <button
                            className="btn-sm primary"
                            disabled={isUploadingThis}
                            onClick={() => void uploadQueue(s.id)}
                            data-testid={`upload-queue-${s.id}`}
                          >
                            {isUploadingThis ? (
                              <><Loader2 size={12} className="animate-spin" /> Uploading...</>
                            ) : (
                              <><Upload size={12} /> Upload {docQueues[s.id].length} file{docQueues[s.id].length !== 1 ? 's' : ''}</>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Staging queue */}
                      {(docQueues[s.id]?.length ?? 0) > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0.5rem 0', borderBottom: '1px solid hsl(var(--border))' }}>
                          {docQueues[s.id].map((item) => (
                            <div key={item.localId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.375rem 0' }}>
                              <FileText size={13} strokeWidth={1.5} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                              <span style={{ flex: 1, minWidth: 100, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.file.name}
                              </span>
                              <select
                                className="select"
                                value={item.docType}
                                onChange={(e) => updateQueueItem(s.id, item.localId, 'docType', e.target.value)}
                                style={{ flex: '0 0 auto', minWidth: 130, fontSize: '0.75rem' }}
                              >
                                {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                                  <option key={val} value={val}>{label}</option>
                                ))}
                              </select>
                              <select
                                className="select"
                                value={item.accessLevel}
                                onChange={(e) => updateQueueItem(s.id, item.localId, 'accessLevel', e.target.value)}
                                style={{ flex: '0 0 auto', minWidth: 100, fontSize: '0.75rem' }}
                              >
                                <option value="private">Private</option>
                                <option value="team">Team</option>
                                <option value="investor">Investor</option>
                                <option value="public">Public</option>
                              </select>
                              <button
                                className="btn-sm ghost"
                                style={{ padding: '0.25rem', flexShrink: 0 }}
                                onClick={() => removeFromQueue(s.id, item.localId)}
                              >
                                <Trash2 size={12} style={{ color: '#ef4444' }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}


                      {/* Docs list */}
                      {isLoadingThis ? (
                        <div className="empty-state" style={{ padding: '1rem 0' }}>
                          <Loader2 size={16} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                          <span className="empty-description">Loading documents...</span>
                        </div>
                      ) : docs.length === 0 ? (
                        <div className="empty-state" style={{ padding: '1rem 0' }}>
                          <span className="empty-description">No documents yet. Upload a pitch deck to get started.</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {docs.map((doc) => {
                            const AccessIcon = ACCESS_ICONS[doc.access_level ?? 'private'] ?? Lock
                            return (
                              <div key={doc.id} className="list-item" data-testid={`doc-${doc.id}`} style={{ cursor: 'default' }}>
                                <FileText size={16} strokeWidth={1.5} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{doc.name}</span>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                    {DOC_TYPE_LABELS[doc.document_type ?? ''] ?? doc.document_type}
                                    {doc.file_size ? ` \u00B7 ${formatFileSize(doc.file_size)}` : ''}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span className="tag" title={doc.access_level ?? 'private'}>
                                    <AccessIcon size={10} style={{ marginRight: 4 }} />
                                    {doc.access_level ?? 'private'}
                                  </span>
                                  {doc.file_url ? (
                                    <a
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn-sm ghost"
                                      data-testid={`view-doc-${doc.id}`}
                                      style={{ padding: '0.25rem' }}
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                  ) : null}
                                  <button
                                    className="btn-sm ghost"
                                    onClick={() => void handleDocDelete(s.id, doc.id)}
                                    data-testid={`delete-doc-${doc.id}`}
                                    style={{ padding: '0.25rem', color: '#ef4444' }}
                                  >
                                    <Trash2 size={12} />
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
    </div>
  )
}
