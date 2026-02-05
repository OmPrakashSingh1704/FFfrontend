import { Link, Outlet } from 'react-router-dom'
import logoMark from '../assets/logo-mark.svg'
import { Page } from '../components/Page'
import { ThemeToggle } from '../components/ThemeToggle'

export function AuthLayout() {
  return (
    <Page>
      <header className="nav" data-testid="auth-nav">
        <Link to="/" className="logo">
          <span className="logo-mark">
            <img src={logoMark} alt="FoundersLib logo" />
          </span>
          <span className="logo-name">FoundersLib</span>
        </Link>
        <div className="nav-actions">
          <ThemeToggle className="theme-toggle" />
          <Link className="btn ghost" to="/">
            Back to home
          </Link>
        </div>
      </header>
      <main className="auth-main" id="main-content">
        <Outlet />
      </main>
    </Page>
  )
}
