import { Link, Outlet } from 'react-router-dom'
import logoMark from '../assets/logo-mark.svg'
import { ThemeToggle } from '../components/ThemeToggle'
import { Page } from '../components/Page'

export function AuthLayout() {
  return (
    <Page>
      <a className="skip-link" href="#auth-main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="logo">
          <span className="logo-mark">
            <img src={logoMark} alt="FoundersLib logo" />
          </span>
          <span className="logo-name">FoundersLib</span>
        </div>
        <div className="app-actions">
          <ThemeToggle />
          <Link className="btn ghost" to="/">
            Back to landing
          </Link>
        </div>
      </header>
      <main className="auth-main" id="auth-main">
        <Outlet />
      </main>
    </Page>
  )
}
