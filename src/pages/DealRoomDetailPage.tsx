import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiRequest, uploadRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Shield, FileText,
  Upload, Loader2, Lock, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { DealRoomDetail, DealRoomWorkflow, DealRoomWorkflowNode } from '../types/deals'

function formatBytes(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function NodeIcon({ node, isCurrent }: { node: DealRoomWorkflowNode; isCurrent: boolean }) {
  if (node.status === 'approved') return <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
  if (node.node_type === 'system') return <Lock size={16} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
  if (isCurrent) return <Clock size={16} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
  return <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid hsl(var(--border))', flexShrink: 0 }} />
}

export function DealRoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { pushToast } = useToast()

  const [room, setRoom] = useState<DealRoomDetail | null>(null)
  const [workflow, setWorkflow] = useState<DealRoomWorkflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [approvalNote, setApprovalNote] = useState('')
  const [signingNda, setSigningNda] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [expandedDesc, setExpandedDesc] = useState<string | null>(null)

  const loadWorkflow = useCallback(async () => {
    if (!id) return
    try {
      const wf = await apiRequest<DealRoomWorkflow>(`/deals/rooms/${id}/workflow/`)
      setWorkflow(wf)
    } catch {
      // workflow may not exist yet — non-blocking
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [roomData] = await Promise.all([
          apiRequest<DealRoomDetail>(`/deals/rooms/${id}/`),
        ])
        if (!cancelled) {
          setRoom(roomData)
          await loadWorkflow()
        }
      } catch {
        if (!cancelled) pushToast('Failed to load deal room', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [id, loadWorkflow, pushToast])

  const handleApprove = async () => {
    if (!id) return
    setApproving(true)
    try {
      await apiRequest(`/deals/rooms/${id}/workflow/approve/`, {
        method: 'POST',
        body: JSON.stringify({ approval_note: approvalNote }),
      })
      setApprovalNote('')
      pushToast('Approved successfully', 'success')
      await loadWorkflow()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed'
      pushToast(msg, 'error')
    } finally {
      setApproving(false)
    }
  }

  const handleSignNda = async () => {
    if (!id) return
    setSigningNda(true)
    try {
      await apiRequest(`/deals/rooms/${id}/sign-nda/`, { method: 'POST' })
      pushToast('NDA signed', 'success')
      const updated = await apiRequest<DealRoomDetail>(`/deals/rooms/${id}/`)
      setRoom(updated)
    } catch {
      pushToast('Failed to sign NDA', 'error')
    } finally {
      setSigningNda(false)
    }
  }

  const handleDocUpload = async (file: File) => {
    if (!id) return
    setUploadingDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)
      await uploadRequest(`/deals/rooms/${id}/documents/`, formData)
      const updated = await apiRequest<DealRoomDetail>(`/deals/rooms/${id}/`)
      setRoom(updated)
      pushToast('Document uploaded', 'success')
    } catch {
      pushToast('Upload failed', 'error')
    } finally {
      setUploadingDoc(false)
    }
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ paddingTop: '6rem' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <span className="empty-description">Loading deal room...</span>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="empty-state" style={{ paddingTop: '6rem' }}>
        <span className="empty-title">Deal room not found</span>
        <Link to="/app/deals" className="btn-sm ghost">Back to deals</Link>
      </div>
    )
  }

  const role = user?.role
  const currentNode = workflow?.current_node ?? null
  const isComplete = workflow?.is_complete ?? false

  const userApprovedCurrent =
    currentNode &&
    ((role === 'investor' && currentNode.investor_approved) ||
      (role === 'founder' && currentNode.founder_approved))

  const canApprove =
    currentNode &&
    !isComplete &&
    !userApprovedCurrent &&
    currentNode.node_type !== 'system' &&
    room.status !== 'closed'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/app/deals"
          className="btn-sm ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={12} /> All deals
        </Link>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          {room.startup.name} × {room.investor.display_name}
        </h1>
        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
          Created {formatDate(room.created_at)} · {room.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Workflow */}
      {workflow ? (
        <section className="card" style={{ marginBottom: '1rem' }} data-testid="workflow-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>Workflow</h2>
            {isComplete && (
              <span style={{ fontSize: '0.75rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} /> Complete
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: currentNode && !isComplete ? '1rem' : 0 }}>
            {workflow.nodes.map((node) => {
              const isCurrent = currentNode?.id === node.id
              const isExpanded = expandedDesc === node.id
              return (
                <div
                  key={node.id}
                  data-testid={`workflow-node-${node.status}`}
                  style={{
                    padding: '0.625rem 0.75rem',
                    borderRadius: 8,
                    background: isCurrent ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--muted))',
                    border: isCurrent ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
                    opacity: node.status === 'pending' && !isCurrent ? 0.55 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <NodeIcon node={node} isCurrent={isCurrent} />
                    <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: isCurrent ? 600 : 400 }}>{node.name}</span>
                    {node.status === 'approved' && node.completed_at && (
                      <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>{formatDate(node.completed_at)}</span>
                    )}
                    {isCurrent && (
                      <span style={{ fontSize: '0.6875rem', padding: '1px 6px', borderRadius: 999, background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                        Current
                      </span>
                    )}
                    {node.description && (
                      <button
                        type="button"
                        onClick={() => setExpandedDesc(isExpanded ? null : node.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'hsl(var(--muted-foreground))' }}
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  {isExpanded && node.description && (
                    <p style={{ margin: '0.375rem 0 0 22px', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {node.description}
                    </p>
                  )}

                  {isCurrent && (
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', marginLeft: 22, fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {node.investor_approved
                          ? <CheckCircle size={11} style={{ color: '#22c55e' }} />
                          : <Clock size={11} />}
                        Investor
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {node.founder_approved
                          ? <CheckCircle size={11} style={{ color: '#22c55e' }} />
                          : <Clock size={11} />}
                        Founder
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {canApprove && (
            <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '0.875rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                Your turn to approve: <strong>{currentNode?.name}</strong>
              </p>
              <textarea
                placeholder="Optional note (why are you approving?)"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                rows={2}
                data-testid="approval-note-input"
                style={{
                  width: '100%', resize: 'vertical', fontSize: '0.8125rem',
                  padding: '0.5rem', borderRadius: 6, border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--muted))', color: 'inherit', marginBottom: '0.5rem',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                className="btn-sm primary"
                disabled={approving}
                onClick={() => void handleApprove()}
                data-testid="approve-btn"
              >
                {approving ? <><Loader2 size={12} className="animate-spin" /> Approving...</> : 'Approve this step'}
              </button>
            </div>
          )}

          {userApprovedCurrent && !isComplete && (
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
              <CheckCircle size={11} style={{ color: '#22c55e', display: 'inline', marginRight: 4 }} />
              You approved this step. Waiting for the other party.
            </p>
          )}
        </section>
      ) : null}

      {/* NDA */}
      <section className="card" style={{ marginBottom: '1rem' }} data-testid="nda-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
          <Shield size={14} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>NDA</h2>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {room.nda_signed_by_founder ? <CheckCircle size={12} style={{ color: '#22c55e' }} /> : <XCircle size={12} style={{ color: '#ef4444' }} />}
            Founder {room.nda_signed_by_founder ? `· ${formatDate(room.founder_signed_at)}` : ''}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {room.nda_signed_by_investor ? <CheckCircle size={12} style={{ color: '#22c55e' }} /> : <XCircle size={12} style={{ color: '#ef4444' }} />}
            Investor {room.nda_signed_by_investor ? `· ${formatDate(room.investor_signed_at)}` : ''}
          </span>
        </div>
        {!room.nda_fully_signed && (
          <button
            type="button"
            className="btn-sm primary"
            disabled={signingNda}
            onClick={() => void handleSignNda()}
            data-testid="sign-nda-btn"
          >
            {signingNda ? <><Loader2 size={12} className="animate-spin" /> Signing...</> : <><Clock size={12} /> Sign NDA</>}
          </button>
        )}
        {room.nda_fully_signed && (
          <span style={{ fontSize: '0.75rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} /> NDA fully signed
          </span>
        )}
      </section>

      {/* Documents */}
      <section className="card" data-testid="documents-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>Documents</h2>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="file"
              className="sr-only"
              disabled={uploadingDoc}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleDocUpload(f)
                e.target.value = ''
              }}
            />
            <span className="btn-sm ghost">
              {uploadingDoc ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : <><Upload size={12} /> Upload</>}
            </span>
          </label>
        </div>
        {room.documents.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '0.75rem 0' }}>
            No documents shared yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {room.documents.map((doc) => (
              <div key={doc.id} className="list-item" style={{ cursor: 'default' }} data-testid="doc-item">
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
      </section>
    </div>
  )
}
