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
  { path: '/app/founders', label: 'Founders', icon: Users, color: 'from-cyan-500/20 to-cyan-500/5' },
  { path: '/app/startups', label: 'Startups', icon: Briefcase, color: 'from-violet-500/20 to-violet-500/5' },
  { path: '/app/investors', label: 'Investors', icon: TrendingUp, color: 'from-emerald-500/20 to-emerald-500/5' },
  { path: '/app/funds', label: 'Funds', icon: Wallet, color: 'from-amber-500/20 to-amber-500/5' },
  { path: '/app/applications', label: 'Applications', icon: FileText, color: 'from-pink-500/20 to-pink-500/5' },
  { path: '/app/uploads', label: 'Uploads', icon: Upload, color: 'from-blue-500/20 to-blue-500/5' },
]

const stats = [
  { label: 'Active Intros', value: '12', icon: Zap, trend: '+3 this week' },
  { label: 'Pipeline Value', value: '$2.4M', icon: Target, trend: '+18% MoM' },
  { label: 'Response Rate', value: '67%', icon: MessageSquare, trend: 'Above avg' },
  { label: 'Avg. Response', value: '4.2h', icon: Clock, trend: '-12% faster' },
]

export function Dashboard() {
  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Welcome Section */}
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Welcome to <span className="text-gradient">FoundersLib</span></h1>
        <p className="text-slate-400">Your fundraising command center. Track signals, manage intros, and close faster.</p>
      </section>

      {/* Stats Grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-5 space-y-3 group hover:border-cyan-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-display">{stat.value}</div>
            <div className="text-xs text-emerald-400">{stat.trend}</div>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="quick-actions">
          {quickActions.map((action) => (
            <Link 
              key={action.path} 
              to={action.path} 
              className="glass-card p-5 group hover:border-cyan-500/30 transition-all hover:-translate-y-1"
              data-testid={`quick-action-${action.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="font-medium">{action.label}</span>
              </div>
              <p className="text-sm text-slate-500">{action.description}</p>
              <div className="mt-4 flex items-center gap-1 text-cyan-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Go <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Browse Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Browse Platform</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="browse-links">
          {browseLinks.map((link) => (
            <Link 
              key={link.path} 
              to={link.path} 
              className={`glass-card p-5 group hover:border-cyan-500/30 transition-all hover:-translate-y-1 bg-gradient-to-br ${link.color}`}
              data-testid={`browse-${link.label.toLowerCase()}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <link.icon className="w-5 h-5 text-slate-300" />
                  <span className="font-medium">{link.label}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Analytics Preview */}
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Activity Overview</h2>
            <p className="text-sm text-slate-500">Your platform activity at a glance</p>
          </div>
          <Link to="/app/analytics" className="btn ghost text-sm" data-testid="view-analytics-btn">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Analytics
          </Link>
        </div>
        <div className="h-32 flex items-center justify-center text-slate-600 border border-dashed border-white/10 rounded-xl">
          <span className="text-sm">Analytics visualization coming soon</span>
        </div>
      </section>
    </div>
  )
}
