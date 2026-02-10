import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp, Users, MessageSquare, Zap, BarChart3, Lock } from 'lucide-react'
import logoMark from '../assets/logo-mark.svg'
import { Page } from '../components/Page'
import { ThemeToggle } from '../components/ThemeToggle'

function HeroAnimation() {
  return (
    <div className="hero-animation" data-testid="hero-animation">
      <div className="vision-container">
        <div className="vision-core">
          <div className="vision-pulse" />
          <div className="vision-pulse delay-1" />
          <div className="vision-pulse delay-2" />
          <span className="vision-label">Your Round</span>
        </div>

        <div className="orbit orbit-1">
          <div className="investor-card card-1">
            <div className="investor-status active" />
            <span>Sequoia</span>
            <small>Reviewing</small>
          </div>
        </div>

        <div className="orbit orbit-2">
          <div className="investor-card card-2">
            <div className="investor-status pending" />
            <span>A16Z</span>
            <small>Interested</small>
          </div>
        </div>

        <div className="orbit orbit-3">
          <div className="investor-card card-3">
            <div className="investor-status hot" />
            <span>Accel</span>
            <small>Term Sheet</small>
          </div>
        </div>

        <svg className="signal-lines" viewBox="0 0 400 400">
          <path className="signal-path path-1" d="M200,200 Q250,150 300,180" />
          <path className="signal-path path-2" d="M200,200 Q150,250 120,200" />
          <path className="signal-path path-3" d="M200,200 Q220,280 280,300" />
        </svg>

        <div className="floating-metric metric-1">
          <span className="metric-num">94%</span>
          <span className="metric-text">Open Rate</span>
        </div>

        <div className="floating-metric metric-2">
          <span className="metric-num">12</span>
          <span className="metric-text">Active Intros</span>
        </div>

        <div className="floating-metric metric-3">
          <span className="metric-num">3</span>
          <span className="metric-text">Decisions</span>
        </div>
      </div>
    </div>
  )
}

