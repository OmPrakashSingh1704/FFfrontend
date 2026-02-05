import { Link, Outlet } from 'react-router-dom'
import logoMark from '../assets/logo-mark.svg'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { Page } from '../components/Page'
import { RealtimeBridge } from '../components/RealtimeBridge'

export function AppShell() {
  const { status, user, logout } = useAuth()

  return (
    <Page>
      <RealtimeBridge />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <div className="logo">
          <span className="logo-mark">
            <img src={logoMark} alt="FoundersLib logo" />
          </span>
          <span className="logo-name">FoundersLib</span>
        </div>
        <nav className="app-nav" aria-label="Application">
          <Link to="/">Landing</Link>
          <Link to="/app">Dashboard</Link>
          <Link to="/onboarding">Onboarding</Link>
          <Link to="/app/feed">Feed</Link>
          <Link to="/app/intros">Intros</Link>
          <Link to="/app/trust">Trust</Link>
          <Link to="/app/respect">Respect</Link>
          <Link to="/app/notifications">Notifications</Link>
          <Link to="/app/analytics">Analytics</Link>
          <Link to="/app/audit">Audit</Link>
          <Link to="/app/admin">Admin</Link>
          <Link to="/app/admin/moderation">Moderation</Link>
          <Link to="/app/chat">Chat</Link>
          <Link to="/app/calls">Calls</Link>
          <Link to="/app/search">Search</Link>
          <Link to="/app/founders">Founders</Link>
          <Link to="/app/startups">Startups</Link>
          <Link to="/app/investors">Investors</Link>
          <Link to="/app/funds">Funds</Link>
          <Link to="/app/applications">Applications</Link>
          <Link to="/app/uploads">Uploads</Link>
        </nav>
        <div className="app-actions">
          <ThemeToggle />
          {status === 'authenticated' ? (
            <button type="button" className="btn ghost" onClick={() => void logout()}>
              Logout {user?.full_name ? `(${user.full_name})` : ''}
            </button>
          ) : (
            <Link className="btn ghost" to="/login">
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
