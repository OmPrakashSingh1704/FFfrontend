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
  created_at?: string
}
