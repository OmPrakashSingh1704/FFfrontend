import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Users, Briefcase, TrendingUp, Bell,
  Search, FileText, Upload, Wallet, ArrowRight,
  Zap, Target, Shield, Heart, CheckCircle, FolderHeart,
  Calendar
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

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
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

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="dashboard-page" data-testid="dashboard">
      {/* Greeting Bar */}
      <div className="flex items-center gap-4 mb-8">
        <div className="avatar lg">
          {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="page-title">{getGreeting()}{user?.full_name ? `, ${user.full_name}` : ''}</h1>
          <p className="page-description flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {today}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <section className="grid-4 mb-8" data-testid="dashboard-stats">
        {loading ? (
          <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
            <div className="stat-label">Loading stats...</div>
          </div>
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
          <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
            <div className="stat-label">Unable to load stats.</div>
          </div>
        )}
      </section>

      <hr className="divider" />

      {/* Investor: Deal Flow Table */}
      {isInvestor && !loading && dealFlow.length > 0 && (
        <section className="section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Pending Deal Flow</h2>
            <Link to="/app/intros" className="btn-sm ghost" data-testid="view-all-deal-flow">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Startup</th>
                  <th>Industry</th>
                  <th>Founder</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {dealFlow.map((intro) => (
                  <tr key={intro.id} data-testid="deal-flow-card">
                    <td className="font-medium">{intro.startup_name}</td>
                    <td><span className="tag">{intro.startup_industry || 'Startup'}</span></td>
                    <td>{intro.founder_user?.full_name || '—'}</td>
                    <td className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {new Date(intro.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Investor: Portfolio Table */}
      {isInvestor && !loading && portfolio.length > 0 && (
        <section className="section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Portfolio</h2>
            <Link to="/app/startups" className="btn-sm ghost" data-testid="view-all-portfolio">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Industry</th>
                  <th>Stage</th>
                  <th>Tagline</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((startup) => (
                  <tr key={startup.id} data-testid="portfolio-card">
                    <td className="font-medium">{startup.name}</td>
                    <td><span className="tag">{startup.industry || '—'}</span></td>
                    <td>{startup.current_stage || '—'}</td>
                    <td className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {startup.tagline || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="section">
        <h2 className="section-label">Quick Actions</h2>
        <div className="grid-3" data-testid="quick-actions">
          {quickActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="card flex items-center gap-4 group"
              data-testid={`quick-action-${action.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="avatar">
                <action.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium block">{action.label}</span>
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{action.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gold)' }} />
            </Link>
          ))}
        </div>
      </section>

      <hr className="divider" />

      {/* Browse Section */}
      <section className="section">
        <h2 className="section-label">Browse</h2>
        <div className="grid-3" data-testid="browse-links">
          {browseLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="card flex items-center gap-3 group"
              data-testid={`browse-${link.label.toLowerCase()}`}
            >
              <link.icon className="w-4 h-4" style={{ color: 'var(--gold)' }} />
              <span className="text-sm font-medium flex-1">{link.label}</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'hsl(var(--muted-foreground))' }} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
