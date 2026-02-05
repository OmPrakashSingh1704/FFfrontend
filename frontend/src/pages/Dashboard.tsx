import { Link } from 'react-router-dom'
import { 
  Activity, Users, Briefcase, TrendingUp, MessageSquare, Bell, 
  BarChart3, Search, FileText, Upload, Wallet, ArrowRight,
  Zap, Target, Clock
} from 'lucide-react'

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

const stats = [
  { label: 'Active Intros', value: '12', icon: Zap, trend: '+3 this week' },
  { label: 'Pipeline Value', value: '$2.4M', icon: Target, trend: '+18% MoM' },
  { label: 'Response Rate', value: '67%', icon: MessageSquare, trend: 'Above avg' },
  { label: 'Avg. Response', value: '4.2h', icon: Clock, trend: '-12% faster' },
]

export function Dashboard() {
  return (
    <div className="dashboard-page" data-testid="dashboard">
      {/* Welcome Section */}
      <section className="dashboard-welcome">
        <h1>Welcome back</h1>
        <p>Your fundraising command center. Track signals, manage intros, and close with confidence.</p>
      </section>

      {/* Stats Grid */}
      <section className="dashboard-stats" data-testid="dashboard-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-header">
              <span className="stat-label">{stat.label}</span>
              <stat.icon className="stat-icon" />
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-trend">{stat.trend}</div>
          </div>
        ))}
      </section>

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
