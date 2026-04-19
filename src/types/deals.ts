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

export type WorkflowTemplateNode = {
  id: string
  name: string
  description: string
  order: number
  node_type: 'system' | 'custom'
}

export type WorkflowTemplate = {
  id: number
  name: string
  nodes: WorkflowTemplateNode[]
  updated_at: string
}

export type DealRoomWorkflowNode = {
  id: string
  name: string
  description: string
  order: number
  node_type: 'system' | 'custom'
  status: 'pending' | 'approved'
  investor_approved: boolean
  founder_approved: boolean
  investor_approved_at: string | null
  founder_approved_at: string | null
  completed_at: string | null
}

export type DealRoomWorkflow = {
  id: number
  nodes: DealRoomWorkflowNode[]
  current_node: DealRoomWorkflowNode | null
  is_complete: boolean
  created_at: string
}