function DashboardPreview() {
  return (
    <div className="features-visual" data-testid="dashboard-preview">
      <div className="dashboard-preview">
        <div className="dashboard-header">
          <div className="dashboard-dots">
            <span /><span /><span />
          </div>
          <span className="dashboard-title">Pipeline Overview</span>
          <div style={{ width: 60 }} />
        </div>
        <div className="dashboard-body">
          <div className="dashboard-row bar-80">
            <div className="row-avatar">SW</div>
            <div className="row-info">
              <strong>Sequoia Capital</strong>
              <span>Series A &middot; $8M</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status hot">Hot Lead</span>
          </div>

          <div className="dashboard-row bar-60">
            <div className="row-avatar">A1</div>
            <div className="row-info">
              <strong>Andreessen Horowitz</strong>
              <span>Series A &middot; $10M</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status">In Review</span>
          </div>

          <div className="dashboard-row bar-90">
            <div className="row-avatar">AC</div>
            <div className="row-info">
              <strong>Accel Partners</strong>
              <span>Series A &middot; $7M</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status hot">Term Sheet</span>
          </div>

          <div className="dashboard-row bar-45">
            <div className="row-avatar">GV</div>
            <div className="row-info">
              <strong>GV (Google Ventures)</strong>
              <span>Series A &middot; $6M</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status new">New</span>
          </div>

          <div className="dashboard-stats">
            <div className="dash-stat">
              <strong>$31M</strong>
              <span>Pipeline Value</span>
            </div>
            <div className="dash-stat">
              <strong>89%</strong>
              <span>Response Rate</span>
            </div>
            <div className="dash-stat">
              <strong>14</strong>
              <span>Days Avg Close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <Page>
      {/* Announcement Banner */}
      <div className="announcement-banner" data-testid="announcement-banner">
        <div className="announcement-content">
          <Link to="/signup" className="announcement-badge" data-testid="announcement-link">
            AI-powered investor matching is here
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <header className="nav" data-testid="landing-nav">
        <div className="logo">
          <span className="logo-mark">
            <img src={logoMark} alt="" />
          </span>
          FoundersLib
        </div>
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
        {/* Hero */}
        <section className="hero" data-testid="hero-section">
          <div className="hero-content">
            <h1 className="hero-title animate-fade-in animate-delay-1">
              Connect with <span className="text-gradient">investors</span><br />who matter.
            </h1>
            <p className="hero-lead animate-fade-in animate-delay-2">
              The modern platform for founders to discover, connect with, and close
              the right investors. Track your pipeline, manage intros, and raise faster.
            </p>
            <div className="hero-actions animate-fade-in animate-delay-3">
              <Link className="btn primary" to="/signup" data-testid="hero-cta-btn">
                Start for Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link className="btn ghost" to="/login">
                Sign in
              </Link>
            </div>
            {/* Mobile stats - shown only on mobile */}
            <div className="hero-stats-mobile animate-fade-in animate-delay-4">
              <div className="hero-stat">
                <strong>94%</strong>
                <span>Open Rate</span>
              </div>
              <div className="hero-stat">
                <strong>12</strong>
                <span>Active Intros</span>
              </div>
              <div className="hero-stat">
                <strong>3</strong>
                <span>Decisions</span>
              </div>
            </div>
          </div>
          <HeroAnimation />
        </section>

        {/* Trusted By */}
        <section className="trusted-by animate-fade-in-slow" data-testid="trusted-by-section">
          <p>Trusted by founders at</p>
          <div className="trusted-by-logos">
            <span className="trusted-logo">Y Combinator</span>
            <span className="trusted-logo">500 Startups</span>
            <span className="trusted-logo">Techstars</span>
            <span className="trusted-logo">AngelList</span>
            <span className="trusted-logo">Product Hunt</span>
          </div>
        </section>

        {/* Stats */}
        <section style={{ maxWidth: 960, margin: '0 auto 4rem', padding: '0 1.5rem' }} data-testid="stats-section">
          <div className="grid-4">
            <div className="stat-card animate-fade-in animate-delay-1">
              <div className="stat-header">
                <span className="stat-label">Founders</span>
                <div className="stat-icon">
                  <Users size={16} strokeWidth={1.5} />
                </div>
              </div>
              <span className="stat-value">2,400+</span>
            </div>
            <div className="stat-card animate-fade-in animate-delay-2">
              <div className="stat-header">
                <span className="stat-label">Investors</span>
                <div className="stat-icon">
                  <TrendingUp size={16} strokeWidth={1.5} />
                </div>
              </div>
              <span className="stat-value">850+</span>
            </div>
            <div className="stat-card animate-fade-in animate-delay-3">
              <div className="stat-header">
                <span className="stat-label">Intros Made</span>
                <div className="stat-icon">
                  <Zap size={16} strokeWidth={1.5} />
                </div>
              </div>
              <span className="stat-value">14K+</span>
            </div>
            <div className="stat-card animate-fade-in animate-delay-4">
              <div className="stat-header">
                <span className="stat-label">Capital Raised</span>
                <div className="stat-icon">
                  <BarChart3 size={16} strokeWidth={1.5} />
                </div>
              </div>
              <span className="stat-value">$220M</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="features" data-testid="features-section">
          <div className="features-layout">
            <div className="features-content">
              <div className="section-header">
                <p className="section-eyebrow">Platform</p>
                <h2 className="section-title">Everything you need to <span className="text-gradient">raise capital</span></h2>
                <p className="section-lead">
                  Purpose-built tools that help founders move faster and close deals with confidence.
                </p>
              </div>
              <div className="grid-2" style={{ gap: 16 }}>
                <div className="card animate-slide-up animate-delay-1">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <TrendingUp size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Pipeline Tracking</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                        Real-time visibility into your fundraising pipeline and investor engagement signals.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card animate-slide-up animate-delay-2">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Warm Introductions</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                        Get introduced to investors through trusted mutual connections in one click.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card animate-slide-up animate-delay-3">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Lock size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Secure Data Room</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                        Share pitch decks and financials with granular access controls and analytics.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card animate-slide-up animate-delay-4">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MessageSquare size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Real-time Messaging</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                        Built-in chat with video calls, reactions, and encrypted conversations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        {/* Testimonials */}
        <section className="testimonials" data-testid="testimonials-section">
          <div className="section-header" style={{ textAlign: 'center', maxWidth: '32rem', margin: '0 auto 3rem' }}>
            <p className="section-eyebrow">Testimonials</p>
            <h2 className="section-title">Loved by <span className="text-gradient">founders</span></h2>
          </div>
          <div className="grid-3" style={{ maxWidth: 960, margin: '0 auto', padding: '0 1.5rem' }}>
            <div className="card animate-fade-in animate-delay-1">
              <blockquote style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'hsl(var(--foreground))', margin: '0 0 16px', fontStyle: 'italic' }}>
                "We closed our Series A in 3 weeks. The pipeline tracking and intro system
                made the entire process feel effortless."
              </blockquote>
              <hr className="divider" style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar">SC</div>
                <div>
                  <strong style={{ fontSize: '0.8125rem', display: 'block' }}>Sarah Chen</strong>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>CEO, DataFlow (YC W24)</span>
                </div>
              </div>
            </div>
            <div className="card animate-fade-in animate-delay-2">
              <blockquote style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'hsl(var(--foreground))', margin: '0 0 16px', fontStyle: 'italic' }}>
                "The signal intelligence saved us from wasting time on cold outreach.
                Every intro was warm and relevant."
              </blockquote>
              <hr className="divider" style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar">MR</div>
                <div>
                  <strong style={{ fontSize: '0.8125rem', display: 'block' }}>Marcus Rivera</strong>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Founder, BuildStack</span>
                </div>
              </div>
            </div>
            <div className="card animate-fade-in animate-delay-3">
              <blockquote style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'hsl(var(--foreground))', margin: '0 0 16px', fontStyle: 'italic' }}>
                "Finally a platform that treats fundraising like a proper pipeline.
                The analytics alone are worth it."
              </blockquote>
              <hr className="divider" style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar">PS</div>
                <div>
                  <strong style={{ fontSize: '0.8125rem', display: 'block' }}>Priya Sharma</strong>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>CTO, NeuralOps</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta" data-testid="cta-section">
          <div className="cta-card animate-fade-in">
            <h2>Ready to <span className="text-gradient">raise capital</span>?</h2>
            <p>Join thousands of founders who use FoundersLib to connect with the right investors.</p>
            <Link className="btn primary" to="/signup" data-testid="cta-btn">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer" data-testid="footer">
        <span className="footer-logo">FoundersLib</span>
        <div className="footer-links">
          <Link to="/login">Sign in</Link>
          <Link to="/signup">Get started</Link>
        </div>
        <span className="footer-copyright">&copy; {new Date().getFullYear()} FoundersLib</span>
      </footer>
    </Page>
  )
}
