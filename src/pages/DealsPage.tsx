import { useEffect, useState } from 'react'
import { apiRequest, uploadRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import {
  Handshake, FileText, CheckCircle, XCircle, Clock, Upload,
  Loader2, ChevronRight, ChevronDown, Shield
} from 'lucide-react'

type DealRoomListItem = {
  id: string
  startup_name: string
  investor_name: string
  status: string
  nda_signed_by_founder: boolean
  nda_signed_by_investor: boolean
  nda_fully_signed: boolean
  document_count: number
  created_at: string
}

type DealRoomDoc = {
  id: string
  name: string
  document_type?: string
  file_url_resolved?: string | null
  file_size?: number | null
  uploaded_by_name?: string
  created_at: string
}

type DealRoomDetail = {
  id: string
  startup: { id: string; name: string }
  investor: { id: string; display_name: string }
  status: string
  nda_signed_by_founder: boolean
  nda_signed_by_investor: boolean
  nda_fully_signed: boolean
  founder_signed_at?: string | null
  investor_signed_at?: string | null
  close_reason?: string | null
  closed_at?: string | null
  documents: DealRoomDoc[]
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  nda_pending: '#f59e0b',
  closed_won: '#6366f1',
  closed_lost: '#ef4444',
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

function formatBytes(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function DealsPage() {
  const { pushToast } = useToast()
  const [rooms, setRooms] = useState<DealRoomListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [roomDetails, setRoomDetails] = useState<Record<string, DealRoomDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [signingNda, setSigningNda] = useState<string | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

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

  const toggleRoom = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (roomDetails[id]) return

    setLoadingDetail(id)
    try {
      const detail = await apiRequest<DealRoomDetail>(`/deals/rooms/${id}/`)
      setRoomDetails((prev) => ({ ...prev, [id]: detail }))
    } catch {
      pushToast('Failed to load room details', 'error')
    } finally {
      setLoadingDetail(null)
    }
  }

  const signNda = async (roomId: string) => {
    setSigningNda(roomId)
    try {
      await apiRequest(`/deals/rooms/${roomId}/sign-nda/`, { method: 'POST' })
      pushToast('NDA signed successfully', 'success')
      // Refresh this room's details
      const [updatedList, updatedDetail] = await Promise.all([
        apiRequest<DealRoomListItem[] | { results: DealRoomListItem[] }>('/deals/rooms/'),
        apiRequest<DealRoomDetail>(`/deals/rooms/${roomId}/`),
      ])
      setRooms(normalizeList(updatedList))
      setRoomDetails((prev) => ({ ...prev, [roomId]: updatedDetail }))
    } catch {
      pushToast('Failed to sign NDA', 'error')
    } finally {
      setSigningNda(null)
    }
  }

  const handleDocUpload = async (roomId: string, file: File) => {
    setUploadingDoc(roomId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)
      await uploadRequest(`/deals/rooms/${roomId}/documents/`, formData)
      // Refresh details
      const detail = await apiRequest<DealRoomDetail>(`/deals/rooms/${roomId}/`)
      setRoomDetails((prev) => ({ ...prev, [roomId]: detail }))
      pushToast('Document uploaded', 'success')
    } catch {
      pushToast('Upload failed', 'error')
    } finally {
      setUploadingDoc(null)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deal Rooms</h1>
          <p className="page-description">Manage active deals, NDA signing, and shared documents.</p>
        </div>
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
          {rooms.map((room) => {
            const expanded = expandedId === room.id
            const detail = roomDetails[room.id]
            const isLoadingThis = loadingDetail === room.id
            const isSigningThis = signingNda === room.id
            const isUploadingThis = uploadingDoc === room.id

            return (
              <div key={room.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  className="list-item"
                  onClick={() => void toggleRoom(room.id)}
                  style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: expanded ? '0.75rem 0.75rem 0 0' : undefined }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Handshake size={16} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>
                      {room.startup_name} × {room.investor_name}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {new Date(room.created_at).toLocaleDateString()} · {room.document_count} document{room.document_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <StatusBadge status={room.status} />
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {expanded && (
                  <div style={{ padding: '1rem', borderTop: '1px solid hsl(var(--border))' }}>
                    {isLoadingThis ? (
                      <div className="empty-state" style={{ padding: '1rem 0' }}>
                        <Loader2 size={16} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                      </div>
                    ) : detail ? (
                      <>
                        {/* NDA Status */}
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'hsl(var(--muted))', borderRadius: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Shield size={14} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>NDA Status</span>
                          </div>
                          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {detail.nda_signed_by_founder
                                ? <CheckCircle size={12} style={{ color: '#22c55e' }} />
                                : <XCircle size={12} style={{ color: '#ef4444' }} />}
                              Founder signed
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {detail.nda_signed_by_investor
                                ? <CheckCircle size={12} style={{ color: '#22c55e' }} />
                                : <XCircle size={12} style={{ color: '#ef4444' }} />}
                              Investor signed
                            </span>
                            {detail.nda_fully_signed && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e' }}>
                                <CheckCircle size={12} />
                                NDA complete
                              </span>
                            )}
                          </div>
                          {!detail.nda_fully_signed && (
                            <button
                              className="btn-sm primary"
                              type="button"
                              style={{ marginTop: 10 }}
                              disabled={isSigningThis}
                              onClick={() => void signNda(room.id)}
                            >
                              {isSigningThis ? (
                                <><Loader2 size={12} className="animate-spin" /> Signing...</>
                              ) : (
                                <><Clock size={12} /> Sign NDA</>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Documents */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Documents</span>
                            <label style={{ cursor: 'pointer' }}>
                              <input
                                type="file"
                                className="sr-only"
                                disabled={isUploadingThis}
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) void handleDocUpload(room.id, f)
                                  e.target.value = ''
                                }}
                              />
                              <span className="btn-sm ghost">
                                {isUploadingThis ? (
                                  <><Loader2 size={12} className="animate-spin" /> Uploading...</>
                                ) : (
                                  <><Upload size={12} /> Upload</>
                                )}
                              </span>
                            </label>
                          </div>
                          {detail.documents.length === 0 ? (
                            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '0.75rem 0' }}>
                              No documents shared yet.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {detail.documents.map((doc) => (
                                <div key={doc.id} className="list-item" style={{ cursor: 'default' }}>
                                  <FileText size={14} strokeWidth={1.5} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500 }}>{doc.name}</span>
                                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
                                      {doc.uploaded_by_name} · {formatBytes(doc.file_size)}
                                    </span>
                                  </div>
                                  {doc.file_url_resolved && (
                                    <a
                                      href={doc.file_url_resolved}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn-sm ghost"
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.6875rem' }}
                                    >
                                      View
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
