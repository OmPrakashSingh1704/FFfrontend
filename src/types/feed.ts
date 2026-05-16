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

/**
 * OpenGraph card for a URL referenced in a post. Fetched asynchronously by
 * the backend after post creation, so `link_preview` may be null even when
 * `link_url` is set (status='pending'). Renderers fall back to the bare
 * URL chip in that case.
 */
export type LinkPreview = {
  url: string
  status: 'pending' | 'ok' | 'error'
  title: string
  description: string
  image_url: string
  site_name: string
}

/**
 * Metadata for a file the user uploaded as part of a post. Mirrors the
 * backend FeedAttachmentSerializer payload. The renderer uses these fields
 * to enrich what would otherwise be bare markdown links — video posters,
 * doc cards, image aspect-ratio hints — by looking the URL up in a Map.
 */
export type FeedAttachment = {
  id: string
  type: 'image' | 'video' | 'audio' | 'document'
  url: string
  file_name: string
  file_size: number
  mime_type: string
  width?: number | null
  height?: number | null
  duration?: number | null
  thumbnail_url?: string | null
  alt_text?: string
  order?: number
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
  link_preview?: LinkPreview | null
  attachments?: FeedAttachment[]
  tags?: string[]
  like_count?: number
  comment_count?: number
  is_liked_by_me?: boolean
  is_pinned?: boolean
  created_at?: string
  attributions?: FeedAttribution[]
}
