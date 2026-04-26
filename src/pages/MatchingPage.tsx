import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { resolveMediaUrl } from '../lib/env'
import { TrendingUp, Briefcase, Star, Loader2, ChevronRight, Zap, Users, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'

type ScoreBreakdown = {
  industry_score: number
  stage_score: number
  capital_fit_score: number
  verification_score: number
  traction_score: number
  total_score: number
  classification: string
  computed_at: string
}

type InvestorMatch = {
  investor: {
    id: string
    display_name: string
    fund_name?: string | null
    investor_type?: string | null
    headline?: string | null
    profile_photo?: string | null
    check_size_min?: number | null
    check_size_max?: number | null
    stages_focus?: string[]
    industries_focus?: string[]
  }
  score: ScoreBreakdown
}

type FounderInfo = {
  user_id: string
  full_name: string
  profile_id?: string | null
  headline?: string | null
  avatar?: string | null
}

type StartupMatch = {
  startup: {
    id: string
    name: string
    industry?: string | null
    current_stage?: string | null
    logo_url?: string | null
    logo?: string | null
    tagline?: string | null
    founders?: FounderInfo[]
  }
  score: ScoreBreakdown
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  strong: '#22c55e',
  moderate: '#f59e0b',
  weak: '#ef4444',
}

function ScoreBadge({ score, classification }: { score: number; classification: string }) {
  const color = CLASSIFICATION_COLORS[classification] ?? 'hsl(var(--muted-foreground))'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        textTransform: 'capitalize',
      }}
    >
      <Star size={10} />
      {score}% · {classification}
    </span>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
      <span style={{ width: 110, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'hsl(var(--muted))', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${value}%`,
            background: 'var(--gold)',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

export function MatchingPage() {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const isInvestor = user?.role === 'investor'
  const isFounder = user?.role === 'founder'

  const [investorMatches, setInvestorMatches] = useState<InvestorMatch[]>([])
  const [startupMatches, setStartupMatches] = useState<StartupMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [needsInvestorOnboarding, setNeedsInvestorOnboarding] = useState(false)
  const [needsFounderOnboarding, setNeedsFounderOnboarding] = useState(false)

  const fetchMatches = async () => {
    setLoading(true)
    try {
      if (isFounder) {
        try {
          const data = await apiRequest<{ results: InvestorMatch[] } | InvestorMatch[]>('/match/knn/investors/')
          setInvestorMatches(normalizeList(data))
        } catch (err: unknown) {
          const e = err as { status?: number }
          if (e?.status === 400) setNeedsFounderOnboarding(true)
          else pushToast('Failed to load investor matches', 'error')
        }
      }
      if (isInvestor) {
        try {
          const data = await apiRequest<{ results: StartupMatch[] } | StartupMatch[]>('/match/knn/startups/')
          setStartupMatches(normalizeList(data))
        } catch (err: unknown) {
          const e = err as { status?: number }
          if (e?.status === 400) setNeedsInvestorOnboarding(true)
          else pushToast('Failed to load startup matches', 'error')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchMatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Matching</h1>
          <p className="page-description">Founders and investors matched by compatibility based on stage, sector, and goals.</p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: '#22c55e18', color: '#22c55e', border: '1px solid #22c55e33' }}>
          <Zap size={11} />
          Live
        </span>
      </div>

      {loading ? (
        <div className="empty-state" style={{ paddingTop: '4rem' }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <span className="empty-description">Computing matches...</span>
        </div>
      ) : (
        <>
          {/* Investor matches (for founders) */}
          {isFounder && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                Matched Investors
                <span className="badge">{investorMatches.length}</span>
              </h2>
              {needsFounderOnboarding ? (
                <div className="empty-state">
                  <div className="empty-icon"><ClipboardList size={24} /></div>
                  <span className="empty-title">Complete your startup profile</span>
                  <span className="empty-description">Create a startup to get matched with investors.</span>
                  <Link to="/onboarding" className="btn primary" style={{ marginTop: '0.75rem' }}>
                    Finish onboarding
                  </Link>
                </div>
              ) : investorMatches.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><TrendingUp size={24} /></div>
                  <span className="empty-title">No matches yet</span>
                  <span className="empty-description">Complete your startup profile to get matched with investors.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {investorMatches.map((m) => {
                    const expanded = expandedId === m.investor.id
                    return (
                      <div key={m.investor.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <button
                          className="list-item"
                          onClick={() => setExpandedId(expanded ? null : m.investor.id)}
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: expanded ? '0.75rem 0.75rem 0 0' : undefined }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {m.investor.profile_photo ? (
                              <img src={resolveMediaUrl(m.investor.profile_photo) ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <TrendingUp size={16} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{m.investor.display_name}</span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                              {m.investor.fund_name ?? m.investor.investor_type ?? 'Investor'}
                            </span>
                          </div>
                          <ScoreBadge score={m.score.total_score} classification={m.score.classification} />
                          <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 200ms' }} />
                        </button>
                        {expanded && (
                          <div style={{ padding: '1rem', borderTop: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <ScoreBar label="Industry fit" value={m.score.industry_score} />
                            <ScoreBar label="Stage fit" value={m.score.stage_score} />
                            <ScoreBar label="Capital fit" value={m.score.capital_fit_score} />
                            <ScoreBar label="Verification" value={m.score.verification_score} />
                            <ScoreBar label="Traction" value={m.score.traction_score} />
                            <div style={{ marginTop: 8 }}>
                              <Link to={`/app/investors/${m.investor.id}`} className="btn-sm ghost">
                                View profile <ChevronRight size={12} />
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Startup + Founder matches (for investors) */}
          {isInvestor && (
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Briefcase size={16} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                Matched Startups &amp; Founders
                <span className="badge">{startupMatches.length}</span>
              </h2>
              {needsInvestorOnboarding ? (
                <div className="empty-state">
                  <div className="empty-icon"><ClipboardList size={24} /></div>
                  <span className="empty-title">Complete your investor profile</span>
                  <span className="empty-description">Set up your investor profile to start discovering matching startups.</span>
                  <Link to="/onboarding" className="btn primary" style={{ marginTop: '0.75rem' }}>
                    Finish onboarding
                  </Link>
                </div>
              ) : startupMatches.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><Briefcase size={24} /></div>
                  <span className="empty-title">No matches yet</span>
                  <span className="empty-description">Complete your investor profile to discover matching startups.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {startupMatches.map((m) => {
                    const expanded = expandedId === m.startup.id
                    const logoSrc = resolveMediaUrl(m.startup.logo ?? m.startup.logo_url)
                    const founders = m.startup.founders ?? []
                    return (
                      <div key={m.startup.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <button
                          className="list-item"
                          onClick={() => setExpandedId(expanded ? null : m.startup.id)}
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: expanded ? '0.75rem 0.75rem 0 0' : undefined }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {logoSrc ? (
                              <img src={logoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Briefcase size={16} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{m.startup.name}</span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                              {m.startup.industry ?? m.startup.current_stage ?? 'Startup'}
                            </span>
                          </div>
                          <ScoreBadge score={m.score.total_score} classification={m.score.classification} />
                          <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 200ms' }} />
                        </button>
                        {expanded && (
                          <div style={{ padding: '1rem', borderTop: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Score breakdown */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <ScoreBar label="Industry fit" value={m.score.industry_score} />
                              <ScoreBar label="Stage fit" value={m.score.stage_score} />
                              <ScoreBar label="Capital fit" value={m.score.capital_fit_score} />
                              <ScoreBar label="Verification" value={m.score.verification_score} />
                              <ScoreBar label="Traction" value={m.score.traction_score} />
                            </div>

                            {/* Founders */}
                            {founders.length > 0 && (
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Users size={12} strokeWidth={1.5} /> Founders
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {founders.map((f) => (
                                    <div key={f.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', fontSize: '0.65rem', fontWeight: 600 }}>
                                        {f.avatar ? (
                                          <img src={resolveMediaUrl(f.avatar) ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          f.full_name.slice(0, 2).toUpperCase()
                                        )}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{f.full_name}</div>
                                        {f.headline && <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.headline}</div>}
                                      </div>
                                      {f.profile_id && (
                                        <Link to={`/app/founders/${f.profile_id}`} className="btn-sm ghost" style={{ flexShrink: 0 }}>
                                          View <ChevronRight size={11} />
                                        </Link>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <Link to={`/app/startups/${m.startup.id}`} className="btn-sm ghost">
                                View startup <ChevronRight size={12} />
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
