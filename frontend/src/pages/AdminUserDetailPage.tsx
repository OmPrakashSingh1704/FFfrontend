import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
      { label: 'League', value: user?.league || '-' },
      { label: 'Credits', value: user?.credits?.toString() || '-' },
      { label: 'Created', value: user?.created_at ? new Date(user.created_at).toLocaleString() : '-' },
      { label: 'Updated', value: user?.updated_at ? new Date(user.updated_at).toLocaleString() : '-' },
    ],
    [user],
  )

  return (
    <section className="content-section admin-user-page">
      <header className="content-header">
        <div>
          <h1>User Control</h1>
          <p>Edit account status, roles, and verification flags.</p>
        </div>
        <div className="data-actions">
          <button className="btn ghost" type="button" onClick={() => navigate('/app/admin')}>
            Back to admin
          </button>
          <button className="btn primary" type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading user...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && user ? (
        <div className="admin-user-grid">
          <div className="admin-card">
            <header>
              <h2>Profile</h2>
              <p>Core identity and contact details.</p>
            </header>
            <div className="admin-form">
              <label>
                Full name
                <input
                  value={form.full_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </label>
              <label>
                Subscription tier
                <input
                  value={form.subscription_tier}
                  onChange={(event) => setForm((prev) => ({ ...prev, subscription_tier: event.target.value }))}
                />
              </label>
            </div>
          </div>

          <div className="admin-card">
            <header>
              <h2>Access</h2>
              <p>Role, status, and verification flags.</p>
            </header>
            <div className="admin-form">
              <label>
                Role
                <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={form.email_verified}
                  onChange={(event) => setForm((prev) => ({ ...prev, email_verified: event.target.checked }))}
                />
                Email verified
              </label>
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={form.phone_verified}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone_verified: event.target.checked }))}
                />
                Phone verified
              </label>
            </div>
            <div className="admin-actions">
              <button className="btn ghost" type="button" onClick={() => void applyStatus('suspended')}>
                Suspend
              </button>
              <button className="btn ghost" type="button" onClick={() => void applyStatus('active')}>
                Activate
              </button>
              <button className="btn ghost" type="button" onClick={() => void applyStatus('deleted')}>
                Delete
              </button>
            </div>
          </div>

          <div className="admin-card">
            <header>
              <h2>Account metadata</h2>
              <p>Read-only system fields.</p>
            </header>
            <div className="admin-meta">
              {meta.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
