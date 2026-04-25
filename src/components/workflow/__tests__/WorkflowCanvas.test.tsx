import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

import { WorkflowCanvas } from '../WorkflowCanvas'
import type {
  DealRoomWorkflowEdge,
  DealRoomWorkflowNode,
} from '../../../types/deals'

type MockNode = {
  id: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

type MockEdge = { id: string; source: string; target: string; label?: string }

type MockReactFlowProps = {
  nodes: MockNode[]
  edges: MockEdge[]
  onNodesChange?: (changes: unknown[]) => void
  onEdgesChange?: (changes: unknown[]) => void
  onConnect?: (conn: { source: string; target: string }) => void
  children?: ReactNode
}

// Capture the latest props passed to ReactFlow so tests can fire callbacks
const lastReactFlowProps: { current: MockReactFlowProps | null } = { current: null }

vi.mock('@xyflow/react', () => {
  return {
    ReactFlow: (props: MockReactFlowProps) => {
      lastReactFlowProps.current = props
      return (
        <div data-testid="rf-mock">
          <div data-testid="rf-node-count">{props.nodes.length}</div>
          <div data-testid="rf-edge-count">{props.edges.length}</div>
          {props.nodes.map((n) => (
            <div key={n.id} data-testid={`rf-node-${n.id}`}>
              {String(n.data.name)}
            </div>
          ))}
          {props.edges.map((e) => (
            <div key={e.id} data-testid={`rf-edge-${e.id}`} data-source={e.source} data-target={e.target}>
              {e.label ?? ''}
            </div>
          ))}
          {props.children}
        </div>
      )
    },
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Background: () => <div data-testid="rf-background" />,
    Controls: () => <div data-testid="rf-controls" />,
    MiniMap: () => <div data-testid="rf-minimap" />,
    ConnectionMode: { Strict: 'strict' as const },
    SelectionMode: { Partial: 'partial' as const, Full: 'full' as const },
    applyNodeChanges: (_changes: unknown[], nodes: MockNode[]) => nodes,
    applyEdgeChanges: (_changes: unknown[], edges: MockEdge[]) => edges,
  }
})

function makeNode(over: Partial<DealRoomWorkflowNode> = {}): DealRoomWorkflowNode {
  return {
    id: 'n1',
    name: 'Step',
    description: '',
    node_type: 'custom',
    status: 'pending',
    position_x: 100,
    position_y: 50,
    terminal_outcome: '',
    investor_approved: false,
    founder_approved: false,
    investor_approved_at: null,
    founder_approved_at: null,
    investor_approval_note: '',
    founder_approval_note: '',
    investor_chosen_next_node_id: null,
    founder_chosen_next_node_id: null,
    completed_at: null,
    ...over,
  }
}

function makeEdge(over: Partial<DealRoomWorkflowEdge> = {}): DealRoomWorkflowEdge {
  return {
    id: 'e1',
    from_node_id: 'n1',
    to_node_id: 'n2',
    label: '',
    order_hint: 0,
    ...over,
  }
}

describe('WorkflowCanvas', () => {
  it('renders existing nodes and edges in view mode', () => {
    const nodes = [
      makeNode({ id: 'n1', name: 'Start' }),
      makeNode({ id: 'n2', name: 'End', position_x: 300 }),
    ]
    const edges = [makeEdge({ id: 'e1', from_node_id: 'n1', to_node_id: 'n2', label: 'next' })]

    render(<WorkflowCanvas mode="view" nodes={nodes} edges={edges} />)

    expect(screen.getByTestId('workflow-canvas')).toHaveAttribute('data-mode', 'view')
    expect(screen.getByTestId('rf-node-count')).toHaveTextContent('2')
    expect(screen.getByTestId('rf-edge-count')).toHaveTextContent('1')
    expect(screen.getByTestId('rf-node-n1')).toHaveTextContent('Start')
    expect(screen.getByTestId('rf-node-n2')).toHaveTextContent('End')
    expect(screen.getByTestId('rf-edge-e1')).toHaveAttribute('data-source', 'n1')
    expect(screen.getByTestId('rf-edge-e1')).toHaveAttribute('data-target', 'n2')
  })

  it('marks the current node via isCurrent on data', () => {
    const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]
    render(<WorkflowCanvas mode="view" nodes={nodes} edges={[]} currentNodeId="n2" />)

    expect(lastReactFlowProps.current?.nodes.find((n) => n.id === 'n2')?.data.isCurrent).toBe(true)
    expect(lastReactFlowProps.current?.nodes.find((n) => n.id === 'n1')?.data.isCurrent).toBe(false)
  })

  it('calls onConnect with source and target ids when an edge is created', () => {
    const onConnect = vi.fn()
    const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]

    render(
      <WorkflowCanvas mode="edit" nodes={nodes} edges={[]} onConnect={onConnect} />,
    )

    lastReactFlowProps.current?.onConnect?.({ source: 'n1', target: 'n2' })
    expect(onConnect).toHaveBeenCalledWith('n1', 'n2')
  })

  it('does not call onConnect when source equals target (self-loop)', () => {
    const onConnect = vi.fn()
    const nodes = [makeNode({ id: 'n1' })]

    render(
      <WorkflowCanvas mode="edit" nodes={nodes} edges={[]} onConnect={onConnect} />,
    )

    lastReactFlowProps.current?.onConnect?.({ source: 'n1', target: 'n1' })
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('emits onNodeDelete on node remove change in edit mode', () => {
    const onNodeDelete = vi.fn()
    const nodes = [makeNode({ id: 'n1' })]

    render(
      <WorkflowCanvas mode="edit" nodes={nodes} edges={[]} onNodeDelete={onNodeDelete} />,
    )

    lastReactFlowProps.current?.onNodesChange?.([{ type: 'remove', id: 'n1' }])
    expect(onNodeDelete).toHaveBeenCalledWith('n1')
  })

  it('emits onEdgeDelete on edge remove change in edit mode', () => {
    const onEdgeDelete = vi.fn()
    const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]
    const edges = [makeEdge({ id: 'e1', from_node_id: 'n1', to_node_id: 'n2' })]

    render(
      <WorkflowCanvas mode="edit" nodes={nodes} edges={edges} onEdgeDelete={onEdgeDelete} />,
    )

    lastReactFlowProps.current?.onEdgesChange?.([{ type: 'remove', id: 'e1' }])
    expect(onEdgeDelete).toHaveBeenCalledWith('e1')
  })

  it('debounces position changes and flushes one onPositionsChange', async () => {
    vi.useFakeTimers()
    try {
      const onPositionsChange = vi.fn()
      const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]

      render(
        <WorkflowCanvas
          mode="edit"
          nodes={nodes}
          edges={[]}
          onPositionsChange={onPositionsChange}
        />,
      )

      lastReactFlowProps.current?.onNodesChange?.([
        { type: 'position', id: 'n1', position: { x: 200, y: 100 }, dragging: false },
      ])
      lastReactFlowProps.current?.onNodesChange?.([
        { type: 'position', id: 'n2', position: { x: 300, y: 50 }, dragging: false },
      ])

      expect(onPositionsChange).not.toHaveBeenCalled()
      vi.advanceTimersByTime(500)

      expect(onPositionsChange).toHaveBeenCalledTimes(1)
      const positions = onPositionsChange.mock.calls[0][0]
      expect(positions).toHaveLength(2)
      expect(positions).toEqual(expect.arrayContaining([
        { node_id: 'n1', x: 200, y: 100 },
        { node_id: 'n2', x: 300, y: 50 },
      ]))
    } finally {
      vi.useRealTimers()
    }
  })

<<<<<<< HEAD
  it('does not emit connect/delete callbacks in view mode but flushes positions when handler provided', async () => {
    vi.useFakeTimers()
    try {
      const onPositionsChange = vi.fn()
      const onConnect = vi.fn()
      const onNodeDelete = vi.fn()
      const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]

      render(
        <WorkflowCanvas
          mode="view"
          nodes={nodes}
          edges={[]}
          onPositionsChange={onPositionsChange}
          onConnect={onConnect}
          onNodeDelete={onNodeDelete}
        />,
      )

      lastReactFlowProps.current?.onNodesChange?.([
        { type: 'position', id: 'n1', position: { x: 99, y: 99 }, dragging: false },
      ])
      lastReactFlowProps.current?.onNodesChange?.([{ type: 'remove', id: 'n1' }])
      lastReactFlowProps.current?.onConnect?.({ source: 'n1', target: 'n2' })

      vi.advanceTimersByTime(500)

      // Layout flushes (founder preview can drag), but structural edits stay locked.
      expect(onPositionsChange).toHaveBeenCalledTimes(1)
      expect(onPositionsChange.mock.calls[0][0]).toEqual([{ node_id: 'n1', x: 99, y: 99 }])
      expect(onConnect).not.toHaveBeenCalled()
      expect(onNodeDelete).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('view mode without onPositionsChange disables drag/select/pan', () => {
    const nodes = [makeNode({ id: 'n1' })]

    render(<WorkflowCanvas mode="view" nodes={nodes} edges={[]} />)

    // ReactFlow gets nodesDraggable=false and selectionOnDrag=false; pan reverts
    // to default left-mouse drag (panOnDrag === true). nodesConnectable is also
    // false (only edit mode can create new edges).
    const props = lastReactFlowProps.current as unknown as Record<string, unknown>
    expect(props.nodesDraggable).toBe(false)
    expect(props.nodesConnectable).toBe(false)
    expect(props.selectionOnDrag).toBe(false)
    expect(props.panOnDrag).toBe(true)
  })

  it('view mode WITH onPositionsChange enables drag/select but not connect or delete', () => {
    const onPositionsChange = vi.fn()
    const nodes = [makeNode({ id: 'n1' })]
=======
  it('does not emit position/connect/delete callbacks in view mode', () => {
    const onPositionsChange = vi.fn()
    const onConnect = vi.fn()
    const onNodeDelete = vi.fn()
    const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]
>>>>>>> c7bc02dc1b24313d62acc4260080ae6840bd6cbd

    render(
      <WorkflowCanvas
        mode="view"
        nodes={nodes}
        edges={[]}
        onPositionsChange={onPositionsChange}
<<<<<<< HEAD
      />,
    )

    const props = lastReactFlowProps.current as unknown as Record<string, unknown>
    expect(props.nodesDraggable).toBe(true)
    expect(props.selectionOnDrag).toBe(true)
    expect(props.panOnDrag).toEqual([1, 2])
    // Structural mutations stay locked even with layout enabled.
    expect(props.nodesConnectable).toBe(false)
    // Nodes are not deletable in view mode (so Delete key can't strip them).
    const rfNode = (props.nodes as Array<{ deletable: boolean }>)[0]
    expect(rfNode.deletable).toBe(false)
=======
        onConnect={onConnect}
        onNodeDelete={onNodeDelete}
      />,
    )

    lastReactFlowProps.current?.onNodesChange?.([
      { type: 'position', id: 'n1', position: { x: 99, y: 99 }, dragging: false },
    ])
    lastReactFlowProps.current?.onNodesChange?.([{ type: 'remove', id: 'n1' }])
    lastReactFlowProps.current?.onConnect?.({ source: 'n1', target: 'n2' })

    expect(onPositionsChange).not.toHaveBeenCalled()
    expect(onConnect).not.toHaveBeenCalled()
    expect(onNodeDelete).not.toHaveBeenCalled()
>>>>>>> c7bc02dc1b24313d62acc4260080ae6840bd6cbd
  })
})

// Suppress unused import warning for fireEvent (kept for future tests)
void fireEvent
