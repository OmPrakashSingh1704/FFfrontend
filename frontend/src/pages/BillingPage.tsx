import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useAuth } from '../context/AuthContext'
import {
  CreditCard,
  Star,
  Trophy,
  Clock,
  Loader2,
} from 'lucide-react'

type CreditHistoryItem = {
  id: string
  amount: number
  reason?: string
  description?: string
  created_at?: string
}

type League = {
  name: string
  min_credits?: number
  max_credits?: number
  description?: string
}

export function BillingPage() {
  const { user } = useAuth()

  const [creditHistory, setCreditHistory] = useState<CreditHistoryItem[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingLeagues, setLoadingLeagues] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadHistory = async () => {
      setLoadingHistory(true)
      try {
        const data = await apiRequest<CreditHistoryItem[] | { results: CreditHistoryItem[] }>('/trust/credit-history/')
        if (!cancelled) setCreditHistory(normalizeList(data))
      } catch {
        if (!cancelled) setCreditHistory([])
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    const loadLeagues = async () => {
      setLoadingLeagues(true)
      try {
        const data = await apiRequest<League[] | { results: League[] }>('/trust/leagues/')
        if (!cancelled) setLeagues(normalizeList(data))
      } catch {
        if (!cancelled) setLeagues([])
      } finally {
        if (!cancelled) setLoadingLeagues(false)
      }
    }

    void loadHistory()
    void loadLeagues()
    return () => { cancelled = true }
  }, [])

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Billing</h1>
          <p>Your subscription, credits, and trust league information.</p>
        </div>
      </header>

      {/* Plan Overview */}
      <div className="billing-cards-grid">
        <div className="content-card billing-plan-card">
          <div className="billing-card-icon">
            <CreditCard size={24} strokeWidth={1.5} />
          </div>
          <span className="billing-card-label">Current plan</span>
          <span className="billing-card-value capitalize">
            {user?.subscription_tier ?? 'Free'}
          </span>
        </div>

        <div className="content-card billing-plan-card">
          <div className="billing-card-icon">
            <Star size={24} strokeWidth={1.5} />
          </div>
          <span className="billing-card-label">Credits</span>
          <span className="billing-card-value">
            {user?.credits ?? 0}
          </span>
        </div>

        <div className="content-card billing-plan-card">
          <div className="billing-card-icon">
            <Trophy size={24} strokeWidth={1.5} />
          </div>
          <span className="billing-card-label">League</span>
          <span className="billing-card-value capitalize">
            {user?.league ?? '—'}
          </span>
        </div>
      </div>

      {/* Leagues */}
      <div className="content-card">
        <div className="settings-section-header">
          <Trophy size={18} strokeWidth={1.5} />
          <h2>Trust leagues</h2>
        </div>

        {loadingLeagues ? (
          <div className="page-loader">Loading leagues…</div>
        ) : leagues.length === 0 ? (
          <p className="billing-muted">No league information available.</p>
        ) : (
          <div className="billing-leagues-list">
            {leagues.map((league) => (
              <div
                key={league.name}
                className={`billing-league-row${user?.league === league.name ? ' billing-league-active' : ''}`}
              >
                <span className="billing-league-name capitalize">{league.name}</span>
                {league.description && (
                  <span className="billing-league-desc">{league.description}</span>
                )}
                {league.min_credits != null && (
                  <span className="billing-league-range">
                    {league.min_credits}
                    {league.max_credits != null ? `–${league.max_credits}` : '+'} credits
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Credit History */}
      <div className="content-card">
        <div className="settings-section-header">
          <Clock size={18} strokeWidth={1.5} />
          <h2>Credit history</h2>
        </div>

        {loadingHistory ? (
          <div className="page-loader">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading history…
          </div>
        ) : creditHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Clock className="w-8 h-8" />
            </div>
            <h3>No credit history</h3>
            <p>Your credit transactions will appear here as you use the platform.</p>
          </div>
        ) : (
          <div className="billing-history-list">
            {creditHistory.map((item) => (
              <div key={item.id} className="billing-history-row">
                <div className="billing-history-info">
                  <span className="billing-history-reason">
                    {item.reason ?? item.description ?? 'Credit adjustment'}
                  </span>
                  {item.created_at && (
                    <span className="billing-history-date">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <span className={`billing-history-amount${item.amount >= 0 ? ' positive' : ' negative'}`}>
                  {item.amount >= 0 ? '+' : ''}{item.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
