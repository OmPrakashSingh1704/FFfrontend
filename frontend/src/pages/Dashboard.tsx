import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Users, Briefcase, TrendingUp, Bell,
  BarChart3, Search, FileText, Upload, Wallet, ArrowRight,
  Zap, Target, Shield, Heart, CheckCircle, FolderHeart
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useAuth } from '../context/AuthContext'
import type { TrustStatus } from '../types/trust'
import type { InvestorStats } from '../types/investor'
import type { IntroRequest } from '../types/intro'
import type { StartupListItem } from '../types/startup'

const quickActions = [
  { path: '/app/feed', label: 'View feed', icon: Activity, description: 'Latest updates from your network' },
  { path: '/app/intros', label: 'Manage intros', icon: Users, description: 'Track warm introductions' },
  { path: '/app/notifications', label: 'Notifications', icon: Bell, description: 'Stay on top of updates' },
  { path: '/app/search', label: 'Search', icon: Search, description: 'Find founders & investors' },
]

const browseLinks = [
  { path: '/app/founders', label: 'Founders', icon: Users },
  { path: '/app/startups', label: 'Startups', icon: Briefcase },
  { path: '/app/investors', label: 'Investors', icon: TrendingUp },
  { path: '/app/funds', label: 'Funds', icon: Wallet },
  { path: '/app/applications', label: 'Applications', icon: FileText },
  { path: '/app/uploads', label: 'Files', icon: Upload },
]

type DashboardStats = {
  label: string
  value: string | number
  icon: typeof Zap
}

