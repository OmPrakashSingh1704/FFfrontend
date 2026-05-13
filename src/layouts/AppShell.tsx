import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Home, Users, Briefcase, TrendingUp, MessageSquare, Bell,
  BarChart3, Settings, Search, FileText,
  Activity, Wallet, Menu, X, Zap, Handshake, ClipboardList, UserCheck, Send
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import logo from '../assets/logo.svg'
import { ThemeToggle } from '../components/ThemeToggle'
import { NotificationDropdown } from '../components/NotificationDropdown'
import { ProfileDropdown } from '../components/ProfileDropdown'
import { StatusLink } from '../components/StatusLink'
import { useAuth } from '../context/AuthContext'
import { useChatUnread } from '../context/ChatUnreadContext'
import { Page } from '../components/Page'
import { RealtimeBridge } from '../components/RealtimeBridge'
import { IncomingCallBridge } from '../components/IncomingCallBridge'
import { FloatingCallWidget } from '../components/FloatingCallWidget'
import { FeedbackWidget } from '../components/FeedbackWidget'
import { CallProvider } from '../context/CallContext'
import Preloader from '../components/ui/preloader'

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
      { path: '/app/investors', label: 'Investors', icon: TrendingUp },
      { path: '/app/startups', label: 'Startups', icon: Briefcase },
      { path: '/app/funds', label: 'Funds', icon: Wallet },
      { path: '/app/connections', label: 'Connections', icon: UserCheck },
    ],
  },
  {
    label: 'Manage',
    items: [
      { path: '/app/matching', label: 'Matching', icon: Zap },
      { path: '/app/deals', label: 'Deals', icon: Handshake },
      { path: '/app/applications', label: 'Applications', icon: FileText },
      { path: '/app/intros', label: 'Intros', icon: Send },
      { path: '/app/chat', label: 'Chat', icon: MessageSquare },
      { path: '/app/notifications', label: 'Alerts', icon: Bell },
    ],
  },
  {
    label: 'Tools',
    items: [
      { path: '/app/analytics', label: 'Analytics', icon: BarChart3, adminOnly: true as const },
      { path: '/app/admin', label: 'Admin', icon: Settings, adminOnly: true as const },
    ],
  },
]

export function AppShell() {
  const { status, user } = useAuth()
  const location = useLocation()
  const { count: chatUnreadCount } = useChatUnread()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showPreloader, setShowPreloader] = useState(() => !localStorage.getItem('ff_preloader_seen'))

  const handlePreloaderComplete = useCallback(() => {
    localStorage.setItem('ff_preloader_seen', '1')
    setShowPreloader(false)
  }, [])

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
    <CallProvider>
    <Page>
      {/* Everything under /app/* is auth-walled and has zero SEO value.
          Emit a robots noindex at the shell so Google stops burning crawl
          budget hitting these routes (it can't see them anyway without
          login). `follow` is kept on so internal links from the app
          surface still pass PageRank if any external page links here. */}
      <Helmet>
        <meta name="robots" content="noindex,follow" />
      </Helmet>
      {showPreloader && <Preloader onComplete={handlePreloaderComplete} />}
      <RealtimeBridge />
      <IncomingCallBridge />
      <FloatingCallWidget />
      <FeedbackWidget />

      {/* Sidebar */}
      <aside
        className={`app-sidebar${mobileMenuOpen ? ' open' : ''}`}
        data-testid="app-sidebar"
      >
        <div className="sidebar-header">
          <Link to={homePath} className="sidebar-logo">
            <span className="logo-mark">
              <img src={logo} alt="FoundersLib logo" decoding="async" />
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
                {items.map((item) => {
                  // Surface an unread badge on the Chat tab so users see
                  // new messages without opening it. Other items don't have
                  // unread state (yet), so the badge only renders here.
                  const showChatBadge = item.path === '/app/chat' && chatUnreadCount > 0
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`sidebar-link${isActive(item.path) ? ' active' : ''}`}
                      data-testid={`nav-${item.label.toLowerCase()}`}
                    >
                      <item.icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                      <span>{item.label}</span>
                      {showChatBadge ? (
                        <span
                          className="sidebar-badge"
                          data-testid="nav-chat-unread"
                          aria-label={`${chatUnreadCount} unread chat${chatUnreadCount === 1 ? '' : 's'}`}
                        >
                          {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <div style={{ padding: '0.75rem 1rem', marginTop: 'auto', borderTop: '1px solid hsl(var(--border))' }}>
          <StatusLink variant="badge" />
        </div>
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

      {user && !user.onboarding_completed && (
        <div style={{
          background: 'linear-gradient(90deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))',
          borderBottom: '1px solid hsl(var(--primary) / 0.2)',
          padding: '0.625rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <ClipboardList size={16} strokeWidth={1.5} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
            <span>Complete your profile to unlock all features and get discovered.</span>
          </div>
          <Link to="/onboarding" className="btn-sm primary" style={{ flexShrink: 0 }} data-testid="finish-onboarding-btn">
            Finish onboarding
          </Link>
        </div>
      )}

      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </Page>
    </CallProvider>
  )
}
