import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import type { FeedEvent } from '../types/feed'

const applicationStatuses = [
  'draft',
  'applied',
  'under_review',
  'shortlisted',
  'pitch_scheduled',
  'pitch_completed',
  'due_diligence',
  'term_sheet',
  'negotiating',
  'accepted',
  'rejected',
  'withdrawn',
  'on_hold',
]

export function AdminModerationPage() {
  const { pushToast } = useToast()
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [eventType, setEventType] = useState('')
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [eventTypesLoading, setEventTypesLoading] = useState(true)
  const [eventTypesError, setEventTypesError] = useState<string | null>(null)

  const [userId, setUserId] = useState('')
  const [userAction, setUserAction] = useState('suspend')

  const [fundId, setFundId] = useState('')
  const [fundAction, setFundAction] = useState('deactivate')

  const [applicationId, setApplicationId] = useState('')
  const [applicationStatus, setApplicationStatus] = useState('under_review')
  const [applicationNotes, setApplicationNotes] = useState('')

  const hasUserId = userId.trim().length > 0
  const hasFundId = fundId.trim().length > 0
  const hasApplicationId = applicationId.trim().length > 0

  const feedQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', '1')
    if (eventType) params.set('event_type', eventType)
    return params.toString()
  }, [eventType])

  useEffect(() => {
    let cancelled = false
    const loadEventTypes = async () => {
      setEventTypesLoading(true)
      setEventTypesError(null)
      try {
        const data = await apiRequest<FeedEvent[] | { results: FeedEvent[] }>('/feed/?page=1')
        const list = normalizeList(data)
        const types = Array.from(
          new Set(
            list
              .map((item) => item.event_type)
              .filter((value): value is string => Boolean(value))
          )
        ).sort((a, b) => a.localeCompare(b))
        if (!cancelled) {
          setEventTypes(types)
        }
      } catch {
        if (!cancelled) {
          setEventTypesError('Unable to load event types.')
        }
      } finally {
        if (!cancelled) {
          setEventTypesLoading(false)
        }
      }
    }
    void loadEventTypes()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadFeed = async () => {
      setFeedLoading(true)
      setFeedError(null)
      try {
        const data = await apiRequest<FeedEvent[] | { results: FeedEvent[] }>(`/feed/?${feedQuery}`)
        const list = normalizeList(data)
        if (!cancelled) {
          setFeedEvents(list)
        }
      } catch {
        if (!cancelled) {
          setFeedError('Unable to load feed events.')
        }
      } finally {
        if (!cancelled) {
          setFeedLoading(false)
        }
      }
    }
    void loadFeed()
    return () => {
      cancelled = true
    }
  }, [feedQuery])

  const moderate = async (type: string, id: string, payload: Record<string, unknown>) => {
    const targetId = id.trim()
    if (!targetId) {
      pushToast('Enter a valid ID before applying moderation.', 'warning')
      return
    }
    try {
      await apiRequest(`/admin/moderate/${type}/${targetId}/`, { method: 'POST', body: payload })
      pushToast('Moderation action applied', 'success')
    } catch {
      pushToast('Moderation action failed', 'error')
    }
  }

  return (
    <section className="content-section admin-moderation-page">
      <header className="content-header">
        <div>
          <h1>Moderation</h1>
          <p>Review feed events and enforce platform policies.</p>
        </div>
        <div className="data-actions">
          <Link className="btn ghost" to="/app/admin">
            Back to admin
          </Link>
        </div>
      </header>

      <div className="admin-filter-bar">
        <label>
          Filter feed event type
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            disabled={eventTypesLoading || Boolean(eventTypesError)}
          >
            <option value="">
              {eventTypesLoading ? 'Loading types…' : 'All types'}
            </option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>

      {eventTypesError ? <div className="form-error">{eventTypesError}</div> : null}
      {feedLoading ? <div className="page-loader">Loading feed events...</div> : null}
      {feedError ? <div className="form-error">{feedError}</div> : null}

      {!feedLoading && !feedError ? (
        <div className="moderation-grid">
          {feedEvents.map((event) => (
            <article key={event.id} className="data-card moderation-card">
              <div className="data-meta">
                <span>{event.event_type}</span>
                {event.is_pinned ? <span>pinned</span> : null}
              </div>
              <h3>{event.title || 'Feed event'}</h3>
              <p>{event.content || ''}</p>
              <div className="data-meta">
                {event.created_at ? <span>{new Date(event.created_at).toLocaleDateString()}</span> : null}
                {event.author?.full_name ? <span>by {event.author.full_name}</span> : null}
              </div>
              <div className="data-actions">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => void moderate('feed', event.id, { action: event.is_pinned ? 'unpin' : 'pin' })}
                >
                  {event.is_pinned ? 'Unpin' : 'Pin'}
                </button>
                <button className="btn ghost" type="button" onClick={() => void moderate('feed', event.id, { action: 'delete' })}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="moderation-actions">
        <div className="admin-card">
          <header>
            <h2>User actions</h2>
            <p>Suspend, activate, or delete a user.</p>
          </header>
          <div className="admin-form">
            <label>
              User ID
              <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID" />
            </label>
            <label>
              Action
              <select value={userAction} onChange={(event) => setUserAction(event.target.value)}>
                <option value="suspend">Suspend</option>
                <option value="activate">Activate</option>
                <option value="delete">Delete</option>
              </select>
            </label>
            <button
              className="btn primary"
              type="button"
              onClick={() => void moderate('user', userId, { action: userAction })}
              disabled={!hasUserId}
            >
              Apply
            </button>
          </div>
        </div>

        <div className="admin-card">
          <header>
            <h2>Fund actions</h2>
            <p>Activate or feature funding opportunities.</p>
          </header>
          <div className="admin-form">
            <label>
              Fund ID
              <input value={fundId} onChange={(event) => setFundId(event.target.value)} placeholder="UUID" />
            </label>
            <label>
              Action
              <select value={fundAction} onChange={(event) => setFundAction(event.target.value)}>
                <option value="activate">Activate</option>
                <option value="deactivate">Deactivate</option>
                <option value="feature">Feature</option>
                <option value="unfeature">Unfeature</option>
                <option value="sponsor">Sponsor</option>
                <option value="unsponsor">Unsponsor</option>
              </select>
            </label>
            <button
              className="btn primary"
              type="button"
              onClick={() => void moderate('fund', fundId, { action: fundAction })}
              disabled={!hasFundId}
            >
              Apply
            </button>
          </div>
        </div>

        <div className="admin-card">
          <header>
            <h2>Application actions</h2>
            <p>Override application status with audit trail.</p>
          </header>
          <div className="admin-form">
            <label>
              Application ID
              <input value={applicationId} onChange={(event) => setApplicationId(event.target.value)} placeholder="UUID" />
            </label>
            <label>
              Status
              <select value={applicationStatus} onChange={(event) => setApplicationStatus(event.target.value)}>
                {applicationStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <input value={applicationNotes} onChange={(event) => setApplicationNotes(event.target.value)} placeholder="Optional" />
            </label>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                void moderate('application', applicationId, {
                  action: 'status',
                  status: applicationStatus,
                  notes: applicationNotes,
                })
              }
              disabled={!hasApplicationId}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
