import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ArrowRight, Wallet } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { ApplicationListItem } from '../types/application'

export function ApplicationsListPage() {
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<ApplicationListItem[] | { results: ApplicationListItem[] }>('/applications/')
        if (!cancelled) {
          setApplications(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load applications.')
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
    <section className="content-section" data-testid="applications-list">
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5" style={{ color: 'var(--gold)' }} />
            <span className="data-eyebrow">Pipeline</span>
          </div>
          <h1>Applications</h1>
          <p>Track the status of your fundraising applications.</p>
        </div>
        <Link className="btn ghost" to="/app/funds" data-testid="find-funds-btn">
          <Wallet className="w-4 h-4 mr-2" />
          Find new funds
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading applications...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid" data-testid="applications-grid">
          {applications.map((application) => (
            <Link 
              key={application.id} 
              to={`/app/applications/${application.id}`} 
              className="data-card"
              data-testid={`application-card-${application.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="data-eyebrow">Application</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gold)' }} />
              </div>
              <h3>{application.fund_name ?? 'Fund'}</h3>
              <p>{application.startup_name ?? 'Startup'}</p>
              <div className="data-meta">
                {application.status ? <span>Status: {application.status}</span> : null}
                {application.applied_date ? (
                  <span>Applied: {new Date(application.applied_date).toLocaleDateString()}</span>
                ) : null}
              </div>
            </Link>
          ))}
          {applications.length === 0 ? (
            <div className="col-span-full text-center py-12" style={{ color: 'hsl(var(--muted-foreground))' }}>
              No applications yet. Start by finding funds to apply to.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
