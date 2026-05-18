/**
 * Inline chat thread for embedding inside a deal room.
 *
 * Talks to the same /chat/conversations/<id>/* endpoints and /ws/chat/
 * WebSocket as the standalone ChatPage, scoped to a single conversation.
 * Intentionally a separate, smaller component instead of an extraction
 * from the 1700-line ChatPage — the goal here is "good chat inside the
 * deal room", not refactoring the main chat surface.
 *
 * Feature set (mirrors ChatPage for these):
 *   - Initial message load + mark-as-read
 *   - Real-time inbound via WebSocket (message.new + typing events)
 *   - Send via WebSocket with REST fallback when socket is closed
 *   - Typing indicator: sends typing.start/stop, shows others' typing
 *   - Edit own messages (15-minute window enforced server-side)
 *   - Delete own messages (soft delete)
 *   - Reactions (toggle endpoint; 6 common emojis)
 *   - Attachments (upload then attach to send payload)
 *   - Read-only mode when the deal room is closed
 *
 * Intentionally NOT included (use the standalone /app/chat for these):
 *   - Bots, slash commands
 *   - Audio / video calls
 *   - E2EE
 *   - Reply threading
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  Smile,
  Trash2,
  X,
} from 'lucide-react'
import { apiRequest, uploadRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { buildWsUrl } from '../lib/ws'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { resolveMediaUrl } from '../lib/env'
import type { ChatAttachment, ChatMessage, ChatReaction } from '../types/chat'

type WsEvent = {
  type: string
  data?: Record<string, unknown>
}

// Backend WS frames sometimes use `conversation_id` (Channels group form),
// the REST API uses `conversation` (FK serializer). Normalize so downstream
// logic sees one shape — mirrors ChatPage's helper.
const normalizeIncoming = (m: ChatMessage & { conversation_id?: string }): ChatMessage => ({
  ...m,
  conversation: m.conversation ?? m.conversation_id,
})

// Quick-pick emoji set. Keep small so the picker stays one-line. Any user
// can react with anything via the API (the server accepts 32-char strings),
// but the in-room picker is intentionally curated to common acks.
const QUICK_REACTIONS = ['👍', '❤️', '😄', '🎉', '👀', '🙏'] as const

function formatTime(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getInitials(name?: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function humanFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

// Derive a reaction count map from either the denormalized `reaction_summary`
// field the serializer attaches, or by aggregating the raw `reactions` list
// if that's the only thing the backend sent.
function buildReactionSummary(message: ChatMessage): Record<string, number> {
  if (message.reaction_summary && Object.keys(message.reaction_summary).length > 0) {
    return { ...message.reaction_summary }
  }
  return (message.reactions ?? []).reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1
    return acc
  }, {})
}

function getUserReactions(message: ChatMessage, userId?: string | number): string[] {
  if (message.user_reactions && message.user_reactions.length >= 0) return message.user_reactions
  if (!userId) return []
  return (message.reactions ?? [])
    .filter((r: ChatReaction) => String(r.user_id) === String(userId))
    .map((r) => r.emoji)
}

type Props = {
  conversationId: string
  /** True when the deal room is closed — disables every write action. */
  readOnly?: boolean
}

