import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Heart,
  MessageSquare,
  Send,
  ExternalLink,
  Pencil,
  Trash2,
  Reply,
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
import { FeedListSkeleton } from '../components/skeletons'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { buildProfileUrl } from '../lib/slugId'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { Markdown } from '../components/Markdown'
import { MarkdownCanvas, type MarkdownCanvasHandle } from '../components/MarkdownCanvas'
import { CommentComposer, ComposerHint, decodeMentions, type Mention } from '../components/CommentComposer'
import type { FeedAttribution, FeedComment, FeedEvent, LinkPreview } from '../types/feed'

/**
 * Compact chip used in the composer's "Posting as" multi-select. Active state
 * is a primary-tinted fill; inactive is a hairline border. Optional avatar
 * thumbnail for startup chips.
 */
function AttributionChip({
  active,
  onToggle,
  label,
  avatarUrl,
  testId,
}: {
  active: boolean
  onToggle: () => void
  label: string
  avatarUrl?: string | null
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid={testId}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.3rem 0.625rem',
        borderRadius: '999px',
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: 'pointer',
        background: active ? 'hsl(var(--primary) / 0.15)' : 'transparent',
        color: active ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
        border: `1px solid ${active ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))'}`,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : null}
      {label}
    </button>
  )
}

/**
 * Stacked avatars for a feed card byline. Renders up to 3 overlapping circles
 * for multi-attribution posts; a single avatar otherwise. Each avatar links to
 * the attribution's `link` when present (e.g. startup profile, founder page).
 */
