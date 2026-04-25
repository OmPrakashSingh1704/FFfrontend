import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  SelectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { WorkflowNode, type WorkflowNodeData } from './WorkflowNode'
import type {
  DealRoomWorkflowEdge,
  DealRoomWorkflowNode,
  WorkflowTemplateEdge,
  WorkflowTemplateNode,
} from '../../types/deals'

type AnyNode = WorkflowTemplateNode | DealRoomWorkflowNode
type AnyEdge = WorkflowTemplateEdge | DealRoomWorkflowEdge

export type WorkflowCanvasProps = {
  nodes: AnyNode[]
  edges: AnyEdge[]
  mode: 'edit' | 'view'
  currentNodeId?: string | null
  selectedNodeId?: string | null
  onNodeSelect?: (id: string | null) => void
  onEdgeSelect?: (id: string | null) => void
  onPositionsChange?: (positions: Array<{ node_id: string; x: number; y: number }>) => void
  onConnect?: (sourceId: string, targetId: string) => void
  onNodeDelete?: (id: string) => void
  onEdgeDelete?: (id: string) => void
  height?: number | string
}

const NODE_TYPES = { workflow: WorkflowNode }

function toRfNodes(
  nodes: AnyNode[],
  currentNodeId: string | null | undefined,
  allowDelete: boolean,
): Node[] {
  return nodes.map((n) => {
    const status = 'status' in n ? n.status : undefined
    const data: WorkflowNodeData = {
      name: n.name,
      description: n.description,
      node_type: n.node_type,
      terminal_outcome: n.terminal_outcome,
      status,
      isCurrent: !!currentNodeId && n.id === currentNodeId,
    }
    return {
      id: n.id,
      type: 'workflow',
      position: { x: n.position_x ?? 0, y: n.position_y ?? 0 },
      data: data as unknown as Record<string, unknown>,
      // All nodes draggable. system_start is a structural anchor (one per
      // template, can't be deleted) but its position is just layout. In
      // preview/view (non-edit) mode nothing is deletable, so the founder
      // pressing Delete during layout doesn't strip nodes from the graph.
      deletable: allowDelete && n.node_type !== 'system_start',
    }
  })
}

function toRfEdges(edges: AnyEdge[], allowDelete: boolean): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.from_node_id,
    target: e.to_node_id,
    deletable: allowDelete,
    label: e.label || undefined,
    labelStyle: { fontSize: 11, fill: 'hsl(var(--foreground))' },
    labelBgStyle: { fill: 'hsl(var(--background))' },
    labelBgPadding: [4, 2],
    style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
  }))
}

function CanvasInner({
  nodes,
  edges,
  mode,
  currentNodeId,
  selectedNodeId,
  onNodeSelect,
  onEdgeSelect,
  onPositionsChange,
  onConnect,
  onNodeDelete,
  onEdgeDelete,
  height = 500,
}: WorkflowCanvasProps) {
  const isEdit = mode === 'edit'
  // Layout mutability is independent from structural edit. View mode + a
  // positions handler = founder rearranging in their preview without being
  // able to add/delete nodes or edges.
  const allowLayout = isEdit || !!onPositionsChange

  const dirtyPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rfNodes, setRfNodes] = useState<Node[]>(() => toRfNodes(nodes, currentNodeId ?? null, isEdit))
  const [rfEdges, setRfEdges] = useState<Edge[]>(() => toRfEdges(edges, isEdit))

  // Re-sync from props when source data changes. Preserve any pending local
  // positions for nodes still queued for server flush, otherwise an in-flight
  // drag would snap back when the parent re-renders for an unrelated reason.
  useEffect(() => {
    const next = toRfNodes(nodes, currentNodeId ?? null, isEdit)
    if (dirtyPositionsRef.current.size === 0) {
      setRfNodes(next)
      return
    }
    setRfNodes(
      next.map((n) => {
        const localPos = dirtyPositionsRef.current.get(n.id)
        return localPos ? { ...n, position: localPos } : n
      }),
    )
  }, [nodes, currentNodeId, isEdit])

  useEffect(() => {
    setRfEdges(toRfEdges(edges, isEdit))
  }, [edges, isEdit])

  const flushPositions = useCallback(() => {
    if (!onPositionsChange) return
    if (dirtyPositionsRef.current.size === 0) return
    const positions = Array.from(dirtyPositionsRef.current.entries()).map(
      ([node_id, { x, y }]) => ({ node_id, x, y }),
    )
    dirtyPositionsRef.current.clear()
    onPositionsChange(positions)
  }, [onPositionsChange])

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    flushPositions()
  }, [flushPositions])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply visually for every change (including dragging:true frames) so the
      // node tracks the cursor in real time. Without this, ReactFlow re-renders
      // with the original prop positions and the drag appears stuck.
      setRfNodes((prev) => applyNodeChanges(changes, prev))
      let positionEnded = false
      for (const ch of changes) {
        if (allowLayout && ch.type === 'position' && ch.position && ch.dragging === false) {
          dirtyPositionsRef.current.set(ch.id, ch.position)
          positionEnded = true
        }
        if (isEdit && ch.type === 'remove') {
          onNodeDelete?.(ch.id)
        }
        if (ch.type === 'select') {
          onNodeSelect?.(ch.selected ? ch.id : null)
        }
      }
      if (positionEnded) {
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
        flushTimerRef.current = setTimeout(flushPositions, 400)
      }
    },
    [allowLayout, isEdit, onNodeDelete, onNodeSelect, flushPositions],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setRfEdges((prev) => applyEdgeChanges(changes, prev))
      if (!isEdit) return
      for (const ch of changes) {
        if (ch.type === 'remove') onEdgeDelete?.(ch.id)
        if (ch.type === 'select') onEdgeSelect?.(ch.selected ? ch.id : null)
      }
    },
    [isEdit, onEdgeDelete, onEdgeSelect],
  )

  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!isEdit || !conn.source || !conn.target) return
      if (conn.source === conn.target) return
      onConnect?.(conn.source, conn.target)
    },
    [isEdit, onConnect],
  )

  const displayNodes = useMemo(() => {
    if (!selectedNodeId) return rfNodes
    return rfNodes.map((n) => (n.id === selectedNodeId ? { ...n, selected: true } : n))
  }, [rfNodes, selectedNodeId])

  return (
    <div
      data-testid="workflow-canvas"
      data-mode={mode}
      style={{
        width: '100%',
        height,
        borderRadius: 8,
        border: '1px solid hsl(var(--border))',
        background: 'hsl(var(--background))',
        overflow: 'hidden',
      }}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        nodesDraggable={allowLayout}
        nodesConnectable={isEdit}
        elementsSelectable={true}
        connectionMode={ConnectionMode.Strict}
        // Marquee select: left-drag on empty canvas draws a selection box.
        // Pan moves to right or middle mouse so the two gestures don't fight.
        // Hold Shift to add to an existing selection. Dragging any selected
        // node moves the whole group; edges follow by source/target id.
        selectionOnDrag={allowLayout}
        panOnDrag={allowLayout ? [1, 2] : true}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        selectNodesOnDrag={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="hsl(var(--border))" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable maskColor="hsl(var(--muted) / 0.6)" />
      </ReactFlow>
    </div>
  )
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
