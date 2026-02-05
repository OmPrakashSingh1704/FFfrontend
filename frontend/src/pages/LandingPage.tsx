import { Link } from 'react-router-dom'
import { ArrowRight, Zap, Shield, Users, TrendingUp, MessageSquare, BarChart3 } from 'lucide-react'
import heroIllustration from '../assets/hero-illustration.svg'
import logoMark from '../assets/logo-mark.svg'
import { Page } from '../components/Page'
import { ThemeToggle } from '../components/ThemeToggle'

export function LandingPage() {
  return (
    <Page>
      {/* Navigation */}
      <header className="nav" data-testid="landing-nav">
        <div className="logo">
          <span className="logo-mark">
            <img src={logoMark} alt="FoundersLib logo" />
          </span>
          <span className="logo-name">FoundersLib</span>
        </div>
        <div className="nav-actions">
          <ThemeToggle className="theme-toggle" />
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
        {/* Hero Section */}
        <section className="hero" id="top" data-testid="hero-section">
          <div className="hero-left">
            <span className="eyebrow">
              <Zap className="w-4 h-4" />
              Built for modern founders
            </span>
            <h1 className="hero-title">
              Raise with <span>signal</span>,<br />not noise.
            </h1>
            <p className="hero-lead">
              FoundersLib compresses your fundraising workflow into one system that keeps
              investors aligned, introductions warm, and decisions moving.
            </p>
            <div className="hero-actions">
              <Link className="btn primary" to="/signup" data-testid="hero-cta-btn">
                Get early access
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link className="btn ghost" to="/login" data-testid="hero-signin-btn">
                Sign in
              </Link>
            </div>
            <div className="hero-metrics">
              <div>
                <span className="metric-value">3.1x</span>
                <span className="metric-label">intro velocity</span>
              </div>
              <div>
                <span className="metric-value">42%</span>
                <span className="metric-label">higher replies</span>
              </div>
              <div>
                <span className="metric-value">24</span>
                <span className="metric-label">signals tracked</span>
              </div>
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-title">FoundersLib Console</span>
                  <span className="panel-subtitle">Seed round · Week 3</span>
                </div>
                <span className="panel-chip">Live</span>
              </div>
              <div className="signal-grid">
                <div className="signal-card">
                  <span className="signal-label">Intros</span>
                  <span className="signal-value">18</span>
                </div>
                <div className="signal-card">
                  <span className="signal-label">Meetings</span>
                  <span className="signal-value">9</span>
                </div>
                <div className="signal-card">
                  <span className="signal-label">Decision</span>
                  <span className="signal-value">3</span>
                </div>
              </div>
              <div className="signal-list">
                <div className="signal-item">
                  <span className="dot success" />
                  Redwood Partners opened your memo
                </div>
                <div className="signal-item">
                  <span className="dot warning" />
                  Ember Ventures requested updated metrics
                </div>
                <div className="signal-item">
                  <span className="dot neutral" />
                  Nova Angels reviewing your deck
                </div>
              </div>
              <div className="panel-visual">
                <img src={heroIllustration} alt="Fundraising pipeline visualization" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="models" id="features" data-testid="features-section">
          <div className="section-intro">
            <span className="eyebrow">
              <BarChart3 className="w-4 h-4" />
              What you get
            </span>
            <h2>Everything you need to close your round</h2>
            <p>
              A modular system for founders and investors who want clarity, trust,
              and momentum without chasing ten different tools.
            </p>
          </div>
          <div className="models-grid">
            <article className="model-card" data-testid="feature-signal">
              <span className="chip">
                <TrendingUp className="w-3 h-3" />
                Signal
              </span>
              <h3>Investor intent tracking</h3>
              <p>See opens, replies, and sentiment in one dashboard. Know who to prioritize.</p>
              <div className="model-metrics">
                <span>Realtime analytics</span>
                <span>Priority scoring</span>
              </div>
            </article>
            <article className="model-card" data-testid="feature-relay">
              <span className="chip">
                <Users className="w-3 h-3" />
                Relay
              </span>
              <h3>Warm intro orchestration</h3>
              <p>Coordinate connectors, track status, and move intros forward without friction.</p>
              <div className="model-metrics">
                <span>Trusted matches</span>
                <span>Auto reminders</span>
              </div>
            </article>
            <article className="model-card" data-testid="feature-vault">
              <span className="chip">
                <Shield className="w-3 h-3" />
                Vault
              </span>
              <h3>Single-source data room</h3>
              <p>Share one live application, update once, and keep every stakeholder aligned.</p>
              <div className="model-metrics">
                <span>Version control</span>
                <span>Access controls</span>
              </div>
            </article>
            <article className="model-card" data-testid="feature-pulse">
              <span className="chip">
                <MessageSquare className="w-3 h-3" />
                Pulse
              </span>
              <h3>Founder updates that land</h3>
              <p>Send performance updates in one click and keep investors in the loop.</p>
              <div className="model-metrics">
                <span>Update templates</span>
                <span>Performance KPIs</span>
              </div>
            </article>
          </div>
        </section>

        {/* How it works */}
        <section className="workflow" id="how-it-works" data-testid="workflow-section">
          <div className="workflow-copy">
            <span className="eyebrow">
              <Zap className="w-4 h-4" />
              How it works
            </span>
            <h2>Everything moves on one timeline</h2>
            <p>
              FoundersLib keeps your raise, intros, and investor comms in a single
              command center with seamless collaboration.
            </p>
            <div className="workflow-actions">
              <Link className="btn primary" to="/signup">
                Start free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
          <div className="workflow-steps">
            <div className="step-card">
              <span className="step-title">01 · Centralize</span>
              <h3>One source of truth</h3>
              <p>One application, one data room, one source of truth across all investors.</p>
            </div>
            <div className="step-card">
              <span className="step-title">02 · Coordinate</span>
              <h3>Seamless orchestration</h3>
              <p>Manage connectors, follow-ups, and meeting schedules in one flow.</p>
            </div>
            <div className="step-card">
              <span className="step-title">03 · Measure</span>
              <h3>Actionable insights</h3>
              <p>Track interest signals and keep your raise moving with real-time data.</p>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="reviews" id="testimonials" data-testid="reviews-section">
          <div className="section-intro">
            <span className="eyebrow">What people say</span>
            <h2>Founders and partners feel the lift</h2>
            <p>Early teams are running tighter rounds with clearer signals and faster closes.</p>
          </div>
          <div className="reviews-grid">
            <article className="review-card">
              <p>
                "FoundersLib cut our outreach time in half. We had clarity on who was
                leaning in within a week."
              </p>
              <div className="review-meta">
                <span className="review-name">Maya K.</span>
                <span className="review-role"> · Founder, Climate SaaS</span>
              </div>
            </article>
            <article className="review-card">
              <p>
                "The intro workflow is the real win. Everyone sees the same timeline,
                so the handoffs are smoother."
              </p>
              <div className="review-meta">
                <span className="review-name">Elliot R.</span>
                <span className="review-role"> · Angel Investor</span>
              </div>
            </article>
            <article className="review-card">
              <p>
                "We used to chase updates across docs and threads. Now it is a single
                dashboard with signal scoring."
              </p>
              <div className="review-meta">
                <span className="review-name">Priya S.</span>
                <span className="review-role"> · Partner, Seed Fund</span>
              </div>
            </article>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta" id="cta" data-testid="cta-section">
          <div>
            <h2>Ready to run a calmer raise?</h2>
            <p>Join founders and investors already building with clarity.</p>
          </div>
          <div className="cta-actions">
            <Link className="btn primary" to="/signup" data-testid="cta-access-btn">
              Get started free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer" data-testid="footer">
        <div>
          <span className="logo-name font-display font-semibold">FoundersLib</span>
          <p className="mt-2">Fundraising infrastructure for modern founders.</p>
        </div>
        <div className="footer-links">
          <Link to="/login">Sign in</Link>
          <Link to="/signup">Get started</Link>
        </div>
      </footer>
    </Page>
  )
}
