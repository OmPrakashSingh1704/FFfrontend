import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'

type AdminStats = {
  users: {
    total: number
    new_30d: number
    new_7d: number
    by_role: Array<{ role: string; count: number }>
    by_league: Array<{ league: string; count: number }>
  }
  startups: {
    total: number
    public: number
  }
  investors: {
    total: number
    verified: number
    pending_verification: number
  }
  intros: {
    total: number
    last_30_days: number
    accepted: number
    declined: number
    acceptance_rate: number
  }
  credits: {
    total_earned: number
    total_spent: number
  }
}

type AdminUser = {
  id: string
  email: string
  full_name: string
  role: string
  league?: string | null
  status?: string
  credits?: number
  created_at?: string
}

type InvestorProfile = {
  id: string
  user?: {
    id: string
    full_name: string
    email?: string
  }
  display_name?: string
  fund_name?: string
  investor_type?: string
  discoverability_mode?: string
  created_at?: string
}

type AdminAuditLog = {
  id: string
  action?: string
  user_email?: string | null
  created_at?: string
}

export function AdminPage() {
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pending, setPending] = useState<InvestorProfile[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [grantForm, setGrantForm] = useState({ user_id: '', amount: '', reason: '' })
  const [deductForm, setDeductForm] = useState({ user_id: '', amount: '', reason: '' })

  const loadUsers = async (query = '') => {
    const params = new URLSearchParams()
    if (query) params.set('email', query)
    const data = await apiRequest<AdminUser[] | { results: AdminUser[] }>(`/admin/users/?${params.toString()}`)
    setUsers(normalizeList(data))
  }

  const loadPending = async () => {
    const data = await apiRequest<InvestorProfile[] | { results: InvestorProfile[] }>('/admin/pending-verifications/')
    setPending(normalizeList(data))
  }

  const loadAudit = async () => {
    const data = await apiRequest<AdminAuditLog[] | { results: AdminAuditLog[] }>('/admin/audit-logs/?limit=8')
    setAuditLogs(normalizeList(data))
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const statsData = await apiRequest<AdminStats>('/admin/stats/')
        if (!cancelled) {
          setStats(statsData)
        }
        await Promise.all([loadUsers(), loadPending(), loadAudit()])
      } catch {
        if (!cancelled) {
          setError('Unable to load admin data.')
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
  }, [])

  const handleVerify = async (id: string) => {
    if (!window.confirm('Verify this investor profile?')) return
    try {
      await apiRequest(`/admin/verify-investor/${id}/`, { method: 'POST' })
      pushToast('Investor verified', 'success')
      await loadPending()
    } catch {
      pushToast('Unable to verify investor', 'error')
    }
  }

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection?')
    if (!reason) return
    try {
      await apiRequest(`/admin/reject-investor/${id}/`, { method: 'POST', body: { reason } })
      pushToast('Investor rejected', 'info')
      await loadPending()
    } catch {
      pushToast('Unable to reject investor', 'error')
    }
  }

  const handleGrant = async () => {
    if (!grantForm.user_id || !grantForm.amount) return
    try {
      await apiRequest('/admin/grant-credits/', {
        method: 'POST',
        body: {
          user_id: grantForm.user_id,
          amount: Number(grantForm.amount),
          reason: grantForm.reason,
        },
      })
      pushToast('Credits granted', 'success')
      setGrantForm({ user_id: '', amount: '', reason: '' })
      await loadUsers(userSearch)
    } catch {
      pushToast('Unable to grant credits', 'error')
    }
  }

  const handleDeduct = async () => {
    if (!deductForm.user_id || !deductForm.amount) return
    try {
      await apiRequest('/admin/deduct-credits/', {
        method: 'POST',
        body: {
          user_id: deductForm.user_id,
          amount: Number(deductForm.amount),
          reason: deductForm.reason,
        },
      })
      pushToast('Credits deducted', 'info')
      setDeductForm({ user_id: '', amount: '', reason: '' })
      await loadUsers(userSearch)
    } catch {
      pushToast('Unable to deduct credits', 'error')
    }
  }

  const handleResetMonthly = async () => {
    if (!window.confirm('Reset monthly intro limits for all users?')) return
    try {
      await apiRequest('/admin/reset-monthly-limits/', { method: 'POST' })
      pushToast('Monthly limits reset', 'success')
    } catch {
      pushToast('Unable to reset limits', 'error')
    }
  }

  return (
    <section className="content-section admin-page">
      <header className="content-header">
        <div>
          <h1>Admin Control Room</h1>
          <p>Manage platform access, verify investors, and review critical events.</p>
        </div>
        <div className="data-actions">
          <Link className="btn ghost" to="/app/admin/funds">
            Funds
          </Link>
          <Link className="btn ghost" to="/app/admin/applications">
            Applications
          </Link>
          <Link className="btn ghost" to="/app/admin/moderation">
            Moderation
          </Link>
          <button className="btn ghost" type="button" onClick={() => void loadUsers(userSearch)}>
            Refresh users
          </button>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading admin data...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="analytics-grid">
        <div className="metric-card">
          <span className="metric-label">Active users</span>
          <span className="metric-value">{stats?.users.total ?? '—'}</span>
          <span className="metric-sub">+{stats?.users.new_7d ?? 0} last 7 days</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Startups</span>
          <span className="metric-value">{stats?.startups.total ?? '—'}</span>
          <span className="metric-sub">{stats?.startups.public ?? 0} public</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Investors</span>
          <span className="metric-value">{stats?.investors.total ?? '—'}</span>
          <span className="metric-sub">{stats?.investors.pending_verification ?? 0} pending</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Intro requests</span>
          <span className="metric-value">{stats?.intros.total ?? '—'}</span>
          <span className="metric-sub">Acceptance {stats?.intros.acceptance_rate ?? 0}%</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Credits earned</span>
          <span className="metric-value">{stats?.credits.total_earned ?? '—'}</span>
          <span className="metric-sub">Spent {stats?.credits.total_spent ?? 0}</span>
        </div>
      </div>

      <div className="admin-layout">
        <div className="admin-card">
          <header>
            <h2>Users</h2>
            <div className="admin-search">
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search by email"
              />
              <button className="btn ghost" type="button" onClick={() => void loadUsers(userSearch)}>
                Search
              </button>
            </div>
          </header>
          <div className="admin-list">
            {users.slice(0, 8).map((user) => (
              <div key={user.id} className="admin-item">
                <div>
                  <strong>{user.full_name || user.email}</strong>
                  <p>{user.email}</p>
                </div>
                <div>
                  <span className="admin-pill">{user.role}</span>
                  <span className="admin-pill">{user.league || '—'}</span>
                </div>
                <button className="btn ghost" type="button" onClick={() => navigate(`/app/admin/users/${user.id}`)}>
                  Manage
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <header>
            <h2>Pending verifications</h2>
            <p>Investor profiles awaiting approval.</p>
          </header>
          <div className="admin-list">
            {pending.length === 0 ? <p>No pending profiles.</p> : null}
            {pending.map((profile) => (
              <div key={profile.id} className="admin-item">
                <div>
                  <strong>{profile.display_name || profile.user?.full_name || 'Investor'}</strong>
                  <p>{profile.fund_name || profile.investor_type || '—'}</p>
                </div>
                <div className="admin-actions">
                  <button className="btn ghost" type="button" onClick={() => void handleReject(profile.id)}>
                    Reject
                  </button>
                  <button className="btn primary" type="button" onClick={() => void handleVerify(profile.id)}>
                    Verify
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-layout">
        <div className="admin-card">
          <header>
            <h2>Credit actions</h2>
            <p>Adjust credits for a specific user.</p>
          </header>
          <div className="admin-form">
            <label>
              User ID
              <input
                value={grantForm.user_id}
                onChange={(event) => setGrantForm((prev) => ({ ...prev, user_id: event.target.value }))}
              />
            </label>
            <label>
              Amount
              <input
                value={grantForm.amount}
                onChange={(event) => setGrantForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </label>
            <label>
              Reason
              <input
                value={grantForm.reason}
                onChange={(event) => setGrantForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </label>
            <button className="btn primary" type="button" onClick={() => void handleGrant()}>
              Grant credits
            </button>
          </div>
          <div className="admin-form">
            <label>
              User ID
              <input
                value={deductForm.user_id}
                onChange={(event) => setDeductForm((prev) => ({ ...prev, user_id: event.target.value }))}
              />
            </label>
            <label>
              Amount
              <input
                value={deductForm.amount}
                onChange={(event) => setDeductForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </label>
            <label>
              Reason
              <input
                value={deductForm.reason}
                onChange={(event) => setDeductForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </label>
            <button className="btn ghost" type="button" onClick={() => void handleDeduct()}>
              Deduct credits
            </button>
          </div>
          <button className="btn ghost" type="button" onClick={() => void handleResetMonthly()}>
            Reset monthly intro limits
          </button>
        </div>

        <div className="admin-card">
          <header>
            <h2>Admin audit log</h2>
            <p>Recent admin actions.</p>
          </header>
          <div className="admin-list">
            {auditLogs.map((log) => (
              <div key={log.id} className="admin-item">
                <div>
                  <strong>{log.action || 'Action'}</strong>
                  <p>{log.user_email || 'Unknown admin'}</p>
                </div>
                <span>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
