import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { FundListItem } from '../types/fund'

export function FundsListPage() {
  const [funds, setFunds] = useState<FundListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FundListItem[] | { results: FundListItem[] }>('/funds/')
        if (!cancelled) {
          setFunds(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load funds.')
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
          <h1>Funds & Opportunities</h1>
          <p>Browse active funds and opportunities accepting applications.</p>
        </div>
        <Link className="btn ghost" to="/app/applications">
          View applications
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading funds...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid">
          {funds.map((fund) => (
            <Link key={fund.id} to={`/app/funds/${fund.id}`} className="data-card">
              <span className="data-eyebrow">Fund</span>
              <h3>{fund.name}</h3>
              <p>{fund.organization || 'Investment opportunity'}</p>
              <div className="data-meta">
                {fund.fund_type ? <span>{fund.fund_type}</span> : null}
                {fund.opportunity_type ? <span>{fund.opportunity_type}</span> : null}
                {fund.deadline ? <span>Deadline: {new Date(fund.deadline).toLocaleDateString()}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
