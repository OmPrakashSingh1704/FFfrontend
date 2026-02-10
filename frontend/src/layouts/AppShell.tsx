import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Home, Users, Briefcase, TrendingUp, MessageSquare, Bell,
  BarChart3, Settings, Search, FileText, Upload,
  Activity, Wallet, Menu, X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import logoMark from '../assets/logo-mark.svg'
import { ThemeToggle } from '../components/ThemeToggle'
import { NotificationDropdown } from '../components/NotificationDropdown'
import { ProfileDropdown } from '../components/ProfileDropdown'
import { useAuth } from '../context/AuthContext'
import { Page } from '../components/Page'
import { RealtimeBridge } from '../components/RealtimeBridge'
import { IncomingCallBridge } from '../components/IncomingCallBridge'

const navSections = [
  {
    label: 'Main',
    items: [
      { path: '/app', label: 'Home', icon: Home },
      { path: '/app/feed', label: 'Feed', icon: Activity },
      { path: '/app/search', label: 'Search', icon: Search },
    ],
  },
  {
    label: 'Network',
    items: [
      { path: '/app/founders', label: 'Founders', icon: Users },
      { path: '/app/startups', label: 'Startups', icon: Briefcase },
      { path: '/app/investors', label: 'Investors', icon: TrendingUp },
      { path: '/app/funds', label: 'Funds', icon: Wallet },
    ],
  },
  {
    label: 'Manage',
    items: [
      { path: '/app/applications', label: 'Applications', icon: FileText },
      { path: '/app/chat', label: 'Chat', icon: MessageSquare },
      { path: '/app/notifications', label: 'Alerts', icon: Bell },
    ],
  },
  {
    label: 'Tools',
    items: [
      { path: '/app/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/app/uploads', label: 'Files', icon: Upload },
      { path: '/app/admin', label: 'Admin', icon: Settings, adminOnly: true as const },
    ],
  },
]

export function AppShell() {
  const { status, user } = useAuth()
  const location = useLocation()
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const isAdmin = user?.role === 'admin'
  const homePath = status === 'authenticated' ? '/app' : '/'

  function isActive(path: string) {
    if (path === '/app') return location.pathname === '/app'
    return location.pathname.startsWith(path)
  }

  return (
    <Page>
      <RealtimeBridge />
      <IncomingCallBridge />

      {/* Sidebar */}
      <aside
        className={`app-sidebar${mobileMenuOpen ? ' open' : ''}`}
        data-testid="app-sidebar"
      >
        <div className="sidebar-header">
          <Link to={homePath} className="sidebar-logo">
            <span className="logo-mark">
              <img src={logoMark} alt="" />
            </span>
            <span className="logo-name">FoundersLib</span>
          </Link>
        </div>
        <nav className="sidebar-nav" aria-label="Application">
          {navSections.map((section) => {
            const items = section.items.filter(
              (item) => !('adminOnly' in item && item.adminOnly) || isAdmin
            )
            if (items.length === 0) return null
            return (
              <div className="sidebar-section" key={section.label}>
                <span className="sidebar-section-label">{section.label}</span>
                {items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-link${isActive(item.path) ? ' active' : ''}`}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    {item.label}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          data-testid="mobile-nav-overlay"
        />
      )}

      {/* Top header */}
      <header className="app-header" data-testid="app-header">
        <button
          className="sidebar-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="mobile-menu-toggle"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="app-header-spacer" />

        <div className="app-actions">
          <NotificationDropdown />
          <ThemeToggle />
          {status === 'authenticated' ? (
            <ProfileDropdown />
          ) : (
            <Link className="btn primary" to="/login" data-testid="signin-btn">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </Page>
  )
}
