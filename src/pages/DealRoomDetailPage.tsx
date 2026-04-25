import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Shield, FileText,
  Upload, Loader2,
} from 'lucide-react'

import { apiRequest, uploadRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  WorkflowApprovalPanel,
  WorkflowCanvas,
  type ApprovalRole,
  type ApprovalSubmit,
} from '../components/workflow'
import type {
  DealRoomDetail,
  DealRoomWorkflow,
  DealRoomWorkflowEdge,
  DealRoomWorkflowNode,
} from '../types/deals'

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

function roleFromUser(role: string | undefined): ApprovalRole {
  if (role === 'investor') return 'investor'
  if (role === 'founder') return 'founder'
  return null
}

export function DealRoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { pushToast } = useToast()

  const [room, setRoom] = useState<DealRoomDetail | null>(null)
  const [workflow, setWorkflow] = useState<DealRoomWorkflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [signingNda, setSigningNda] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

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
        const roomData = await apiRequest<DealRoomDetail>(`/deals/rooms/${id}/`)
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

  const nodesById = useMemo(() => {
    const map: Record<string, DealRoomWorkflowNode> = {}
    workflow?.nodes.forEach((n) => { map[n.id] = n })
    return map
  }, [workflow])

  const currentNode = workflow?.current_node ?? null
  const outgoingEdges = useMemo<DealRoomWorkflowEdge[]>(() => {
    if (!workflow || !currentNode) return []
    return workflow.edges.filter((e) => e.from_node_id === currentNode.id)
  }, [workflow, currentNode])

<<<<<<< HEAD
  const handlePositionsChange = useCallback(
    async (positions: Array<{ node_id: string; x: number; y: number }>) => {
      if (!id || positions.length === 0) return
      // Optimistically merge into local workflow so the canvas keeps the new
      // layout even if a parent re-render fires before the server responds.
      setWorkflow((prev) => {
        if (!prev) return prev
        const byId = new Map(positions.map((p) => [p.node_id, p]))
        return {
          ...prev,
          nodes: prev.nodes.map((n) => {
            const pos = byId.get(n.id)
            return pos ? { ...n, position_x: pos.x, position_y: pos.y } : n
          }),
        }
      })
      try {
        await apiRequest(`/deals/rooms/${id}/workflow/positions/`, {
          method: 'PATCH',
          body: { positions },
        })
      } catch {
        pushToast('Failed to save layout', 'error')
      }
    },
    [id, pushToast],
  )

=======
>>>>>>> c7bc02dc1b24313d62acc4260080ae6840bd6cbd
  const handleApprove = async (payload: ApprovalSubmit) => {
    if (!id) return
    setApproveError(null)
    setApproving(true)
    try {
      await apiRequest(`/deals/rooms/${id}/workflow/approve/`, {
        method: 'POST',
        body: payload,
      })
      pushToast('Approved successfully', 'success')
      await loadWorkflow()
    } catch (err: unknown) {
      const detail = (err as { details?: { detail?: string } })?.details?.detail
      const msg = detail || (err instanceof Error ? err.message : 'Approval failed')
      setApproveError(msg)
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

  const role = roleFromUser(user?.role)
  const isComplete = workflow?.is_complete ?? false
  const isClosed = room.status === 'closed'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
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
        <section style={{ marginBottom: '1rem' }} data-testid="workflow-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>Workflow</h2>
            {isComplete && (
              <span style={{ fontSize: '0.75rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} /> Complete
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '1rem', alignItems: 'start' }}>
            <WorkflowCanvas
              mode="view"
              nodes={workflow.nodes}
              edges={workflow.edges}
              currentNodeId={currentNode?.id ?? null}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
<<<<<<< HEAD
              onPositionsChange={isClosed ? undefined : handlePositionsChange}
=======
>>>>>>> c7bc02dc1b24313d62acc4260080ae6840bd6cbd
              height={460}
            />
            <WorkflowApprovalPanel
              currentNode={currentNode}
              outgoingEdges={outgoingEdges}
              nodesById={nodesById}
              role={role}
              isComplete={isComplete}
              isClosed={isClosed}
              submitting={approving}
              errorMessage={approveError}
              onApprove={(payload) => void handleApprove(payload)}
            />
          </div>
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
