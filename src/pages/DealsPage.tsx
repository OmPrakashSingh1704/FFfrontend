import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { Handshake, ArrowRight, Loader2, Settings } from 'lucide-react'
import type { DealRoomListItem } from '../types/deals'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await apiRequest<DealRoomListItem[] | { results: DealRoomListItem[] }>('/deals/rooms/')
        if (!cancelled) setRooms(normalizeList(data))
      } catch {
        if (!cancelled) pushToast('Failed to load deal rooms', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [pushToast])

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
      ) : rooms.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: '4rem' }}>
          <div className="empty-icon"><Handshake size={28} /></div>
          <span className="empty-title">No deal rooms yet</span>
          <span className="empty-description">
            Deal rooms are created when an investor expresses interest in your startup and both parties agree to connect.
          </span>
        </div>
      ) : (
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
      )}
    </div>
  )
}
