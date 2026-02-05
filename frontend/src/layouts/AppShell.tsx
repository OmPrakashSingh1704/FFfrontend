import { Link, Outlet } from 'react-router-dom'
import { 
  Home, Users, Briefcase, TrendingUp, MessageSquare, Bell, 
  BarChart3, Settings, Search, FileText, Upload,
  Phone, Activity, Wallet, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import logoMark from '../assets/logo-mark.svg'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { Page } from '../components/Page'
import { RealtimeBridge } from '../components/RealtimeBridge'

const navItems = [
  { path: '/app', label: 'Home', icon: Home },
  { path: '/app/feed', label: 'Feed', icon: Activity },
  { path: '/app/founders', label: 'Founders', icon: Users },
  { path: '/app/startups', label: 'Startups', icon: Briefcase },
  { path: '/app/investors', label: 'Investors', icon: TrendingUp },
  { path: '/app/funds', label: 'Funds', icon: Wallet },
  { path: '/app/applications', label: 'Applications', icon: FileText },
  { path: '/app/chat', label: 'Chat', icon: MessageSquare },
  { path: '/app/notifications', label: 'Alerts', icon: Bell },
  { path: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/app/search', label: 'Search', icon: Search },
  { path: '/app/uploads', label: 'Files', icon: Upload },
  { path: '/app/admin', label: 'Admin', icon: Settings },
]

export function AppShell() {
  const { status, user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <Page>
      <RealtimeBridge />
      
      {/* Header */}
      <header className="app-header" data-testid="app-header">
        <div className="flex items-center gap-3">
          <Link to="/" className="logo">
            <span className="logo-mark">
              <img src={logoMark} alt="" />
            </span>
            <span className="logo-name">FoundersLib</span>
          </Link>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="app-nav" aria-label="Application">
          {navItems.slice(0, 7).map(item => (
            <Link key={item.path} to={item.path}>
              {item.label}
            </Link>
          ))}
        </nav>
        
        <div className="app-actions">
          {/* Mobile menu toggle */}
          <button 
            className="md:hidden btn ghost"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-toggle"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          {/* Notification Bell */}
          <Link 
            to="/app/notifications" 
            className="header-icon-btn"
            data-testid="header-notifications-btn"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </Link>
          
          <ThemeToggle />
          
          {status === 'authenticated' ? (
            <button 
              type="button" 
              className="btn ghost hidden sm:inline-flex" 
              onClick={() => void logout()}
              data-testid="logout-btn"
            >
              Logout
            </button>
          ) : (
            <Link className="btn primary" to="/login" data-testid="signin-btn">
              Sign in
            </Link>
          )}
        </div>
      </header>
      
      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="mobile-nav-grid md:hidden" style={{ marginTop: '4.5rem' }} data-testid="mobile-nav">
          {navItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path} 
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon />
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </Page>
  )
}