export function DealRoomChat({ conversationId, readOnly = false }: Props) {
  const { user, accessToken } = useAuth()
  const { pushToast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Typing — keyed by other-user id → display name (or '' if name unknown).
  // ChatPage stored a boolean; we store the name so we can render "Alice is
  // typing…" without a second lookup. Stale entries get garbage-collected
  // when a typing.stop arrives or after a 6s safety timeout per user.
  const [typingByUser, setTypingByUser] = useState<Record<string, { name: string; expires: number }>>({})

  // Edit state — null means not editing. When set, the bubble for this id
  // swaps to an inline textarea; the composer's primary action is hidden
  // until edit completes or cancels.
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [editingContent, setEditingContent] = useState('')

  // Pending attachment — one at a time, replaces previous on re-pick.
  // ChatPage allows the same (single-attachment-per-message). Cleared on
  // successful send.
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null)
  const [uploading, setUploading] = useState(false)

  // Hover state — track which message id (if any) has its action menu
  // open. Mouse-only for v1; touch users tap the bubble to toggle.
  const [hoveredId, setHoveredId] = useState<string | number | null>(null)
  const [reactingForId, setReactingForId] = useState<string | number | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const joinedRef = useRef<string | null>(null)
  const typingTimerRef = useRef<number | null>(null)

  // Initial fetch + mark-as-read. Re-runs only when conversationId changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const data = await apiRequest<ChatMessage[] | { results: ChatMessage[] }>(
          `/chat/conversations/${conversationId}/messages/`,
        )
        if (cancelled) return
        // Backend returns most-recent-first; reverse so the latest is at
        // the bottom of the scroll container (standard chat ordering).
        setMessages([...normalizeList(data)].reverse())
        void apiRequest(`/chat/conversations/${conversationId}/read/`, { method: 'POST' })
          .catch(() => null)
      } catch {
        if (!cancelled) setError('Unable to load messages.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [conversationId])

  // WebSocket: single shared /ws/chat/ endpoint. We join the conversation
  // channel after the socket is open. The `joinedRef` guard prevents a
  // double-join if React re-runs the effect (StrictMode) or the socket
  // briefly reconnects with the same conversation still active.
  const wsUrl = useMemo(
    () => (accessToken ? buildWsUrl('/ws/chat/', accessToken) : null),
    [accessToken],
  )
  const { status: wsStatus, lastMessage, sendJson } = useWebSocket(wsUrl, { reconnect: true })

  useEffect(() => {
    if (wsStatus !== 'open') {
      joinedRef.current = null
      return
    }
    if (joinedRef.current === conversationId) return
    sendJson({ type: 'conversation.join', data: { conversation_id: conversationId } })
    joinedRef.current = conversationId
    return () => {
      sendJson({ type: 'conversation.leave', data: { conversation_id: conversationId } })
      joinedRef.current = null
    }
  }, [wsStatus, conversationId, sendJson])

  // Heartbeat — mirrors ChatPage. Prevents idle WS connections from being
  // dropped by Azure / reverse-proxy timeouts.
  useEffect(() => {
    if (wsStatus !== 'open') return
    const id = window.setInterval(() => {
      sendJson({ type: 'heartbeat' })
    }, 30_000)
    return () => window.clearInterval(id)
  }, [wsStatus, sendJson])

  // Inbound message + typing + edit/delete/reaction handler — only react
  // to events for THIS conversation. The consumer skips echoes back to
  // the actor, so we don't need to filter out own events here; whatever
  // we receive is from someone else and should mutate local state.
  useEffect(() => {
    if (!lastMessage?.data) return
    try {
      const event = JSON.parse(lastMessage.data as string) as WsEvent
      const data = event.data ?? {}
      const convId = (data as { conversation_id?: string }).conversation_id
      if (convId && String(convId) !== String(conversationId)) return

      if (event.type === 'message.new') {
        const incoming = normalizeIncoming(data as ChatMessage & { conversation_id?: string })
        setMessages((prev) => {
          // De-dupe: own messages were appended optimistically before send.
          if (prev.some((m) => String(m.id) === String(incoming.id))) return prev
          return [...prev, incoming]
        })
      } else if (event.type === 'typing') {
        const userId = (data as { user_id?: string }).user_id
        const userName = (data as { user_name?: string }).user_name ?? ''
        const isTyping = (data as { is_typing?: boolean }).is_typing
        if (!userId) return
        setTypingByUser((prev) => {
          const next = { ...prev }
          if (isTyping) {
            // 6s safety: if a typing.stop never arrives (socket drop, etc.),
            // the indicator self-clears so it doesn't get stuck.
            next[String(userId)] = { name: userName, expires: Date.now() + 6000 }
          } else {
            delete next[String(userId)]
          }
          return next
        })
      } else if (event.type === 'message.edited') {
        // Another participant edited their message — patch content + edited_at
        // in place. Backend has already enforced the edit window and
        // sender-ownership rules; we trust the broadcast.
        const d = data as { message_id?: string; content?: string; edited_at?: string }
        if (!d.message_id) return
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id) === String(d.message_id)
              ? { ...m, content: d.content ?? m.content, edited_at: d.edited_at ?? new Date().toISOString() }
              : m,
          ),
        )
      } else if (event.type === 'message.deleted') {
        // Soft delete — backend keeps the row, but for the live view we
        // drop it from the list. Refetch on next mount will reconcile if
        // the backend ever exposes deleted tombstones (it doesn't today).
        const d = data as { message_id?: string }
        if (!d.message_id) return
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(d.message_id)))
      } else if (event.type === 'reaction.update') {
        // Another participant added or removed a reaction. Adjust the
        // count map on the target message. user_reactions stays untouched
        // — that field is OUR reactions only, and we already updated it
        // optimistically when WE reacted.
        const d = data as { message_id?: string; action?: 'added' | 'removed'; emoji?: string }
        if (!d.message_id || !d.emoji) return
        const delta = d.action === 'removed' ? -1 : 1
        setMessages((prev) =>
          prev.map((m) => {
            if (String(m.id) !== String(d.message_id)) return m
            const summary = buildReactionSummary(m)
            const next = (summary[d.emoji!] || 0) + delta
            if (next <= 0) delete summary[d.emoji!]
            else summary[d.emoji!] = next
            return { ...m, reaction_summary: summary }
          }),
        )
      }
    } catch {
      // Ignore unparseable frames.
    }
  }, [lastMessage, conversationId])

  // Garbage-collect stale typing entries every 2s. Cheap and ensures the
  // indicator never sticks if a peer disconnects without sending stop.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTypingByUser((prev) => {
        const now = Date.now()
        const next: typeof prev = {}
        let dirty = false
        for (const [k, v] of Object.entries(prev)) {
          if (v.expires > now) next[k] = v
          else dirty = true
        }
        return dirty ? next : prev
      })
    }, 2000)
    return () => window.clearInterval(id)
  }, [])

  // Auto-scroll to the latest message whenever the list grows — but only
  // when the user is already near the bottom. Interrupting a scroll-up
  // read would be hostile.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight)
    if (distanceFromBottom < 120) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages.length])

  // Emit typing.start with a 1400ms debounce (same as ChatPage) — we send
  // start on every keystroke and a stop after the user pauses, so peers
  // see "X is typing…" disappear shortly after typing actually stops.
  const emitTyping = useCallback(() => {
    if (wsStatus !== 'open' || readOnly) return
    sendJson({ type: 'typing.start', data: { conversation_id: conversationId } })
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
    typingTimerRef.current = window.setTimeout(() => {
      sendJson({ type: 'typing.stop', data: { conversation_id: conversationId } })
    }, 1400)
  }, [wsStatus, readOnly, sendJson, conversationId])

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed && !pendingAttachment) return
    if (sending || readOnly) return
    setSending(true)
    setError(null)
    const payload = {
      content: trimmed,
      message_type: pendingAttachment?.type || (pendingAttachment?.url ? 'file' : 'text'),
      attachment_url: pendingAttachment?.url ?? null,
      attachment_name: pendingAttachment?.name ?? null,
      attachment_size: pendingAttachment?.size ?? null,
      attachment_mime_type: pendingAttachment?.mime_type ?? null,
    }
    try {
      if (wsStatus === 'open') {
        sendJson({ type: 'message.send', data: { conversation_id: conversationId, ...payload } })
      } else {
        // WebSocket is closed — fall back to the REST endpoint so the
        // message still lands.
        const message = await apiRequest<ChatMessage>(
          `/chat/conversations/${conversationId}/messages/create/`,
          { method: 'POST', body: payload },
        )
        setMessages((prev) => [...prev, message])
      }
      setDraft('')
      setPendingAttachment(null)
      // Stop the typing indicator immediately after send — otherwise peers
      // see "still typing" for up to 1.4s after the message arrives.
      if (wsStatus === 'open') {
        sendJson({ type: 'typing.stop', data: { conversation_id: conversationId } })
      }
    } catch (err) {
      const e = err as { details?: { error?: string } }
      setError(e.details?.error ?? 'Unable to send message.')
    } finally {
      setSending(false)
    }
  }, [draft, pendingAttachment, sending, readOnly, wsStatus, sendJson, conversationId])

  const handleFilePicked = useCallback(
    async (file: File) => {
      if (readOnly) return
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('conversation_id', conversationId)
        const upload = await uploadRequest<ChatAttachment>('/chat/upload/', fd)
        setPendingAttachment(upload)
      } catch {
        pushToast('Attachment upload failed', 'error')
      } finally {
        setUploading(false)
      }
    },
    [conversationId, readOnly, pushToast],
  )

  const beginEdit = (m: ChatMessage) => {
    setEditingId(m.id)
    setEditingContent(m.content ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingContent('')
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const trimmed = editingContent.trim()
    if (!trimmed) return
    try {
      const updated = await apiRequest<{ content?: string; edited_at?: string }>(
        `/chat/messages/${editingId}/edit/`,
        { method: 'PUT', body: { content: trimmed } },
      )
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id) === String(editingId)
            ? { ...m, content: updated.content ?? trimmed, edited_at: updated.edited_at ?? new Date().toISOString() }
            : m,
        ),
      )
      cancelEdit()
    } catch (err) {
      const e = err as { details?: { error?: string } }
      pushToast(e.details?.error ?? 'Unable to edit message.', 'error')
    }
  }

  const handleDelete = async (messageId: string | number) => {
    if (!window.confirm('Delete this message?')) return
    try {
      await apiRequest(`/chat/messages/${messageId}/delete/`, { method: 'DELETE' })
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)))
      if (String(messageId) === String(editingId)) cancelEdit()
    } catch (err) {
      const e = err as { details?: { error?: string } }
      pushToast(e.details?.error ?? 'Unable to delete message.', 'error')
    }
  }

  const handleToggleReaction = async (messageId: string | number, emoji: string) => {
    if (readOnly) return
    // Optimistic update — flip the badge immediately so the click feels
    // responsive; on failure, the catch arm reverts via a re-render-with-
    // current-server-state path (refetching the message is overkill, so we
    // just toast and leave the optimistic state — next page load reconciles).
    const hadReaction = (() => {
      const target = messages.find((m) => String(m.id) === String(messageId))
      return target ? getUserReactions(target, user?.id).includes(emoji) : false
    })()
    setMessages((prev) =>
      prev.map((m) => {
        if (String(m.id) !== String(messageId)) return m
        const summary = buildReactionSummary(m)
        const userReactions = getUserReactions(m, user?.id)
        if (hadReaction) {
          const next = (summary[emoji] || 0) - 1
          if (next <= 0) delete summary[emoji]
          else summary[emoji] = next
          return {
            ...m,
            reaction_summary: summary,
            user_reactions: userReactions.filter((e) => e !== emoji),
          }
        }
        summary[emoji] = (summary[emoji] || 0) + 1
        return {
          ...m,
          reaction_summary: summary,
          user_reactions: Array.from(new Set([...userReactions, emoji])),
        }
      }),
    )
    setReactingForId(null)
    try {
      await apiRequest(`/chat/messages/${messageId}/reactions/toggle/`, {
        method: 'POST',
        body: { emoji },
      })
    } catch {
      pushToast('Reaction failed', 'error')
    }
  }

  const handleComposerChange = (value: string) => {
    setDraft(value)
    emitTyping()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  // Build the typing indicator text, ignoring self.
  const typingLabel = useMemo(() => {
    const others = Object.entries(typingByUser).filter(
      ([userId]) => String(userId) !== String(user?.id),
    )
    if (others.length === 0) return ''
    const names = others.map(([, v]) => v.name).filter(Boolean)
    if (names.length === 0) return 'Someone is typing…'
    if (names.length === 1) return `${names[0]} is typing…`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
    return 'Several people are typing…'
  }, [typingByUser, user?.id])

  return (
    <section className="card" data-testid="deal-room-chat" style={{ marginBottom: '1rem', padding: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0.875rem 1rem',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <MessageSquare size={14} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
        <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', margin: 0, flex: 1 }}>Discussion</h2>
        <span
          style={{
            fontSize: '0.6875rem',
            color: 'hsl(var(--muted-foreground))',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          aria-label={`WebSocket ${wsStatus}`}
          data-testid="deal-room-chat-ws-status"
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: wsStatus === 'open' ? '#22c55e' : '#a1a1a1',
            }}
          />
          {wsStatus === 'open' ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div
        ref={scrollRef}
        style={{
          height: 360,
          overflowY: 'auto',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
        data-testid="deal-room-chat-scroll"
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem' }}>
            <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} />
            Loading messages…
          </div>
        ) : error ? (
          <div style={{ color: '#ef4444', fontSize: '0.8125rem', textAlign: 'center', paddingTop: '1rem' }}>{error}</div>
        ) : messages.length === 0 ? (
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem', textAlign: 'center', margin: 'auto' }}>
            No messages yet. Start the conversation.
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = String(m.sender_id) === String(user?.id)
            const isEditing = String(m.id) === String(editingId)
            const avatarUrl = resolveMediaUrl(m.sender_avatar_url ?? null)
            const summary = buildReactionSummary(m)
            const userReactions = getUserReactions(m, user?.id)
            const showActions = !readOnly && (hoveredId === m.id || reactingForId === m.id)
            return (
              <div
                key={m.id}
                data-testid={`deal-room-chat-message-${m.id}`}
                onMouseEnter={() => setHoveredId(m.id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === m.id ? null : prev))}
                style={{
                  display: 'flex',
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                  gap: '0.5rem',
                  alignItems: 'flex-end',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'hsl(var(--muted))',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'hsl(var(--muted-foreground))',
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    getInitials(m.sender_name)
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '78%', alignItems: isOwn ? 'flex-end' : 'flex-start', minWidth: 0 }}>
                  {!isOwn && (
                    <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', marginBottom: 2 }}>
                      {m.sender_name ?? 'Unknown'}
                    </span>
                  )}
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 240 }}>
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void handleSaveEdit()
                          } else if (e.key === 'Escape') {
                            cancelEdit()
                          }
                        }}
                        rows={2}
                        autoFocus
                        data-testid={`deal-room-chat-edit-${m.id}`}
                        style={{
                          width: '100%',
                          resize: 'vertical',
                          padding: '0.5rem 0.625rem',
                          borderRadius: 10,
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--background))',
                          color: 'hsl(var(--foreground))',
                          fontSize: '0.875rem',
                          fontFamily: 'inherit',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-sm ghost" onClick={cancelEdit} data-testid={`deal-room-chat-edit-cancel-${m.id}`}>Cancel</button>
                        <button type="button" className="btn-sm primary" onClick={() => void handleSaveEdit()} data-testid={`deal-room-chat-edit-save-${m.id}`}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 14,
                        background: isOwn ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                        color: isOwn ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                        fontSize: '0.875rem',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        // Plain text — chat messages are short-form. Newlines
                        // are preserved via pre-wrap (the user can Shift+Enter
                        // to insert one).
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {m.content ?? ''}
                      {m.attachment_url ? (
                        <a
                          href={resolveMediaUrl(m.attachment_url) ?? m.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`deal-room-chat-attachment-${m.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: m.content ? 6 : 0,
                            padding: '4px 8px',
                            borderRadius: 8,
                            background: isOwn ? 'rgba(0,0,0,0.08)' : 'hsl(var(--background))',
                            color: 'inherit',
                            fontSize: '0.75rem',
                            textDecoration: 'none',
                            border: '1px solid hsl(var(--border))',
                          }}
                        >
                          <Paperclip size={11} strokeWidth={1.5} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                            {m.attachment_name ?? 'Attachment'}
                          </span>
                          {m.attachment_size ? (
                            <span style={{ opacity: 0.65 }}>· {humanFileSize(m.attachment_size)}</span>
                          ) : null}
                        </a>
                      ) : null}
                    </div>
                  )}

                  {/* Reaction badges */}
                  {Object.keys(summary).length > 0 && !isEditing ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {Object.entries(summary).map(([emoji, count]) => {
                        const mine = userReactions.includes(emoji)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            disabled={readOnly}
                            onClick={() => void handleToggleReaction(m.id, emoji)}
                            data-testid={`deal-room-chat-reaction-${m.id}-${emoji}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '2px 6px',
                              borderRadius: 999,
                              fontSize: '0.6875rem',
                              border: `1px solid ${mine ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                              background: mine ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                              color: 'inherit',
                              cursor: readOnly ? 'default' : 'pointer',
                            }}
                          >
                            <span>{emoji}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  <span style={{ fontSize: '0.625rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                    {formatTime(m.created_at)}
                    {m.edited_at ? ' · edited' : ''}
                  </span>

                  {/* Reaction picker — appears when the user clicked the
                      smile button on this message. Positioned BELOW the
                      bubble so it isn't clipped by the chat scroll
                      container's `overflow-y: auto` when reacting to one
                      of the oldest visible messages. */}
                  {reactingForId === m.id ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        [isOwn ? 'right' : 'left']: 36,
                        display: 'flex',
                        gap: 2,
                        padding: 4,
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 999,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 10,
                      }}
                      data-testid={`deal-room-chat-reaction-picker-${m.id}`}
                    >
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => void handleToggleReaction(m.id, emoji)}
                          data-testid={`deal-room-chat-reaction-pick-${emoji}`}
                          style={{
                            padding: '2px 6px',
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            fontSize: '1rem',
                            cursor: 'pointer',
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Hover action menu — react (everyone), edit + delete (own only). */}
                {showActions && !isEditing ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: 2,
                      alignSelf: 'center',
                      padding: 2,
                      background: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 999,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setReactingForId((prev) => (prev === m.id ? null : m.id))}
                      title="React"
                      data-testid={`deal-room-chat-react-btn-${m.id}`}
                      style={{
                        padding: '4px 6px',
                        border: 'none',
                        background: 'transparent',
                        color: 'hsl(var(--muted-foreground))',
                        cursor: 'pointer',
                        borderRadius: 999,
                      }}
                    >
                      <Smile size={12} strokeWidth={1.5} />
                    </button>
                    {isOwn ? (
                      <>
                        <button
                          type="button"
                          onClick={() => beginEdit(m)}
                          title="Edit"
                          data-testid={`deal-room-chat-edit-btn-${m.id}`}
                          style={{
                            padding: '4px 6px',
                            border: 'none',
                            background: 'transparent',
                            color: 'hsl(var(--muted-foreground))',
                            cursor: 'pointer',
                            borderRadius: 999,
                          }}
                        >
                          <Pencil size={12} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(m.id)}
                          title="Delete"
                          data-testid={`deal-room-chat-delete-btn-${m.id}`}
                          style={{
                            padding: '4px 6px',
                            border: 'none',
                            background: 'transparent',
                            color: 'hsl(var(--muted-foreground))',
                            cursor: 'pointer',
                            borderRadius: 999,
                          }}
                        >
                          <Trash2 size={12} strokeWidth={1.5} />
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      {/* Typing indicator — small pill above the composer. Empty string
          renders nothing (no layout shift since the container has its own
          spacing). */}
      {typingLabel ? (
        <div
          style={{
            padding: '0.25rem 1rem 0',
            fontSize: '0.6875rem',
            color: 'hsl(var(--muted-foreground))',
            fontStyle: 'italic',
          }}
          data-testid="deal-room-chat-typing"
        >
          {typingLabel}
        </div>
      ) : null}

      {/* Pending attachment preview — chip above the composer. Clear with X. */}
      {pendingAttachment ? (
        <div
          style={{
            padding: '0.5rem 0.625rem',
            borderTop: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          data-testid="deal-room-chat-pending-attachment"
        >
          <Paperclip size={12} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: '0.8125rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pendingAttachment.name}
          </span>
          {pendingAttachment.size ? (
            <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
              {humanFileSize(pendingAttachment.size)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setPendingAttachment(null)}
            style={{
              padding: 2,
              border: 'none',
              background: 'transparent',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
            }}
            aria-label="Remove attachment"
            data-testid="deal-room-chat-pending-attachment-remove"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      <form
        onSubmit={(e) => { e.preventDefault(); void handleSend() }}
        style={{
          borderTop: '1px solid hsl(var(--border))',
          padding: '0.625rem',
          display: 'flex',
          gap: 6,
          alignItems: 'flex-end',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFilePicked(file)
            // Reset so the same file can be re-picked (input doesn't fire
            // change if the value doesn't differ).
            e.target.value = ''
          }}
          data-testid="deal-room-chat-file-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={readOnly || uploading}
          title="Attach a file"
          data-testid="deal-room-chat-attach"
          style={{
            padding: '0.5rem',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            background: 'transparent',
            color: 'hsl(var(--muted-foreground))',
            cursor: readOnly || uploading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} strokeWidth={1.5} />}
        </button>
        <textarea
          value={draft}
          onChange={(e) => handleComposerChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={readOnly ? 'Deal room is closed.' : 'Write a message…'}
          rows={1}
          disabled={readOnly || sending}
          data-testid="deal-room-chat-composer"
          style={{
            flex: 1,
            resize: 'none',
            minHeight: 36,
            maxHeight: 120,
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={readOnly || sending || (!draft.trim() && !pendingAttachment)}
          className="btn-sm primary"
          data-testid="deal-room-chat-send"
          style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
        >
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Send
        </button>
      </form>
    </section>
  )
}
