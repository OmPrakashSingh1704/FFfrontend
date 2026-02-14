import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const BOB_FREQUENCY = 8
const BOB_AMPLITUDE = 4

export function HandshakeAnimation() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let rafId = 0
    const handleScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!sectionRef.current) return
        const rect = sectionRef.current.getBoundingClientRect()
        const windowHeight = window.innerHeight
        const sectionHeight = rect.height
        const rawProgress = 1 - (rect.top - windowHeight * 0.2) / (sectionHeight + windowHeight * 0.3)
        setProgress(Math.max(0, Math.min(1, rawProgress)))
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  // Walking phase: 0 to 0.65 — figures walk to center
  // Handshake phase: 0.65 to 0.8 — hands come together
  // Reveal phase: 0.8 to 1 — sign-up button appears
  const walkProgress = Math.min(progress / 0.65, 1)
  const handshakeProgress = Math.max(0, Math.min((progress - 0.65) / 0.15, 1))
  const revealProgress = Math.max(0, Math.min((progress - 0.8) / 0.2, 1))

  // Translate from edges to center: 0% = at edge, 100% = at center
  const founderX = (1 - walkProgress) * 100 // starts at 100% right, moves to 0
  const investorX = (1 - walkProgress) * -100 // starts at -100% left, moves to 0

  // Walking bobbing motion
  const bobAmount = walkProgress < 1 ? Math.sin(walkProgress * Math.PI * BOB_FREQUENCY) * BOB_AMPLITUDE : 0

  return (
    <section
      ref={sectionRef}
      className="handshake-section"
      data-testid="handshake-section"
    >
      <div className="handshake-container">
        <div className="handshake-header">
          <p className="section-eyebrow">Building Bridges</p>
          <h2 className="section-title">
            Where <span className="text-gradient">founders</span> meet{' '}
            <span className="text-gradient">investors</span>
          </h2>
        </div>

        <div className="handshake-stage">
          {/* Investor - comes from the left */}
          <div
            className="handshake-figure investor-figure"
            style={{
              transform: `translateX(${investorX}%) translateY(${bobAmount}px)`,
            }}
            data-testid="investor-figure"
          >
            <div className="figure-body">
              <svg viewBox="0 0 120 200" className="person-svg">
                {/* Head */}
                <circle cx="60" cy="30" r="22" fill="var(--gold)" opacity="0.9" />
                {/* Eyes */}
                <circle cx="52" cy="27" r="2.5" fill="white" />
                <circle cx="68" cy="27" r="2.5" fill="white" />
                {/* Smile */}
                <path d="M50,36 Q60,44 70,36" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                {/* Body */}
                <rect x="38" y="52" width="44" height="55" rx="8" fill="hsl(var(--foreground))" opacity="0.85" />
                {/* Tie */}
                <polygon points="60,52 55,72 60,68 65,72" fill="var(--gold)" opacity="0.7" />
                {/* Left arm - extends for handshake */}
                <rect
                  x="82"
                  y="58"
                  width="32"
                  height="12"
                  rx="6"
                  fill="hsl(var(--foreground))"
                  opacity="0.75"
                  style={{
                    transformOrigin: '82px 64px',
                    transform: `rotate(${handshakeProgress * -15}deg)`,
                    transition: 'transform 0.3s ease',
                  }}
                />
                {/* Right arm */}
                <rect x="6" y="62" width="32" height="12" rx="6" fill="hsl(var(--foreground))" opacity="0.75" />
                {/* Briefcase */}
                <rect x="2" y="75" width="20" height="16" rx="3" fill="var(--gold)" opacity="0.6" />
                <rect x="8" y="72" width="8" height="4" rx="2" fill="var(--gold)" opacity="0.8" />
                {/* Left leg */}
                <rect x="42" y="107" width="14" height="45" rx="6" fill="hsl(var(--foreground))" opacity="0.7" />
                {/* Right leg */}
                <rect x="64" y="107" width="14" height="45" rx="6" fill="hsl(var(--foreground))" opacity="0.7" />
                {/* Shoes */}
                <rect x="38" y="148" width="20" height="8" rx="4" fill="hsl(var(--foreground))" opacity="0.9" />
                <rect x="62" y="148" width="20" height="8" rx="4" fill="hsl(var(--foreground))" opacity="0.9" />
              </svg>
            </div>
            <span className="figure-label">Investor</span>
          </div>

          {/* Handshake effect in center */}
          <div
            className="handshake-center"
            style={{
              opacity: handshakeProgress,
              transform: `scale(${0.5 + handshakeProgress * 0.5})`,
            }}
            data-testid="handshake-icon"
          >
            <svg viewBox="0 0 80 80" className="handshake-icon-svg">
              <circle cx="40" cy="40" r="36" fill="var(--gold)" opacity="0.15" />
              <circle cx="40" cy="40" r="24" fill="var(--gold)" opacity="0.25" />
              {/* Handshake icon */}
              <path
                d="M22,42 L30,34 Q36,30 40,34 L44,38 Q48,42 52,38 L58,32"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22,42 L28,48 Q34,52 40,48"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M58,32 L52,44 Q48,50 40,48"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Founder - comes from the right */}
          <div
            className="handshake-figure founder-figure"
            style={{
              transform: `translateX(${founderX}%) translateY(${bobAmount}px)`,
            }}
            data-testid="founder-figure"
          >
            <div className="figure-body">
              <svg viewBox="0 0 120 200" className="person-svg" style={{ transform: 'scaleX(-1)' }}>
                {/* Head */}
                <circle cx="60" cy="30" r="22" fill="var(--gold-light)" opacity="0.9" />
                {/* Eyes */}
                <circle cx="52" cy="27" r="2.5" fill="white" />
                <circle cx="68" cy="27" r="2.5" fill="white" />
                {/* Smile */}
                <path d="M50,36 Q60,44 70,36" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                {/* Body - casual */}
                <rect x="38" y="52" width="44" height="55" rx="8" fill="var(--gold)" opacity="0.3" />
                {/* Hoodie detail */}
                <path d="M50,52 Q60,60 70,52" fill="none" stroke="var(--gold)" strokeWidth="1.5" opacity="0.5" />
                {/* Left arm - extends for handshake */}
                <rect
                  x="82"
                  y="58"
                  width="32"
                  height="12"
                  rx="6"
                  fill="var(--gold)"
                  opacity="0.3"
                  style={{
                    transformOrigin: '82px 64px',
                    transform: `rotate(${handshakeProgress * -15}deg)`,
                    transition: 'transform 0.3s ease',
                  }}
                />
                {/* Right arm */}
                <rect x="6" y="62" width="32" height="12" rx="6" fill="var(--gold)" opacity="0.3" />
                {/* Laptop */}
                <rect x="0" y="72" width="22" height="16" rx="2" fill="hsl(var(--foreground))" opacity="0.3" />
                <rect x="2" y="74" width="18" height="10" rx="1" fill="var(--gold)" opacity="0.2" />
                {/* Left leg */}
                <rect x="42" y="107" width="14" height="45" rx="6" fill="hsl(var(--foreground))" opacity="0.5" />
                {/* Right leg */}
                <rect x="64" y="107" width="14" height="45" rx="6" fill="hsl(var(--foreground))" opacity="0.5" />
                {/* Shoes */}
                <rect x="38" y="148" width="20" height="8" rx="4" fill="var(--gold)" opacity="0.6" />
                <rect x="62" y="148" width="20" height="8" rx="4" fill="var(--gold)" opacity="0.6" />
              </svg>
            </div>
            <span className="figure-label">Founder</span>
          </div>
        </div>

        {/* Sign-up CTA that appears on handshake */}
        <div
          className="handshake-cta"
          style={{
            opacity: revealProgress,
            transform: `translateY(${(1 - revealProgress) * 30}px) scale(${0.8 + revealProgress * 0.2})`,
          }}
          data-testid="handshake-cta"
        >
          <p className="handshake-cta-text">
            Great things happen when founders and investors connect.
          </p>
          <Link className="btn primary" to="/signup" data-testid="handshake-signup-btn">
            Sign Up Now
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    </section>
  )
}
