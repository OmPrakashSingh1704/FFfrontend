/**
 * Invitations + join requests — unified across both flows.
 *
 * Three tabs grouped by direction-of-flow / decision state, NOT by
 * record type. Each tab mixes invitations and join requests:
 *
 *   Sent     — outgoing things waiting on someone else
 *              ╴ invitations I sent (or that any of my startups sent)
 *              ╴ join requests I sent
 *              Actions: Cancel (invitation) | Withdraw (join request)
 *
 *   Received — incoming things waiting on me
 *              ╴ invitations sent to me
 *              ╴ join requests sent to one of my startups
 *              Actions: Accept / Decline (invitation) |
 *                       Review → deep-link to startup detail (join request,
 *                       since approving needs role + title pickers)
 *
 *   Verdict  — historical / decided across all four categories.
 *              Read-only with the resolved status badge. Status filter
 *              is "all except pending" — accepted, declined, cancelled,
 *              expired, approved, rejected, withdrawn.
 *
 * Each row carries a `kind` discriminator so the renderer knows which
 * action affordance to draw without sniffing fields.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Clock,
  Gavel,
  Inbox,
  Loader2,
  Send,
  UserPlus,
  X,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { formatLabel } from '../lib/format'
import { buildProfileUrl } from '../lib/slugId'

type Invitation = {
  id: string
  startup_id: string
  startup_name: string
  inviter_id?: string
  inviter_name?: string
  inviter_email?: string
  invitee_id?: string
  invitee_name?: string
  invitee_email?: string
  role: string
  status: string
  message?: string
  is_expired?: boolean
  expires_at?: string
  created_at?: string
}

type JoinRequest = {
  id: string
  startup_id: string
  startup_name: string
  requester_id?: string
  requester_name?: string
  requester_email?: string
  // `role` is no longer carried on the join-request payload — the founder
  // picks the position at approval time (see the approve modal below).
  status: string
  message?: string
  created_at?: string
}

// Same role enum the backend accepts on /members/<id>/ PATCH and on the
// approve action. Keep in sync with StartupMember.Role in
// ff_backend/founders/models.py.
const MEMBER_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'founder', label: 'Founder' },
  { value: 'co_founder', label: 'Co-Founder' },
  { value: 'executive', label: 'Executive' },
  { value: 'investor', label: 'Investor' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'employee', label: 'Employee' },
]

/**
 * Render a user's name as a Link to /app/users/<id> when we have their
 * id, or as plain text when we don't. UserRedirectPage handles the
 * founder-vs-investor resolution and bounces to the canonical profile
 * URL. Falls back to email when the name is unknown.
 */
function UserNameLink({
  userId,
  name,
  email,
}: {
  userId?: string
  name?: string
  email?: string
}) {
  const label = name ?? email ?? 'Unknown'
  if (!userId) {
    return <>{label}</>
  }
  return (
    <Link
      to={`/app/users/${userId}`}
      style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, textDecorationColor: 'hsl(var(--muted-foreground))' }}
      data-testid={`profile-link-${userId}`}
    >
      {label}
    </Link>
  )
}

type Tab = 'sent' | 'received' | 'verdict'

// Unified row: a tagged union so the renderer can pattern-match on
// `kind` to pick the right title, subtitle, and action UI. The four
// `kind` values map 1:1 to the four endpoints we fetch.
type Row =
  | { kind: 'invitation-out'; data: Invitation }
  | { kind: 'invitation-in'; data: Invitation }
  | { kind: 'request-out'; data: JoinRequest }
  | { kind: 'request-in'; data: JoinRequest }

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

type StatusToneEntry = { color: string; bg: string }

