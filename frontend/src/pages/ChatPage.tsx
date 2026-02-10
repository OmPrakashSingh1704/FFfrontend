import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Search, Paperclip, ArrowUp, Phone, X, Bot, LogOut, Pencil, Trash2 } from 'lucide-react'
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

function formatMessageTime(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDateKey(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toDateString()
}

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
  const [sidebarSearch, setSidebarSearch] = useState('')

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

  const filteredConversations = sidebarSearch
    ? conversations.filter((c) =>
        formatConversationName(c).toLowerCase().includes(sidebarSearch.toLowerCase()),
      )
    : conversations

  // Build date-separated message groups
  let lastDateKey = ''

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="chat-page">
      {error ? (
        <div className="px-4 py-2 text-sm" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
          {error}
          <button className="ml-2 underline text-xs" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Conversation Sidebar */}
        <aside className="w-72 shrink-0 flex flex-col border-r" style={{ borderColor: 'hsl(var(--border))' }}>
          <div className="p-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Messages</h2>
            <div className="flex items-center gap-1">
              <span className={`status-dot ${wsStatus === 'open' ? 'online' : 'offline'}`} />
              <button
                className="btn-sm ghost"
                type="button"
                onClick={() => setShowNewConversation(true)}
                data-testid="new-conversation-btn"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <input
                type="search"
                className="input pl-8 text-xs"
                placeholder="Search conversations..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No conversations yet.</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const name = formatConversationName(conversation)
                const active = String(conversation.id) === String(activeId)
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`list-item w-full text-left ${active ? 'active' : ''}`}
                    onClick={() => navigate(`/app/chat/${conversation.id}`)}
                  >
                    <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.65rem' }}>
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{name}</span>
                        {conversation.unread_count ? (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--gold)' }} />
                        ) : null}
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {conversation.last_message_preview || 'No messages'}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Message Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Panel Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate">{activeConversation ? formatConversationName(activeConversation) : 'Select a chat'}</h2>
              <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {activeConversation?.participants?.length ?? activeConversation?.participant_count ?? 0} participant{(activeConversation?.participants?.length ?? activeConversation?.participant_count ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button className="btn-sm ghost" type="button" onClick={() => setShowBotModal(true)} title="Add bot">
                <Bot className="w-3.5 h-3.5" />
              </button>
              {activeConversation ? (
                <button className="btn-sm ghost" type="button" onClick={() => void handleLeaveConversation()} title="Leave">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              ) : null}
              <button
                className="btn-sm primary"
                type="button"
                onClick={() => {
                  if (activeConversation?.id) {
                    navigate(`/app/calls?conversationId=${encodeURIComponent(String(activeConversation.id))}`)
                  } else {
                    navigate('/app/calls')
                  }
                }}
              >
                <Phone className="w-3.5 h-3.5" /> Call
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.map((message, idx) => {
              const isMe = String(message.sender_id ?? '') === String(user?.id ?? '')
              const senderLabel = message.sender_name || 'Unknown'
              const reactionSummary = buildReactionSummary(message)
              const userReactions = getUserReactions(message)
              const prevMessage = messages[idx - 1]
              const sameSender = prevMessage && String(prevMessage.sender_id) === String(message.sender_id)
              const dateKey = getDateKey(message.created_at)
              const showDateSep = dateKey !== lastDateKey
              if (showDateSep) lastDateKey = dateKey

              return (
                <div key={message.id}>
                  {/* Date separator */}
                  {showDateSep && message.created_at ? (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                      <span className="text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {formatDateSeparator(message.created_at)}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                    </div>
                  ) : null}

                  {/* Message */}
                  <div className="group flex gap-3 py-1 hover:bg-[hsl(var(--muted)/0.3)] rounded-md px-2 -mx-2 transition-colors">
                    {/* Avatar or spacer */}
                    {sameSender && !showDateSep ? (
                      <div className="w-8 shrink-0" />
                    ) : (
                      <div className="avatar shrink-0 mt-0.5" style={{ width: '2rem', height: '2rem', fontSize: '0.65rem' }}>
                        {(isMe ? (user?.full_name || 'Y') : senderLabel).slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Name + time (only for first message in a group) */}
                      {(!sameSender || showDateSep) && (
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{isMe ? 'You' : senderLabel}</span>
                          <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {formatMessageTime(message.created_at)}
                          </span>
                        </div>
                      )}

                      {/* Content */}
                      {editingId === message.id ? (
                        <div className="mt-1">
                          <textarea
                            className="textarea text-sm"
                            value={editingContent}
                            onChange={(event) => setEditingContent(event.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2 mt-1">
                            <button className="btn-sm ghost" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                            <button className="btn-sm primary" type="button" onClick={() => void handleEditMessage()}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      )}

                      {/* Attachment */}
                      {message.attachment_url ? (
                        <a
                          href={message.attachment_url}
                          className="inline-flex items-center gap-1.5 mt-1 text-xs px-2 py-1 rounded-md"
                          style={{ background: 'hsl(var(--muted))', color: 'var(--gold)' }}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Paperclip className="w-3 h-3" />
                          {message.attachment_name || 'Attachment'}
                        </a>
                      ) : null}

                      {/* Reactions */}
                      {(Object.keys(reactionSummary).length > 0) && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Object.entries(reactionSummary).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              type="button"
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs transition-colors"
                              style={{
                                background: userReactions.includes(emoji) ? 'rgba(249,115,22,0.15)' : 'hsl(var(--muted))',
                                color: userReactions.includes(emoji) ? 'var(--gold)' : 'hsl(var(--foreground))',
                              }}
                              onClick={() => void handleReaction(message.id, emoji, userReactions.includes(emoji))}
                            >
                              {emoji} {count}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick react + actions (visible on hover) */}
                      <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {['👍', '🔥', '🎯'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="text-xs px-1 py-0.5 rounded hover:bg-[hsl(var(--muted))] transition-colors"
                            onClick={() => void handleReaction(message.id, emoji, userReactions.includes(emoji))}
                          >
                            {emoji}
                          </button>
                        ))}
                        {isMe && editingId !== message.id ? (
                          <>
                            <button
                              type="button"
                              className="text-xs px-1 py-0.5 rounded hover:bg-[hsl(var(--muted))] transition-colors"
                              onClick={() => { setEditingId(message.id); setEditingContent(message.content ?? '') }}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              className="text-xs px-1 py-0.5 rounded hover:bg-[hsl(var(--muted))] transition-colors"
                              onClick={() => void handleDeleteMessage(message.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {typingLabel ? (
              <div className="flex items-center gap-2 py-2 px-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--gold)' }} />
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--gold)', animationDelay: '0.2s' }} />
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--gold)', animationDelay: '0.4s' }} />
                </span>
                {typingLabel} is typing...
              </div>
            ) : null}
            <div ref={scrollRef} />
          </div>

          {/* Composer */}
          <div className="border-t px-4 py-3 shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
            {attachments.length > 0 && (
              <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                <Paperclip className="w-3 h-3" />
                {attachments.map((item) => (
                  <span key={item.url ?? item.name}>{item.name || 'Attachment ready'}</span>
                ))}
                <button className="ml-1" onClick={() => setAttachments([])}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {commandsOpen && (
              <div className="mb-2 rounded-lg overflow-hidden border" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
                {commandsLoading ? <div className="px-3 py-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading commands...</div> : null}
                {!commandsLoading && filteredCommands.length === 0 ? (
                  <div className="px-3 py-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No matching commands</div>
                ) : null}
                {filteredCommands.map((cmd) => (
                  <button
                    key={cmd.name}
                    type="button"
                    className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setMessageDraft(`/${cmd.name} `)
                      setCommandsOpen(false)
                    }}
                    data-testid={`command-${cmd.name}`}
                  >
                    <div>
                      <span className="font-medium">/{cmd.name}</span>
                      {cmd.description ? (
                        <span className="ml-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{cmd.description}</span>
                      ) : null}
                    </div>
                    <span className="tag">{cmd.bot_name || 'Bot'}</span>
                  </button>
                ))}
                {commandsError ? <div className="px-3 py-2 text-xs" style={{ color: '#ef4444' }}>{commandsError}</div> : null}
              </div>
            )}

            <div className="flex items-end gap-2">
              <label className="shrink-0 cursor-pointer p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors" htmlFor="chat-attachment">
                <Paperclip className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
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
              <textarea
                className="textarea flex-1 text-sm min-h-[40px] max-h-32"
                style={{ resize: 'none' }}
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
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder="Write a message..."
                rows={1}
              />
              <button
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: messageDraft.trim() || attachments.length ? 'var(--gold)' : 'hsl(var(--muted))',
                  color: messageDraft.trim() || attachments.length ? 'white' : 'hsl(var(--muted-foreground))',
                }}
                type="button"
                onClick={() => void handleSend()}
                disabled={sending}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConversation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="card w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">New conversation</h3>
              <button type="button" onClick={() => setShowNewConversation(false)} className="p-1 rounded hover:bg-[hsl(var(--muted))]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="form-group">
              <label>Title (optional)</label>
              <input className="input" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Fundraising sync" />
            </div>
            <div className="form-group">
              <label>Find people</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                  placeholder="Search by name or email"
                />
                <button className="btn-sm ghost" type="button" onClick={() => void handleSearchUsers()}>
                  {userLoading ? '...' : 'Search'}
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto mb-3">
              {userResults.length === 0 && userQuery ? <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No matches found.</p> : null}
              {userResults.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={`list-item w-full ${selectedUsers.includes(candidate.id) ? 'active' : ''}`}
                  onClick={() => toggleSelectedUser(candidate.id)}
                >
                  <div className="avatar" style={{ width: '1.5rem', height: '1.5rem', fontSize: '0.55rem' }}>
                    {(candidate.full_name || candidate.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{candidate.full_name || candidate.email}</span>
                    <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{candidate.email}</span>
                  </div>
                  <span className={`status-dot ${candidate.is_online ? 'online' : 'offline'}`} />
                </button>
              ))}
            </div>
            <div className="text-xs mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {selectedUsers.length ? `${selectedUsers.length} selected` : 'Or paste participant IDs below'}
            </div>
            <div className="form-group">
              <label>Participant IDs (comma-separated)</label>
              <input
                className="input"
                value={newParticipants}
                onChange={(event) => setNewParticipants(event.target.value)}
                placeholder="12, 44"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" className="btn-sm ghost" onClick={() => setShowNewConversation(false)}>Cancel</button>
              <button type="button" className="btn-sm primary" onClick={() => void handleCreateConversation()}>Create</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bot Modal */}
      {showBotModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="card w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Add a bot</h3>
              <button type="button" onClick={() => setShowBotModal(false)} className="p-1 rounded hover:bg-[hsl(var(--muted))]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {botError ? <div className="text-xs mb-2" style={{ color: '#ef4444' }}>{botError}</div> : null}
            <div className="form-group">
              <label>Select bot</label>
              <select
                className="select"
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
            </div>
            {selectedBotId ? (
              <p className="text-xs mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {bots.find((bot) => bot.id === selectedBotId)?.description || 'No description provided.'}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button className="btn-sm ghost" type="button" onClick={() => setShowBotModal(false)}>Cancel</button>
              <button className="btn-sm primary" type="button" onClick={() => void handleAddBot()} disabled={botLoading}>Add bot</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
