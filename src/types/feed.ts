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
  /**
   * One-level threading: when set, this comment is a reply to the comment
   * with this id. The backend flattens reply-to-a-reply at create time so
   * parent_id is always either null or a top-level comment id.
   */
  parent_id?: string | null
  created_at: string
  updated_at: string
}

/**
 * Resolved attribution for a feed post — one row per profile the author chose
 * to post as. Ordered by the backend: startups first (primary), then founder
 * identity, then investor, then bare user. The frontend renders index 0 as
 * the primary byline and stacks the rest.
 */
export type FeedAttribution = {
  kind: 'startup' | 'founder' | 'investor' | 'user'
  id: string
  name: string
  avatar_url: string | null
  link: string | null
  role_label: string | null
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
    role?: string
    profile_id?: string | null
  }
  startup_name?: string | null
  link_url?: string | null
  tags?: string[]
  like_count?: number
  comment_count?: number
  is_liked_by_me?: boolean
  is_pinned?: boolean
  created_at?: string
  attributions?: FeedAttribution[]
}
