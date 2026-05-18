import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Shield, FileText,
  Upload, Loader2, Maximize2, Workflow as WorkflowIcon, X,
} from 'lucide-react'

import { apiRequest, uploadRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { DetailPageSkeleton } from '../components/skeletons'
import { DealRoomChat } from '../components/DealRoomChat'
import { DealRoomNDAModal } from '../components/DealRoomNDAModal'
import {
  WorkflowApprovalPanel,
  WorkflowCanvas,
  WorkflowHistory,
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
  // Open state for the click-through NDA modal. The modal handles the
  // template fetch + sha256 + typed-name flow; we just toggle visibility
  // and refresh the room when it reports success.
  const [ndaModalOpen, setNdaModalOpen] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  // Floating-window state for the Workflow. The minimized mini-card is the
  // default surface (always shown in the left column); clicking it opens
  // a centered popover with the full canvas + approval panel + history.
  // No persistence — each page visit starts with the window closed so
  // users land on the chat-forward view by default.
  const [workflowWindowOpen, setWorkflowWindowOpen] = useState(false)

  // ESC to close the floating window — keyboard parity with the close
  // button. Registered only while the window is open to avoid a global
  // listener leak.
  useEffect(() => {
    if (!workflowWindowOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWorkflowWindowOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workflowWindowOpen])

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

  const uploadedDocumentTypes = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    room?.documents.forEach((d) => { if (d.document_type) set.add(d.document_type) })
    return set
  }, [room?.documents])

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

  // Re-fetch the room after the NDA modal reports a successful sign. The
  // modal itself handled the POST + validation; this just syncs local
  // state so the section flips to "NDA fully signed" without a reload.
  const refetchRoomAfterSign = useCallback(async () => {
    if (!id) return
    setSigningNda(true)
    try {
      const updated = await apiRequest<DealRoomDetail>(`/deals/rooms/${id}/`)
      setRoom(updated)
    } catch {
      // Best-effort refresh — the POST already succeeded, so the worst
      // case is a stale UI until next navigation. Toast and move on.
      pushToast('Signed, but the room state could not refresh. Reload to see updates.', 'info')
    } finally {
      setSigningNda(false)
      setNdaModalOpen(false)
    }
  }, [id, pushToast])

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
    return <DetailPageSkeleton />
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
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            {room.startup.name} × {room.investor.display_name}
          </h1>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            Created {formatDate(room.created_at)} · {room.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Workflow column + Discussion — side-by-side. The left column
          stacks the mini-card (click to open canvas) on top of the
          approval panel, so users can approve the next stage without
          opening the floating window. The popup keeps the full canvas +
          panel + history for context. Layout collapses to single-column
          under 900px so the mini-card and chat remain readable on tablets.
          Chat sits in the right column when the room has a conversation;
          legacy rooms fall through to a single-column layout. */}
      {workflow || room.conversation_id ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: workflow && room.conversation_id ? 'minmax(0, 320px) minmax(0, 1fr)' : '1fr',
            gap: '1rem',
            alignItems: 'start',
            marginBottom: '1rem',
          }}
        >
          {workflow ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setWorkflowWindowOpen(true)}
                data-testid="workflow-mini-card"
                aria-label="Open workflow"
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '0.5rem',
                  padding: '0.875rem 1rem',
                  cursor: 'pointer',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  color: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                  font: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <WorkflowIcon size={14} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
                  <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0, flex: 1 }}>Workflow</h2>
                  <Maximize2 size={12} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
                </div>
                <div
                  data-testid="workflow-mini-summary"
                  style={{
                    fontSize: '0.75rem',
                    color: 'hsl(var(--muted-foreground))',
                    lineHeight: 1.4,
                  }}
                >
                  {isComplete ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#22c55e' }}>
                      <CheckCircle size={12} /> Complete
                    </span>
                  ) : currentNode ? (
                    <>Current: <span style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>{currentNode.name}</span></>
                  ) : (
                    'Not started'
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'hsl(var(--muted-foreground))',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Click to open
                </span>
              </button>

              {/* Inline approval panel — the primary action surface for
                  workflow progression. Same component as inside the
                  floating window, but rendered directly under the mini
                  card so approvers don't need to open the popup for a
                  routine "approve & pick next step" action. */}
              <div data-testid="workflow-approval-panel-inline">
                <WorkflowApprovalPanel
                  currentNode={currentNode}
                  outgoingEdges={outgoingEdges}
                  nodesById={nodesById}
                  role={role}
                  isComplete={isComplete}
                  isClosed={isClosed}
                  submitting={approving}
                  errorMessage={approveError}
                  uploadedDocumentTypes={uploadedDocumentTypes}
                  onApprove={(payload) => void handleApprove(payload)}
                />
              </div>
            </div>
          ) : null}

          {room.conversation_id ? (
            <DealRoomChat conversationId={room.conversation_id} readOnly={isClosed} />
          ) : null}
        </div>
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
            onClick={() => setNdaModalOpen(true)}
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

      {/* Click-through NDA modal. Fetches the template, requires
          scroll-to-bottom + checkbox + typed name, then POSTs the
          version + sha256 alongside the typed name so the server can
          reject any tampered submission. */}
      {ndaModalOpen && id ? (
        <DealRoomNDAModal
          conversationDealRoomId={id}
          onClose={() => setNdaModalOpen(false)}
          onSigned={() => void refetchRoomAfterSign()}
        />
      ) : null}

      {/* Floating workflow window. Backdrop is a separate stacking layer
          so the click-to-close target is the entire darkened area, not
          just outside the card. The window sizes to 90vw × 85vh capped at
          1000×700 so it fits comfortably on laptop screens without going
          full-bleed — preserves the user's sense of "I'm still in the
          deal room, this is a temporary view." */}
      {workflow && workflowWindowOpen ? (
        <div
          data-testid="workflow-window-backdrop"
          onClick={() => setWorkflowWindowOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem',
          }}
        >
          <div
            data-testid="workflow-window"
            role="dialog"
            aria-modal="true"
            aria-label="Workflow detail"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
              width: 'min(1000px, 90vw)',
              height: 'min(700px, 85vh)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0.875rem 1.25rem',
                borderBottom: '1px solid hsl(var(--border))',
              }}
            >
              <WorkflowIcon size={14} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0, flex: 1 }}>Workflow</h2>
              {isComplete && (
                <span style={{ fontSize: '0.75rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={12} /> Complete
                </span>
              )}
              <button
                type="button"
                onClick={() => setWorkflowWindowOpen(false)}
                aria-label="Close workflow window"
                data-testid="workflow-window-close"
                style={{
                  padding: 4,
                  border: 'none',
                  background: 'transparent',
                  color: 'hsl(var(--muted-foreground))',
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '1rem', alignItems: 'start' }}>
                <WorkflowCanvas
                  mode="view"
                  nodes={workflow.nodes}
                  edges={workflow.edges}
                  currentNodeId={currentNode?.id ?? null}
                  selectedNodeId={selectedNodeId}
                  onNodeSelect={setSelectedNodeId}
                  onPositionsChange={isClosed ? undefined : handlePositionsChange}
                  height={420}
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
                  uploadedDocumentTypes={uploadedDocumentTypes}
                  onApprove={(payload) => void handleApprove(payload)}
                />
              </div>
              <WorkflowHistory nodes={workflow.nodes} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