const STATUS_TONES: Record<string, StatusToneEntry> = {
  accepted: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
  approved: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
  declined: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  rejected: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  cancelled: { color: '#a1a1a1', bg: 'rgba(161, 161, 161, 0.15)' },
  withdrawn: { color: '#a1a1a1', bg: 'rgba(161, 161, 161, 0.15)' },
  expired: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  pending: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.pending
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'capitalize',
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.color}33`,
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function InvitationsPage() {
  const { pushToast } = useToast()
  const [tab, setTab] = useState<Tab>('received')

  // Pending lists (drive Sent + Received tabs).
  const [invitationsIn, setInvitationsIn] = useState<Invitation[]>([])
  const [requestsOut, setRequestsOut] = useState<JoinRequest[]>([])
  const [invitationsOut, setInvitationsOut] = useState<Invitation[]>([])
  const [requestsIn, setRequestsIn] = useState<JoinRequest[]>([])

  // Verdict tab — everything non-pending across all four sources. Cached
  // as a flat list of typed rows so the render layer doesn't need to
  // re-sort or re-tag on every render.
  const [verdictRows, setVerdictRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  // Approve-request modal state — the founder picks role + title at
  // approval time. Mirrors the modal on PublicStartupPage so the two
  // surfaces behave identically. Stays null when closed.
  const [approveModal, setApproveModal] = useState<{ req: JoinRequest } | null>(null)
  const [approveRole, setApproveRole] = useState<string>('employee')
  const [approveTitle, setApproveTitle] = useState<string>('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Eight requests in parallel: 4 endpoints × 2 status modes
      // (pending for the Sent + Received tabs, all for the Verdict tab).
      // allSettled keeps the page useful when only one endpoint hiccups
      // (e.g. founder-side aggregates return empty for a non-member).
      const [pIn, pReqOut, pOut, pReqIn, vIn, vReqOut, vOut, vReqIn] =
        await Promise.allSettled([
          apiRequest<Invitation[] | { results: Invitation[] }>('/founders/invitations/?status=pending'),
          apiRequest<JoinRequest[] | { results: JoinRequest[] }>('/founders/my-join-requests/?status=pending'),
          apiRequest<Invitation[] | { results: Invitation[] }>('/founders/sent-invitations/?status=pending'),
          apiRequest<JoinRequest[] | { results: JoinRequest[] }>('/founders/incoming-join-requests/?status=pending'),
          apiRequest<Invitation[] | { results: Invitation[] }>('/founders/invitations/?status=all'),
          apiRequest<JoinRequest[] | { results: JoinRequest[] }>('/founders/my-join-requests/?status=all'),
          apiRequest<Invitation[] | { results: Invitation[] }>('/founders/sent-invitations/?status=all'),
          apiRequest<JoinRequest[] | { results: JoinRequest[] }>('/founders/incoming-join-requests/?status=all'),
        ])

      if (pIn.status === 'fulfilled') setInvitationsIn(normalizeList(pIn.value))
      if (pReqOut.status === 'fulfilled') setRequestsOut(normalizeList(pReqOut.value))
      if (pOut.status === 'fulfilled') setInvitationsOut(normalizeList(pOut.value))
      if (pReqIn.status === 'fulfilled') setRequestsIn(normalizeList(pReqIn.value))

      // Build the verdict list — concat all four sources, drop pending
      // (already represented in the other two tabs), tag with kind so
      // the renderer can show the right "who/what" framing per row.
      const rows: Row[] = []
      if (vIn.status === 'fulfilled') {
        for (const r of normalizeList(vIn.value) as Invitation[]) {
          if (r.status !== 'pending') rows.push({ kind: 'invitation-in', data: r })
        }
      }
      if (vReqOut.status === 'fulfilled') {
        for (const r of normalizeList(vReqOut.value) as JoinRequest[]) {
          if (r.status !== 'pending') rows.push({ kind: 'request-out', data: r })
        }
      }
      if (vOut.status === 'fulfilled') {
        for (const r of normalizeList(vOut.value) as Invitation[]) {
          if (r.status !== 'pending') rows.push({ kind: 'invitation-out', data: r })
        }
      }
      if (vReqIn.status === 'fulfilled') {
        for (const r of normalizeList(vReqIn.value) as JoinRequest[]) {
          if (r.status !== 'pending') rows.push({ kind: 'request-in', data: r })
        }
      }
      // Sort newest-first across all categories using created_at.
      rows.sort((a, b) => {
        const ta = a.data.created_at ? new Date(a.data.created_at).getTime() : 0
        const tb = b.data.created_at ? new Date(b.data.created_at).getTime() : 0
        return tb - ta
      })
      setVerdictRows(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // --- Action handlers (each scoped to one tab) -------------------------

  const respond = async (id: string, action: 'accept' | 'decline') => {
    setActionId(id)
    try {
      await apiRequest(`/founders/invitations/${id}/respond/`, {
        method: 'POST',
        body: { action },
      })
      setInvitationsIn((prev) => prev.filter((i) => i.id !== id))
      pushToast(action === 'accept' ? 'Invitation accepted' : 'Invitation declined', 'success')
    } catch (err) {
      const e = err as { details?: { detail?: string } }
      pushToast(e.details?.detail ?? 'Failed to respond.', 'error')
    } finally {
      setActionId(null)
    }
  }

  const withdraw = async (id: string) => {
    if (!window.confirm('Withdraw this join request?')) return
    setActionId(id)
    try {
      await apiRequest(`/founders/my-join-requests/${id}/`, { method: 'DELETE' })
      setRequestsOut((prev) => prev.filter((j) => j.id !== id))
      pushToast('Request withdrawn', 'success')
    } catch (err) {
      const e = err as { details?: { detail?: string } }
      pushToast(e.details?.detail ?? 'Failed to withdraw.', 'error')
    } finally {
      setActionId(null)
    }
  }

  const cancelSentInvite = async (inv: Invitation) => {
    if (!window.confirm(`Cancel the invitation to ${inv.invitee_name ?? inv.invitee_email ?? 'this user'}?`)) return
    setActionId(inv.id)
    try {
      await apiRequest(`/founders/startups/${inv.startup_id}/invitations/${inv.id}/`, {
        method: 'DELETE',
      })
      setInvitationsOut((prev) => prev.filter((i) => i.id !== inv.id))
      pushToast('Invitation cancelled', 'success')
    } catch (err) {
      const e = err as { details?: { detail?: string } }
      pushToast(e.details?.detail ?? 'Failed to cancel.', 'error')
    } finally {
      setActionId(null)
    }
  }

  // Approve flow is now two-step: clicking Approve opens a modal where
  // the founder picks the position. The requester no longer proposes a
  // role — see the JoinRequest type comment above. The backend rejects
  // anything outside the role enum with 400.
  const openApproveModal = (req: JoinRequest) => {
    setApproveRole('employee')
    setApproveTitle('')
    setApproveModal({ req })
  }

  const submitApprove = async () => {
    if (!approveModal) return
    const { req } = approveModal
    setActionId(req.id)
    try {
      await apiRequest(`/founders/startups/${req.startup_id}/join-requests/${req.id}/review/`, {
        method: 'POST',
        body: { action: 'approve', role: approveRole, title: approveTitle },
      })
      setRequestsIn((prev) => prev.filter((r) => r.id !== req.id))
      setApproveModal(null)
      pushToast(`${req.requester_name ?? 'Member'} added to ${req.startup_name}`, 'success')
      // Refresh so the row reappears under Verdict with status=approved
      // and the "Manage team" deep-link becomes available there.
      void refresh()
    } catch (err) {
      const e = err as { details?: { detail?: string } }
      pushToast(e.details?.detail ?? 'Failed to approve.', 'error')
    } finally {
      setActionId(null)
    }
  }

  const rejectRequest = async (req: JoinRequest) => {
    if (!window.confirm(`Reject ${req.requester_name ?? 'this request'}?`)) return
    setActionId(req.id)
    try {
      await apiRequest(`/founders/startups/${req.startup_id}/join-requests/${req.id}/review/`, {
        method: 'POST',
        body: { action: 'reject' },
      })
      setRequestsIn((prev) => prev.filter((r) => r.id !== req.id))
      pushToast('Request rejected', 'success')
    } catch (err) {
      const e = err as { details?: { detail?: string } }
      pushToast(e.details?.detail ?? 'Failed to reject.', 'error')
    } finally {
      setActionId(null)
    }
  }

  // --- Derived counts for the tab strip ---------------------------------

  const sentCount = invitationsOut.length + requestsOut.length
  const receivedCount = invitationsIn.length + requestsIn.length
  const verdictCount = verdictRows.length

  // --- Composed lists for the Sent and Received tabs --------------------

  const sentRows: Row[] = useMemo(
    () => [
      ...invitationsOut.map((d) => ({ kind: 'invitation-out' as const, data: d })),
      ...requestsOut.map((d) => ({ kind: 'request-out' as const, data: d })),
    ].sort((a, b) => {
      const ta = a.data.created_at ? new Date(a.data.created_at).getTime() : 0
      const tb = b.data.created_at ? new Date(b.data.created_at).getTime() : 0
      return tb - ta
    }),
    [invitationsOut, requestsOut],
  )

  const receivedRows: Row[] = useMemo(
    () => [
      ...invitationsIn.map((d) => ({ kind: 'invitation-in' as const, data: d })),
      ...requestsIn.map((d) => ({ kind: 'request-in' as const, data: d })),
    ].sort((a, b) => {
      const ta = a.data.created_at ? new Date(a.data.created_at).getTime() : 0
      const tb = b.data.created_at ? new Date(b.data.created_at).getTime() : 0
      return tb - ta
    }),
    [invitationsIn, requestsIn],
  )

  // --- Per-row renderer (used by all three tabs) ------------------------

  const renderRow = (row: Row, withActions: boolean) => {
    switch (row.kind) {
      case 'invitation-in': {
        const inv = row.data
        return (
          <article key={`ii-${inv.id}`} className="card" data-testid={`row-invitation-in-${inv.id}`}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Invited to
                  </span>
                  <Link to={buildProfileUrl('startups', inv.startup_name, inv.startup_id)} style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
                    {inv.startup_name}
                  </Link>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>· {formatLabel(inv.role)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                  By <strong style={{ color: 'hsl(var(--foreground))' }}>
                    <UserNameLink userId={inv.inviter_id} name={inv.inviter_name} email={inv.inviter_email} />
                  </strong>
                  {inv.created_at ? ` · ${relativeTime(inv.created_at)}` : ''}
                </div>
                {inv.message ? <MessageBlock>{inv.message}</MessageBlock> : null}
                {inv.is_expired && withActions ? (
                  <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> Expired
                  </div>
                ) : null}
                {!withActions ? <div style={{ marginTop: 6 }}><StatusBadge status={inv.status} /></div> : null}
              </div>
              {withActions && !inv.is_expired ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn-sm primary"
                    disabled={actionId === inv.id}
                    onClick={() => void respond(inv.id, 'accept')}
                    data-testid={`invitation-accept-${inv.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {actionId === inv.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-sm ghost"
                    disabled={actionId === inv.id}
                    onClick={() => void respond(inv.id, 'decline')}
                    data-testid={`invitation-decline-${inv.id}`}
                    style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <X size={12} /> Decline
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        )
      }
      case 'invitation-out': {
        const inv = row.data
        return (
          <article key={`io-${inv.id}`} className="card" data-testid={`row-invitation-out-${inv.id}`}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    You invited
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                    <UserNameLink userId={inv.invitee_id} name={inv.invitee_name} email={inv.invitee_email} />
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>· {formatLabel(inv.role)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                  For{' '}
                  <Link to={buildProfileUrl('startups', inv.startup_name, inv.startup_id)} style={{ color: 'hsl(var(--foreground))', textDecoration: 'none', fontWeight: 500 }}>
                    {inv.startup_name}
                  </Link>
                  {inv.created_at ? ` · ${relativeTime(inv.created_at)}` : ''}
                </div>
                {inv.message ? <MessageBlock>{inv.message}</MessageBlock> : null}
                {!withActions ? <div style={{ marginTop: 6 }}><StatusBadge status={inv.status} /></div> : null}
              </div>
              {withActions ? (
                <button
                  type="button"
                  className="btn-sm ghost"
                  disabled={actionId === inv.id}
                  onClick={() => void cancelSentInvite(inv)}
                  data-testid={`sent-invitation-cancel-${inv.id}`}
                  style={{ color: '#ef4444', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {actionId === inv.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                  Cancel
                </button>
              ) : null}
            </div>
          </article>
        )
      }
      case 'request-out': {
        const req = row.data
        return (
          <article key={`ro-${req.id}`} className="card" data-testid={`row-request-out-${req.id}`}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    You asked to join
                  </span>
                  <Link to={buildProfileUrl('startups', req.startup_name, req.startup_id)} style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'hsl(var(--foreground))', textDecoration: 'none' }}>
                    {req.startup_name}
                  </Link>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> Sent {req.created_at ? relativeTime(req.created_at) : 'recently'}
                  {withActions ? ' · awaiting review' : ''}
                </div>
                {req.message ? <MessageBlock>{req.message}</MessageBlock> : null}
                {!withActions ? <div style={{ marginTop: 6 }}><StatusBadge status={req.status} /></div> : null}
              </div>
              {withActions ? (
                <button
                  type="button"
                  className="btn-sm ghost"
                  disabled={actionId === req.id}
                  onClick={() => void withdraw(req.id)}
                  data-testid={`join-request-withdraw-${req.id}`}
                  style={{ color: '#ef4444', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {actionId === req.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                  Withdraw
                </button>
              ) : null}
            </div>
          </article>
        )
      }
      case 'request-in': {
        const req = row.data
        // Verdict tab: rows whose status resolved to "approved" represent
        // a person who is NOW a team member. Surface a deep-link to the
        // startup's public page where the founder can edit role/title or
        // remove them via the Team section.
        const showManageTeam = !withActions && req.status === 'approved'
        return (
          <article key={`ri-${req.id}`} className="card" data-testid={`row-request-in-${req.id}`}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                    <UserNameLink userId={req.requester_id} name={req.requester_name} email={req.requester_email} />
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                    · wants to join
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                  For{' '}
                  <Link to={buildProfileUrl('startups', req.startup_name, req.startup_id)} style={{ color: 'hsl(var(--foreground))', textDecoration: 'none', fontWeight: 500 }}>
                    {req.startup_name}
                  </Link>
                  {req.created_at ? ` · ${relativeTime(req.created_at)}` : ''}
                </div>
                {req.message ? <MessageBlock>{req.message}</MessageBlock> : null}
                {!withActions ? <div style={{ marginTop: 6 }}><StatusBadge status={req.status} /></div> : null}
                {showManageTeam ? (
                  <div style={{ marginTop: 8 }}>
                    <Link
                      to={buildProfileUrl('startups', req.startup_name, req.startup_id)}
                      className="btn-sm ghost"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                      data-testid={`manage-team-${req.id}`}
                      title="Edit this person's role or remove them from the team"
                    >
                      Manage team
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                ) : null}
              </div>
              {/* Approve opens the role-picker modal — the requester no
                  longer proposes a position, so the founder must pick.
                  Reject closes the request with a confirm prompt. */}
              {withActions ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn-sm primary"
                    disabled={actionId === req.id}
                    onClick={() => openApproveModal(req)}
                    data-testid={`review-request-approve-${req.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {actionId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-sm ghost"
                    disabled={actionId === req.id}
                    onClick={() => void rejectRequest(req)}
                    data-testid={`review-request-reject-${req.id}`}
                    style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        )
      }
    }
  }

  // --- Tab strip --------------------------------------------------------

  const tabs: Array<{ key: Tab; label: string; icon: typeof Inbox; count: number; testid: string }> = [
    { key: 'received', label: 'Received', icon: Inbox, count: receivedCount, testid: 'tab-received' },
    { key: 'sent', label: 'Sent', icon: Send, count: sentCount, testid: 'tab-sent' },
    { key: 'verdict', label: 'Verdict', icon: Gavel, count: verdictCount, testid: 'tab-verdict' },
  ]

  return (
    <section className="content-section" data-testid="invitations-page" style={{ maxWidth: '42rem', margin: '0 auto' }}>
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-5 h-5" style={{ color: 'var(--gold)' }} />
            <span className="data-eyebrow">Network</span>
          </div>
          <h1>Invitations</h1>
          <p>Invitations and join requests across every startup you're part of, in one place.</p>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Invitations tabs"
        style={{
          display: 'flex',
          borderBottom: '1px solid hsl(var(--border))',
          marginBottom: '1rem',
          gap: 4,
        }}
      >
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              data-testid={t.testid}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'transparent',
                color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                borderBottom: `2px solid ${active ? 'hsl(var(--primary))' : 'transparent'}`,
                marginBottom: -1,
                fontSize: '0.875rem',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon size={14} strokeWidth={1.5} />
              {t.label}
              {t.count > 0 ? <span className={active ? 'badge info' : 'badge'}>{t.count}</span> : null}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: '3rem 0' }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <span className="empty-description">Loading…</span>
        </div>
      ) : tab === 'received' ? (
        receivedRows.length === 0 ? (
          <div className="empty-state" data-testid="received-empty">
            <Inbox className="empty-icon" strokeWidth={1.5} />
            <h3 className="empty-title">Nothing waiting on you</h3>
            <p className="empty-description">When someone invites you to a startup or asks to join one of yours, it'll show up here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {receivedRows.map((row) => renderRow(row, true))}
          </div>
        )
      ) : tab === 'sent' ? (
        sentRows.length === 0 ? (
          <div className="empty-state" data-testid="sent-empty">
            <Send className="empty-icon" strokeWidth={1.5} />
            <h3 className="empty-title">No pending requests</h3>
            <p className="empty-description">Things you've sent appear here while they're waiting on a response.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sentRows.map((row) => renderRow(row, true))}
          </div>
        )
      ) : verdictRows.length === 0 ? (
        <div className="empty-state" data-testid="verdict-empty">
          <Gavel className="empty-icon" strokeWidth={1.5} />
          <h3 className="empty-title">No history yet</h3>
          <p className="empty-description">Once invitations and join requests are decided, they'll appear here for reference.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {verdictRows.map((row) => renderRow(row, false))}
        </div>
      )}

      {/* Approve modal — opened from the Received tab. Founder picks
          role+title, then we POST to the review endpoint with that
          payload. Backend now rejects anything outside the role enum. */}
      {approveModal ? (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="approve-request-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setApproveModal(null)
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%', maxWidth: 420,
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>
                Add {approveModal.req.requester_name ?? approveModal.req.requester_email ?? 'member'}
              </h3>
              <button
                type="button"
                className="btn-sm ghost"
                style={{ padding: 4 }}
                onClick={() => setApproveModal(null)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>
              Joining <strong>{approveModal.req.startup_name}</strong>
            </p>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, color: 'hsl(var(--muted-foreground))' }}>
              Position
            </label>
            <select
              className="input"
              value={approveRole}
              onChange={(e) => setApproveRole(e.target.value)}
              data-testid="approve-role-select"
              style={{ width: '100%', marginBottom: '0.75rem' }}
            >
              {MEMBER_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, color: 'hsl(var(--muted-foreground))' }}>
              Title (optional)
            </label>
            <input
              className="input"
              type="text"
              value={approveTitle}
              onChange={(e) => setApproveTitle(e.target.value)}
              placeholder="e.g. CTO, Head of Growth"
              maxLength={100}
              data-testid="approve-title-input"
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => setApproveModal(null)}
                disabled={actionId === approveModal.req.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-sm primary"
                onClick={() => void submitApprove()}
                disabled={actionId === approveModal.req.id}
                data-testid="approve-request-confirm"
              >
                {actionId === approveModal.req.id ? (
                  <><Loader2 size={12} className="animate-spin" /> Adding…</>
                ) : (
                  <><Check size={12} /> Add to team</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function MessageBlock({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '0.5rem 0 0',
        padding: '0.5rem 0.75rem',
        fontSize: '0.8125rem',
        lineHeight: 1.45,
        background: 'hsl(var(--muted))',
        borderLeft: '2px solid hsl(var(--border))',
        borderRadius: '0 0.25rem 0.25rem 0',
      }}
    >
      {children}
    </p>
  )
}
