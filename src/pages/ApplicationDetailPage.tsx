/**
 * /app/applications/:id — single application detail.
 *
 * Previously this page only rendered fields that had content, so a fresh
 * draft application (no notes, no status_history, no reminders) collapsed
 * to a near-empty card and looked broken. Now every field renders with
 * an em-dash placeholder for nulls, and the founder can edit notes and
 * change status inline.
 *
 * The page does NOT expose reminder creation — that flow lives on the
 * applications list page. Status changes go through /applications/<id>/status/
 * so the backend writes a row to ApplicationStatusHistory (the audit
 * trail timeline rendered below).
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, ExternalLink, Loader2, Pencil, Save, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { DetailPageSkeleton } from '../components/skeletons'
import type { ApplicationDetail } from '../types/application'
import { buildProfileUrl } from '../lib/slugId'

// Mirrors Application.Status in ff_backend/founders/applications/models.py.
// Keep in sync if the backend enum changes.
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'applied', label: 'Applied' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'pitch_scheduled', label: 'Pitch Scheduled' },
  { value: 'pitch_completed', label: 'Pitch Completed' },
  { value: 'due_diligence', label: 'Due Diligence' },
  { value: 'term_sheet', label: 'Term Sheet' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'on_hold', label: 'On Hold' },
]

function statusLabel(value?: string | null): string {
  if (!value) return '—'
  return STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value
}

function formatDate(iso?: string | null, includeTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return includeTime
    ? d.toLocaleString()
    : d.toLocaleDateString()
}

export function ApplicationDetailPage() {
  const { id } = useParams()
  const { pushToast } = useToast()
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inline notes editing — load the server value into the draft when the
  // user clicks the pencil; revert on cancel; PATCH on save.
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Status update — a separate endpoint that also writes a history row.
  // We keep the picker open below the status line so the user can do
  // multiple updates without a modal round-trip.
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const [statusNotesDraft, setStatusNotesDraft] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

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
          setNotesDraft(data.notes ?? '')
          setStatusDraft(data.status ?? 'draft')
        }
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as { status?: number }
          setError(
            apiErr?.status === 404
              ? 'Application not found, or you don\'t have access to it.'
              : 'Unable to load application details.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  const handleSaveNotes = async () => {
    if (!application) return
    setSavingNotes(true)
    try {
      const updated = await apiRequest<ApplicationDetail>(`/applications/${application.id}/`, {
        method: 'PATCH',
        body: { notes: notesDraft },
      })
      setApplication(updated)
      setEditingNotes(false)
      pushToast('Notes saved', 'success')
    } catch (err) {
      const apiErr = err as { details?: { detail?: string }; message?: string }
      pushToast(apiErr?.details?.detail ?? apiErr?.message ?? 'Failed to save notes', 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleSaveStatus = async () => {
    if (!application) return
    setSavingStatus(true)
    try {
      await apiRequest(`/applications/${application.id}/status/`, {
        method: 'PATCH',
        body: { status: statusDraft, status_notes: statusNotesDraft },
      })
      // The status endpoint returns the partial-update shape; refetch the
      // detail so status_history picks up the new row we just created.
      const fresh = await apiRequest<ApplicationDetail>(`/applications/${application.id}/`)
      setApplication(fresh)
      setEditingStatus(false)
      setStatusNotesDraft('')
      pushToast('Status updated', 'success')
    } catch (err) {
      const apiErr = err as { details?: { detail?: string }; message?: string }
      pushToast(apiErr?.details?.detail ?? apiErr?.message ?? 'Failed to update status', 'error')
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) {
    return (
      <section className="content-section">
        <DetailPageSkeleton />
      </section>
    )
  }

  if (error || !application) {
    return (
      <section className="content-section" style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <header className="content-header">
          <h1>Application</h1>
          <Link className="btn ghost" to="/app/applications">Back to applications</Link>
        </header>
        <div className="form-error" style={{ marginTop: '1rem' }}>{error ?? 'Application unavailable.'}</div>
      </section>
    )
  }

  return (
    <section className="content-section" style={{ maxWidth: '48rem', margin: '0 auto' }}>
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="data-eyebrow">Application</span>
          </div>
          <h1 data-testid="application-detail-fund-name">{application.fund_name ?? 'Untitled fund'}</h1>
          <p>
            From{' '}
            <Link
              to={buildProfileUrl('startups', application.startup_name, application.startup)}
              style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
              data-testid="application-detail-startup-link"
            >
              {application.startup_name ?? 'your startup'}
            </Link>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Primary CTA: re-open the external application page. Founders
              often come back days later to check status / continue a
              partially-filled form; the link belongs in the header where
              it's findable, not buried in the meta grid below. */}
          {application.fund_application_link ? (
            <a
              href={application.fund_application_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn primary"
              data-testid="application-opportunity-link"
            >
              <ExternalLink size={14} />
              Open opportunity
            </a>
          ) : null}
          <Link className="btn ghost" to="/app/applications">Back</Link>
        </div>
      </header>

      <div className="content-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Status row — clicking edit opens the picker + status_notes input
            inline. Save calls the dedicated /status/ endpoint so the
            history timeline below gets a new row. */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div>
              <span className="data-eyebrow">Status</span>
              <p data-testid="application-detail-status" style={{ fontSize: '1rem', fontWeight: 500, marginTop: 2 }}>
                {statusLabel(application.status)}
              </p>
            </div>
            {!editingStatus ? (
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => {
                  setStatusDraft(application.status ?? 'draft')
                  setStatusNotesDraft('')
                  setEditingStatus(true)
                }}
                data-testid="application-edit-status"
              >
                <Pencil className="w-3.5 h-3.5" /> Update
              </button>
            ) : null}
          </div>
          {editingStatus ? (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select
                className="input"
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value)}
                data-testid="application-status-select"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <textarea
                className="input"
                rows={2}
                placeholder="Note about this status change (optional)"
                value={statusNotesDraft}
                onChange={(e) => setStatusNotesDraft(e.target.value)}
                style={{ resize: 'vertical' }}
                data-testid="application-status-notes"
                maxLength={500}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={() => setEditingStatus(false)}
                  disabled={savingStatus}
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  type="button"
                  className="btn-sm primary"
                  onClick={() => void handleSaveStatus()}
                  disabled={savingStatus || statusDraft === application.status}
                  data-testid="application-status-save"
                >
                  {savingStatus ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><Save size={12} /> Save</>}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Key meta — always rendered, em-dash placeholder for nulls. */}
        <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <span className="data-eyebrow">Applied date</span>
            <p style={{ marginTop: 2 }}>
              <Calendar size={12} style={{ display: 'inline', marginRight: 4, opacity: 0.6 }} />
              {formatDate(application.applied_date)}
            </p>
          </div>
          <div>
            <span className="data-eyebrow">Created</span>
            <p style={{ marginTop: 2 }}>{formatDate(application.created_at, true)}</p>
          </div>
          <div>
            <span className="data-eyebrow">Last updated</span>
            <p style={{ marginTop: 2 }}>{formatDate(application.updated_at, true)}</p>
          </div>
          <div>
            <span className="data-eyebrow">Fund page</span>
            <p style={{ marginTop: 2 }}>
              <Link
                to={`/app/funds/${application.fund}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                data-testid="application-detail-fund-link"
              >
                {application.fund_name ?? 'Open fund'} <ExternalLink size={11} />
              </Link>
            </p>
          </div>
          {application.fund_deadline ? (
            <div>
              <span className="data-eyebrow">Deadline</span>
              <p style={{ marginTop: 2 }}>
                <Calendar size={12} style={{ display: 'inline', marginRight: 4, opacity: 0.6 }} />
                {formatDate(application.fund_deadline)}
              </p>
            </div>
          ) : null}
          {application.fund_application_link ? (
            <div>
              <span className="data-eyebrow">Apply URL</span>
              <p style={{ marginTop: 2 }}>
                <a
                  href={application.fund_application_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, wordBreak: 'break-all' }}
                  data-testid="application-detail-apply-url"
                >
                  Application page <ExternalLink size={11} />
                </a>
              </p>
            </div>
          ) : null}
          {application.fund_website_url ? (
            <div>
              <span className="data-eyebrow">Fund website</span>
              <p style={{ marginTop: 2 }}>
                <a
                  href={application.fund_website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, wordBreak: 'break-all' }}
                  data-testid="application-detail-fund-website"
                >
                  Open website <ExternalLink size={11} />
                </a>
              </p>
            </div>
          ) : null}
        </div>

        {/* Notes — always rendered, edit inline. */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span className="data-eyebrow">Notes</span>
            {!editingNotes ? (
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => {
                  setNotesDraft(application.notes ?? '')
                  setEditingNotes(true)
                }}
                data-testid="application-edit-notes"
              >
                <Pencil className="w-3.5 h-3.5" /> {application.notes ? 'Edit' : 'Add'}
              </button>
            ) : null}
          </div>
          {editingNotes ? (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <textarea
                className="input"
                rows={4}
                placeholder="Private notes about this application (e.g. partner contact, internal context, next steps)…"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                style={{ resize: 'vertical' }}
                data-testid="application-notes-input"
                maxLength={2000}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={() => setEditingNotes(false)}
                  disabled={savingNotes}
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  type="button"
                  className="btn-sm primary"
                  onClick={() => void handleSaveNotes()}
                  disabled={savingNotes || notesDraft === (application.notes ?? '')}
                  data-testid="application-notes-save"
                >
                  {savingNotes ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><Save size={12} /> Save</>}
                </button>
              </div>
            </div>
          ) : (
            <p
              style={{
                marginTop: 4,
                fontSize: '0.9375rem',
                color: application.notes ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontStyle: application.notes ? 'normal' : 'italic',
              }}
              data-testid="application-detail-notes"
            >
              {application.notes || 'No notes yet — use the Edit button above to add context for this application.'}
            </p>
          )}
        </div>

        {/* Status timeline — populated by status updates. Empty on a fresh
            draft, so we show a small hint instead of just hiding it. */}
        <div>
          <span className="data-eyebrow">Status history</span>
          {application.status_history && application.status_history.length > 0 ? (
            <ul className="timeline" style={{ marginTop: 6 }}>
              {application.status_history.map((item) => (
                <li key={item.id}>
                  <span style={{ fontWeight: 500 }}>
                    {statusLabel(item.old_status)} → {statusLabel(item.new_status)}
                  </span>
                  <span className="timeline-meta" style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                    {item.changed_by_name ? `${item.changed_by_name} · ` : ''}
                    {formatDate(item.created_at, true)}
                  </span>
                  {item.notes ? <p style={{ marginTop: 4, fontSize: '0.875rem' }}>{item.notes}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ marginTop: 4, fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
              No status changes yet. Use Update above to advance this application.
            </p>
          )}
        </div>

        {/* Reminders — read-only here. Creating a reminder lives on the
            applications list page where the cross-application context
            (due-soon view, overdue counts) makes more sense. */}
        <div>
          <span className="data-eyebrow">Reminders</span>
          {application.reminders && application.reminders.length > 0 ? (
            <ul className="timeline" style={{ marginTop: 6 }}>
              {application.reminders.map((reminder) => (
                <li key={reminder.id}>
                  <span style={{ fontWeight: 500 }}>{reminder.title}</span>
                  <span className="timeline-meta" style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                    {reminder.due_date ? `Due ${formatDate(reminder.due_date)}` : 'No due date'}
                    {reminder.status ? ` · ${reminder.status}` : ''}
                  </span>
                  {reminder.description ? <p style={{ marginTop: 4, fontSize: '0.875rem' }}>{reminder.description}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ marginTop: 4, fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
              No reminders yet.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default ApplicationDetailPage