export function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats[]>([])
  const [loading, setLoading] = useState(true)
  const [dealFlow, setDealFlow] = useState<IntroRequest[]>([])
  const [portfolio, setPortfolio] = useState<StartupListItem[]>([])

  const isInvestor = user?.role === 'investor' || user?.role === 'both'

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const promises: Promise<unknown>[] = [
          apiRequest<TrustStatus>('/trust/status/'),
          apiRequest<unknown[]>('/respects/received/'),
          apiRequest<unknown[]>('/intros/sent/'),
        ]

        if (isInvestor) {
          promises.push(apiRequest<InvestorStats>('/investors/stats/'))
          promises.push(apiRequest<IntroRequest[] | { results: IntroRequest[] }>('/investors/deal-flow/?status=pending&limit=5'))
          promises.push(apiRequest<StartupListItem[] | { results: StartupListItem[] }>('/investors/portfolio/'))
        }

        const results = await Promise.all(promises)
        if (cancelled) return

        const trustStatus = results[0] as TrustStatus
        const respects = normalizeList(results[1] as unknown[])
        const sentIntros = normalizeList(results[2] as unknown[])

        if (isInvestor) {
          const investorStats = results[3] as InvestorStats
          const dealFlowData = normalizeList(results[4] as IntroRequest[] | { results: IntroRequest[] })
          const portfolioData = normalizeList(results[5] as StartupListItem[] | { results: StartupListItem[] })

          setStats([
            { label: 'Pending Intros', value: investorStats.pending_intros, icon: Zap },
            { label: 'Portfolio', value: investorStats.portfolio_count, icon: Briefcase },
            { label: 'Saved Startups', value: investorStats.saved_startups, icon: FolderHeart },
            { label: 'Accepted', value: investorStats.accepted_intros, icon: CheckCircle },
          ])
          setDealFlow(dealFlowData.slice(0, 5))
          setPortfolio(portfolioData.slice(0, 5))
        } else {
          setStats([
            { label: 'League', value: trustStatus.league ?? '—', icon: Shield },
            { label: 'Credits', value: trustStatus.credits ?? 0, icon: Target },
            { label: 'Intros Sent', value: sentIntros.length, icon: Zap },
            { label: 'Respect', value: respects.length, icon: Heart },
          ])
        }
      } catch {
        // Graceful fallback — show empty stats
        setStats([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [isInvestor])

  return (
    <div className="dashboard-page" data-testid="dashboard">
      {/* Welcome Section */}
      <section className="dashboard-welcome">
        <h1>Welcome back{user?.full_name ? `, ${user.full_name}` : ''}</h1>
        <p>Your fundraising command center. Track signals, manage intros, and close with confidence.</p>
      </section>

      {/* Stats Grid */}
      <section className="dashboard-stats" data-testid="dashboard-stats">
        {loading ? (
          <div className="page-loader" style={{ gridColumn: '1 / -1' }}>Loading stats...</div>
        ) : stats.length > 0 ? (
          stats.map((stat) => (
            <div key={stat.label} className="stat-card" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="stat-header">
                <span className="stat-label">{stat.label}</span>
                <stat.icon className="stat-icon" />
              </div>
              <div className="stat-value">{stat.value}</div>
            </div>
          ))
        ) : (
          <div className="page-loader" style={{ gridColumn: '1 / -1' }}>Unable to load stats.</div>
        )}
      </section>

      {/* Investor: Deal Flow Preview */}
      {isInvestor && !loading && dealFlow.length > 0 && (
        <section className="dashboard-section">
          <div className="preview-header">
            <h2>Pending Deal Flow</h2>
            <Link to="/app/intros" data-testid="view-all-deal-flow">View all</Link>
          </div>
          <div className="data-grid">
            {dealFlow.map((intro) => (
              <article key={intro.id} className="data-card" data-testid="deal-flow-card">
                <span className="data-eyebrow">{intro.startup_industry || 'Startup'}</span>
                <h3>{intro.startup_name}</h3>
                <p>{intro.pitch_summary ? `${intro.pitch_summary.slice(0, 120)}${intro.pitch_summary.length > 120 ? '...' : ''}` : ''}</p>
                <div className="data-meta">
                  <span>{intro.founder_user?.full_name}</span>
                  <span>{new Date(intro.created_at).toLocaleDateString()}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Investor: Portfolio Preview */}
      {isInvestor && !loading && portfolio.length > 0 && (
        <section className="dashboard-section">
          <div className="preview-header">
            <h2>Portfolio</h2>
            <Link to="/app/startups" data-testid="view-all-portfolio">View all</Link>
          </div>
          <div className="data-grid">
            {portfolio.map((startup) => (
              <article key={startup.id} className="data-card" data-testid="portfolio-card">
                <span className="data-eyebrow">{startup.industry || 'Startup'}</span>
                <h3>{startup.name}</h3>
                <p>{startup.tagline || ''}</p>
                <div className="data-meta">
                  {startup.current_stage ? <span>{startup.current_stage}</span> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="action-grid" data-testid="quick-actions">
          {quickActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="action-card"
              data-testid={`quick-action-${action.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="action-icon">
                <action.icon />
              </div>
              <div className="action-content">
                <span className="action-label">{action.label}</span>
                <p>{action.description}</p>
              </div>
              <ArrowRight className="action-arrow" />
            </Link>
          ))}
        </div>
      </section>

      {/* Browse Section */}
      <section className="dashboard-section">
        <h2>Browse</h2>
        <div className="browse-grid" data-testid="browse-links">
          {browseLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="browse-card"
              data-testid={`browse-${link.label.toLowerCase()}`}
            >
              <link.icon className="browse-icon" />
              <span>{link.label}</span>
              <ArrowRight className="browse-arrow" />
            </Link>
          ))}
        </div>
      </section>

      {/* Analytics Preview */}
      <section className="dashboard-section">
        <div className="analytics-preview">
          <div className="analytics-header">
            <div>
              <h2>Activity Overview</h2>
              <p>Your platform activity at a glance</p>
            </div>
            <Link to="/app/analytics" className="btn ghost" data-testid="view-analytics-btn">
              <BarChart3 />
              View Analytics
            </Link>
          </div>
          <div className="analytics-placeholder">
            <span>Analytics visualization coming soon</span>
          </div>
        </div>
      </section>
    </div>
  )
}
