import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'

type TrustStatus = {
  league?: string
  credits?: number
  intro_requests_this_month?: number
  intro_limit?: number
  cooldown_until?: string | null
  onboarding_completed?: boolean
  next_league_threshold?: number | null
}

type CreditEvent = {
  id: string
  amount?: number
  reason?: string
  created_at?: string
}

export function TrustPage() {
  const [status, setStatus] = useState<TrustStatus | null>(null)
  const [events, setEvents] = useState<CreditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [statusData, historyData] = await Promise.all([
          apiRequest<TrustStatus>('/trust/status/'),
          apiRequest<CreditEvent[] | { results: CreditEvent[] }>('/trust/credit-history/'),
        ])
        if (!cancelled) {
          setStatus(statusData)
          setEvents(normalizeList(historyData))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load trust status.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Trust & Credits</h1>
          <p>Track your league, credits, and reputation signals.</p>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading trust status...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="data-grid">
            <div className="data-card">
              <span className="data-eyebrow">League</span>
              <h3>{status?.league ?? '—'}</h3>
              <p>Next threshold: {status?.next_league_threshold ?? '—'}</p>
            </div>
            <div className="data-card">
              <span className="data-eyebrow">Credits</span>
              <h3>{status?.credits ?? 0}</h3>
              <p>Intro limit: {status?.intro_limit ?? '—'}</p>
            </div>
            <div className="data-card">
              <span className="data-eyebrow">Intro usage</span>
              <h3>{status?.intro_requests_this_month ?? 0}</h3>
              <p>Cooldown: {status?.cooldown_until ? new Date(status.cooldown_until).toLocaleDateString() : '—'}</p>
            </div>
          </div>

          <div className="content-card">
            <span className="data-eyebrow">Credit history</span>
            <ul className="timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <span>{event.reason ?? 'Credit update'}</span>
                  <span className="timeline-meta">
                    {event.amount !== undefined ? `${event.amount > 0 ? '+' : ''}${event.amount}` : ''}{' '}
                    {event.created_at ? new Date(event.created_at).toLocaleDateString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  )
}
