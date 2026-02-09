import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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

type BotSummary = {
  id: string
  name: string
  display_name: string
  description?: string | null
  avatar_url?: string | null
  bot_type?: string
  is_owned?: boolean
}

type ChatCommand = {
  name: string
  description?: string
  usage?: string
  bot_name?: string
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

const normalizeIncomingMessage = (message: ChatMessage & { conversation_id?: string }) => ({
  ...message,
  conversation: message.conversation ?? message.conversation_id,
})

export function ChatPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const newChatId = searchParams.get('newChat')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { pushToast } = useToast()
  const tokens = getTokens()
  const newChatRequestRef = useRef<string | null>(null)

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
  const [showBotModal, setShowBotModal] = useState(false)
  const [bots, setBots] = useState<BotSummary[]>([])
  const [botLoading, setBotLoading] = useState(false)
  const [botError, setBotError] = useState<string | null>(null)
  const [selectedBotId, setSelectedBotId] = useState('')
  const [commands, setCommands] = useState<ChatCommand[]>([])
  const [commandsLoading, setCommandsLoading] = useState(false)
  const [commandsOpen, setCommandsOpen] = useState(false)
  const [commandsError, setCommandsError] = useState<string | null>(null)

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
          if (!activeId && list.length > 0 && !newChatId) {
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
  }, [activeId, navigate, newChatId])

  useEffect(() => {
    if (!id) return
    setActiveId(id)
  }, [id])

  useEffect(() => {
    if (!newChatId) return
    if (newChatRequestRef.current === newChatId) return

    newChatRequestRef.current = newChatId
    setError(null)

    const createDirectChat = async () => {
      try {
        const conversation = await apiRequest<ChatConversation>('/chat/dm/', {
          method: 'POST',
          body: { user_id: newChatId },
        })
        setConversations((prev) => {
          const exists = prev.some((item) => String(item.id) === String(conversation.id))
          if (exists) {
            return prev.map((item) => (String(item.id) === String(conversation.id) ? conversation : item))
          }
          return [conversation, ...prev]
        })
        setActiveId(conversation.id)
        navigate(`/app/chat/${conversation.id}`, { replace: true })
      } catch {
        setError('Unable to start this chat.')
      }
    }

    void createDirectChat()
  }, [navigate, newChatId])

  useEffect(() => {
    if (!showBotModal) return
    let cancelled = false
    const loadBots = async () => {
      setBotLoading(true)
      setBotError(null)
      try {
        const data = await apiRequest<{ bots: BotSummary[] }>('/chat/bots/')
        if (!cancelled) {
          setBots(data.bots ?? [])
          setSelectedBotId((prev) => prev || data.bots?.[0]?.id || '')
        }
      } catch {
        if (!cancelled) {
          setBotError('Unable to load bots.')
        }
      } finally {
        if (!cancelled) {
          setBotLoading(false)
        }
      }
    }

    void loadBots()
    return () => {
      cancelled = true
    }
  }, [showBotModal])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      setConversationDetail(null)
      setCommands([])
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

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    const loadCommands = async () => {
      setCommandsLoading(true)
      setCommandsError(null)
      try {
        const data = await apiRequest<{ commands: ChatCommand[] }>(`/chat/bots/commands/?conversation_id=${activeId}`)
        if (!cancelled) {
          setCommands(data.commands ?? [])
        }
      } catch {
        if (!cancelled) {
          setCommandsError('Unable to load commands.')
        }
      } finally {
        if (!cancelled) {
          setCommandsLoading(false)
        }
      }
    }

    void loadCommands()
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
        const message = normalizeIncomingMessage(event.data as ChatMessage & { conversation_id?: string })
        const conversationId = message.conversation
        if (String(conversationId) === String(activeId)) {
          setMessages((prev) => {
            if (prev.some((msg) => String(msg.id) === String(message.id))) return prev
            return [...prev, message]
          })
        }
        setConversations((prev) =>
          prev.map((item) =>
            String(item.id) === String(conversationId)
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

  const commandPrefix = useMemo(() => {
    const trimmed = messageDraft.trim()
    if (!trimmed.startsWith('/')) return ''
    const token = trimmed.slice(1).split(/\s+/)[0]
    return token.toLowerCase()
  }, [messageDraft])

  const filteredCommands = useMemo(() => {
    if (!commandPrefix) return commands.slice(0, 6)
    return commands.filter((cmd) => cmd.name.startsWith(commandPrefix)).slice(0, 6)
  }, [commandPrefix, commands])

  const resolveCommand = (content: string) => {
    const trimmed = content.trim()
    if (!trimmed.startsWith('/')) return null
    const name = trimmed.slice(1).split(/\s+/)[0].toLowerCase()
    return commands.find((cmd) => cmd.name === name) ?? null
  }

  const buildReactionSummary = (message: ChatMessage) => {
    if (message.reaction_summary) return message.reaction_summary
    const reactions = message.reactions ?? []
    return reactions.reduce<Record<string, number>>((acc, reaction) => {
      acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1
      return acc
    }, {})
  }

  const getUserReactions = (message: ChatMessage) => {
    if (message.user_reactions) return message.user_reactions
    if (!user?.id) return []
    const reactions = message.reactions ?? []
    return reactions
      .filter((reaction) => String(reaction.user_id) === String(user.id))
      .map((reaction) => reaction.emoji)
  }

  const handleSend = async () => {
    if (!activeId) return
    const trimmed = messageDraft.trim()
    const attachment = attachments[0]
    if (!trimmed && !attachment?.url) return

    // Slash command handling — execute via dedicated endpoint
    if (trimmed.startsWith('/')) {
      const commandMatch = resolveCommand(trimmed)
      if (!commandsLoading && !commandsError && !commandMatch) {
        setError(`Unknown command: ${trimmed.split(/\s+/)[0]}`)
        return
      }
      if (commandMatch) {
        setSending(true)
        setError(null)
        try {
          const data = await apiRequest<{
            result: { message?: string; error?: string }
            bot_name: string
            bot_avatar_url?: string | null
            message?: ChatMessage | null
          }>('/chat/bots/execute/', {
            method: 'POST',
            body: { content: trimmed, conversation_id: String(activeId) },
          })

          // Display the bot reply message in chat
          if (data.message) {
            setMessages((prev) => {
              if (prev.some((msg) => String(msg.id) === String(data.message!.id))) return prev
              return [...prev, data.message!]
            })
          } else if (data.result.error) {
            setError(data.result.error)
          }

          setMessageDraft('')
          setCommandsOpen(false)
          setConversations((prev) =>
            prev.map((item) =>
              String(item.id) === String(activeId)
                ? {
                    ...item,
                    last_message_preview: data.result.message ?? trimmed,
                    last_message_at: new Date().toISOString(),
                  }
                : item,
            ),
          )
        } catch {
          setError('Command execution failed.')
        } finally {
          setSending(false)
        }
        return
      }
    }

    // Regular message sending
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
      setCommandsOpen(false)
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

  const handleAddBot = async () => {
    if (!activeId) {
      setError('Select a conversation first.')
      return
    }
    if (!selectedBotId) {
      setBotError('Select a bot to add.')
      return
    }
    setBotError(null)
    try {
      await apiRequest('/chat/bots/conversations/add/', {
        method: 'POST',
        body: { bot_id: selectedBotId, conversation_id: activeId },
      })
      pushToast('Bot added to conversation', 'success')
      setShowBotModal(false)
    } catch {
      setBotError('Unable to add bot.')
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
      const response = await apiRequest<{
        status?: 'added' | 'removed' | string
        summary?: Record<string, number>
        user_reactions?: string[]
      }>(`/chat/messages/${messageId}/reactions/toggle/`, {
        method: 'POST',
        body: { emoji },
      })
      setMessages((prev) =>
        prev.map((msg) => {
          if (String(msg.id) !== String(messageId)) return msg
          const currentSummary = buildReactionSummary(msg)
          const currentUserReactions = getUserReactions(msg)
          const action = response.status ?? (hasReacted ? 'removed' : 'added')

          let nextSummary = response.summary
          if (!nextSummary) {
            nextSummary = { ...currentSummary }
            const delta = action === 'added' ? 1 : -1
            const nextCount = (nextSummary[emoji] || 0) + delta
            if (nextCount <= 0) {
              delete nextSummary[emoji]
            } else {
              nextSummary[emoji] = nextCount
            }
          }

          const nextUserReactions =
            response.user_reactions ??
            (action === 'added'
              ? Array.from(new Set([...currentUserReactions, emoji]))
              : currentUserReactions.filter((value) => value !== emoji))

          return {
            ...msg,
            reaction_summary: nextSummary,
            user_reactions: nextUserReactions,
          }
        }),
      )
    } catch {
      setError('Unable to update reaction.')
    }
  }

  const handleTyping = (value: string) => {
    setMessageDraft(value)
    if (value.trim().startsWith('/')) {
      setCommandsOpen(true)
    } else {
      setCommandsOpen(false)
    }
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
              <button className="btn ghost" type="button" onClick={() => setShowBotModal(true)}>
                Add bot
              </button>
              {activeConversation ? (
                <button className="btn ghost" type="button" onClick={() => void handleLeaveConversation()}>
                  Leave
                </button>
              ) : null}
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  if (activeConversation?.id) {
                    navigate(`/app/calls?conversationId=${encodeURIComponent(String(activeConversation.id))}`)
                  } else {
                    navigate('/app/calls')
                  }
                }}
              >
                Start call
              </button>
            </div>
          </header>

          <div className="chat-messages">
            {messages.map((message) => {
              const isMe = String(message.sender_id ?? '') === String(user?.id ?? '')
              const senderLabel = message.sender_name || 'Unknown'
              const reactionSummary = buildReactionSummary(message)
              const userReactions = getUserReactions(message)
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
                          className={`chat-reaction-btn ${userReactions.includes(emoji) ? 'active' : ''}`}
                          onClick={() =>
                            void handleReaction(
                              message.id,
                              emoji,
                              userReactions.includes(emoji),
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
                              userReactions.includes(emoji),
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
              onFocus={() => {
                if (messageDraft.trim().startsWith('/')) {
                  setCommandsOpen(true)
                }
              }}
              onBlur={() => {
                window.setTimeout(() => setCommandsOpen(false), 150)
              }}
              placeholder="Write a message..."
              rows={3}
            />
            {commandsOpen ? (
              <div className="chat-command-list">
                {commandsLoading ? <div className="chat-command-item muted">Loading commands...</div> : null}
                {!commandsLoading && filteredCommands.length === 0 ? (
                  <div className="chat-command-item muted">No matching commands</div>
                ) : null}
                {filteredCommands.map((cmd) => (
                  <button
                    key={cmd.name}
                    type="button"
                    className="chat-command-item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setMessageDraft(`/${cmd.name} `)
                      setCommandsOpen(false)
                    }}
                    data-testid={`command-${cmd.name}`}
                  >
                    <div className="chat-command-info">
                      <span className="chat-command-name">/{cmd.name}</span>
                      {cmd.description ? (
                        <span className="chat-command-desc">{cmd.description}</span>
                      ) : null}
                    </div>
                    <span className="chat-command-meta">{cmd.bot_name || 'Bot'}</span>
                  </button>
                ))}
                {commandsError ? <div className="chat-command-item muted">{commandsError}</div> : null}
              </div>
            ) : null}
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

      {showBotModal ? (
        <div className="chat-modal-overlay" role="dialog" aria-modal="true">
          <div className="chat-modal">
            <header>
              <h3>Add a bot</h3>
              <button type="button" onClick={() => setShowBotModal(false)}>
                ✕
              </button>
            </header>
            {botError ? <div className="form-error">{botError}</div> : null}
            <label className="chat-field">
              Select bot
              <select
                value={selectedBotId}
                onChange={(event) => setSelectedBotId(event.target.value)}
                disabled={botLoading}
              >
                {botLoading ? <option>Loading...</option> : null}
                {!botLoading && bots.length === 0 ? <option value="">No bots available</option> : null}
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.display_name || bot.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedBotId ? (
              <div className="text-xs text-slate-500">
                {bots.find((bot) => bot.id === selectedBotId)?.description || 'No description provided.'}
              </div>
            ) : null}
            <div className="chat-modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowBotModal(false)}>
                Cancel
              </button>
              <button className="btn primary" type="button" onClick={() => void handleAddBot()} disabled={botLoading}>
                Add bot
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
