import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, Pin, PinOff, Trash2, UserCog, Landmark, FileText } from 'lucide-react'
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
    <div data-testid="admin-moderation-page">
      <Link className="back-btn" to="/app/admin">
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Admin
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Moderation</h1>
          <p className="page-description">Review feed events and enforce platform policies.</p>
        </div>
      </div>

      {/* Feed Events Section */}
      <div className="section">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Feed Events</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                className="select"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
                disabled={eventTypesLoading || Boolean(eventTypesError)}
                style={{ width: '200px' }}
              >
                <option value="">
                  {eventTypesLoading ? 'Loading types...' : 'All types'}
                </option>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {eventTypesError && <p style={{ color: '#ef4444', fontSize: '0.875rem', padding: '0 1rem' }}>{eventTypesError}</p>}

          {feedLoading && (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <Shield className="empty-icon" strokeWidth={1.5} />
              <p className="empty-description">Loading feed events...</p>
            </div>
          )}
          {feedError && <div className="empty-state" style={{ padding: '2rem 0' }}><p className="empty-description" style={{ color: '#ef4444' }}>{feedError}</p></div>}

          {!feedLoading && !feedError && (
            <>
              {feedEvents.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <Shield className="empty-icon" strokeWidth={1.5} />
                  <h3 className="empty-title">No feed events</h3>
                  <p className="empty-description">No events match the current filter.</p>
                </div>
              ) : (
                <table className="data-table" data-testid="moderation-feed-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Author</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedEvents.map((event) => (
                      <tr key={event.id} data-testid={`feed-event-row-${event.id}`}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{event.title || 'Feed event'}</div>
                          {event.content && (
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.125rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {event.content}
                            </div>
                          )}
                        </td>
                        <td><span className="tag">{event.event_type || '—'}</span></td>
                        <td>{event.author?.full_name || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                          {event.created_at ? new Date(event.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {event.is_pinned ? <span className="badge info">Pinned</span> : null}
                        </td>
                        <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-sm ghost"
                            type="button"
                            onClick={() => void moderate('feed', event.id, { action: event.is_pinned ? 'unpin' : 'pin' })}
                          >
                            {event.is_pinned ? <PinOff size={14} strokeWidth={1.5} /> : <Pin size={14} strokeWidth={1.5} />}
                            {event.is_pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button className="btn-sm ghost" type="button" onClick={() => void moderate('feed', event.id, { action: 'delete' })}>
                            <Trash2 size={14} strokeWidth={1.5} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {/* Moderation Action Cards */}
      <div className="grid-3">
        {/* User Actions */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCog size={16} strokeWidth={1.5} />
              User Actions
            </h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>Suspend, activate, or delete a user.</p>
          <div className="form-group">
            <label>User ID</label>
            <input className="input" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID" />
          </div>
          <div className="form-group">
            <label>Action</label>
            <select className="select" value={userAction} onChange={(event) => setUserAction(event.target.value)}>
              <option value="suspend">Suspend</option>
              <option value="activate">Activate</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <button
            className="btn-sm primary"
            type="button"
            onClick={() => void moderate('user', userId, { action: userAction })}
            disabled={!hasUserId}
          >
            Apply
          </button>
        </div>

        {/* Fund Actions */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Landmark size={16} strokeWidth={1.5} />
              Fund Actions
            </h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>Activate or feature funding opportunities.</p>
          <div className="form-group">
            <label>Fund ID</label>
            <input className="input" value={fundId} onChange={(event) => setFundId(event.target.value)} placeholder="UUID" />
          </div>
          <div className="form-group">
            <label>Action</label>
            <select className="select" value={fundAction} onChange={(event) => setFundAction(event.target.value)}>
              <option value="activate">Activate</option>
              <option value="deactivate">Deactivate</option>
              <option value="feature">Feature</option>
              <option value="unfeature">Unfeature</option>
              <option value="sponsor">Sponsor</option>
              <option value="unsponsor">Unsponsor</option>
            </select>
          </div>
          <button
            className="btn-sm primary"
            type="button"
            onClick={() => void moderate('fund', fundId, { action: fundAction })}
            disabled={!hasFundId}
          >
            Apply
          </button>
        </div>

        {/* Application Actions */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} strokeWidth={1.5} />
              Application Actions
            </h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>Override application status with audit trail.</p>
          <div className="form-group">
            <label>Application ID</label>
            <input className="input" value={applicationId} onChange={(event) => setApplicationId(event.target.value)} placeholder="UUID" />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="select" value={applicationStatus} onChange={(event) => setApplicationStatus(event.target.value)}>
              {applicationStatuses.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input className="input" value={applicationNotes} onChange={(event) => setApplicationNotes(event.target.value)} placeholder="Optional" />
          </div>
          <button
            className="btn-sm primary"
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
  )
}
