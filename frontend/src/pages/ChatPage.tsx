import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiRequest, uploadRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { buildWsUrl } from '../lib/ws'
import { getTokens } from '../lib/tokenStorage'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { ChatAttachment, ChatConversation, ChatMessage, ChatParticipant } from '../types/chat'

type WsEvent = {
  type: string
  data?: Record<string, unknown>
}

const formatName = (participant?: ChatParticipant) =>
  participant?.full_name || participant?.title || `User ${participant?.id ?? ''}`.trim()

const formatConversationName = (conversation: ChatConversation) => {
  if (conversation.type === 'direct' && conversation.other_participant?.full_name) {
    return conversation.other_participant.full_name
  }
  if (conversation.name) return conversation.name
  return 'Conversation'
}

export function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { pushToast } = useToast()
  const tokens = getTokens()

  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | number | null>(id ?? null)
  const [messageDraft, setMessageDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [conversationDetail, setConversationDetail] = useState<ChatConversation | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newParticipants, setNewParticipants] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<
    Array<{ id: string; full_name: string; email?: string; avatar_url?: string; league?: string; is_online?: boolean }>
  >([])
  const [userLoading, setUserLoading] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const typingTimer = useRef<number | null>(null)
  const activeConversationRef = useRef<string | number | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadConversations = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<ChatConversation[] | { results: ChatConversation[] }>('/chat/conversations/')
        const list = normalizeList(data)
        if (!cancelled) {
          setConversations(list)
          if (!activeId && list.length > 0) {
            setActiveId(list[0].id)
            navigate(`/app/chat/${list[0].id}`, { replace: true })
          }
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load conversations.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadConversations()
    return () => {
      cancelled = true
    }
  }, [activeId, navigate])

  useEffect(() => {
    if (!id) return
    setActiveId(id)
  }, [id])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      setConversationDetail(null)
      return
    }
    setTypingUsers({})
    let cancelled = false
    const loadMessages = async () => {
      setError(null)
      try {
        const [detail, data] = await Promise.all([
          apiRequest<ChatConversation>(`/chat/conversations/${activeId}/`),
          apiRequest<ChatMessage[] | { results: ChatMessage[] }>(`/chat/conversations/${activeId}/messages/`),
        ])
        if (!cancelled) {
          const mappedDetail: ChatConversation = {
            ...detail,
            participants: detail.participants?.map((participant) => ({
              id: (participant as ChatParticipant & { user_id?: string }).user_id ?? participant.id,
              full_name: (participant as ChatParticipant & { user_name?: string }).user_name ?? participant.full_name,
              avatar_url: (participant as ChatParticipant & { user_avatar?: string }).user_avatar ?? participant.avatar_url,
              role: participant.role,
              is_online: participant.is_online,
            })),
          }
          setConversationDetail(mappedDetail)
          const list = normalizeList(data)
          setMessages([...list].reverse())
        }
        void apiRequest(`/chat/conversations/${activeId}/read/`, { method: 'POST' }).catch(() => null)
      } catch {
        if (!cancelled) {
          setError('Unable to load messages.')
        }
      }
    }

    void loadMessages()
    return () => {
      cancelled = true
    }
  }, [activeId])

  const wsUrl = useMemo(() => {
    if (!tokens.accessToken) return null
    return buildWsUrl('/ws/chat/', tokens.accessToken)
  }, [tokens.accessToken])

  const { status: wsStatus, lastMessage, sendJson } = useWebSocket(wsUrl, { reconnect: true })

  useEffect(() => {
    if (!lastMessage?.data) return
    try {
      const event = JSON.parse(lastMessage.data as string) as WsEvent
      if (event.type === 'message.new') {
        const message = event.data as ChatMessage
        if (String(message.conversation) === String(activeId)) {
          setMessages((prev) => {
            if (prev.some((msg) => String(msg.id) === String(message.id))) return prev
            return [...prev, message]
          })
        }
        setConversations((prev) =>
          prev.map((item) =>
            String(item.id) === String(message.conversation)
              ? {
                  ...item,
                  last_message_preview: message.content ?? item.last_message_preview ?? null,
                  last_message_sender_name: message.sender_name ?? item.last_message_sender_name ?? null,
                  last_message_at: message.created_at ?? item.last_message_at ?? null,
                }
              : item,
          ),
        )
      }
      if (event.type === 'typing') {
        const data = event.data as { conversation_id?: string; user_id?: string; is_typing?: boolean }
        if (!data.conversation_id || String(data.conversation_id) !== String(activeId)) return
        setTypingUsers((prev) => ({
          ...prev,
          [String(data.user_id ?? '')]: Boolean(data.is_typing),
        }))
      }
    } catch {
      // ignore malformed events
    }
  }, [activeId, lastMessage])

  useEffect(() => {
    if (wsStatus !== 'open') return
    if (!activeId) return
    if (activeConversationRef.current && activeConversationRef.current !== activeId) {
      sendJson({ type: 'conversation.leave', data: { conversation_id: activeConversationRef.current } })
    }
    sendJson({ type: 'conversation.join', data: { conversation_id: activeId } })
    activeConversationRef.current = activeId
    return () => {
      if (activeConversationRef.current) {
        sendJson({ type: 'conversation.leave', data: { conversation_id: activeConversationRef.current } })
      }
    }
  }, [activeId, sendJson, wsStatus])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const activeConversation =
    conversationDetail ?? conversations.find((item) => String(item.id) === String(activeId))
  const typingLabel = Object.entries(typingUsers)
    .filter(([, isTyping]) => isTyping)
    .map(([userId]) => {
      const participant = activeConversation?.participants?.find((member) => String(member.id) === userId)
      return participant ? formatName(participant) : 'Someone'
    })
    .join(', ')

  const handleSend = async () => {
    if (!activeId) return
    const trimmed = messageDraft.trim()
    const attachment = attachments[0]
    if (!trimmed && !attachment?.url) return
    setSending(true)
    setError(null)
    try {
      const payload = {
        content: trimmed,
        message_type: attachment?.type || (attachment?.url ? 'file' : 'text'),
        attachment_url: attachment?.url ?? null,
        attachment_name: attachment?.name ?? null,
        attachment_size: attachment?.size ?? null,
        attachment_mime_type: attachment?.mime_type ?? null,
      }
      if (wsStatus === 'open') {
        sendJson({ type: 'message.send', data: { conversation_id: activeId, ...payload } })
      } else {
        const message = await apiRequest<ChatMessage>(`/chat/conversations/${activeId}/messages/create/`, {
          method: 'POST',
          body: payload,
        })
        setMessages((prev) => [...prev, message])
      }
      setMessageDraft('')
      setAttachments([])
      setConversations((prev) =>
        prev.map((item) =>
          String(item.id) === String(activeId)
            ? {
                ...item,
                last_message_preview: trimmed || attachment?.name || 'Attachment',
                last_message_at: new Date().toISOString(),
              }
            : item,
        ),
      )
    } catch {
      setError('Unable to send message.')
    } finally {
      setSending(false)
    }
  }

  const handleCreateConversation = async () => {
    const participants = selectedUsers.length
      ? selectedUsers
      : newParticipants
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
    if (participants.length === 0) {
      setError('Add at least one participant id.')
      return
    }
    setError(null)
    try {
      const isDirect = participants.length === 1
      const payload = isDirect
        ? { user_id: participants[0] }
        : { name: newTitle.trim() || 'Group chat', participant_ids: participants }
      const conversation = await apiRequest<ChatConversation>(isDirect ? '/chat/dm/' : '/chat/groups/', {
        method: 'POST',
        body: payload,
      })
      setConversations((prev) => [conversation, ...prev])
      setShowNewConversation(false)
      setNewTitle('')
      setNewParticipants('')
      setSelectedUsers([])
      setUserQuery('')
      setUserResults([])
      setActiveId(conversation.id)
      navigate(`/app/chat/${conversation.id}`)
    } catch {
      setError('Unable to create conversation.')
    }
  }

  const handleSearchUsers = async () => {
    if (!userQuery.trim()) {
      setUserResults([])
      return
    }
    setUserLoading(true)
    try {
      const data = await apiRequest<
        Array<{ id: string; full_name: string; email?: string; avatar_url?: string; league?: string; is_online?: boolean }>
      >(`/chat/messageable-users/?search=${encodeURIComponent(userQuery.trim())}`)
      setUserResults(data)
    } catch {
      setUserResults([])
    } finally {
      setUserLoading(false)
    }
  }

  const toggleSelectedUser = (userId: string) => {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const handleLeaveConversation = async () => {
    if (!activeId) return
    try {
      await apiRequest(`/chat/conversations/${activeId}/leave/`, { method: 'POST' })
      setConversations((prev) => prev.filter((item) => String(item.id) !== String(activeId)))
      setMessages([])
      setActiveId(null)
      navigate('/app/chat')
    } catch {
      setError('Unable to leave conversation.')
    }
  }

  const handleEditMessage = async () => {
    if (!editingId || !editingContent.trim()) return
    try {
      const updated = await apiRequest<ChatMessage>(`/chat/messages/${editingId}/edit/`, {
        method: 'PUT',
        body: { content: editingContent.trim() },
      })
      setMessages((prev) => prev.map((msg) => (String(msg.id) === String(editingId) ? updated : msg)))
      setEditingId(null)
      setEditingContent('')
    } catch {
      setError('Unable to edit message.')
    }
  }

  const handleDeleteMessage = async (messageId: string | number) => {
    if (!window.confirm('Delete this message?')) return
    try {
      await apiRequest(`/chat/messages/${messageId}/delete/`, { method: 'DELETE' })
      setMessages((prev) => prev.filter((msg) => String(msg.id) !== String(messageId)))
    } catch {
      setError('Unable to delete message.')
    }
  }

  const handleReaction = async (messageId: string | number, emoji: string, hasReacted: boolean) => {
    try {
      if (hasReacted) {
        await apiRequest(`/chat/messages/${messageId}/reactions/remove/?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' })
      } else {
        await apiRequest(`/chat/messages/${messageId}/reactions/add/`, { method: 'POST', body: { emoji } })
      }
      setMessages((prev) =>
        prev.map((msg) => {
          if (String(msg.id) !== String(messageId)) return msg
          const reactions = msg.reactions ? [...msg.reactions] : []
          if (hasReacted) {
            return { ...msg, reactions: reactions.filter((r) => !(r.emoji === emoji && String(r.user_id) === String(user?.id))) }
          }
          return { ...msg, reactions: [...reactions, { emoji, user_id: user?.id ?? 'me' }] }
        }),
      )
    } catch {
      setError('Unable to update reaction.')
    }
  }

  const handleTyping = (value: string) => {
    setMessageDraft(value)
    if (wsStatus !== 'open' || !activeId || !user?.id) return
    sendJson({ type: 'typing.start', data: { conversation_id: activeId } })
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
    }
    typingTimer.current = window.setTimeout(() => {
      sendJson({ type: 'typing.stop', data: { conversation_id: activeId } })
    }, 1400)
  }

  const handleUpload = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (activeId) {
        formData.append('conversation_id', String(activeId))
      }
      const upload = await uploadRequest<ChatAttachment>('/chat/upload/', formData)
      setAttachments([upload])
      pushToast('Attachment ready to send', 'success')
    } catch {
      pushToast('Attachment upload failed', 'error')
    }
  }

  return (
    <section className="content-section chat-page">
      <header className="content-header">
        <div>
          <h1>Realtime Chat</h1>
          <p>Build momentum with fast, contextual conversations.</p>
        </div>
        <div className="chat-status">
          <span className={`chat-status-dot ${wsStatus}`} />
          <span>{wsStatus === 'open' ? 'Live' : 'Offline'}</span>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading conversations...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="chat-shell">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Conversations</h2>
            <button className="btn ghost" type="button" onClick={() => setShowNewConversation(true)}>
              New
            </button>
          </div>
          <div className="chat-search">
            <input type="search" placeholder="Search people or startups" />
          </div>
          <div className="chat-list">
            {conversations.map((conversation) => {
              const name = formatConversationName(conversation)
              const active = String(conversation.id) === String(activeId)
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`chat-item ${active ? 'active' : ''}`}
                  onClick={() => navigate(`/app/chat/${conversation.id}`)}
                >
                  <div className="chat-avatar">{name.slice(0, 2).toUpperCase()}</div>
                  <div className="chat-item-body">
                    <div className="chat-item-title">
                      <span>{name}</span>
                      {conversation.unread_count ? <span className="chat-pill">{conversation.unread_count}</span> : null}
                    </div>
                    <p>{conversation.last_message_preview || 'No messages yet.'}</p>
                  </div>
                </button>
              )
            })}
            {conversations.length === 0 && !loading ? (
              <div className="chat-empty">
                <p>No conversations yet.</p>
                <p>Start a thread with an investor or founder to begin the flow.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="chat-panel">
          <header className="chat-panel-header">
            <div>
              <h2>{activeConversation ? formatConversationName(activeConversation) : 'Select a chat'}</h2>
              <span>
                {activeConversation?.participants?.length ?? activeConversation?.participant_count ?? 0} participant
                {(activeConversation?.participants?.length ?? activeConversation?.participant_count ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="chat-panel-actions">
              <button className="btn ghost" type="button">
                Archive
              </button>
              {activeConversation ? (
                <button className="btn ghost" type="button" onClick={() => void handleLeaveConversation()}>
                  Leave
                </button>
              ) : null}
              <button className="btn primary" type="button" onClick={() => navigate('/app/calls')}>
                Start call
              </button>
            </div>
          </header>

          <div className="chat-messages">
            {messages.map((message) => {
              const isMe = String(message.sender_id ?? '') === String(user?.id ?? '')
              const senderLabel = message.sender_name || 'Unknown'
              const reactions = message.reactions ?? []
              const reactionSummary = reactions.reduce<Record<string, number>>((acc, reaction) => {
                acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1
                return acc
              }, {})
              return (
                <div key={message.id} className={`chat-message ${isMe ? 'mine' : ''}`}>
                  <div className="chat-message-meta">
                    <span>{isMe ? 'You' : senderLabel}</span>
                    <span>{message.created_at ? new Date(message.created_at).toLocaleTimeString() : ''}</span>
                  </div>
                  <div className="chat-message-bubble">
                    {editingId === message.id ? (
                      <div className="chat-edit">
                        <textarea
                          value={editingContent}
                          onChange={(event) => setEditingContent(event.target.value)}
                          rows={2}
                        />
                        <div className="chat-edit-actions">
                          <button className="btn ghost" type="button" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                          <button className="btn primary" type="button" onClick={() => void handleEditMessage()}>
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                    {message.attachment_url ? (
                      <div className="chat-attachments">
                        <a href={message.attachment_url} className="chat-attachment" target="_blank" rel="noreferrer">
                          {message.attachment_name || 'Attachment'}
                        </a>
                      </div>
                    ) : null}
                    <div className="chat-reactions">
                      {Object.entries(reactionSummary).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          className={`chat-reaction-btn ${
                            reactions.some((r) => r.emoji === emoji && String(r.user_id) === String(user?.id)) ? 'active' : ''
                          }`}
                          onClick={() =>
                            void handleReaction(
                              message.id,
                              emoji,
                              reactions.some((r) => r.emoji === emoji && String(r.user_id) === String(user?.id)),
                            )
                          }
                        >
                          {emoji} {count}
                        </button>
                      ))}
                      {['👍', '🔥', '🎯'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="chat-reaction-btn"
                          onClick={() =>
                            void handleReaction(
                              message.id,
                              emoji,
                              reactions.some((r) => r.emoji === emoji && String(r.user_id) === String(user?.id)),
                            )
                          }
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isMe ? (
                    <div className="chat-message-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(message.id)
                          setEditingContent(message.content ?? '')
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDeleteMessage(message.id)}>
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
            {typingLabel ? <div className="chat-typing">{typingLabel} typing...</div> : null}
            <div ref={scrollRef} />
          </div>

          <div className="chat-composer">
            <div className="chat-composer-tools">
              <label className="btn ghost" htmlFor="chat-attachment">
                Attach
              </label>
              <input
                id="chat-attachment"
                type="file"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleUpload(file)
                }}
              />
              {attachments.length ? (
                <div className="chat-attachment-preview">
                  {attachments.map((item) => (
                    <span key={item.url ?? item.name}>{item.name || 'Attachment ready'}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="chat-composer-input">
              <textarea
                value={messageDraft}
                onChange={(event) => handleTyping(event.target.value)}
                placeholder="Write a message..."
                rows={3}
              />
              <button className="btn primary" type="button" onClick={() => void handleSend()} disabled={sending}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showNewConversation ? (
        <div className="chat-modal-overlay" role="dialog" aria-modal="true">
          <div className="chat-modal">
            <header>
              <h3>New conversation</h3>
              <button type="button" onClick={() => setShowNewConversation(false)}>
                ✕
              </button>
            </header>
            <label className="chat-field">
              Title (optional)
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Fundraising sync" />
            </label>
            <label className="chat-field">
              Find people
              <div className="chat-user-search">
                <input
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                  placeholder="Search by name or email"
                />
                <button className="btn ghost" type="button" onClick={() => void handleSearchUsers()}>
                  {userLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </label>
            <div className="chat-user-results">
              {userResults.length === 0 && userQuery ? <p>No matches found.</p> : null}
              {userResults.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={`chat-user-item ${selectedUsers.includes(candidate.id) ? 'selected' : ''}`}
                  onClick={() => toggleSelectedUser(candidate.id)}
                >
                  <span className="chat-user-avatar">
                    {(candidate.full_name || candidate.email || 'U').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="chat-user-meta">
                    <strong>{candidate.full_name || candidate.email}</strong>
                    <small>{candidate.email}</small>
                  </span>
                  <span className={`chat-user-status ${candidate.is_online ? 'online' : 'offline'}`}>
                    {candidate.is_online ? 'Online' : 'Offline'}
                  </span>
                </button>
              ))}
            </div>
            <div className="chat-user-selected">
              {selectedUsers.length ? (
                <span>{selectedUsers.length} selected</span>
              ) : (
                <span>Or paste participant IDs below</span>
              )}
            </div>
            <label className="chat-field">
              Participant IDs (comma-separated)
              <input
                value={newParticipants}
                onChange={(event) => setNewParticipants(event.target.value)}
                placeholder="12, 44"
              />
            </label>
            <div className="chat-modal-actions">
              <button type="button" className="btn ghost" onClick={() => setShowNewConversation(false)}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={() => void handleCreateConversation()}>
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
