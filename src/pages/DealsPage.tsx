import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { Handshake, ArrowRight, Loader2, Settings, Clock, Inbox, Send } from 'lucide-react'
import type { DealRoomListItem, InterestExpression } from '../types/deals'

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  pending_nda: '#f59e0b',
  closed: '#a1a1a1',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'hsl(var(--muted-foreground))'
  const label = status.replace(/_/g, ' ')
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: '0.6875rem',
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </span>
  )
}

export function DealsPage() {
  const { pushToast } = useToast()
  const { user } = useAuth()
  const isInvestor = user?.role === 'investor'
  const [rooms, setRooms] = useState<DealRoomListItem[]>([])
  const [interests, setInterests] = useState<InterestExpression[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        // Fetch deal rooms and pending interests in parallel. We don't fail
        // the whole page if one side errors — partial data beats an empty
        // page when only one endpoint hiccups.
        const [roomsRes, interestsRes] = await Promise.allSettled([
          apiRequest<DealRoomListItem[] | { results: DealRoomListItem[] }>('/deals/rooms/'),
          apiRequest<InterestExpression[] | { results: InterestExpression[] }>('/deals/my-interests/'),
        ])
        if (cancelled) return
        if (roomsRes.status === 'fulfilled') {
          setRooms(normalizeList(roomsRes.value))
        } else {
          pushToast('Failed to load deal rooms', 'error')
        }
        if (interestsRes.status === 'fulfilled') {
          setInterests(normalizeList(interestsRes.value))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [pushToast])

  // Filter to interests that don't have a matching deal room yet — those
  // ARE pending (still waiting for the other side to reciprocate). Once
  // both sides express interest, the backend creates a DealRoom and the
  // pair stops being "pending" in user perception, though the
  // InterestExpression rows persist for audit. We dedupe by startup-investor
  // key and check against the deal-rooms list.
  const pending = useMemo(() => {
    if (interests.length === 0) return { incoming: [], outgoing: [] as InterestExpression[] }
    const roomKeys = new Set(rooms.map((r) => `${r.startup_name}::${r.investor_name}`))
    const open = interests.filter((i) => !roomKeys.has(`${i.startup_name}::${i.investor_name}`))
    // Direction is from the perspective of who initiated. We classify
    // "outgoing" (I sent) vs "incoming" (other side sent, waiting on me)
    // using the user's role plus the direction enum.
    const incoming: InterestExpression[] = []
    const outgoing: InterestExpression[] = []
    for (const i of open) {
      const isOutgoingForFounder = !isInvestor && i.direction === 'founder_to_investor'
      const isOutgoingForInvestor = isInvestor && i.direction === 'investor_to_founder'
      if (isOutgoingForFounder || isOutgoingForInvestor) outgoing.push(i)
      else incoming.push(i)
    }
    return { incoming, outgoing }
  }, [interests, rooms, isInvestor])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deal Rooms</h1>
          <p className="page-description">Manage active deals, NDA signing, and shared documents.</p>
        </div>
        {isInvestor && (
          <Link
            to="/app/deals/workflow-settings"
            className="btn-sm ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            data-testid="workflow-settings-link"
          >
            <Settings size={14} strokeWidth={1.5} />
            Workflow Settings
          </Link>
        )}
      </div>

      {loading ? (
        <div className="empty-state" style={{ paddingTop: '4rem' }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <span className="empty-description">Loading deal rooms...</span>
        </div>
      ) : (
        <>
          {/* Pending: waiting on the other side OR waiting on you. Rendered
              above the live deal-room list so they're never missed. */}
          {pending.incoming.length > 0 || pending.outgoing.length > 0 ? (
            <section style={{ marginBottom: '1.5rem' }} data-testid="pending-interests-section">
              <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={14} strokeWidth={1.5} />
                Pending
                <span className="badge">{pending.incoming.length + pending.outgoing.length}</span>
              </h2>

              {pending.incoming.length > 0 ? (
                <div style={{ marginBottom: pending.outgoing.length > 0 ? '1rem' : 0 }}>
                  <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Inbox size={12} strokeWidth={1.5} />
                    Waiting on you to reciprocate
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {pending.incoming.map((i) => (
                      <PendingInterestCard key={i.id} interest={i} variant="incoming" />
                    ))}
                  </div>
                </div>
              ) : null}

              {pending.outgoing.length > 0 ? (
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Send size={12} strokeWidth={1.5} />
                    Awaiting their response
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {pending.outgoing.map((i) => (
                      <PendingInterestCard key={i.id} interest={i} variant="outgoing" />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {rooms.length === 0 && pending.incoming.length === 0 && pending.outgoing.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: '4rem' }}>
              <div className="empty-icon"><Handshake size={28} /></div>
              <span className="empty-title">No deal rooms yet</span>
              <span className="empty-description">
                Deal rooms open the moment both sides express interest. Visit a founder
                or startup profile to send the first signal.
              </span>
            </div>
          ) : null}

          {rooms.length > 0 ? (
            <section data-testid="deal-rooms-section">
              <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Handshake size={14} strokeWidth={1.5} />
                Active deal rooms
                <span className="badge">{rooms.length}</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {rooms.map((room) => (
                  <div key={room.id} className="card" data-testid="deal-room-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Handshake size={16} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>
                          {room.startup_name} × {room.investor_name}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                          {new Date(room.created_at).toLocaleDateString()} · {room.document_count} document{room.document_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <StatusBadge status={room.status} />
                      <Link
                        to={`/app/deals/${room.id}`}
                        className="btn-sm ghost"
                        data-testid="view-details-link"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                      >
                        View Details <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

/**
 * A pending interest — one side of the handshake. "incoming" means the
 * other party has expressed interest and is waiting on the viewer to
 * reciprocate; "outgoing" means the viewer sent it and is waiting on
 * the other side.
 */
function PendingInterestCard({
  interest,
  variant,
}: {
  interest: InterestExpression
  variant: 'incoming' | 'outgoing'
}) {
  const accent = variant === 'incoming' ? '#f59e0b' : 'hsl(var(--muted-foreground))'
  // Who's on the other side, from the viewer's perspective?
  const counterparty =
    variant === 'incoming'
      ? interest.expressed_by_name
      : interest.direction === 'founder_to_investor'
        ? interest.investor_name
        : interest.startup_name
  const pairing = `${interest.startup_name} · ${interest.investor_name}`
  const sentAt = new Date(interest.created_at).toLocaleDateString()
  return (
    <div className="card" data-testid={`pending-interest-${variant}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `${accent}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {variant === 'incoming' ? (
            <Inbox size={16} strokeWidth={1.5} style={{ color: accent }} />
          ) : (
            <Send size={16} strokeWidth={1.5} style={{ color: accent }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>
            {counterparty}
          </span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            {pairing} · sent {sentAt}
          </span>
          {interest.message ? (
            <p
              style={{
                marginTop: '0.5rem',
                marginBottom: 0,
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                color: 'hsl(var(--foreground))',
                padding: '0.5rem 0.75rem',
                borderLeft: `2px solid ${accent}44`,
                background: 'hsl(var(--muted) / 0.4)',
                borderRadius: '0 0.25rem 0.25rem 0',
              }}
            >
              {interest.message}
            </p>
          ) : null}
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: '0.6875rem',
            fontWeight: 600,
            background: `${accent}22`,
            color: accent,
            border: `1px solid ${accent}44`,
            textTransform: 'capitalize',
            flexShrink: 0,
          }}
        >
          {variant === 'incoming' ? 'Awaiting you' : 'Awaiting them'}
        </span>
      </div>
    </div>
  )
}
