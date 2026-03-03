import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Rocket, Briefcase, ArrowRightLeft, Coins, ShieldCheck, RefreshCw, Plus, Minus, ScrollText } from 'lucide-react'
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

  const statCards = [
    { label: 'Active Users', value: stats?.users.total ?? '—', sub: `+${stats?.users.new_7d ?? 0} last 7 days`, icon: Users },
    { label: 'Startups', value: stats?.startups.total ?? '—', sub: `${stats?.startups.public ?? 0} public`, icon: Rocket },
    { label: 'Investors', value: stats?.investors.total ?? '—', sub: `${stats?.investors.pending_verification ?? 0} pending`, icon: Briefcase },
    { label: 'Intro Requests', value: stats?.intros.total ?? '—', sub: `Acceptance ${stats?.intros.acceptance_rate ?? 0}%`, icon: ArrowRightLeft },
    { label: 'Credits Earned', value: stats?.credits.total_earned ?? '—', sub: `Spent ${stats?.credits.total_spent ?? 0}`, icon: Coins },
  ]

  const roleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge error'
      case 'investor': return 'badge info'
      case 'founder': return 'badge success'
      default: return 'badge'
    }
  }

  return (
    <div data-testid="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-description">Manage platform access, verify investors, and review critical events.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link className="btn-sm ghost" to="/app/admin/funds">Funds</Link>
          <Link className="btn-sm ghost" to="/app/admin/applications">Applications</Link>
          <Link className="btn-sm ghost" to="/app/admin/moderation">Moderation</Link>
          <button className="btn-sm ghost" type="button" onClick={() => void loadUsers(userSearch)}>
            <RefreshCw size={14} strokeWidth={1.5} />
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <Users className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading admin data...</p>
        </div>
      )}
      {error && <div className="empty-state"><p className="empty-description" style={{ color: '#ef4444' }}>{error}</p></div>}

      {!loading && !error && (
        <>
          {/* Metrics Grid */}
          <div className="section">
            <div className="grid-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {statCards.map((stat) => (
                <div key={stat.label} className="stat-card" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="stat-header">
                    <span className="stat-label">{stat.label}</span>
                    <stat.icon className="stat-icon" strokeWidth={1.5} />
                  </div>
                  <div className="stat-value">{stat.value}</div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{stat.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Users Section */}
          <div className="section">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Users</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    className="input"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search by email"
                    style={{ width: '240px' }}
                    data-testid="user-search-input"
                  />
                  <button className="btn-sm primary" type="button" onClick={() => void loadUsers(userSearch)}>
                    Search
                  </button>
                </div>
              </div>
              <table className="data-table" data-testid="users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>League</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.slice(0, 8).map((user) => (
                    <tr key={user.id} data-testid={`user-row-${user.id}`}>
                      <td style={{ fontWeight: 500 }}>{user.full_name || '—'}</td>
                      <td>{user.email}</td>
                      <td><span className={roleBadgeClass(user.role)}>{user.role}</span></td>
                      <td><span className="tag">{user.league || '—'}</span></td>
                      <td><span className={`badge ${user.status === 'active' ? 'success' : user.status === 'suspended' ? 'error' : ''}`}>{user.status || 'active'}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-sm ghost" type="button" onClick={() => navigate(`/app/admin/users/${user.id}`)}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Verifications */}
          <div className="section">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Pending Verifications</h2>
                  <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>Investor profiles awaiting approval.</p>
                </div>
                <span className="badge warning">{pending.length} pending</span>
              </div>
              {pending.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <ShieldCheck className="empty-icon" strokeWidth={1.5} />
                  <p className="empty-description">No pending profiles.</p>
                </div>
              ) : (
                <table className="data-table" data-testid="verifications-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Fund / Type</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((profile) => (
                      <tr key={profile.id} data-testid={`verification-row-${profile.id}`}>
                        <td style={{ fontWeight: 500 }}>{profile.display_name || profile.user?.full_name || 'Investor'}</td>
                        <td>{profile.fund_name || profile.investor_type || '—'}</td>
                        <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn-sm ghost" type="button" onClick={() => void handleReject(profile.id)}>
                            Reject
                          </button>
                          <button className="btn-sm primary" type="button" onClick={() => void handleVerify(profile.id)}>
                            Verify
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Credit Actions + Audit Log */}
          <div className="grid-2">
            {/* Credit Actions */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Credit Actions</h2>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>Adjust credits for a specific user.</p>

              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={12} strokeWidth={1.5} />
                Grant Credits
              </div>
              <div className="form-group">
                <label>User ID</label>
                <input
                  className="input"
                  value={grantForm.user_id}
                  onChange={(event) => setGrantForm((prev) => ({ ...prev, user_id: event.target.value }))}
                  placeholder="Enter user ID"
                />
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input
                  className="input"
                  value={grantForm.amount}
                  onChange={(event) => setGrantForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="Number of credits"
                />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <input
                  className="input"
                  value={grantForm.reason}
                  onChange={(event) => setGrantForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Reason for granting"
                />
              </div>
              <button className="btn-sm primary" type="button" onClick={() => void handleGrant()} style={{ marginBottom: '1.5rem' }}>
                <Plus size={14} strokeWidth={1.5} />
                Grant credits
              </button>

              <hr className="divider" />

              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Minus size={12} strokeWidth={1.5} />
                Deduct Credits
              </div>
              <div className="form-group">
                <label>User ID</label>
                <input
                  className="input"
                  value={deductForm.user_id}
                  onChange={(event) => setDeductForm((prev) => ({ ...prev, user_id: event.target.value }))}
                  placeholder="Enter user ID"
                />
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input
                  className="input"
                  value={deductForm.amount}
                  onChange={(event) => setDeductForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="Number of credits"
                />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <input
                  className="input"
                  value={deductForm.reason}
                  onChange={(event) => setDeductForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Reason for deduction"
                />
              </div>
              <button className="btn-sm ghost" type="button" onClick={() => void handleDeduct()} style={{ marginBottom: '1rem' }}>
                <Minus size={14} strokeWidth={1.5} />
                Deduct credits
              </button>

              <hr className="divider" />

              <button className="btn-sm ghost" type="button" onClick={() => void handleResetMonthly()}>
                <RefreshCw size={14} strokeWidth={1.5} />
                Reset monthly intro limits
              </button>
            </div>

            {/* Audit Log */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Admin Audit Log</h2>
                <Link className="btn-sm ghost" to="/app/audit-log">
                  <ScrollText size={14} strokeWidth={1.5} />
                  View all
                </Link>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>Recent admin actions.</p>
              <table className="data-table" data-testid="audit-log-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Admin</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} data-testid={`audit-row-${log.id}`}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
                      <td>{log.user_email || 'Unknown admin'}</td>
                      <td style={{ fontWeight: 500 }}>{log.action || 'Action'}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>No audit entries.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
