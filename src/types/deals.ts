export type DealRoomListItem = {
  id: string
  startup_name: string
  investor_name: string
  status: string
  nda_signed_by_founder: boolean
  nda_signed_by_investor: boolean
  nda_fully_signed: boolean
  document_count: number
  /**
   * Unread chat messages on the deal-room conversation for the requesting
   * user. 0 when caught up or the room has no conversation yet (legacy).
   */
  unread_count?: number
  created_at: string
}

export type InterestDirection = 'founder_to_investor' | 'investor_to_founder'

/**
 * One side of the deal-room handshake. When both sides express interest
 * in the same startup+investor pair, the backend auto-creates a DealRoom
 * and the interest is "consumed". Until then it shows up on the Deals
 * page as "pending" so the other side can reciprocate.
 *
 * Mirrors `ff_backend.deals.serializers.InterestExpressionSerializer`.
 */
export type InterestExpression = {
  id: string
  startup: string
  startup_name: string
  investor: string
  investor_name: string
  expressed_by_name: string
  direction: InterestDirection
  message: string
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
  /**
   * UUID of the deal-room Conversation. Null for legacy rooms that haven't
   * been backfilled yet. When present, the DealRoomDetailPage shows a
   * "Discussion" button that deep-links to /app/chat?conversationId=<id>.
   */
  conversation_id: string | null
  created_at: string
}

export type WorkflowNodeType = 'system_start' | 'system_end' | 'custom'

export type TerminalOutcome = 'won' | 'lost' | 'abandoned' | 'other' | ''

export type DocumentType =
  | ''
  | 'pitch_deck'
  | 'term_sheet'
  | 'nda'
  | 'financial_model'
  | 'cap_table'
  | 'due_diligence'
  | 'contract'
  | 'other'

export const DOCUMENT_TYPE_LABELS: Record<Exclude<DocumentType, ''>, string> = {
  pitch_deck: 'Pitch Deck',
  term_sheet: 'Term Sheet',
  nda: 'NDA Document',
  financial_model: 'Financial Model',
  cap_table: 'Cap Table',
  due_diligence: 'Due Diligence',
  contract: 'Contract',
  other: 'Other',
}

export type WorkflowTemplateNode = {
  id: string
  name: string
  description: string
  node_type: WorkflowNodeType
  position_x: number
  position_y: number
  terminal_outcome: TerminalOutcome
  required_document_type: DocumentType
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
  required_document_type: DocumentType
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
