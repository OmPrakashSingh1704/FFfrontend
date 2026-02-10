import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, User, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'

type AdminUser = {
  id: string
  email: string
  full_name: string
  phone?: string | null
  email_verified?: boolean
  phone_verified?: boolean
  status?: string
  role?: string
  league?: string
  credits?: number
  subscription_tier?: string
  created_at?: string
  updated_at?: string
}

const roleOptions = ['founder', 'investor', 'both', 'admin']
const statusOptions = ['active', 'inactive', 'suspended', 'deleted']

const roleBadgeClass = (role: string) => {
  switch (role) {
    case 'admin': return 'badge error'
    case 'investor': return 'badge info'
    case 'founder': return 'badge success'
    case 'both': return 'badge warning'
    default: return 'badge'
  }
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'active': return 'badge success'
    case 'suspended': return 'badge error'
    case 'deleted': return 'badge error'
    case 'inactive': return 'badge warning'
    default: return 'badge'
  }
}

export function AdminUserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const [user, setUser] = useState<AdminUser | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    email_verified: false,
    phone_verified: false,
    status: 'active',
    role: 'founder',
    subscription_tier: 'free',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<AdminUser>(`/admin/users/${id}/`)
        if (!cancelled) {
          setUser(data)
          setForm({
            full_name: data.full_name || '',
            email: data.email || '',
            phone: data.phone || '',
            email_verified: Boolean(data.email_verified),
            phone_verified: Boolean(data.phone_verified),
            status: data.status || 'active',
            role: data.role || 'founder',
            subscription_tier: data.subscription_tier || 'free',
          })
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load user.')
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

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const updated = await apiRequest<AdminUser>(`/admin/users/${id}/`, {
        method: 'PUT',
        body: {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          email_verified: form.email_verified,
          phone_verified: form.phone_verified,
          status: form.status,
          role: form.role,
          subscription_tier: form.subscription_tier,
        },
      })
      setUser(updated)
      pushToast('User updated', 'success')
    } catch {
      setError('Unable to update user.')
      pushToast('Update failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const applyStatus = async (nextStatus: string) => {
    setForm((prev) => ({ ...prev, status: nextStatus }))
    await handleSave()
  }

  const meta = useMemo(
    () => [
      { label: 'User ID', value: user?.id },
      { label: 'League', value: user?.league || '—' },
      { label: 'Credits', value: user?.credits?.toString() || '—' },
      { label: 'Created', value: user?.created_at ? new Date(user.created_at).toLocaleString() : '—' },
      { label: 'Updated', value: user?.updated_at ? new Date(user.updated_at).toLocaleString() : '—' },
    ],
    [user],
  )

  return (
    <div data-testid="admin-user-detail-page">
      <button className="back-btn" type="button" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Admin
      </button>

      {loading && (
        <div className="empty-state">
          <User className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading user...</p>
        </div>
      )}
      {error && <div className="empty-state"><p className="empty-description" style={{ color: '#ef4444' }}>{error}</p></div>}

      {!loading && user && (
        <>
          {/* Profile Header */}
          <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="avatar xl" data-testid="user-avatar">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h1 className="page-title">{user.full_name || 'User'}</h1>
                <p className="page-description">{user.email}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span className={roleBadgeClass(form.role)}>{form.role}</span>
                  <span className={statusBadgeClass(form.status)}>{form.status}</span>
                </div>
              </div>
            </div>
            <button className="btn-sm primary" type="button" onClick={() => void handleSave()} disabled={saving}>
              <Save size={14} strokeWidth={1.5} />
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>

          <div className="grid-2">
            {/* Profile Card */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Profile</h2>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>Core identity and contact details.</p>
              <div className="form-group">
                <label>Full name</label>
                <input
                  className="input"
                  value={form.full_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  className="input"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Subscription tier</label>
                <input
                  className="input"
                  value={form.subscription_tier}
                  onChange={(event) => setForm((prev) => ({ ...prev, subscription_tier: event.target.value }))}
                />
              </div>
            </div>

            {/* Access Card */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Access</h2>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>Role, status, and verification flags.</p>
              <div className="form-group">
                <label>Role</label>
                <select className="select" value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="select" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <span className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={form.email_verified}
                      onChange={(event) => setForm((prev) => ({ ...prev, email_verified: event.target.checked }))}
                    />
                    <span />
                  </span>
                  Email verified
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <span className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={form.phone_verified}
                      onChange={(event) => setForm((prev) => ({ ...prev, phone_verified: event.target.checked }))}
                    />
                    <span />
                  </span>
                  Phone verified
                </label>
              </div>

              <hr className="divider" />

              <div className="section-label">Quick Actions</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn-sm primary" type="button" onClick={() => void applyStatus('active')}>
                  <ShieldCheck size={14} strokeWidth={1.5} />
                  Activate
                </button>
                <button className="btn-sm ghost" type="button" onClick={() => void applyStatus('suspended')}>
                  <ShieldOff size={14} strokeWidth={1.5} />
                  Suspend
                </button>
                <button className="btn-sm ghost" type="button" onClick={() => void applyStatus('deleted')}>
                  <Trash2 size={14} strokeWidth={1.5} />
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Account Metadata */}
          <div className="section">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Account Metadata</h2>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>Read-only system fields.</p>
              <div className="grid-3" style={{ gap: '0.75rem' }}>
                {meta.map((item) => (
                  <div key={item.label} className="stat-card">
                    <div className="stat-header">
                      <span className="stat-label">{item.label}</span>
                    </div>
                    <div className="stat-value" style={{ fontSize: '0.875rem' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