function StackedAvatars({ attributions, fallbackInitials }: {
  attributions: FeedAttribution[]
  fallbackInitials: string
}) {
  const shown = attributions.slice(0, 3)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((a, idx) => (
        <div
          key={`${a.kind}-${a.id}`}
          className="avatar"
          style={{
            marginLeft: idx === 0 ? 0 : '-0.5rem',
            border: '2px solid hsl(var(--card))',
            zIndex: shown.length - idx,
            position: 'relative',
          }}
          title={`${a.name}${a.role_label ? ` · ${a.role_label}` : ''}`}
        >
          {a.avatar_url ? (
            <img src={a.avatar_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>
              {(a.name || fallbackInitials || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

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

/**
 * Did this comment actually get edited, or is the timestamp delta just noise?
 *
 * Django sets `created_at` (auto_now_add) and `updated_at` (auto_now) via
 * independent pre_save callbacks on INSERT. Each calls `timezone.now()`
 * separately, so they differ at the microsecond level on every fresh row.
 * A strict `updated_at !== created_at` check would flag every comment as
 * "(edited)" the instant it was posted.
 *
 * 1.5 second tolerance covers the auto_now race + any clock skew between
 * the two queries, while still flagging real edits (which can't happen in
 * under 1.5s — the user has to click Edit, type, click Save).
 */
function wasEdited(c: FeedComment): boolean {
  if (!c.updated_at || !c.created_at) return false
  const created = new Date(c.created_at).getTime()
  const updated = new Date(c.updated_at).getTime()
  if (Number.isNaN(created) || Number.isNaN(updated)) return false
  return updated - created > 1500
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
  // Re-seeded from the comment's stored markdown when entering edit mode, so
  // mention → user-id links survive an edit cycle. See decodeMentions.
  const [editMentions, setEditMentions] = useState<Mention[]>([])
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [hintShow, setHintShow] = useState(false)
  /** When set, the inline reply composer renders below the thread rooted at this id. */
  const [replyingToRootId, setReplyingToRootId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

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

  /**
   * Optimistic post: the comment appears in the list instantly with a
   * temporary id; if the API fails, roll it back and restore the draft so
   * the user doesn't lose their typing.
   */
  const handleSubmit = async (encoded: string) => {
    const content = encoded.trim()
    if (!content || submitting || !user) return

    // Snapshot the textarea's plain form before clearing, so a failed POST
    // can restore the draft in display form (not the URL-encoded canonical).
    const draftBackup = newComment

    const tempId = `temp-${Date.now()}`
    const optimistic: FeedComment = {
      id: tempId,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: user.id,
        full_name: user.full_name,
        profile_picture: user.avatar_url ?? null,
      },
    } as FeedComment

    setComments((prev) => [...prev, optimistic])
    setNewComment('')
    onCountChange(1)
    setSubmitting(true)

    try {
      const created = await apiRequest<FeedComment>(`/feed/${eventId}/comments/`, {
        method: 'POST',
        body: { content },
      })
      setComments((prev) => prev.map((c) => (c.id === tempId ? created : c)))
    } catch {
      // Roll back: remove the optimistic comment, restore draft so the user
      // can retry without retyping.
      setComments((prev) => prev.filter((c) => c.id !== tempId))
      onCountChange(-1)
      setNewComment(draftBackup)
      pushToast('Unable to post comment. Try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (commentId: string, encoded: string) => {
    const content = encoded.trim()
    if (!content) return

    setEditSubmitting(true)
    try {
      const updated = await apiRequest<FeedComment>(
        `/feed/${eventId}/comments/${commentId}/`,
        { method: 'PATCH', body: { content } },
      )
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)))
      setEditingId(null)
      setEditContent('')
      setEditMentions([])
    } catch {
      pushToast('Unable to edit comment.', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return

    // Optimistic remove — restore on failure.
    const snapshot = comments
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    onCountChange(-1)
    setDeletingId(commentId)

    try {
      await apiRequest(`/feed/${eventId}/comments/${commentId}/`, {
        method: 'DELETE',
      })
    } catch {
      setComments(snapshot)
      onCountChange(1)
      pushToast('Unable to delete comment.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (comment: FeedComment) => {
    // Convert stored canonical `[@Name](/app/users/<id>)` into clean `@Name`
    // for the textarea, and seed the composer with the mention list so the
    // user-id link survives a save without re-typing.
    const { plain, mentions } = decodeMentions(comment.content)
    setEditingId(comment.id)
    setEditContent(plain)
    setEditMentions(mentions)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
    setEditMentions([])
  }

  /**
   * Open the reply composer targeted at a SPECIFIC comment. Backend allows
   * the reply chain to grow up to MAX_REPLY_DEPTH (5) before rejecting, so
   * `parent_id` is the clicked comment's id, not the thread root.
   */
  const startReply = (comment: FeedComment) => {
    setReplyingToRootId(comment.id)
    setReplyContent('')
  }

  const cancelReply = () => {
    setReplyingToRootId(null)
    setReplyContent('')
  }

  const handleReply = async (parentId: string, encoded: string) => {
    const content = encoded.trim()
    if (!content || replySubmitting || !user) return

    // Restore the plain draft (not the encoded form) if the post fails.
    const draftBackup = replyContent

    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    const optimistic: FeedComment = {
      id: tempId,
      content,
      parent_id: parentId,
      created_at: now,
      updated_at: now,
      user: {
        id: user.id,
        full_name: user.full_name,
        profile_picture: user.avatar_url ?? null,
      },
    } as FeedComment

    setComments((prev) => [...prev, optimistic])
    setReplyContent('')
    setReplyingToRootId(null)
    onCountChange(1)
    setReplySubmitting(true)

    try {
      const created = await apiRequest<FeedComment>(`/feed/${eventId}/comments/`, {
        method: 'POST',
        body: { content, parent_id: parentId },
      })
      setComments((prev) => prev.map((c) => (c.id === tempId ? created : c)))
    } catch (err: unknown) {
      // Backend returns 400 with `error` field for depth-cap violations or
      // missing parents. Surface the message verbatim so the user can act.
      const errMsg = (err as { details?: { error?: string } })?.details?.error
        ?? 'Unable to post reply. Try again.'
      setComments((prev) => prev.filter((c) => c.id !== tempId))
      onCountChange(-1)
      setReplyContent(draftBackup)
      setReplyingToRootId(parentId)
      pushToast(errMsg, 'error')
    } finally {
      setReplySubmitting(false)
    }
  }

  /**
   * Render a single comment row. Shared between top-level and reply branches
   * so the row UX stays consistent — same avatar size, same actions, same
   * edit composer. The `isReply` flag only affects styling (no avatar size
   * change yet, but kept for future hooks).
   */
  const renderCommentRow = (comment: FeedComment, isReply: boolean) => {
    const isOwn = user?.id === comment.user.id
    const isEditing = editingId === comment.id
    const isDeleting = deletingId === comment.id
    const isTemp = comment.id.startsWith('temp-')

    return (
      <div
        key={comment.id}
        data-testid={`comment-${comment.id}`}
        style={{
          display: 'flex',
          gap: '0.625rem',
          padding: '0.5rem 0',
          opacity: isTemp ? 0.65 : 1, // visual hint while the post is in-flight
        }}
      >
        <div
          className="avatar"
          style={{
            width: isReply ? '1.25rem' : '1.5rem',
            height: isReply ? '1.25rem' : '1.5rem',
            fontSize: '0.625rem',
            flexShrink: 0,
            marginTop: '0.125rem',
          }}
        >
          {comment.user.profile_picture ? (
            <img src={comment.user.profile_picture} alt="" loading="lazy" decoding="async" />
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
              {wasEdited(comment) && ' (edited)'}
            </span>
            {!isEditing && !isTemp && (
              <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
                <button
                  type="button"
                  className="btn-sm ghost"
                  style={{ padding: '0.125rem 0.25rem' }}
                  onClick={() => startReply(comment)}
                  title="Reply to this comment"
                  aria-label="Reply"
                  data-testid={`comment-reply-btn-${comment.id}`}
                >
                  <Reply className="w-3 h-3" strokeWidth={1.5} />
                </button>
                {isOwn && (
                  <>
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
                  </>
                )}
              </div>
            )}
          </div>
          {isEditing ? (
            <CommentComposer
              value={editContent}
              onChange={setEditContent}
              onSubmit={(encoded) => void handleEdit(comment.id, encoded)}
              onCancel={cancelEdit}
              submitting={editSubmitting}
              mode="save"
              compact
              enableMentions
              initialMentions={editMentions}
              placeholder="Edit your comment…"
              data-testid={`comment-edit-input-${comment.id}`}
            />
          ) : (
            <Markdown size="sm">{comment.content}</Markdown>
          )}
        </div>
      </div>
    )
  }

  /**
   * Render a single thread rooted at `comment`, recursing into its children
   * for each level. Each level shifts content right by ~1.5rem and draws a
   * left rail so the tree shape is visible. Composer for replies sits at
   * the bottom of the parent's child block (so visually, your reply lands
   * directly under the comment you're replying to, before any sibling
   * replies that come later).
   *
   * The recursion is bounded by the backend's MAX_REPLY_DEPTH=5 — past that,
   * a comment can't be created so this never walks deeper than 5 levels in
   * practice. We don't enforce the cap visually; the backend rejection on
   * over-cap replies surfaces as a toast.
   */
  const renderThread = (comment: FeedComment, depth: number): React.ReactNode => {
    const kids = childrenOf[comment.id] ?? []
    const isReplying = replyingToRootId === comment.id
    // Cap visual indentation at depth 5; deeper trees still render, just
    // without additional rightward shift so mobile width stays usable.
    const visualDepth = Math.min(depth, 5)
    return (
      <div
        key={comment.id}
        className="comment-thread"
        data-testid={`comment-thread-${comment.id}`}
        style={depth > 0 ? {
          marginLeft: '2.125rem',
          paddingLeft: '0.75rem',
          borderLeft: '2px solid hsl(var(--border))',
        } : undefined}
      >
        {renderCommentRow(comment, depth > 0)}
        {kids.map((child) => renderThread(child, visualDepth + 1))}
        {isReplying && (
          <div
            style={{
              marginLeft: '2.125rem',
              marginTop: '0.5rem',
              paddingLeft: '0.75rem',
              borderLeft: '2px solid hsl(var(--primary) / 0.3)',
            }}
            data-testid={`reply-composer-${comment.id}`}
          >
            <p
              style={{
                margin: '0 0 0.25rem',
                fontSize: '0.6875rem',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              Replying to{' '}
              <strong style={{ color: 'hsl(var(--foreground))' }}>
                {comment.user.full_name ?? 'comment'}
              </strong>
            </p>
            <CommentComposer
              value={replyContent}
              onChange={setReplyContent}
              onSubmit={(encoded) => void handleReply(comment.id, encoded)}
              onCancel={cancelReply}
              submitting={replySubmitting}
              compact
              enableMentions
              enableAttachments
              placeholder={`Reply to ${comment.user.full_name ?? 'this comment'}…`}
              data-testid={`reply-input-${comment.id}`}
            />
          </div>
        )}
      </div>
    )
  }

  /**
   * Build a tree of comments from the flat array, keyed by parent_id.
   * Top-level = comments with no parent_id (or with a parent_id that points
   * at a comment we don't have — e.g. parent was deleted and SET_NULL kicked
   * in, leaving the child as a logical top-level).
   *
   * `childrenOf[parentId]` is a sorted-by-created-at array of direct children.
   * The render walks this map recursively, so the visual depth always matches
   * the actual chain depth. Backend caps at MAX_REPLY_DEPTH=5.
   */
  const { roots, childrenOf } = useMemo(() => {
    const known = new Set(comments.map((c) => c.id))
    const top: FeedComment[] = []
    const kids: Record<string, FeedComment[]> = {}
    for (const c of comments) {
      // Treat as top-level if parent_id is null OR points at a comment we
      // don't have (deleted parent — SET_NULL leaves the FK pointing at a
      // ghost; if optimistic order matters this also catches a parent that
      // hasn't loaded yet).
      const effectiveParent = c.parent_id && known.has(c.parent_id) ? c.parent_id : null
      if (effectiveParent === null) {
        top.push(c)
      } else {
        (kids[effectiveParent] ??= []).push(c)
      }
    }
    for (const k of Object.keys(kids)) {
      kids[k].sort((a, b) => a.created_at.localeCompare(b.created_at))
    }
    top.sort((a, b) => a.created_at.localeCompare(b.created_at))
    return { roots: top, childrenOf: kids }
  }, [comments])

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
            {roots.map((root) => renderThread(root, 0))}
          </div>
        </>
      )}

      <div
        data-testid={`comment-form-${eventId}`}
        style={{ marginTop: '0.625rem' }}
        onFocus={() => setHintShow(true)}
        onBlur={(e) => {
          // Hide the hint when focus leaves the composer entirely (not just
          // the textarea — the buttons live inside the same wrapper).
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setHintShow(false)
          }
        }}
      >
        <CommentComposer
          value={newComment}
          onChange={setNewComment}
          onSubmit={(encoded) => void handleSubmit(encoded)}
          submitting={submitting}
          placeholder="Write a comment…  Type @ to mention, drop a screenshot to attach."
          enableAttachments
          enableMentions
          avatar={
            user?.avatar_url ? (
              <img src={user.avatar_url} alt="" loading="lazy" decoding="async" />
            ) : (
              authorInitials(user?.full_name ?? 'You')
            )
          }
          data-testid={`comment-input-${eventId}`}
        />
        <ComposerHint show={hintShow} />
      </div>
    </div>
  )
}

/**
 * Renders the OG link card in a post body. If the backend has fetched
 * metadata (status='ok' with at least a title or image), shows a rich
 * card with thumbnail + site + title + description. Otherwise falls back
 * to the original bare-URL chip — which is what the user sees in the
 * brief window between posting and the worker finishing the fetch.
 */
function LinkPreviewBlock({
  url,
  preview,
}: {
  url: string
  preview?: LinkPreview | null
}) {
  const [imageBroken, setImageBroken] = useState(false)
  const hasCard =
    preview && preview.status === 'ok' && (preview.title || preview.image_url)

  if (!hasCard) {
    return (
      <a
        href={url}
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
          {url.replace(/^https?:\/\//, '').slice(0, 60)}
        </span>
      </a>
    )
  }

  const showImage = preview.image_url && !imageBroken
  // Hostname for the footer label — preferred over og:site_name when the
  // site doesn't set one, falls back to the raw URL if URL parsing fails
  // (shouldn't happen since the backend validated it, but defense in depth).
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    host = url
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex',
        marginTop: '0.625rem',
        borderRadius: '0.5rem',
        border: '1px solid hsl(var(--border))',
        background: 'hsl(var(--card))',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {showImage ? (
        <img
          src={preview.image_url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageBroken(true)}
          style={{
            width: '7.5rem',
            minHeight: '5rem',
            objectFit: 'cover',
            flexShrink: 0,
            background: 'hsl(var(--muted))',
          }}
        />
      ) : null}
      <div
        style={{
          padding: '0.625rem 0.75rem',
          minWidth: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.125rem',
        }}
      >
        <span
          style={{
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'hsl(var(--muted-foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {preview.site_name || host}
        </span>
        {preview.title ? (
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'hsl(var(--foreground))',
              // Two-line clamp — webkit-line-clamp works in all modern
              // browsers including Firefox now.
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview.title}
          </span>
        ) : null}
        {preview.description ? (
          <span
            style={{
              fontSize: '0.75rem',
              lineHeight: 1.4,
              color: 'hsl(var(--muted-foreground))',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview.description}
          </span>
        ) : null}
      </div>
    </a>
  )
}

const FEED_PAGE_SIZE = 20

function feedEndpoint(tab: FeedTab, offset: number) {
  if (tab === 'ranked') return `/feed/ranked/?limit=${FEED_PAGE_SIZE}&offset=${offset}`
  if (tab === 'trending') return `/feed/trending/?limit=${FEED_PAGE_SIZE}&offset=${offset}`
  return `/feed/?page=${Math.floor(offset / FEED_PAGE_SIZE) + 1}&page_size=${FEED_PAGE_SIZE}`
}

export function FeedPage() {
  const { pushToast } = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState<FeedTab>('ranked')
  const [items, setItems] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [interactions, setInteractions] = useState<Record<string, FeedInteraction>>({})
  const [composerOpen, setComposerOpen] = useState(false)
  // Used at submit time to pull the IDs of files dropped into the
  // composer so the post-create call can link them to the new FeedEvent.
  // Without this the attachment rows stay orphans and the renderer can't
  // resolve URLs to their metadata (no doc card / video poster / etc.).
  const composerCanvasRef = useRef<MarkdownCanvasHandle | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({
    event_type: feedEventTypes[0].value,
    title: '',
    content: '',
    link_url: '',
    tags: '',
  })

  /**
   * Multi-profile attribution state — see backend FeedEvent.
   * `myStartups` is the list of startups the user can post as (loaded once,
   * when the composer first opens). `hasFounderProfile` / `hasInvestorProfile`
   * gate the corresponding identity checkboxes. The Set + booleans are the
   * actual selection, defaulted via applySmartDefault() on composer open.
   */
  type ComposerStartup = { id: string; name: string; logo_url: string | null }
  const [myStartups, setMyStartups] = useState<ComposerStartup[]>([])
  const [hasFounderProfile, setHasFounderProfile] = useState(false)
  const [hasInvestorProfile, setHasInvestorProfile] = useState(false)
  const [attributionLoaded, setAttributionLoaded] = useState(false)
  const [selectedStartupIds, setSelectedStartupIds] = useState<Set<string>>(new Set())
  const [postAsFounder, setPostAsFounder] = useState(false)
  const [postAsInvestor, setPostAsInvestor] = useState(false)

  const tagList = useMemo(
    () =>
      form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags],
  )

  // Lazy-load attribution options the first time the composer opens. Cheap
  // queries, but no reason to fire them for users who never post.
  //
  // Each request is individually wrapped in .catch() so a rejection never
  // reaches Promise.all (which would propagate it). 404 is the *expected*
  // shape for "no founder/investor profile" — we treat it as "absent" not
  // an error. This keeps the composer working for users with any combo of
  // founder/investor/startup roles.
  useEffect(() => {
    if (!composerOpen || attributionLoaded) return
    let cancelled = false
    void (async () => {
      type MyStartupsResp = { results?: ComposerStartup[] } | ComposerStartup[]
      const [startupsResult, founderResult, investorResult] = await Promise.all([
        apiRequest<MyStartupsResp>('/founders/my-startups/').catch(() => null),
        apiRequest('/founders/profile/me/').catch(() => null),
        apiRequest('/investors/profile/me/').catch(() => null),
      ])
      if (cancelled) return

      const startups: ComposerStartup[] = startupsResult
        ? (Array.isArray(startupsResult)
            ? startupsResult
            : startupsResult.results ?? [])
        : []
      const hasFounder = founderResult !== null
      const hasInvestor = investorResult !== null

      setMyStartups(startups)
      setHasFounderProfile(hasFounder)
      setHasInvestorProfile(hasInvestor)
      setAttributionLoaded(true)

      // Smart default: pick one identity automatically so the user can hit
      // submit without thinking. They can change before posting.
      //  - exactly one startup → that startup
      //  - founder profile exists → post as founder
      //  - investor profile exists → post as investor
      //  - none → leave empty; backend will fall back to bare User.
      if (selectedStartupIds.size === 0 && !postAsFounder && !postAsInvestor) {
        if (startups.length === 1) {
          setSelectedStartupIds(new Set([startups[0].id]))
        } else if (hasFounder) {
          setPostAsFounder(true)
        } else if (hasInvestor) {
          setPostAsInvestor(true)
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerOpen, attributionLoaded])

  // Reset and reload when tab changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setItems([])
      setOffset(0)
      setHasMore(true)
      try {
        const data = await apiRequest<FeedEvent[] | { results: FeedEvent[]; next?: string | null }>(feedEndpoint(tab, 0))
        if (!cancelled) {
          const results = normalizeList(data)
          setItems(results)
          setOffset(results.length)
          setHasMore(results.length === FEED_PAGE_SIZE && (!('next' in data) || !!data.next))
        }
      } catch {
        if (!cancelled) setError('Unable to load feed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [tab])

  // Infinite scroll — load more when sentinel enters viewport
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || loadingMore || !hasMore) return
        const load = async () => {
          setLoadingMore(true)
          try {
            const data = await apiRequest<FeedEvent[] | { results: FeedEvent[]; next?: string | null }>(feedEndpoint(tab, offset))
            const results = normalizeList(data)
            if (results.length === 0) {
              setHasMore(false)
            } else {
              setItems((prev) => {
                const existingIds = new Set(prev.map((i) => i.id))
                return [...prev, ...results.filter((r) => !existingIds.has(r.id))]
              })
              setOffset((prev) => prev + results.length)
              setHasMore(results.length === FEED_PAGE_SIZE && (!('next' in data) || !!data.next))
            }
          } catch {
            // silent — user can scroll up/down to retry
          } finally {
            setLoadingMore(false)
          }
        }
        void load()
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [tab, offset, hasMore, loading, loadingMore])

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
      const attachmentIds = composerCanvasRef.current?.getReferencedAttachmentIds() ?? []
      await apiRequest('/feed/create/', {
        method: 'POST',
        body: {
          event_type: form.event_type,
          title: form.title.trim(),
          content: form.content.trim(),
          link_url: form.link_url.trim() || undefined,
          tags: tagList.length ? tagList : undefined,
          // Files the user dropped into the composer. Backend's
          // FeedEventCreateSerializer.create() runs an update that sets
          // FeedAttachment.event_id for every orphan row in this list, so
          // the new post owns them and the read serializer can include
          // their metadata in `attachments`.
          attachment_ids: attachmentIds.length ? attachmentIds : undefined,
          // Multi-profile attribution. Backend applies its own smart default
          // if all three are empty, but we send the user's explicit choices
          // when they've made any.
          attributed_startup_ids: Array.from(selectedStartupIds),
          post_as_founder: postAsFounder,
          post_as_investor: postAsInvestor,
        },
      })
      pushToast('Post created', 'success')
      if (tab !== 'all') {
        pushToast('Switch to "all" to see the latest post.', 'info')
      }
      setForm((prev) => ({ ...prev, title: '', content: '', link_url: '', tags: '' }))
      setComposerOpen(false)

      const data = await apiRequest<FeedEvent[] | { results: FeedEvent[]; next?: string | null }>(feedEndpoint(tab, 0))
      const results = normalizeList(data)
      setItems(results)
      setOffset(results.length)
      setHasMore(results.length === FEED_PAGE_SIZE)
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

            {/* Posting-as selector. Multi-select chip row. Hidden when there's
                only the bare User as an option (no profiles, no startups) — in
                that case attribution falls back to User automatically. */}
            {attributionLoaded && (myStartups.length > 0 || hasFounderProfile || hasInvestorProfile) ? (
              <div style={{ marginBottom: '0.75rem' }} data-testid="composer-attribution">
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '0.4rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                  }}
                >
                  Posting as
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {hasFounderProfile && (
                    <AttributionChip
                      active={postAsFounder}
                      onToggle={() => setPostAsFounder((v) => !v)}
                      label={`${user?.full_name ?? 'You'} (Founder)`}
                      testId="attribution-founder"
                    />
                  )}
                  {hasInvestorProfile && (
                    <AttributionChip
                      active={postAsInvestor}
                      onToggle={() => setPostAsInvestor((v) => !v)}
                      label={`${user?.full_name ?? 'You'} (Investor)`}
                      testId="attribution-investor"
                    />
                  )}
                  {myStartups.map((s) => (
                    <AttributionChip
                      key={s.id}
                      active={selectedStartupIds.has(s.id)}
                      onToggle={() =>
                        setSelectedStartupIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(s.id)) {
                            next.delete(s.id)
                          } else {
                            next.add(s.id)
                          }
                          return next
                        })
                      }
                      label={s.name}
                      avatarUrl={s.logo_url}
                      testId={`attribution-startup-${s.id}`}
                    />
                  ))}
                </div>
              </div>
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
                  // Matches FeedEvent.title's max_length=255 column cap.
                  maxLength={255}
                  data-testid="post-title-input"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Content</label>
              {/* Canvas-style editor: drag a screenshot, paste from clipboard,
                  or hit Attach to inline images and docs into the post.
                  Goes through /feed/attachments/upload/ which enforces the
                  MIME allowlist and runs async virus scanning before the
                  URL is exposed to readers. */}
              <MarkdownCanvas
                ref={composerCanvasRef}
                className="textarea"
                value={form.content}
                onChange={(next) => setForm((prev) => ({ ...prev, content: next }))}
                rows={4}
                // Match backend's MAX_POST_CONTENT_CHARS — the textarea
                // browser-enforces the limit so the user can't get into a
                // state where their post would fail server validation.
                maxLength={10000}
                placeholder="Write the details you want investors to see. Drag-and-drop images or files to attach inline."
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
      {loading ? <FeedListSkeleton count={4} /> : null}
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
                {/* Card header: stacked avatars + attribution row + timestamp + type badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1.25rem 0' }}>
                  {(() => {
                    const attributions = item.attributions ?? []
                    // Back-compat: when the backend hasn't been redeployed
                    // yet, fall back to a single-author byline from item.author.
                    if (attributions.length === 0) {
                      const profilePath = item.author?.profile_id
                        ? buildProfileUrl(
                            item.author.role === 'investor' ? 'investors' : 'founders',
                            item.author.full_name,
                            item.author.profile_id,
                          )
                        : null
                      const inner = (
                        <>
                          <div className="avatar">
                            {item.author?.avatar_url ? (
                              <img src={item.author.avatar_url} alt="" loading="lazy" decoding="async" />
                            ) : (
                              authorInitials(item.author?.full_name ?? item.startup_name ?? undefined)
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                {item.author?.full_name ?? item.startup_name ?? 'Unknown'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                {relativeTime(item.created_at)}
                              </span>
                            </div>
                          </div>
                        </>
                      )
                      return profilePath ? (
                        <Link
                          to={profilePath}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                          data-testid={`author-link-${item.id}`}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          {inner}
                        </div>
                      )
                    }

                    const primary = attributions[0]
                    const rest = attributions.slice(1)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <StackedAvatars
                          attributions={attributions}
                          fallbackInitials={item.author?.full_name ?? ''}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {primary.link ? (
                              <Link
                                to={primary.link}
                                style={{ fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none', color: 'inherit' }}
                                data-testid={`attribution-primary-${item.id}`}
                              >
                                {primary.name}
                              </Link>
                            ) : (
                              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                {primary.name}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                              {relativeTime(item.created_at)}
                            </span>
                          </div>
                          {rest.length > 0 && (
                            <p
                              style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}
                              data-testid={`attribution-rest-${item.id}`}
                            >
                              also by{' '}
                              {rest.map((a, idx) => (
                                <span key={`${a.kind}-${a.id}`}>
                                  {idx > 0 ? ' · ' : ''}
                                  {a.link ? (
                                    <Link to={a.link} style={{ color: 'inherit', textDecoration: 'underline' }}>
                                      {a.name}
                                    </Link>
                                  ) : (
                                    a.name
                                  )}
                                  {a.role_label ? ` (${a.role_label})` : ''}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })()}
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
                    <Markdown size="sm" attachments={item.attachments}>{item.content}</Markdown>
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

                  {/* Link preview — rich OG card when the backend has finished
                      fetching, bare URL chip otherwise (status='pending'/'error'
                      or no preview row yet). */}
                  {item.link_url ? (
                    <LinkPreviewBlock url={item.link_url} preview={item.link_preview} />
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

          {/* Infinite scroll sentinel */}
          {items.length > 0 && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}
          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', color: 'hsl(var(--muted-foreground))' }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', padding: '1rem 0' }}>
              You've reached the end
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}
