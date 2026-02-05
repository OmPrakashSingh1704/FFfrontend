import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'

type RespectItem = {
  id: string
  skill?: string
  created_at?: string
  giver_name?: string
  receiver_name?: string
}

export function RespectPage() {
  const [received, setReceived] = useState<RespectItem[]>([])
  const [given, setGiven] = useState<RespectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [receivedData, givenData] = await Promise.all([
          apiRequest<RespectItem[] | { results: RespectItem[] }>('/respects/received/'),
          apiRequest<RespectItem[] | { results: RespectItem[] }>('/respects/given/'),
        ])
        if (!cancelled) {
          setReceived(normalizeList(receivedData))
          setGiven(normalizeList(givenData))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load respect data.')
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
          <h1>Respect</h1>
          <p>Endorsements and credibility signals in your network.</p>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading respect...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid">
          <div className="data-card">
            <span className="data-eyebrow">Received</span>
            <h3>{received.length}</h3>
            <ul className="timeline">
              {received.map((item) => (
                <li key={item.id}>
                  <span>{item.skill ?? 'Skill endorsement'}</span>
                  <span className="timeline-meta">
                    {item.giver_name ? `From ${item.giver_name}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="data-card">
            <span className="data-eyebrow">Given</span>
            <h3>{given.length}</h3>
            <ul className="timeline">
              {given.map((item) => (
                <li key={item.id}>
                  <span>{item.skill ?? 'Skill endorsement'}</span>
                  <span className="timeline-meta">
                    {item.receiver_name ? `To ${item.receiver_name}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}
