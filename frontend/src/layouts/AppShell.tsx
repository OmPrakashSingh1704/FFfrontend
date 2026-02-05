import { Link, Outlet } from 'react-router-dom'
import { 
  Home, Users, Briefcase, TrendingUp, MessageSquare, Bell, 
  BarChart3, Settings, Search, FileText, Upload,
  Phone, Activity, Wallet, Menu, X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import logoMark from '../assets/logo-mark.svg'
import { ThemeToggle } from '../components/ThemeToggle'
import { NotificationDropdown } from '../components/NotificationDropdown'
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

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
          {/* More menu toggle - works on all screen sizes */}
          <button 
            className="btn ghost"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-toggle"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          {/* Notification Dropdown */}
          <NotificationDropdown />
          
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
      
      {/* Navigation Menu Overlay */}
      {mobileMenuOpen && (
        <>
          <div 
            className="mobile-nav-overlay" 
            onClick={() => setMobileMenuOpen(false)}
            data-testid="mobile-nav-overlay"
          />
          <nav className="mobile-nav-panel" data-testid="mobile-nav">
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
        </>
      )}
      
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </Page>
  )
}
