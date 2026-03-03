import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import type { ApplicationDetail } from '../types/application'

export function ApplicationDetailPage() {
  const { id } = useParams()
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<ApplicationDetail>(`/applications/${id}/`)
        if (!cancelled) {
          setApplication(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load application details.')
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
  }, [id])

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>{application?.fund_name ?? 'Application'}</h1>
          <p>{application?.startup_name ?? 'Startup application details.'}</p>
        </div>
        <Link className="btn ghost" to="/app/applications">
          Back to applications
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading application...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {application ? (
        <div className="content-card">
          <div className="detail-grid">
            <div>
              <span className="data-eyebrow">Status</span>
              <p>{application.status ?? 'Unknown'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Applied date</span>
              <p>
                {application.applied_date ? new Date(application.applied_date).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>

          {application.notes ? (
            <div>
              <span className="data-eyebrow">Notes</span>
              <p>{application.notes}</p>
            </div>
          ) : null}

          {application.status_history && application.status_history.length > 0 ? (
            <div>
              <span className="data-eyebrow">Status history</span>
              <ul className="timeline">
                {application.status_history.map((item) => (
                  <li key={item.id}>
                    <span>{item.new_status ?? 'Status updated'}</span>
                    <span className="timeline-meta">
                      {item.changed_by_name ? `${item.changed_by_name} · ` : ''}
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                    </span>
                    {item.notes ? <p>{item.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {application.reminders && application.reminders.length > 0 ? (
            <div>
              <span className="data-eyebrow">Reminders</span>
              <ul className="timeline">
                {application.reminders.map((reminder) => (
                  <li key={reminder.id}>
                    <span>{reminder.title}</span>
                    <span className="timeline-meta">
                      {reminder.due_date ? `Due ${new Date(reminder.due_date).toLocaleDateString()}` : ''}
                    </span>
                    {reminder.description ? <p>{reminder.description}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
