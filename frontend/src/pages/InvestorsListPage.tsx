import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, MapPin, Building2, UserPlus, ArrowRight } from 'lucide-react'
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
    <section className="content-section" data-testid="investors-list">
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-cyan-400">Directory</span>
          </div>
          <h1>Investors</h1>
          <p>Discover investors and their focus areas.</p>
        </div>
        <Link className="btn ghost" to="/onboarding" data-testid="update-profile-btn">
          <UserPlus className="w-4 h-4 mr-2" />
          Update my profile
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading investors...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid" data-testid="investors-grid">
          {investors.map((investor) => (
            <Link 
              key={investor.id} 
              to={`/app/investors/${investor.id}`} 
              className="data-card group"
              data-testid={`investor-card-${investor.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="data-eyebrow">Investor</span>
                <ArrowRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3>{investor.display_name}</h3>
              <p>{investor.headline || investor.investment_thesis || 'Investor profile'}</p>
              <div className="data-meta">
                {investor.investor_type ? (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {investor.investor_type}
                  </span>
                ) : null}
                {investor.fund_name ? <span>{investor.fund_name}</span> : null}
                {investor.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {investor.location}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
          {investors.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No investors found. Check back soon!
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
