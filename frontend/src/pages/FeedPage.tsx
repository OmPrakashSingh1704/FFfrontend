import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Sparkles, Send, ExternalLink, ThumbsUp, MessageCircle, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
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
    <div className="comment-section" id={`feed-comment-${eventId}`} data-testid={`comment-section-${eventId}`}>
      {loading ? (
        <div className="comment-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading comments...</span>
        </div>
      ) : (
        <>
          {comments.length === 0 && (
            <p className="comment-empty">No comments yet. Be the first to reply.</p>
          )}
          <div className="comment-list">
            {comments.map((comment) => {
              const isOwn = user?.id === comment.user.id
              const isEditing = editingId === comment.id
              const isDeleting = deletingId === comment.id

              return (
                <div
                  key={comment.id}
                  className="comment-item"
                  data-testid={`comment-${comment.id}`}
                >
                  <div className="comment-header">
                    <span className="comment-author">{comment.user.full_name ?? 'User'}</span>
                    <span className="comment-time">
                      {new Date(comment.created_at).toLocaleString()}
                      {comment.updated_at !== comment.created_at && ' (edited)'}
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="comment-edit-form">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        data-testid={`comment-edit-input-${comment.id}`}
                      />
                      <div className="comment-edit-actions">
                        <button
                          type="button"
                          className="comment-action-btn"
                          onClick={() => handleEdit(comment.id)}
                          disabled={!editContent.trim()}
                          data-testid={`comment-save-${comment.id}`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="comment-action-btn"
                          onClick={cancelEdit}
                          data-testid={`comment-cancel-${comment.id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="comment-content">{comment.content}</p>
                  )}
                  {isOwn && !isEditing && (
                    <div className="comment-owner-actions">
                      <button
                        type="button"
                        className="comment-action-btn"
                        onClick={() => startEdit(comment)}
                        data-testid={`comment-edit-btn-${comment.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="comment-action-btn danger"
                        onClick={() => handleDelete(comment.id)}
                        disabled={isDeleting}
                        data-testid={`comment-delete-btn-${comment.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <form className="comment-form" onSubmit={handleSubmit} data-testid={`comment-form-${eventId}`}>
        <textarea
          ref={inputRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          maxLength={2000}
          data-testid={`comment-input-${eventId}`}
        />
        <button
          type="submit"
          className="btn primary comment-submit-btn"
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
        pushToast('Switch to “all” to see the latest post.', 'info')
      }
      setForm((prev) => ({ ...prev, title: '', content: '', link_url: '', tags: '' }))

      const endpoint = tab === 'ranked' ? '/feed/ranked/' : tab === 'trending' ? '/feed/trending/' : '/feed/'
      const data = await apiRequest<FeedEvent[] | { results: FeedEvent[] }>(endpoint)
      setItems(normalizeList(data))
    } catch {
      setFormError('Unable to publish post. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="content-section" data-testid="feed-page">
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-cyan-400">Network</span>
          </div>
          <h1>Feed</h1>
          <p>Signals, updates, and highlights across your network.</p>
        </div>
        <div className="segmented" data-testid="feed-tabs">
          {(['ranked', 'trending', 'all'] as FeedTab[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`segmented-btn ${tab === option ? 'active' : ''}`}
              onClick={() => setTab(option)}
              data-testid={`feed-tab-${option}`}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      <form className="feed-composer" onSubmit={handleCreate} data-testid="feed-composer">
        <header>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2>Create a post</h2>
          </div>
          <p>Share an update, milestone, or investor insight with your network.</p>
        </header>
        {formError ? <div className="form-error">{formError}</div> : null}
        <div className="composer-grid">
          <label>
            Event type
            <select
              value={form.event_type}
              onChange={(event) => setForm((prev) => ({ ...prev, event_type: event.target.value }))}
              data-testid="post-type-select"
            >
              {feedEventTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Announce your progress"
              data-testid="post-title-input"
            />
          </label>
        </div>
        <label>
          Content
          <textarea
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            rows={5}
            placeholder="Write the details you want investors to see."
            data-testid="post-content-textarea"
          />
        </label>
        <div className="composer-grid">
          <label>
            Link (optional)
            <input
              value={form.link_url}
              onChange={(event) => setForm((prev) => ({ ...prev, link_url: event.target.value }))}
              placeholder="https://"
              data-testid="post-link-input"
            />
          </label>
          <label>
            Tags (comma separated)
            <input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="launch, hiring, demo"
              data-testid="post-tags-input"
            />
          </label>
        </div>
        <div className="composer-actions">
          <p>{tagList.length ? `${tagList.length} tag${tagList.length === 1 ? '' : 's'} added` : 'Add tags to boost reach.'}</p>
          <button className="btn primary" type="submit" disabled={submitting} data-testid="publish-post-btn">
            <Send className="w-4 h-4 mr-2" />
            {submitting ? 'Publishing...' : 'Publish post'}
          </button>
        </div>
      </form>

      {loading ? <div className="page-loader">Loading feed...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="feed-list" data-testid="feed-list">
          {items.map((item) => {
            const state = getInteraction(item, interactions)
            return (
              <article key={item.id} className="feed-card" data-testid={`feed-item-${item.id}`}>
                <div className="feed-meta">
                  <span className="data-eyebrow">{item.event_type ?? 'Update'}</span>
                  <span>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
                </div>
                <h3>{item.title || item.startup_name || 'Update'}</h3>
                <p>{item.content || 'No additional details provided.'}</p>
                {item.startup_name ? (
                  <div className="feed-startup">
                    <span>From: {item.startup_name}</span>
                  </div>
                ) : null}
                <div className="feed-actions">
                  <button
                    type="button"
                    className={`feed-action-btn ${state.liked ? 'is-active' : ''}`}
                    onClick={() => handleLike(item)}
                    aria-pressed={state.liked}
                    disabled={state.busy}
                    data-testid={`like-btn-${item.id}`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>{state.likeCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`feed-action-btn ${state.commentOpen ? 'is-active' : ''}`}
                    onClick={() => handleCommentToggle(item)}
                    aria-expanded={state.commentOpen}
                    aria-controls={`feed-comment-${item.id}`}
                    data-testid={`comment-btn-${item.id}`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{state.commentCount}</span>
                  </button>
                  {item.link_url ? (
                    <a href={item.link_url} target="_blank" rel="noreferrer" className="feed-action-btn">
                      <ExternalLink className="w-4 h-4" />
                      <span>Link</span>
                    </a>
                  ) : null}
                </div>
                {state.commentOpen ? (
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
                ) : null}
              </article>
            )
          })}
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No posts yet. Be the first to share an update!
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
