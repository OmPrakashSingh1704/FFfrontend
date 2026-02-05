import { Link, Outlet } from 'react-router-dom'
import { 
  Home, Users, Briefcase, TrendingUp, MessageSquare, Bell, 
  BarChart3, Shield, Settings, Search, FileText, Upload,
  Phone, Activity, Wallet, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import logoMark from '../assets/logo-mark.svg'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { Page } from '../components/Page'
import { RealtimeBridge } from '../components/RealtimeBridge'

const navItems = [
  { path: '/app', label: 'Dashboard', icon: Home },
  { path: '/app/feed', label: 'Feed', icon: Activity },
  { path: '/app/founders', label: 'Founders', icon: Users },
  { path: '/app/startups', label: 'Startups', icon: Briefcase },
  { path: '/app/investors', label: 'Investors', icon: TrendingUp },
  { path: '/app/funds', label: 'Funds', icon: Wallet },
  { path: '/app/intros', label: 'Intros', icon: Users },
  { path: '/app/applications', label: 'Applications', icon: FileText },
  { path: '/app/chat', label: 'Chat', icon: MessageSquare },
  { path: '/app/calls', label: 'Calls', icon: Phone },
  { path: '/app/notifications', label: 'Notifications', icon: Bell },
  { path: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/app/search', label: 'Search', icon: Search },
  { path: '/app/uploads', label: 'Uploads', icon: Upload },
  { path: '/app/admin', label: 'Admin', icon: Settings },
]

export function AppShell() {
  const { status, user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <Page>
      <RealtimeBridge />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      
      {/* Header */}
      <header className="app-header" data-testid="app-header">
        <div className="flex items-center gap-4">
          <Link to="/" className="logo">
            <span className="logo-mark">
              <img src={logoMark} alt="FoundersLib logo" />
            </span>
            <span className="logo-name hidden sm:inline">FoundersLib</span>
          </Link>
          
          {/* Mobile menu toggle */}
          <button 
            className="lg:hidden btn ghost p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="app-nav hidden lg:flex" aria-label="Application">
          {navItems.slice(0, 8).map(item => (
            <Link key={item.path} to={item.path} className="flex items-center gap-1.5">
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          ))}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400">
              More
            </button>
            <div className="absolute top-full right-0 mt-2 py-2 w-48 glass-card rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              {navItems.slice(8).map(item => (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-cyan-400 hover:bg-white/5"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        
        <div className="app-actions">
          <ThemeToggle />
          {status === 'authenticated' ? (
            <button 
              type="button" 
              className="btn ghost" 
              onClick={() => void logout()}
              data-testid="logout-btn"
            >
              Logout {user?.full_name ? `(${user.full_name})` : ''}
            </button>
          ) : (
            <Link className="btn ghost" to="/login" data-testid="signin-btn">
              Sign in
            </Link>
          )}
        </div>
      </header>
      
      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="lg:hidden glass-card mx-4 mb-4 p-4 rounded-xl" data-testid="mobile-nav">
          <div className="grid grid-cols-3 gap-2">
            {navItems.map(item => (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={() => setMobileMenuOpen(false)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors text-xs"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
      
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </Page>
  )
}
