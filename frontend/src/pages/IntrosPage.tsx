import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { IntroRequest } from '../types/intro'

type IntroTab = 'sent' | 'received'

export function IntrosPage() {
  const [tab, setTab] = useState<IntroTab>('sent')
  const [items, setItems] = useState<IntroRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const endpoint = tab === 'sent' ? '/intros/sent/' : '/intros/received/'
        const data = await apiRequest<IntroRequest[] | { results: IntroRequest[] }>(endpoint)
        if (!cancelled) {
          setItems(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load intro requests.')
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
  }, [tab])

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Intros</h1>
          <p>Track warm introductions and follow-ups.</p>
        </div>
        <div className="segmented">
          {(['sent', 'received'] as IntroTab[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`segmented-btn ${tab === option ? 'active' : ''}`}
              onClick={() => setTab(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      {loading ? <div className="page-loader">Loading intros...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid">
          {items.map((intro) => (
            <article key={intro.id} className="data-card">
              <span className="data-eyebrow">{intro.status ?? 'pending'}</span>
              <h3>{intro.requester_name ?? 'Requester'} → {intro.recipient_name ?? 'Recipient'}</h3>
              <p>{intro.message || 'No message provided.'}</p>
              <div className="data-meta">
                {intro.created_at ? <span>Created: {new Date(intro.created_at).toLocaleDateString()}</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
