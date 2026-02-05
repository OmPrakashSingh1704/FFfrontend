import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp, Users, Shield, MessageSquare } from 'lucide-react'
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
              <span>Series A · $8M</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status hot">Hot Lead</span>
          </div>
          
          <div className="dashboard-row bar-60">
            <div className="row-avatar">A1</div>
            <div className="row-info">
              <strong>Andreessen Horowitz</strong>
              <span>Series A · $10M</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status">In Review</span>
          </div>
          
          <div className="dashboard-row bar-90">
            <div className="row-avatar">AC</div>
            <div className="row-info">
              <strong>Accel Partners</strong>
              <span>Series A · $7M</span>
            </div>
            <div className="row-bar"><div className="row-bar-fill" /></div>
            <span className="row-status hot">Term Sheet</span>
          </div>
          
          <div className="dashboard-row bar-45">
            <div className="row-avatar">GV</div>
            <div className="row-info">
              <strong>GV (Google Ventures)</strong>
              <span>Series A · $6M</span>
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
            <p className="hero-eyebrow animate-fade-in">For discerning founders</p>
            <h1 className="hero-title animate-fade-in animate-delay-1">
              Raise capital with<br /><em>quiet confidence.</em>
            </h1>
            <p className="hero-lead animate-fade-in animate-delay-2">
              A refined system for founders who value discretion, clarity, 
              and meaningful connections over noise.
            </p>
            <div className="hero-actions animate-fade-in animate-delay-3">
              <Link className="btn primary" to="/signup" data-testid="hero-cta-btn">
                Request Access
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link className="btn ghost" to="/login">
                Sign in
              </Link>
            </div>
          </div>
          <HeroAnimation />
        </section>

        {/* Features */}
        <section className="features" data-testid="features-section">
          <div className="features-layout">
            <div className="features-content">
              <div className="section-header">
                <p className="section-eyebrow">The Essentials</p>
                <h2 className="section-title">Everything in its proper place</h2>
                <p className="section-lead">
                  Curated tools for founders who prefer substance over spectacle.
                </p>
              </div>
              <div className="features-grid">
                <article className="feature-card animate-slide-up animate-delay-1">
                  <div className="feature-icon">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3>Signal Intelligence</h3>
                  <p>Know precisely who is interested and who requires attention.</p>
                </article>
                <article className="feature-card animate-slide-up animate-delay-2">
                  <div className="feature-icon">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3>Warm Introductions</h3>
                  <p>Orchestrate introductions through trusted connections.</p>
                </article>
                <article className="feature-card animate-slide-up animate-delay-3">
                  <div className="feature-icon">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3>Private Data Room</h3>
                  <p>Share sensitive materials with confidence and control.</p>
                </article>
                <article className="feature-card animate-slide-up animate-delay-4">
                  <div className="feature-icon">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h3>Investor Updates</h3>
                  <p>Keep stakeholders informed with elegant communications.</p>
                </article>
              </div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        {/* Testimonials */}
        <section className="testimonials" data-testid="testimonials-section">
          <div className="section-header" style={{ textAlign: 'center', maxWidth: '32rem', margin: '0 auto 3rem' }}>
            <p className="section-eyebrow">Trusted By</p>
            <h2 className="section-title">Words from our circle</h2>
          </div>
          <div className="testimonials-grid">
            <article className="testimonial-card animate-fade-in animate-delay-1">
              <blockquote>
                "Finally, a platform that understands discretion. Our Series A came together 
                with remarkable efficiency."
              </blockquote>
              <div className="testimonial-author">
                <strong>Alexandra M.</strong>
                <span>Founder, Private Equity Tech</span>
              </div>
            </article>
            <article className="testimonial-card animate-fade-in animate-delay-2">
              <blockquote>
                "The signal tracking alone saved us months of uncertainty. 
                Worth every consideration."
              </blockquote>
              <div className="testimonial-author">
                <strong>Jonathan R.</strong>
                <span>Managing Partner</span>
              </div>
            </article>
            <article className="testimonial-card animate-fade-in animate-delay-3">
              <blockquote>
                "Understated elegance in a space filled with noise. 
                Exactly what serious founders need."
              </blockquote>
              <div className="testimonial-author">
                <strong>Caroline W.</strong>
                <span>Angel Investor</span>
              </div>
            </article>
          </div>
        </section>

        {/* CTA */}
        <section className="cta" data-testid="cta-section">
          <div className="cta-card animate-fade-in">
            <h2>Ready to begin?</h2>
            <p>Join founders who value quality over quantity.</p>
            <Link className="btn primary" to="/signup" data-testid="cta-btn">
              Request Access
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
      </footer>
    </Page>
  )
}
