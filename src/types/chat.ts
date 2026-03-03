export type ChatParticipant = {
  id: string | number
  full_name?: string
  role?: string
  avatar_url?: string | null
  title?: string
  is_online?: boolean
}

export type ChatAttachment = {
  url?: string
  name?: string
  size?: number
  mime_type?: string
  type?: string
}

export type ChatReaction = {
  emoji: string
  user_id: string | number
}

export type ChatMessage = {
  id: string | number
  conversation?: string | number
  sender_id?: string | number
  sender_name?: string
  sender_avatar_url?: string | null
  type?: string
  content?: string
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_size?: number | null
  attachment_mime_type?: string | null
  reply_to_id?: string | null
  reply_to_preview?: string | null
  created_at?: string
  edited_at?: string | null
  deleted_at?: string | null
  metadata?: Record<string, unknown> | null
  reactions?: ChatReaction[]
  reaction_summary?: Record<string, number>
  user_reactions?: string[]
}

export type ChatConversation = {
  id: string | number
  type?: string
  name?: string | null
  avatar_url?: string | null
  last_message_at?: string | null
  last_message_preview?: string | null
  last_message_sender_name?: string | null
  participant_count?: number
  unread_count?: number
  other_participant?: ChatParticipant | null
  created_at?: string
  description?: string | null
  participants?: ChatParticipant[]
}
