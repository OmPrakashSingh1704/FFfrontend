import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  Globe,
  Handshake,
  Instagram,
  Linkedin,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import logo from '../assets/logo.svg'
import { Page } from '../components/Page'
import { PageHead } from '../components/PageHead'
import { StatusLink } from '../components/StatusLink'
import { ThemeToggle } from '../components/ThemeToggle'
import { Waves } from '../components/ui/wave-background'
import { useAuth } from '../context/AuthContext'

const NAV_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#verify', label: 'Verification' },
  { href: '#founders', label: 'For Founders' },
  { href: '#investors', label: 'For Investors' },
  { href: '#faq', label: 'FAQ' },
]

const FAQS = [
  {
    question: 'How do you verify founders?',
    answer:
      'Profile review, team check, traction signals, and a short call when needed. We turn away re-pitches of the same idea and pitch-and-pray spammers.',
  },
  {
    question: 'How do you verify investors?',
    answer:
      'Cheque size, recent deal activity, and sector fit. Inactive funds and dormant angels do not get listed. We do not list anyone who has not written a cheque in the last 18 months.',
  },
  {
    question: 'Is it free?',
    answer:
      'Free for founders today. Investors get a free tier with limits; paid plans unlock higher-volume use. No surprise pricing.',
  },
  {
    question: 'What if I get spam intros anyway?',
    answer:
      'Report it. The sender loses trust credits and can be removed from the network. The system has teeth — that is the point.',
  },
  {
    question: 'Why India-first?',
    answer:
      'India fundraising mechanics (SAFE / CCD / iSAFE), Tier-2 ecosystem signals, and INR cheque sizes need a network built for them — not a global tool retrofitted to local context.',
  },
]


