export type CallSession = {
  call_id: string
  conversation_id?: string
  call_type?: 'voice' | 'video' | string
  status?: string
  is_group_call?: boolean
  initiator_id?: string | null
  started_at?: string | null
  duration_seconds?: number | null
  participant_count?: number
  ice_servers?: unknown[]
  participants?: Array<{
    user_id: string
    status?: string
  }>
}

export type CallEvent = {
  type: string
  call_id?: string
  from_user_id?: string
  to_user_id?: string
  payload?: unknown
  timestamp?: string
}
