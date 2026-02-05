import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Building2, Calendar, FileText, ArrowRight } from 'lucide-react'
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
    <section className="content-section" data-testid="funds-list">
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-cyan-400">Opportunities</span>
          </div>
          <h1>Funds & Opportunities</h1>
          <p>Browse active funds and opportunities accepting applications.</p>
        </div>
        <Link className="btn ghost" to="/app/applications" data-testid="view-applications-btn">
          <FileText className="w-4 h-4 mr-2" />
          View applications
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading funds...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid" data-testid="funds-grid">
          {funds.map((fund) => (
            <Link 
              key={fund.id} 
              to={`/app/funds/${fund.id}`} 
              className="data-card group"
              data-testid={`fund-card-${fund.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="data-eyebrow">Fund</span>
                <ArrowRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3>{fund.name}</h3>
              <p>{fund.organization || 'Investment opportunity'}</p>
              <div className="data-meta">
                {fund.fund_type ? (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {fund.fund_type}
                  </span>
                ) : null}
                {fund.opportunity_type ? <span>{fund.opportunity_type}</span> : null}
                {fund.deadline ? (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(fund.deadline).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
          {funds.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No funds available. Check back soon!
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
