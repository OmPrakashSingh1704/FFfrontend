import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Heart,
  MessageSquare,
  Send,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Rss,
  TrendingUp,
  BarChart3,
  List,
  Link as LinkIcon,
  Tag,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { Markdown } from '../components/Markdown'
import { MarkdownTextarea } from '../components/MarkdownTextarea'
import type { FeedComment, FeedEvent } from '../types/feed'

type FeedTab = 'ranked' | 'trending' | 'all'
type FeedInteraction = {
  liked: boolean
  likeCount: number
  commentCount: number
  commentOpen: boolean
  busy: boolean
  dirty: boolean
}

const feedEventTypes = [
  { value: 'startup_update', label: 'Startup update' },
  { value: 'funding_announcement', label: 'Funding announcement' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'opportunity_highlight', label: 'Opportunity highlight' },
  { value: 'platform_announcement', label: 'Platform announcement' },
  { value: 'investor_insight', label: 'Investor insight' },
]

const tabConfig: { key: FeedTab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'ranked', label: 'Ranked', icon: BarChart3 },
  { key: 'trending', label: 'Trending', icon: TrendingUp },
  { key: 'all', label: 'All', icon: List },
]

function formatEventType(type?: string | null): string {
  if (!type) return 'Update'
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function authorInitials(name?: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

type CommentSectionProps = {
  eventId: string
  onCountChange: (delta: number) => void
}

function CommentSection({ eventId, onCountChange }: CommentSectionProps) {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const [comments, setComments] = useState<FeedComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadComments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<FeedComment[] | { results: FeedComment[] }>(
        `/feed/${eventId}/comments/`,
      )
      setComments(normalizeList(data))
    } catch {
      pushToast('Unable to load comments.', 'error')
    } finally {
      setLoading(false)
    }
  }, [eventId, pushToast])

  useEffect(() => {
    void loadComments()
  }, [loadComments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = newComment.trim()
    if (!content || submitting) return

    setSubmitting(true)
    try {
      const created = await apiRequest<FeedComment>(`/feed/${eventId}/comments/`, {
        method: 'POST',
        body: { content },
      })
      setComments((prev) => [...prev, created])
      setNewComment('')
      onCountChange(1)
    } catch {
      pushToast('Unable to post comment.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (commentId: string) => {
    const content = editContent.trim()
    if (!content) return

    try {
      const updated = await apiRequest<FeedComment>(
        `/feed/${eventId}/comments/${commentId}/`,
        { method: 'PATCH', body: { content } },
      )
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)))
      setEditingId(null)
      setEditContent('')
    } catch {
      pushToast('Unable to edit comment.', 'error')
    }
  }

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId)
    try {
      await apiRequest(`/feed/${eventId}/comments/${commentId}/`, {
        method: 'DELETE',
      })
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      onCountChange(-1)
    } catch {
      pushToast('Unable to delete comment.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (comment: FeedComment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  return (
    <div
      className="comment-section"
      id={`feed-comment-${eventId}`}
      data-testid={`comment-section-${eventId}`}
      style={{
        borderTop: '1px solid hsl(var(--border))',
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
      }}
    >
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 0',
            color: 'hsl(var(--muted-foreground))',
            fontSize: '0.8125rem',
          }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading comments...</span>
        </div>
      ) : (
        <>
          {comments.length === 0 && (
            <p
              style={{
                color: 'hsl(var(--muted-foreground))',
                fontSize: '0.8125rem',
                padding: '0.5rem 0',
              }}
            >
              No comments yet. Be the first to reply.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {comments.map((comment) => {
              const isOwn = user?.id === comment.user.id
              const isEditing = editingId === comment.id
              const isDeleting = deletingId === comment.id

              return (
                <div
                  key={comment.id}
                  data-testid={`comment-${comment.id}`}
                  style={{
                    display: 'flex',
                    gap: '0.625rem',
                    padding: '0.5rem 0',
                  }}
                >
                  <div className="avatar" style={{ width: '1.5rem', height: '1.5rem', fontSize: '0.625rem', flexShrink: 0, marginTop: '0.125rem' }}>
                    {comment.user.profile_picture ? (
                      <img src={comment.user.profile_picture} alt="" />
                    ) : (
                      authorInitials(comment.user.full_name)
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                        {comment.user.full_name ?? 'User'}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
                        {relativeTime(comment.created_at)}
                        {comment.updated_at !== comment.created_at && ' (edited)'}
                      </span>
                      {isOwn && !isEditing && (
                        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
                          <button
                            type="button"
                            className="btn-sm ghost"
                            style={{ padding: '0.125rem 0.25rem' }}
                            onClick={() => startEdit(comment)}
                            data-testid={`comment-edit-btn-${comment.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            className="btn-sm ghost"
                            style={{ padding: '0.125rem 0.25rem', color: '#ef4444' }}
                            onClick={() => handleDelete(comment.id)}
                            disabled={isDeleting}
                            data-testid={`comment-delete-btn-${comment.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <textarea
                          className="textarea"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                          maxLength={2000}
                          style={{ minHeight: '3rem', fontSize: '0.8125rem' }}
                          data-testid={`comment-edit-input-${comment.id}`}
                        />
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button
                            type="button"
                            className="btn-sm primary"
                            onClick={() => handleEdit(comment.id)}
                            disabled={!editContent.trim()}
                            data-testid={`comment-save-${comment.id}`}
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                          <button
                            type="button"
                            className="btn-sm ghost"
                            onClick={cancelEdit}
                            data-testid={`comment-cancel-${comment.id}`}
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Markdown size="sm">{comment.content}</Markdown>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <form
        data-testid={`comment-form-${eventId}`}
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '0.625rem',
          alignItems: 'flex-end',
        }}
      >
        <MarkdownTextarea
          ref={inputRef}
          wrapperClassName="flex-1"
          className="textarea"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={1}
          maxLength={2000}
          style={{ minHeight: '2.25rem', fontSize: '0.8125rem' }}
          data-testid={`comment-input-${eventId}`}
          previewSize="sm"
        />
        <button
          type="submit"
          className="btn-sm primary"
          disabled={submitting || !newComment.trim()}
          data-testid={`comment-submit-${eventId}`}
        >
          <Send className="w-3.5 h-3.5" />
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </form>
    </div>
  )
}

export function FeedPage() {
  const { pushToast } = useToast()
  const [tab, setTab] = useState<FeedTab>('ranked')
  const [items, setItems] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [interactions, setInteractions] = useState<Record<string, FeedInteraction>>({})
  const [composerOpen, setComposerOpen] = useState(false)
  const [form, setForm] = useState({
    event_type: feedEventTypes[0].value,
    title: '',
    content: '',
    link_url: '',
    tags: '',
  })

  const tagList = useMemo(
    () =>
      form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const endpoint = tab === 'ranked' ? '/feed/ranked/' : tab === 'trending' ? '/feed/trending/' : '/feed/'
        const data = await apiRequest<FeedEvent[] | { results: FeedEvent[] }>(endpoint)
        if (!cancelled) {
          setItems(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load feed.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tab])

  useEffect(() => {
    if (!items.length) return
    setInteractions((prev) => {
      const next = { ...prev }
      for (const item of items) {
        const likeCount = item.like_count ?? 0
        const commentCount = item.comment_count ?? 0
        const liked = Boolean(item.is_liked_by_me)
        const existing = next[item.id]
        if (!existing) {
          next[item.id] = {
            liked,
            likeCount,
            commentCount,
            commentOpen: false,
            busy: false,
            dirty: false,
          }
        } else if (!existing.dirty) {
          next[item.id] = {
            ...existing,
            liked,
            likeCount,
            commentCount,
          }
        }
      }
      return next
    })
  }, [items])

  const getInteraction = (item: FeedEvent, snapshot: Record<string, FeedInteraction>) =>
    snapshot[item.id] ?? {
      liked: Boolean(item.is_liked_by_me),
      likeCount: item.like_count ?? 0,
      commentCount: item.comment_count ?? 0,
      commentOpen: false,
      busy: false,
      dirty: false,
    }

  const handleLike = async (item: FeedEvent) => {
    const current = getInteraction(item, interactions)
    if (current.busy) return

    const nextLiked = !current.liked
    const nextCount = Math.max(0, current.likeCount + (nextLiked ? 1 : -1))

    setInteractions((prev) => ({
      ...prev,
      [item.id]: {
        ...current,
        liked: nextLiked,
        likeCount: nextCount,
        busy: true,
        dirty: true,
      },
    }))

    try {
      const response = await apiRequest<{ liked?: boolean; like_count?: number }>(`/feed/${item.id}/like/`, {
        method: 'POST',
        body: { action: nextLiked ? 'like' : 'unlike' },
      })
      setInteractions((prev) => {
        const prevItem = prev[item.id]
        if (!prevItem) return prev
        return {
          ...prev,
          [item.id]: {
            ...prevItem,
            liked: response.liked ?? prevItem.liked,
            likeCount: response.like_count ?? prevItem.likeCount,
            busy: false,
            dirty: false,
          },
        }
      })
    } catch {
      setInteractions((prev) => {
        const prevItem = prev[item.id]
        if (!prevItem) return prev
        return {
          ...prev,
          [item.id]: {
            ...prevItem,
            liked: current.liked,
            likeCount: current.likeCount,
            busy: false,
            dirty: false,
          },
        }
      })
      pushToast('Unable to update reaction.', 'error')
    }
  }

  const handleCommentToggle = (item: FeedEvent) => {
    setInteractions((prev) => {
      const current = getInteraction(item, prev)
      return {
        ...prev,
        [item.id]: {
          ...current,
          commentOpen: !current.commentOpen,
        },
      }
    })
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('Title and content are required.')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await apiRequest('/feed/create/', {
        method: 'POST',
        body: {
          event_type: form.event_type,
          title: form.title.trim(),
          content: form.content.trim(),
          link_url: form.link_url.trim() || undefined,
          tags: tagList.length ? tagList : undefined,
        },
      })
      pushToast('Post created', 'success')
      if (tab !== 'all') {
        pushToast('Switch to "all" to see the latest post.', 'info')
      }
      setForm((prev) => ({ ...prev, title: '', content: '', link_url: '', tags: '' }))
      setComposerOpen(false)

      const endpoint = tab === 'ranked' ? '/feed/ranked/' : tab === 'trending' ? '/feed/trending/' : '/feed/'
      const data = await apiRequest<FeedEvent[] | { results: FeedEvent[] }>(endpoint)
      setItems(normalizeList(data))
    } catch {
      setFormError('Unable to publish post. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const emptyMessages: Record<FeedTab, { title: string; desc: string }> = {
    ranked: { title: 'No ranked posts yet', desc: 'Posts will appear here once the community starts engaging. Share something to get things started.' },
    trending: { title: 'Nothing trending right now', desc: 'When posts gain momentum they surface here. Check back soon or explore the full feed.' },
    all: { title: 'No posts yet', desc: 'Be the first to share an update, milestone, or insight with the network.' },
  }

  return (
    <section data-testid="feed-page" style={{ maxWidth: '48rem', margin: '0 auto' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Feed</h1>
          <p className="page-description">Signals, updates, and highlights across your network.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tabs" data-testid="feed-tabs" style={{ marginBottom: '1.25rem' }}>
        {tabConfig.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
            data-testid={`feed-tab-${key}`}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              <Icon style={{ width: '0.875rem', height: '0.875rem', strokeWidth: 1.5 }} />
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Post composer - collapsible */}
      <div className="card" style={{ marginBottom: '1.25rem' }} data-testid="feed-composer">
        {!composerOpen ? (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            data-testid="composer-trigger"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.875rem',
              padding: 0,
            }}
          >
            <div className="avatar">
              <Rss style={{ width: '0.875rem', height: '0.875rem' }} />
            </div>
            <span>What's happening?</span>
            <ChevronDown style={{ width: '1rem', height: '1rem', marginLeft: 'auto', strokeWidth: 1.5 }} />
          </button>
        ) : (
          <form onSubmit={handleCreate}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Create a post</span>
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => { setComposerOpen(false); setFormError(null) }}
                data-testid="composer-collapse"
              >
                <ChevronUp style={{ width: '0.875rem', height: '0.875rem', strokeWidth: 1.5 }} />
              </button>
            </div>

            {formError ? (
              <div style={{ fontSize: '0.8125rem', color: '#ef4444', marginBottom: '0.75rem' }}>{formError}</div>
            ) : null}

            <div className="grid-2" style={{ marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Event type</label>
                <select
                  className="select"
                  value={form.event_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, event_type: e.target.value }))}
                  data-testid="post-type-select"
                >
                  {feedEventTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Title</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Announce your progress"
                  data-testid="post-title-input"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Content</label>
              <MarkdownTextarea
                className="textarea"
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                rows={3}
                placeholder="Write the details you want investors to see."
                data-testid="post-content-textarea"
              />
            </div>

            <div className="grid-2" style={{ marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <LinkIcon style={{ width: '0.75rem', height: '0.75rem', strokeWidth: 1.5 }} /> Link (optional)
                </label>
                <input
                  className="input"
                  value={form.link_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, link_url: e.target.value }))}
                  placeholder="https://"
                  data-testid="post-link-input"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Tag style={{ width: '0.75rem', height: '0.75rem', strokeWidth: 1.5 }} /> Tags (comma separated)
                </label>
                <input
                  className="input"
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="launch, hiring, demo"
                  data-testid="post-tags-input"
                />
              </div>
            </div>

            {tagList.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                {tagList.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn primary"
                type="submit"
                disabled={submitting}
                data-testid="publish-post-btn"
              >
                <Send style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.375rem', strokeWidth: 1.5 }} />
                {submitting ? 'Publishing...' : 'Publish post'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Loading / error states */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem 0', color: 'hsl(var(--muted-foreground))' }}>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading feed...</span>
        </div>
      ) : null}
      {error ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#ef4444', fontSize: '0.875rem' }}>
          {error}
        </div>
      ) : null}

      {/* Feed list */}
      {!loading && !error ? (
        <div data-testid="feed-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((item) => {
            const state = getInteraction(item, interactions)
            return (
              <article key={item.id} className="card" data-testid={`feed-item-${item.id}`} style={{ padding: 0, overflow: 'hidden' }}>
                {/* Card header: avatar + author + timestamp + type badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1.25rem 0' }}>
                  <div className="avatar">
                    {item.author?.avatar_url ? (
                      <img src={item.author.avatar_url} alt="" />
                    ) : (
                      authorInitials(item.author?.full_name ?? item.startup_name ?? undefined)
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.author?.full_name ?? item.startup_name ?? 'Unknown'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {relativeTime(item.created_at)}
                      </span>
                    </div>
                    {item.startup_name && item.author?.full_name && (
                      <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                        {item.startup_name}
                      </p>
                    )}
                  </div>
                  <span className="badge info" style={{ flexShrink: 0 }}>
                    {formatEventType(item.event_type)}
                  </span>
                </div>

                {/* Card body: title + content */}
                <div style={{ padding: '0.625rem 1.25rem' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 500, margin: '0 0 0.25rem' }}>
                    {item.title || item.startup_name || 'Update'}
                  </h3>
                  {item.content ? (
                    <Markdown size="sm">{item.content}</Markdown>
                  ) : (
                    <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', margin: 0, lineHeight: 1.6 }}>
                      No additional details provided.
                    </p>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                      {item.tags.map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Link preview */}
                  {item.link_url ? (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.625rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        background: 'hsl(var(--muted) / 0.5)',
                        border: '1px solid hsl(var(--border))',
                        fontSize: '0.8125rem',
                        color: 'var(--gold)',
                        textDecoration: 'none',
                        transition: 'background 0.15s',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <ExternalLink style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0, strokeWidth: 1.5 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.link_url.replace(/^https?:\/\//, '').slice(0, 60)}
                      </span>
                    </a>
                  ) : null}
                </div>

                {/* Card footer: like + comment */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.5rem 1.25rem 0.75rem',
                    borderTop: '1px solid hsl(var(--border) / 0.5)',
                  }}
                >
                  <button
                    type="button"
                    className="btn-sm ghost"
                    onClick={() => handleLike(item)}
                    aria-pressed={state.liked}
                    disabled={state.busy}
                    data-testid={`like-btn-${item.id}`}
                    style={{
                      color: state.liked ? 'var(--gold)' : undefined,
                    }}
                  >
                    <Heart
                      style={{
                        width: '0.875rem',
                        height: '0.875rem',
                        strokeWidth: 1.5,
                        fill: state.liked ? 'var(--gold)' : 'none',
                      }}
                    />
                    <span>{state.likeCount}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-sm ghost"
                    onClick={() => handleCommentToggle(item)}
                    aria-expanded={state.commentOpen}
                    aria-controls={`feed-comment-${item.id}`}
                    data-testid={`comment-btn-${item.id}`}
                    style={{
                      color: state.commentOpen ? 'var(--gold)' : undefined,
                    }}
                  >
                    <MessageSquare style={{ width: '0.875rem', height: '0.875rem', strokeWidth: 1.5 }} />
                    <span>{state.commentCount}</span>
                  </button>
                  {item.link_url ? (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                      style={{ marginLeft: 'auto', textDecoration: 'none' }}
                    >
                      <ExternalLink style={{ width: '0.875rem', height: '0.875rem', strokeWidth: 1.5 }} />
                      Link
                    </a>
                  ) : null}
                </div>

                {/* Inline comments */}
                {state.commentOpen ? (
                  <div style={{ padding: '0 1.25rem 1rem' }}>
                    <CommentSection
                      eventId={item.id}
                      onCountChange={(delta) => {
                        setInteractions((prev) => {
                          const current = prev[item.id]
                          if (!current) return prev
                          return {
                            ...prev,
                            [item.id]: {
                              ...current,
                              commentCount: Math.max(0, current.commentCount + delta),
                            },
                          }
                        })
                      }}
                    />
                  </div>
                ) : null}
              </article>
            )
          })}

          {/* Empty state per tab */}
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                {tab === 'ranked' ? <BarChart3 /> : tab === 'trending' ? <TrendingUp /> : <Rss />}
              </div>
              <div className="empty-title">{emptyMessages[tab].title}</div>
              <div className="empty-description">{emptyMessages[tab].desc}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
