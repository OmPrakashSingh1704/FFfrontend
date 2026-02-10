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
  ChevronRight,
  Award,
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
    <div style={{ padding: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-description">Your subscription, credits, and trust league information.</p>
        </div>
      </div>

      {/* Plan Overview - 3 stat cards */}
      <div className="grid-3 section">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Current Plan</span>
            <div className="stat-icon">
              <CreditCard style={{ width: 20, height: 20 }} strokeWidth={1.5} />
            </div>
          </div>
          <span className="stat-value" style={{ textTransform: 'capitalize' }}>
            {user?.subscription_tier ?? 'Free'}
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Credits</span>
            <div className="stat-icon">
              <Star style={{ width: 20, height: 20 }} strokeWidth={1.5} />
            </div>
          </div>
          <span className="stat-value">
            {user?.credits ?? 0}
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Next Billing</span>
            <div className="stat-icon">
              <Trophy style={{ width: 20, height: 20 }} strokeWidth={1.5} />
            </div>
          </div>
          <span className="stat-value" style={{ textTransform: 'capitalize' }}>
            {user?.league ?? '\u2014'}
          </span>
        </div>
      </div>

      {/* Trust Leagues */}
      <div className="card section">
        <div className="card-header">
          <span className="card-title">
            <Award style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} strokeWidth={1.5} />
            Trust Leagues
          </span>
        </div>

        {loadingLeagues ? (
          <div className="empty-state" style={{ padding: '2rem 0' }}>
            <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
            <p className="empty-description">Loading leagues...</p>
          </div>
        ) : leagues.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 0' }}>
            <Trophy className="empty-icon" />
            <p className="empty-description">No league information available.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>League</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Credit Range</th>
                <th style={{ width: '2rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {leagues.map((league) => {
                const isActive = user?.league === league.name
                return (
                  <tr key={league.name}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{league.name}</span>
                        {isActive && (
                          <span className="badge success">Current</span>
                        )}
                      </span>
                    </td>
                    <td style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {league.description ?? '\u2014'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                      {league.min_credits != null
                        ? `${league.min_credits}${league.max_credits != null ? `\u2013${league.max_credits}` : '+'}`
                        : '\u2014'}
                    </td>
                    <td>
                      {isActive && (
                        <ChevronRight style={{ width: 14, height: 14, color: 'var(--gold)' }} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Credit History */}
      <div className="card section">
        <div className="card-header">
          <span className="card-title">
            <Clock style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} strokeWidth={1.5} />
            Credit History
          </span>
        </div>

        {loadingHistory ? (
          <div className="empty-state" style={{ padding: '2rem 0' }}>
            <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
            <p className="empty-description">Loading history...</p>
          </div>
        ) : creditHistory.length === 0 ? (
          <div className="empty-state">
            <Clock className="empty-icon" />
            <h3 className="empty-title">No credit history</h3>
            <p className="empty-description">Your credit transactions will appear here as you use the platform.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {creditHistory.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : '\u2014'}
                  </td>
                  <td>
                    {item.reason ?? item.description ?? 'Credit adjustment'}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.8125rem',
                    color: item.amount >= 0 ? '#22c55e' : '#ef4444',
                  }}>
                    {item.amount >= 0 ? '+' : ''}{item.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
