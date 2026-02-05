import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Applications</h1>
          <p>Track the status of your fundraising applications.</p>
        </div>
        <Link className="btn ghost" to="/app/funds">
          Find new funds
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading applications...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid">
          {applications.map((application) => (
            <Link key={application.id} to={`/app/applications/${application.id}`} className="data-card">
              <span className="data-eyebrow">Application</span>
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
        </div>
      ) : null}
    </section>
  )
}
