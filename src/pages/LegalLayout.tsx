import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Instagram, Linkedin } from 'lucide-react'
import logo from '../assets/logo.svg'
import { Page } from '../components/Page'
import { PageHead } from '../components/PageHead'
import { StatusLink } from '../components/StatusLink'
import { ThemeToggle } from '../components/ThemeToggle'

/**
 * Shared shell for static legal pages (Terms, Privacy).
 *
 * Same nav + footer skeleton as LandingPage so the layout doesn't jolt
 * when visitors click footer links from `/`. Content area is a single
 * narrow column with strong typography so the dense legal copy stays
 * scannable.
 *
 * NOTE on legal-entity placeholders: "FoundersLib" is used as both the
 * platform name and the operating entity. When the registered legal
 * entity is established (e.g., "FoundersLib Technologies Private
 * Limited"), update this and the body copy in TermsPage / PrivacyPage.
 * Same for jurisdiction (currently Bengaluru, India).
 */
type Props = {
  title: string
  description: string
  path: string
  lastUpdated: string
  children: ReactNode
}

export function LegalLayout({ title, description, path, lastUpdated, children }: Props) {
  return (
    <Page className="page-home">
      <PageHead title={title} description={description} path={path} />

      <header className="nav" data-testid="legal-nav">
        <div className="logo">
          <span className="logo-mark">
            <img src={logo} alt="FoundersLib logo" decoding="async" />
          </span>
          FoundersLib
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <Link className="btn ghost" to="/login" data-testid="legal-signin">
            Sign in
          </Link>
          <Link className="btn primary" to="/signup" data-testid="legal-getstarted">
            Get Started
          </Link>
        </div>
      </header>

      <main id="main-content" style={{ paddingTop: '6rem' }}>
        <div
          style={{
            maxWidth: '780px',
            margin: '0 auto',
            padding: '2rem 1.5rem 4rem',
          }}
        >
          <Link
            to="/"
            data-testid="legal-back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.8125rem',
              color: 'hsl(var(--muted-foreground))',
              textDecoration: 'none',
              marginBottom: '1.5rem',
            }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back to home
          </Link>

          <h1
            style={{
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              fontWeight: 700,
              letterSpacing: '-0.015em',
              marginBottom: '0.75rem',
            }}
          >
            {title.split('—')[0].trim()}
          </h1>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.625rem',
              borderRadius: '999px',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--muted))',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'hsl(var(--muted-foreground))',
              letterSpacing: '0.02em',
              marginBottom: '2.5rem',
            }}
            data-testid="legal-last-updated"
          >
            <span style={{ fontWeight: 600 }}>Last updated</span>
            <span aria-hidden="true">·</span>
            <span>{lastUpdated}</span>
          </div>

          <div className="legal-body">
            {children}
            <hr
              style={{
                margin: '3rem 0 1.25rem',
                border: 'none',
                borderTop: '1px solid hsl(var(--border))',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              This page was last updated on <strong>{lastUpdated}</strong>. Continued use of
              the Platform after this date constitutes acceptance of the current version.
            </p>
          </div>
        </div>

        <div
          className="footer-note"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '1.25rem 1.5rem',
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            © 2026 FoundersLib · India-first fundraising network
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <a
              href="https://www.linkedin.com/company/founderslib"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="FoundersLib on LinkedIn"
              style={{ color: 'hsl(var(--muted-foreground))', display: 'inline-flex', alignItems: 'center' }}
            >
              <Linkedin size={16} strokeWidth={1.5} />
            </a>
            <a
              href="https://www.instagram.com/founderslib/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="FoundersLib on Instagram"
              style={{ color: 'hsl(var(--muted-foreground))', display: 'inline-flex', alignItems: 'center' }}
            >
              <Instagram size={16} strokeWidth={1.5} />
            </a>
            <Link
              to="/terms"
              style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}
            >
              Privacy
            </Link>
            <a
              href="mailto:support@founderslib.in"
              style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}
            >
              Contact
            </a>
            <StatusLink variant="badge" />
          </div>
        </div>
      </main>
    </Page>
  )
}
