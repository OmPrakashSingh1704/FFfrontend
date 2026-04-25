export type DealRoomListItem = {
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

export type DealRoomDoc = {
  id: string
  name: string
  document_type?: string
  file_url_resolved?: string | null
  file_size?: number | null
  uploaded_by_name?: string
  created_at: string
}

export type DealRoomDetail = {
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

export type WorkflowNodeType = 'system_start' | 'system_end' | 'custom'

export type TerminalOutcome = 'won' | 'lost' | 'abandoned' | 'other' | ''

export type WorkflowTemplateNode = {
  id: string
  name: string
  description: string
  node_type: WorkflowNodeType
  position_x: number
  position_y: number
  terminal_outcome: TerminalOutcome
}

export type WorkflowTemplateEdge = {
  id: string
  from_node_id: string
  to_node_id: string
  label: string
  order_hint: number
}

export type WorkflowTemplate = {
  id: number
  name: string
  nodes: WorkflowTemplateNode[]
  edges: WorkflowTemplateEdge[]
  updated_at: string
}

export type WorkflowNodeStatus = 'pending' | 'active' | 'approved'

export type DealRoomWorkflowNode = {
  id: string
  name: string
  description: string
  node_type: WorkflowNodeType
  status: WorkflowNodeStatus
  position_x: number
  position_y: number
  terminal_outcome: TerminalOutcome
  investor_approved: boolean
  founder_approved: boolean
  investor_approved_at: string | null
  founder_approved_at: string | null
  investor_approval_note: string
  founder_approval_note: string
  investor_chosen_next_node_id: string | null
  founder_chosen_next_node_id: string | null
  completed_at: string | null
}

export type DealRoomWorkflowEdge = {
  id: string
  from_node_id: string
  to_node_id: string
  label: string
  order_hint: number
}

export type DealRoomWorkflow = {
  id: number
  nodes: DealRoomWorkflowNode[]
  edges: DealRoomWorkflowEdge[]
  current_node: DealRoomWorkflowNode | null
  is_complete: boolean
  created_at: string
}

export type WorkflowValidationResponse = {
  valid: boolean
  errors: string[]
}

export type BulkPositionItem = {
  node_id: string
  x: number
  y: number
}