// Illustrative pipeline view. Investor names are intentionally anonymized —
// this is a product mock, not a claim about real activity.
function DashboardPreview() {
  return (
    <div className="features-visual" data-testid="dashboard-preview">
      <div className="dashboard-preview">
        <div className="dashboard-header">
          <div className="dashboard-dots">
            <span /><span /><span />
          </div>
          <span className="dashboard-title">Pipeline · Illustrative</span>
          <div style={{ width: 60 }} />
        </div>
        <div className="dashboard-body">
          <div className="dashboard-row bar-80">
            <div className="row-avatar">A</div>
            <div className="row-info">
              <strong>Investor A</strong>
              <span>Seed &middot; ₹2Cr cheque</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status hot">Warm intro</span>
          </div>

          <div className="dashboard-row bar-60">
            <div className="row-avatar">B</div>
            <div className="row-info">
              <strong>Investor B</strong>
              <span>Pre-Seed &middot; ₹50L cheque</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status">In review</span>
          </div>

          <div className="dashboard-row bar-90">
            <div className="row-avatar">C</div>
            <div className="row-info">
              <strong>Investor C</strong>
              <span>Seed &middot; ₹1Cr cheque</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status hot">Term sheet</span>
          </div>

          <div className="dashboard-row bar-45">
            <div className="row-avatar">D</div>
            <div className="row-info">
              <strong>Investor D</strong>
              <span>Pre-Seed &middot; ₹25L cheque</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status new">New</span>
          </div>

          <div className="dashboard-stats">
            <div className="dash-stat">
              <strong>Pipeline</strong>
              <span>Live view</span>
            </div>
            <div className="dash-stat">
              <strong>Warm intros</strong>
              <span>Earned, not bought</span>
            </div>
            <div className="dash-stat">
              <strong>Status</strong>
              <span>In-thread updates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const { status } = useAuth()

  // Authenticated users typing the bare base URL ("/") shouldn't see the
  // marketing page — bounce them to the app dashboard. While auth status
  // is still resolving ('idle' / 'loading'), render the landing page so
  // anon visitors don't get a blank/loader flash; authed users will
  // briefly see it but get redirected once the context settles.
  if (status === 'authenticated') {
    return <Navigate to="/app" replace />
  }

  return (
    <Page className="page-home">
      <PageHead
        title="FoundersLib — verified founders and investors, India-first"
        description="A vetted network for India's founders and investors. Every profile is reviewed before it goes live. Skip the cold DMs and tire-kickers."
        path="/"
      />
      <Waves className="fixed inset-0 z-0" />
      {/* Navigation */}
      <header className="nav" data-testid="landing-nav">
        <div className="logo">
          <span className="logo-mark">
            <img src={logo} alt="FoundersLib logo" decoding="async" />
          </span>
          FoundersLib
        </div>
        <nav className="nav-links" aria-label="Primary">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={label} href={href} data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <Link className="btn ghost" to="/login" data-testid="nav-signin-btn">
            Sign in
          </Link>
          <Link className="btn primary" to="/signup" data-testid="nav-getstarted-btn">
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </header>

      <main id="main-content">
        {/* Hero — split CTA, honest positioning */}
        <section
          id="home"
          data-testid="hero-section"
          className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
        >
          <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="max-w-4xl mx-auto"
            >
              <p
                style={{
                  fontSize: '0.8125rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'hsl(var(--muted-foreground))',
                  marginBottom: '1.25rem',
                }}
              >
                India-first · Verified on both sides
              </p>
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold mb-6 tracking-tighter">
                Where India&apos;s next
                <br />
                <span className="text-gradient">1,000 startups get funded.</span>
              </h1>
              <p
                style={{
                  fontSize: '1.125rem',
                  lineHeight: 1.6,
                  color: 'hsl(var(--muted-foreground))',
                  maxWidth: '38rem',
                  margin: '0 auto 2.5rem',
                }}
              >
                A verified network of founders and investors.
                Quality of relationships, not size of database.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                }}
              >
                <Link
                  className="btn primary"
                  to="/signup?role=founder"
                  data-testid="hero-founder-cta"
                  style={{ padding: '0.875rem 1.5rem', fontSize: '0.9375rem' }}
                >
                  I&apos;m a founder
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
                <Link
                  className="btn ghost"
                  to="/signup?role=investor"
                  data-testid="hero-investor-cta"
                  style={{ padding: '0.875rem 1.5rem', fontSize: '0.9375rem' }}
                >
                  I&apos;m an investor
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'hsl(var(--muted-foreground))',
                  margin: 0,
                }}
              >
                Onboarding by review — usually within 48 hours.
              </p>
            </motion.div>
          </div>
        </section>

        {/* How we vet — replaces fake "trusted by" logos */}
        <section
          id="verify"
          className="features"
          style={{ paddingTop: '4rem', paddingBottom: '4rem' }}
          data-testid="verify-section"
        >
          <div className="section-header" style={{ textAlign: 'center', maxWidth: '36rem', margin: '0 auto 3rem' }}>
            <p className="section-eyebrow">Why this works</p>
            <h2 className="section-title">
              Both sides go through <span className="text-gradient">verification</span>.
            </h2>
            <p className="section-lead">
              The network is small on purpose. Every profile is reviewed before it goes live.
            </p>
          </div>
          <div className="grid-3" style={{ maxWidth: 960, margin: '0 auto', padding: '0 1.5rem' }}>
            <div className="card animate-fade-in animate-delay-1">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div className="feature-icon-modern">
                  <BadgeCheck size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 6 }}>
                    Founders are reviewed
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.55, margin: 0 }}>
                    Profile, team, traction signals. We turn away pitch-and-pray spammers and
                    re-pitches of the same idea.
                  </p>
                </div>
              </div>
            </div>
            <div className="card animate-fade-in animate-delay-2">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div className="feature-icon-modern">
                  <ShieldCheck size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 6 }}>
                    Investors are checked
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.55, margin: 0 }}>
                    Cheque size, sector, recent activity. We do not list inactive funds or
                    angels who have not written a cheque in 18 months.
                  </p>
                </div>
              </div>
            </div>
            <div className="card animate-fade-in animate-delay-3">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div className="feature-icon-modern">
                  <Handshake size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 6 }}>
                    Intros are earned
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.55, margin: 0 }}>
                    A trust-and-credits system means warm intros are actually warm.
                    Cold-DMing is not a feature.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform / how it actually works.
            Headline spans MUST be short — `.section-title--spaced span` is
            `white-space: nowrap` at ~3.75rem, so anything over ~3 words
            overflows the column on desktop and crashes into the dashboard
            preview on the right. */}
        <section id="platform" className="features" data-testid="features-section">
          <div className="features-layout">
            <div className="features-content">
              <div className="section-header">
                <p className="section-eyebrow">Platform</p>
                <h2 className="section-title section-title--spaced">
                  <span>Built for</span>
                  <span className="text-gradient">Indian fundraising.</span>
                </h2>
                <p className="section-lead">
                  Verification on both sides. Warm intros earned through participation.
                  Deal mechanics built for the Indian ecosystem.
                </p>
              </div>
              <div className="grid-2" style={{ gap: 16 }}>
                <div className="card feature-card-new animate-slide-up animate-delay-1">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div className="feature-icon-modern">
                      <BadgeCheck size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Verified profiles</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                        Manual review, not signup-form trust. You see who someone actually is
                        before you spend time on the conversation.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card feature-card-new animate-slide-up animate-delay-2">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div className="feature-icon-modern">
                      <Handshake size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Warm intros, not cold DMs</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                        Earn trust credits through real participation; spend them on intros.
                        Spammers run out of credits fast.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card feature-card-new animate-slide-up animate-delay-3">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div className="feature-icon-modern">
                      <Lock size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Deal rooms in-thread</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                        NDAs, document sharing, term-sheet status. The conversation and the
                        paperwork live in the same place.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card feature-card-new animate-slide-up animate-delay-4">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div className="feature-icon-modern">
                      <Globe size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>India-native</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                        SAFE / CCD / iSAFE, INR and USD cheques, Tier-1 and Tier-2 city coverage.
                        Not a global tool retrofitted.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        {/* For founders */}
        <section
          id="founders"
          className="features"
          style={{ paddingTop: '4rem', paddingBottom: '4rem' }}
          data-testid="founders-section"
        >
          <div className="grid-2" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', gap: '2.5rem', alignItems: 'center' }}>
            <div>
              <p className="section-eyebrow">For Founders</p>
              <h2 className="section-title" style={{ marginBottom: '1rem' }}>
                Find investors who actually <span className="text-gradient">invest at your stage</span>.
              </h2>
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.65, color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
                Search by cheque size, sector, stage, and recent deals — not by who has the
                loudest Twitter. Track every conversation in one workspace: pipeline, chat,
                deal room, NDA, documents. No spreadsheets, no lost threads.
              </p>
              <Link
                className="btn primary"
                to="/signup?role=founder"
                data-testid="founders-cta"
                style={{ padding: '0.75rem 1.25rem', fontSize: '0.9375rem' }}
              >
                Apply as a founder
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="feature-icon-modern"><Users size={16} strokeWidth={1.5} /></div>
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 2 }}>Targeted, not sprayed</strong>
                  <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    Filter investors by what they actually fund.
                  </span>
                </div>
              </div>
              <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="feature-icon-modern"><FileText size={16} strokeWidth={1.5} /></div>
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 2 }}>One workspace</strong>
                  <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    Pipeline, chat, deal room, documents — in-thread.
                  </span>
                </div>
              </div>
              <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="feature-icon-modern"><MessageSquare size={16} strokeWidth={1.5} /></div>
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 2 }}>Real answers</strong>
                  <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    Pass / interested / in review — never silence.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* For investors */}
        <section
          id="investors"
          className="features"
          style={{ paddingTop: '4rem', paddingBottom: '4rem' }}
          data-testid="investors-section"
        >
          <div className="grid-2" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', gap: '2.5rem', alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: '0.75rem', order: 1 }}>
              <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="feature-icon-modern"><BadgeCheck size={16} strokeWidth={1.5} /></div>
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 2 }}>Vetted deal flow</strong>
                  <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    Sorted by your thesis — stage, sector, geography.
                  </span>
                </div>
              </div>
              <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="feature-icon-modern"><Lock size={16} strokeWidth={1.5} /></div>
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 2 }}>Diligence in-platform</strong>
                  <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    NDA, documents, term-sheet status, all in one thread.
                  </span>
                </div>
              </div>
              <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="feature-icon-modern"><Sparkles size={16} strokeWidth={1.5} /></div>
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 2 }}>Never recycled</strong>
                  <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    Founders disclose where they have already pitched.
                  </span>
                </div>
              </div>
            </div>
            <div style={{ order: 2 }}>
              <p className="section-eyebrow">For Investors</p>
              <h2 className="section-title" style={{ marginBottom: '1rem' }}>
                India deal flow <span className="text-gradient">without the inbox flood</span>.
              </h2>
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.65, color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
                See vetted founders sorted by your thesis. Pass quickly, save what is
                interesting, run the diligence inside the platform. Your deal flow stays
                organized; founders get a real answer instead of silence.
              </p>
              <Link
                className="btn primary"
                to="/signup?role=investor"
                data-testid="investors-cta"
                style={{ padding: '0.75rem 1.25rem', fontSize: '0.9375rem' }}
              >
                Apply as an investor
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        </section>

        {/* Honest about stage */}
        <section
          className="features"
          style={{ paddingTop: '2rem', paddingBottom: '4rem' }}
          data-testid="cohort-section"
        >
          <div
            className="card animate-fade-in"
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: '2rem',
              textAlign: 'center',
              borderColor: 'hsl(var(--border))',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.75rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'hsl(var(--muted-foreground))',
                marginBottom: '1rem',
              }}
            >
              <Sparkles size={14} strokeWidth={1.5} />
              Stage
            </div>
            <h2 className="section-title" style={{ marginBottom: '0.75rem' }}>
              Currently onboarding the founding cohort.
            </h2>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.65, color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
              FoundersLib is early on purpose. We would rather have 200 verified founders and
              100 active investors than 20,000 unverified profiles. If you are serious about
              raising or deploying capital in India, we want to talk.
            </p>
            <Link
              className="btn primary"
              to="/signup"
              data-testid="cohort-cta"
              style={{ padding: '0.75rem 1.25rem', fontSize: '0.9375rem' }}
            >
              Request access
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </section>

        {/* Contact + FAQ */}
        <section id="faq" className="cta contact-section" data-testid="cta-section">
          <div className="contact-grid">
            <div className="cta-card contact-card animate-fade-in">
              <p className="contact-eyebrow">Talk to us</p>
              <h2>Get in touch</h2>
              <p>
                Questions about access, verification, or partnerships? Reach the team directly.
                We read every note.
              </p>
              <div className="contact-email-block">
                <span>Email</span>
                <a href="mailto:info@founderslib.in">info@founderslib.in</a>
              </div>
              <p className="contact-note">
                Onboarding is by review. Most applications get a response within 48 hours.
              </p>
            </div>

            <div className="cta-card contact-card faq-card animate-fade-in">
              <p className="contact-eyebrow">FAQ</p>
              <h3>Common questions</h3>
              <div className="faq-list">
                {FAQS.map(({ question, answer }) => {
                  const isOpen = openFaq === question
                  return (
                    <article key={question} className={`faq-item ${isOpen ? 'faq-open' : ''}`}>
                      <div className="faq-item-header">
                        <h4>{question}</h4>
                        <button
                          type="button"
                          className={`faq-toggle ${isOpen ? 'faq-toggle-open' : ''}`}
                          aria-expanded={isOpen}
                          onClick={() => setOpenFaq(isOpen ? null : question)}
                        >
                          <span>+</span>
                        </button>
                      </div>
                      {isOpen && <p className="faq-answer">{answer}</p>}
                    </article>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <div
          className="footer-note"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '1.25rem 1.5rem',
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
              data-testid="footer-linkedin"
              style={{
                color: 'hsl(var(--muted-foreground))',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <Linkedin size={16} strokeWidth={1.5} />
            </a>
            <a
              href="https://www.instagram.com/founderslib/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="FoundersLib on Instagram"
              data-testid="footer-instagram"
              style={{
                color: 'hsl(var(--muted-foreground))',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <Instagram size={16} strokeWidth={1.5} />
            </a>
            <Link
              to="/terms"
              style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}
              data-testid="footer-terms"
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}
              data-testid="footer-privacy"
            >
              Privacy
            </Link>
            <a
              href="mailto:info@founderslib.in"
              style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}
            >
              Contact
            </a>
            <a
              href="#faq"
              style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}
            >
              FAQ
            </a>
            <StatusLink variant="badge" />
          </div>
        </div>
      </main>

    </Page>
  )
}
