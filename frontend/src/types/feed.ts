export type FeedComment = {
  id: string
  user: {
    id: string
    email?: string
    full_name?: string
    profile_picture?: string | null
    role?: string
  }
  content: string
  created_at: string
  updated_at: string
}

export type FeedEvent = {
  id: string
  event_type?: string
  title?: string | null
  content?: string | null
  author?: {
    id?: string
    full_name?: string
    avatar_url?: string | null
  }
  startup_name?: string | null
  link_url?: string | null
  tags?: string[]
  like_count?: number
  comment_count?: number
  is_liked_by_me?: boolean
  created_at?: string
}
