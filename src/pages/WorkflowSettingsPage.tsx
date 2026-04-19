import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  ArrowLeft, Settings, Lock, Plus, Pencil, Trash2, Loader2, Check, X,
} from 'lucide-react'
import type { WorkflowTemplate, WorkflowTemplateNode } from '../types/deals'

function NodeRow({
  node,
  onEdit,
  onDelete,
}: {
  node: WorkflowTemplateNode
  onEdit: (node: WorkflowTemplateNode) => void
  onDelete: (id: string) => void
}) {
  const isSystem = node.node_type === 'system'
  return (
    <div
      className="card"
      data-testid="workflow-node-row"
      style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem' }}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: isSystem ? 'hsl(var(--muted))' : 'hsl(var(--primary) / 0.12)',
        }}
      >
        {isSystem
          ? <Lock size={13} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
          : <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>{node.order}</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{node.name}</span>
        {node.description && (
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
            {node.description}
          </span>
        )}
        {isSystem && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
            <Lock size={10} strokeWidth={1.5} /> System node
          </span>
        )}
      </div>
      {!isSystem && (
        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
          <button
            className="btn-sm ghost"
            data-testid="edit-node-btn"
            onClick={() => onEdit(node)}
            style={{ padding: '4px 8px' }}
            title="Edit node"
          >
            <Pencil size={12} strokeWidth={1.5} />
          </button>
          <button
            className="btn-sm ghost"
            data-testid="delete-node-btn"
            onClick={() => onDelete(node.id)}
            style={{ padding: '4px 8px', color: '#ef4444' }}
            title="Delete node"
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}

export function WorkflowSettingsPage() {
  const { status, user } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const [template, setTemplate] = useState<WorkflowTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [templateName, setTemplateName] = useState('')
  const [editingName, setEditingName] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingNode, setEditingNode] = useState<WorkflowTemplateNode | null>(null)
  const [nodeName, setNodeName] = useState('')
  const [nodeDesc, setNodeDesc] = useState('')
  const [nodeOrder, setNodeOrder] = useState(1)
  const [submittingNode, setSubmittingNode] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)

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

  const handleSaveName = async () => {
    if (!template || templateName.trim() === template.name) { setEditingName(false); return }
    setSaving(true)
    try {
      const updated = await apiRequest<WorkflowTemplate>('/deals/workflow/', {
        method: 'PATCH',
        body: JSON.stringify({ name: templateName.trim() }),
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

  const openAddForm = () => {
    setEditingNode(null)
    setNodeName('')
    setNodeDesc('')
    const maxOrder = template?.nodes.filter(n => n.node_type === 'custom').reduce((m, n) => Math.max(m, n.order), 0) ?? 0
    setNodeOrder(maxOrder + 1)
    setShowAddForm(true)
  }

  const openEditForm = (node: WorkflowTemplateNode) => {
    setEditingNode(node)
    setNodeName(node.name)
    setNodeDesc(node.description)
    setNodeOrder(node.order)
    setShowAddForm(true)
  }

  const closeForm = () => {
    setShowAddForm(false)
    setEditingNode(null)
  }

  const handleSubmitNode = async () => {
    if (!nodeName.trim()) { pushToast('Node name is required', 'error'); return }
    setSubmittingNode(true)
    try {
      if (editingNode) {
        await apiRequest(`/deals/workflow/nodes/${editingNode.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ name: nodeName.trim(), description: nodeDesc.trim(), order: nodeOrder }),
        })
        pushToast('Node updated', 'success')
      } else {
        await apiRequest('/deals/workflow/nodes/', {
          method: 'POST',
          body: JSON.stringify({ name: nodeName.trim(), description: nodeDesc.trim(), order: nodeOrder }),
        })
        pushToast('Node added', 'success')
      }
      closeForm()
      void load()
    } catch {
      pushToast(editingNode ? 'Failed to update node' : 'Failed to add node', 'error')
    } finally {
      setSubmittingNode(false)
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    setDeleting(nodeId)
    try {
      await apiRequest(`/deals/workflow/nodes/${nodeId}/`, { method: 'DELETE' })
      pushToast('Node deleted', 'success')
      void load()
    } catch {
      pushToast('Failed to delete node', 'error')
    } finally {
      setDeleting(null)
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

  const sortedNodes = [...template.nodes].sort((a, b) => a.order - b.order)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
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
            <p className="page-description">Configure the deal workflow template applied to all your deal rooms.</p>
          </div>
        </div>
      </div>

      {/* Template name */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
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
                  onChange={e => setTemplateName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
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

      {/* Nodes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Workflow Steps ({sortedNodes.length})</span>
        <button
          className="btn-sm"
          data-testid="add-node-btn"
          onClick={openAddForm}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Plus size={13} strokeWidth={1.5} /> Add Step
        </button>
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'hsl(var(--primary) / 0.4)' }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {editingNode ? 'Edit Step' : 'Add Custom Step'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              data-testid="node-name-input"
              className="input"
              placeholder="Step name (e.g. Due Diligence)"
              value={nodeName}
              onChange={e => setNodeName(e.target.value)}
            />
            <textarea
              data-testid="node-desc-input"
              className="input"
              placeholder="Description (optional)"
              value={nodeDesc}
              onChange={e => setNodeDesc(e.target.value)}
              rows={2}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>Order:</label>
              <input
                data-testid="node-order-input"
                className="input"
                type="number"
                min={1}
                value={nodeOrder}
                onChange={e => setNodeOrder(Number(e.target.value))}
                style={{ width: 72 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                className="btn-sm"
                data-testid="submit-node-btn"
                onClick={() => void handleSubmitNode()}
                disabled={submittingNode}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {submittingNode ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {editingNode ? 'Save Changes' : 'Add Step'}
              </button>
              <button className="btn-sm ghost" onClick={closeForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {sortedNodes.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: '2rem' }}>
          <span className="empty-description">No workflow steps yet. Add your first step above.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sortedNodes.map(node =>
            deleting === node.id ? (
              <div key={node.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.5 }}>
                <Loader2 size={14} className="animate-spin" /> Deleting...
              </div>
            ) : (
              <NodeRow key={node.id} node={node} onEdit={openEditForm} onDelete={id => void handleDeleteNode(id)} />
            )
          )}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', borderRadius: 8, background: 'hsl(var(--muted) / 0.5)', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
        System nodes (NDA Signing, Term Sheet, Closing) are built-in and cannot be removed. Custom steps can be reordered by setting the order number.
      </div>
    </div>
  )
}
