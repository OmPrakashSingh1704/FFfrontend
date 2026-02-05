import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { InvestorProfile } from '../types/investor'

export function InvestorsListPage() {
  const [investors, setInvestors] = useState<InvestorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<InvestorProfile[] | { results: InvestorProfile[] }>('/investors/')
        if (!cancelled) {
          setInvestors(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load investors.')
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
          <h1>Investors</h1>
          <p>Discover investors and their focus areas.</p>
        </div>
        <Link className="btn ghost" to="/onboarding">
          Update my profile
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading investors...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid">
          {investors.map((investor) => (
            <Link key={investor.id} to={`/app/investors/${investor.id}`} className="data-card">
              <span className="data-eyebrow">Investor</span>
              <h3>{investor.display_name}</h3>
              <p>{investor.headline || investor.investment_thesis || 'Investor profile'}</p>
              <div className="data-meta">
                {investor.investor_type ? <span>{investor.investor_type}</span> : null}
                {investor.fund_name ? <span>{investor.fund_name}</span> : null}
                {investor.location ? <span>{investor.location}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
