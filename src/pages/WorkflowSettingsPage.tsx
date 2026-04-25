import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Settings, Plus, Pencil, Loader2, Check, X, Save } from 'lucide-react'

import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  WorkflowCanvas,
  WorkflowValidationBanner,
} from '../components/workflow'
import type {
  BulkPositionItem,
  TerminalOutcome,
  WorkflowTemplate,
  WorkflowTemplateEdge,
  WorkflowTemplateNode,
  WorkflowValidationResponse,
} from '../types/deals'

type NodeFormState = {
  open: boolean
  mode: 'create' | 'edit'
  nodeId: string | null
  name: string
  description: string
  terminal_outcome: TerminalOutcome
}

type EdgeFormState = {
  open: boolean
  edgeId: string | null
  label: string
  order_hint: number
}

const EMPTY_NODE_FORM: NodeFormState = {
  open: false,
  mode: 'create',
  nodeId: null,
  name: '',
  description: '',
  terminal_outcome: '',
}

const EMPTY_EDGE_FORM: EdgeFormState = {
  open: false,
  edgeId: null,
  label: '',
  order_hint: 0,
}

export function WorkflowSettingsPage() {
  const { status, user } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const [template, setTemplate] = useState<WorkflowTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<WorkflowValidationResponse | null>(null)

  const [templateName, setTemplateName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const [nodeForm, setNodeForm] = useState<NodeFormState>(EMPTY_NODE_FORM)
  const [edgeForm, setEdgeForm] = useState<EdgeFormState>(EMPTY_EDGE_FORM)
  const [submittingNode, setSubmittingNode] = useState(false)
  const [submittingEdge, setSubmittingEdge] = useState(false)

  const pendingPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<WorkflowTemplate>('/deals/workflow/')
      setTemplate(data)
      setTemplateName(data.name)
    } catch {
      pushToast('Failed to load workflow template', 'error')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    if (status === 'loading' || status === 'idle') return
    if (status === 'unauthenticated' || user?.role !== 'investor') {
      navigate('/app/deals')
      return
    }
    void load()
  }, [status, user, navigate, load])

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus()
  }, [editingName])

  const nodesById = useMemo(() => {
    const map: Record<string, WorkflowTemplateNode> = {}
    template?.nodes.forEach((n) => { map[n.id] = n })
    return map
  }, [template])

  const edgesById = useMemo(() => {
    const map: Record<string, WorkflowTemplateEdge> = {}
    template?.edges.forEach((e) => { map[e.id] = e })
    return map
  }, [template])

  const selectedNode = selectedNodeId ? nodesById[selectedNodeId] ?? null : null
  const selectedEdge = selectedEdgeId ? edgesById[selectedEdgeId] ?? null : null

  const handleSaveName = async () => {
    if (!template || templateName.trim() === template.name) {
      setEditingName(false)
      return
    }
    setSaving(true)
    try {
      const updated = await apiRequest<WorkflowTemplate>('/deals/workflow/', {
        method: 'PATCH',
        body: { name: templateName.trim() },
      })
      setTemplate(updated)
      setTemplateName(updated.name)
      setEditingName(false)
      pushToast('Template name updated', 'success')
    } catch {
      pushToast('Failed to update template name', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openCreateNode = () => {
    setNodeForm({
      open: true, mode: 'create', nodeId: null,
      name: '', description: '', terminal_outcome: '',
    })
  }

  const openEditNode = (node: WorkflowTemplateNode) => {
    if (node.node_type === 'system_start') {
      pushToast('The start node cannot be edited.', 'info')
      return
    }
    setNodeForm({
      open: true, mode: 'edit', nodeId: node.id,
      name: node.name, description: node.description,
      terminal_outcome: node.terminal_outcome,
    })
  }

  const closeNodeForm = () => setNodeForm(EMPTY_NODE_FORM)

  const handleSubmitNode = async () => {
    if (!template) return
    if (!nodeForm.name.trim()) {
      pushToast('Node name is required', 'error')
      return
    }
    setSubmittingNode(true)
    try {
      if (nodeForm.mode === 'edit' && nodeForm.nodeId) {
        await apiRequest(`/deals/workflow/nodes/${nodeForm.nodeId}/`, {
          method: 'PATCH',
          body: {
            name: nodeForm.name.trim(),
            description: nodeForm.description.trim(),
            terminal_outcome: nodeForm.terminal_outcome,
          },
        })
        pushToast('Node updated', 'success')
      } else {
        const xs = template.nodes.map((n) => n.position_x)
        const maxX = xs.length ? Math.max(...xs) : 0
        await apiRequest('/deals/workflow/nodes/', {
          method: 'POST',
          body: {
            name: nodeForm.name.trim(),
            description: nodeForm.description.trim(),
            terminal_outcome: nodeForm.terminal_outcome,
            position_x: maxX + 220,
            position_y: 0,
          },
        })
        pushToast('Node added', 'success')
      }
      closeNodeForm()
      setValidation(null)
      void load()
    } catch (e) {
      const detail = (e as { details?: { detail?: string } })?.details?.detail
      pushToast(detail || (nodeForm.mode === 'edit' ? 'Failed to update node' : 'Failed to add node'), 'error')
    } finally {
      setSubmittingNode(false)
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    const node = nodesById[nodeId]
    if (!node) return
    if (node.node_type === 'system_start') {
      pushToast('The start node cannot be deleted.', 'error')
      return
    }
    try {
      await apiRequest(`/deals/workflow/nodes/${nodeId}/`, { method: 'DELETE' })
      pushToast('Node deleted', 'success')
      setSelectedNodeId(null)
      setValidation(null)
      void load()
    } catch {
      pushToast('Failed to delete node', 'error')
    }
  }

  const handleConnect = async (sourceId: string, targetId: string) => {
    if (!template) return
    try {
      await apiRequest('/deals/workflow/edges/', {
        method: 'POST',
        body: { from_node: sourceId, to_node: targetId, label: '', order_hint: 0 },
      })
      pushToast('Edge created', 'success')
      setValidation(null)
      void load()
    } catch (e) {
      const detail = (e as { details?: { detail?: string } })?.details?.detail
      pushToast(detail || 'Failed to create edge', 'error')
    }
  }

  const handleDeleteEdge = async (edgeId: string) => {
    try {
      await apiRequest(`/deals/workflow/edges/${edgeId}/`, { method: 'DELETE' })
      pushToast('Edge deleted', 'success')
      setSelectedEdgeId(null)
      setValidation(null)
      void load()
    } catch {
      pushToast('Failed to delete edge', 'error')
    }
  }

  const openEditEdge = (edge: WorkflowTemplateEdge) => {
    setEdgeForm({
      open: true, edgeId: edge.id, label: edge.label, order_hint: edge.order_hint,
    })
  }

  const closeEdgeForm = () => setEdgeForm(EMPTY_EDGE_FORM)

  const handleSubmitEdge = async () => {
    if (!edgeForm.edgeId) return
    setSubmittingEdge(true)
    try {
      await apiRequest(`/deals/workflow/edges/${edgeForm.edgeId}/`, {
        method: 'PATCH',
        body: { label: edgeForm.label, order_hint: edgeForm.order_hint },
      })
      pushToast('Edge updated', 'success')
      closeEdgeForm()
      void load()
    } catch {
      pushToast('Failed to update edge', 'error')
    } finally {
      setSubmittingEdge(false)
    }
  }

  const handlePositionsChange = useCallback(
    async (positions: BulkPositionItem[]) => {
      positions.forEach((p) => pendingPositionsRef.current.set(p.node_id, { x: p.x, y: p.y }))
      const payload = Array.from(pendingPositionsRef.current.entries()).map(
        ([node_id, { x, y }]) => ({ node_id, x, y }),
      )
      pendingPositionsRef.current.clear()
      try {
        await apiRequest('/deals/workflow/positions/', {
          method: 'PATCH',
          body: { positions: payload },
        })
      } catch {
        pushToast('Failed to save node positions', 'error')
      }
    },
    [pushToast],
  )

  const handleValidate = async () => {
    setValidating(true)
    try {
      const result = await apiRequest<WorkflowValidationResponse>(
        '/deals/workflow/validate/',
        { method: 'POST' },
      )
      setValidation(result)
      if (result.valid) pushToast('Workflow is valid', 'success')
      else pushToast(`Workflow has ${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}`, 'error')
    } catch {
      pushToast('Failed to validate workflow', 'error')
    } finally {
      setValidating(false)
    }
  }

  if (status === 'loading' || status === 'idle' || loading) {
    return (
      <div className="empty-state" style={{ paddingTop: '4rem' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <span className="empty-description">Loading workflow settings...</span>
      </div>
    )
  }

  if (!template) return null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/app/deals" className="btn-sm ghost" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} strokeWidth={1.5} /> Back
          </Link>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={20} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              Workflow Settings
            </h1>
            <p className="page-description">
              Design your deal workflow as a graph. Drag to position, connect to add steps. Branches let you fork the
              path, with both parties choosing the next step.
            </p>
          </div>
        </div>
      </div>

      {/* Template name */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>Template Name</span>
            {editingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  ref={nameInputRef}
                  data-testid="template-name-input"
                  className="input"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveName()
                    if (e.key === 'Escape') { setEditingName(false); setTemplateName(template.name) }
                  }}
                  style={{ flex: 1 }}
                />
                <button className="btn-sm" data-testid="save-name-btn" onClick={() => void handleSaveName()} disabled={saving}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                </button>
                <button className="btn-sm ghost" onClick={() => { setEditingName(false); setTemplateName(template.name) }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{template.name}</span>
            )}
          </div>
          {!editingName && (
            <button
              className="btn-sm ghost"
              data-testid="edit-name-btn"
              onClick={() => setEditingName(true)}
              style={{ flexShrink: 0 }}
            >
              <Pencil size={13} strokeWidth={1.5} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn-sm"
            data-testid="add-node-btn"
            onClick={openCreateNode}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={13} strokeWidth={1.5} /> Add Node
          </button>
          {selectedNode && selectedNode.node_type !== 'system_start' && (
            <>
              <button
                className="btn-sm ghost"
                data-testid="edit-selected-node-btn"
                onClick={() => openEditNode(selectedNode)}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Pencil size={12} /> Edit "{selectedNode.name}"
              </button>
              <button
                className="btn-sm ghost"
                data-testid="delete-selected-node-btn"
                onClick={() => void handleDeleteNode(selectedNode.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444' }}
              >
                <X size={12} /> Delete node
              </button>
            </>
          )}
          {selectedEdge && (
            <>
              <button
                className="btn-sm ghost"
                data-testid="edit-selected-edge-btn"
                onClick={() => openEditEdge(selectedEdge)}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Pencil size={12} /> Edit edge label
              </button>
              <button
                className="btn-sm ghost"
                data-testid="delete-selected-edge-btn"
                onClick={() => void handleDeleteEdge(selectedEdge.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444' }}
              >
                <X size={12} /> Delete edge
              </button>
            </>
          )}
        </div>
        <button
          className="btn-sm primary"
          data-testid="validate-btn"
          onClick={() => void handleValidate()}
          disabled={validating}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {validating ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save & Validate
        </button>
      </div>

      {validation && (
        <div style={{ marginBottom: '0.75rem' }}>
          <WorkflowValidationBanner valid={validation.valid} errors={validation.errors} />
        </div>
      )}

      <WorkflowCanvas
        mode="edit"
        nodes={template.nodes}
        edges={template.edges}
        selectedNodeId={selectedNodeId}
        onNodeSelect={(id) => { setSelectedNodeId(id); if (id) setSelectedEdgeId(null) }}
        onEdgeSelect={(id) => { setSelectedEdgeId(id); if (id) setSelectedNodeId(null) }}
        onPositionsChange={(positions) => void handlePositionsChange(positions)}
        onConnect={(s, t) => void handleConnect(s, t)}
        onNodeDelete={(id) => void handleDeleteNode(id)}
        onEdgeDelete={(id) => void handleDeleteEdge(id)}
        height={560}
      />

      <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: 'hsl(var(--muted) / 0.5)', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
        <strong style={{ color: 'hsl(var(--foreground))' }}>Tips.</strong>{' '}
        Drag nodes to position. Drag from a node's bottom handle onto another node's top handle to connect.
        Click an edge to select it, then press Delete (or use the toolbar) to disconnect. Left-drag empty canvas
        to box-select multiple nodes; right-drag or middle-drag to pan. Multiple outgoing edges become a branch
        where both parties pick the next step. Mark a leaf node as a terminal outcome (Won, Lost, Abandoned, Other)
        to close the deal when reached.
      </div>

      {/* Node modal */}
      {nodeForm.open && (
        <div
          data-testid="node-form-modal"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
          onClick={closeNodeForm}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, padding: '1rem 1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                {nodeForm.mode === 'edit' ? 'Edit Node' : 'Add Node'}
              </span>
              <button className="btn-sm ghost" onClick={closeNodeForm}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <input
                data-testid="node-name-input"
                className="input"
                placeholder="Step name (e.g. Due Diligence)"
                value={nodeForm.name}
                onChange={(e) => setNodeForm((s) => ({ ...s, name: e.target.value }))}
                autoFocus
              />
              <textarea
                data-testid="node-desc-input"
                className="input"
                placeholder="Description (optional)"
                value={nodeForm.description}
                onChange={(e) => setNodeForm((s) => ({ ...s, description: e.target.value }))}
                rows={2}
                style={{ resize: 'vertical' }}
              />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }}>
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Terminal outcome (optional — marks this as a leaf that closes the deal)
                </span>
                <select
                  data-testid="node-terminal-input"
                  className="input"
                  value={nodeForm.terminal_outcome}
                  onChange={(e) => setNodeForm((s) => ({ ...s, terminal_outcome: e.target.value as TerminalOutcome }))}
                >
                  <option value="">Not terminal</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="abandoned">Abandoned</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', justifyContent: 'flex-end' }}>
                <button className="btn-sm ghost" onClick={closeNodeForm}>Cancel</button>
                <button
                  className="btn-sm primary"
                  data-testid="submit-node-btn"
                  onClick={() => void handleSubmitNode()}
                  disabled={submittingNode}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {submittingNode ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {nodeForm.mode === 'edit' ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edge modal */}
      {edgeForm.open && (
        <div
          data-testid="edge-form-modal"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
          onClick={closeEdgeForm}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 420, padding: '1rem 1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>Edit Edge</span>
              <button className="btn-sm ghost" onClick={closeEdgeForm}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <input
                data-testid="edge-label-input"
                className="input"
                placeholder="Edge label (e.g. 'If approved')"
                value={edgeForm.label}
                onChange={(e) => setEdgeForm((s) => ({ ...s, label: e.target.value }))}
                autoFocus
              />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }}>
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Order hint (lower numbers appear first in the picker)
                </span>
                <input
                  data-testid="edge-order-input"
                  className="input"
                  type="number"
                  min={0}
                  value={edgeForm.order_hint}
                  onChange={(e) => setEdgeForm((s) => ({ ...s, order_hint: Number(e.target.value) }))}
                  style={{ width: 100 }}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', justifyContent: 'flex-end' }}>
                <button className="btn-sm ghost" onClick={closeEdgeForm}>Cancel</button>
                <button
                  className="btn-sm primary"
                  data-testid="submit-edge-btn"
                  onClick={() => void handleSubmitEdge()}
                  disabled={submittingEdge}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {submittingEdge ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
