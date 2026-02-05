import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp, Users, Shield, MessageSquare } from 'lucide-react'
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
          <div className="hero-visual" />
        </section>

        {/* Features */}
        <section className="features" data-testid="features-section">
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
              <p>Know precisely who is interested and who requires attention. No guesswork.</p>
            </article>
            <article className="feature-card animate-slide-up animate-delay-2">
              <div className="feature-icon">
                <Users className="w-5 h-5" />
              </div>
              <h3>Warm Introductions</h3>
              <p>Orchestrate introductions through trusted connections with grace and efficiency.</p>
            </article>
            <article className="feature-card animate-slide-up animate-delay-3">
              <div className="feature-icon">
                <Shield className="w-5 h-5" />
              </div>
              <h3>Private Data Room</h3>
              <p>Share sensitive materials with confidence. One source of truth for all parties.</p>
            </article>
            <article className="feature-card animate-slide-up animate-delay-4">
              <div className="feature-icon">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3>Investor Updates</h3>
              <p>Keep stakeholders informed with elegant, thoughtful communications.</p>
            </article>
          </div>
        </section>

        {/* Testimonials */}
        <section className="testimonials" data-testid="testimonials-section">
          <div className="section-header">
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
