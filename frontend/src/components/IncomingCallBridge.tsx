import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { apiRequest } from '../lib/api'
import { addActiveCallId, removeActiveCallId } from '../lib/callSession'
import { getTokens } from '../lib/tokenStorage'
import { buildWsUrl } from '../lib/ws'
import { useWebSocket } from '../hooks/useWebSocket'
import type { CallSession } from '../types/call'

type IncomingCallEvent = {
  type?: string
  call_id?: string
  call_type?: string
  conversation_id?: string
  caller?: {
    user_id?: string
    name?: string
  }
  is_group_call?: boolean
  timestamp?: string
}

export function IncomingCallBridge() {
  const { status } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const tokens = getTokens()
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null)
  const [busy, setBusy] = useState(false)
  const lastMessageRef = useRef<string | null>(null)

  const url = useMemo(() => {
    if (status !== 'authenticated') return null
    return buildWsUrl('/ws/calls/', tokens.accessToken)
  }, [status, tokens.accessToken])

  const { lastMessage } = useWebSocket(url, { reconnect: status === 'authenticated' })

  useEffect(() => {
    if (!lastMessage?.data) return
    try {
      if (lastMessageRef.current === lastMessage.data) return
      lastMessageRef.current = lastMessage.data as string

      const event = JSON.parse(lastMessage.data as string) as IncomingCallEvent
      if (event.type === 'incoming_call' && event.call_id) {
        addActiveCallId(event.call_id)
        setIncomingCall((prev) => (prev?.call_id === event.call_id ? prev : event))
      }
      if (event.type === 'call_ended' && event.call_id) {
        removeActiveCallId(event.call_id)
        setIncomingCall((prev) => (prev?.call_id === event.call_id ? null : prev))
      }
    } catch {
      // ignore malformed events
    }
  }, [lastMessage])

  const handleDecline = async () => {
    if (!incomingCall?.call_id) return
    setBusy(true)
    try {
      await apiRequest(`/chat/calls/${incomingCall.call_id}/decline/`, {
        method: 'POST',
        body: { reason: 'declined' },
      })
      pushToast('Call declined', 'info')
      removeActiveCallId(incomingCall.call_id)
      setIncomingCall(null)
    } catch {
      pushToast('Unable to decline call', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleAnswer = async () => {
    if (!incomingCall?.call_id) return
    setBusy(true)
    try {
      const call = await apiRequest<CallSession>(`/chat/calls/${incomingCall.call_id}/answer/`, {
        method: 'POST',
      })
      setIncomingCall(null)
      addActiveCallId(call.call_id)
      pushToast('Call connected', 'success')
      const params = new URLSearchParams()
      params.set('callId', call.call_id)
      if (incomingCall.conversation_id) {
        params.set('conversationId', incomingCall.conversation_id)
      } else if (call.conversation_id) {
        params.set('conversationId', call.conversation_id)
      }
      navigate(`/app/calls?${params.toString()}`)
    } catch {
      pushToast('Unable to answer call', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!incomingCall?.call_id) {
    return null
  }

  const callerName = incomingCall.caller?.name || 'Someone'
  const callType = incomingCall.call_type?.toUpperCase() || 'CALL'

  return (
    <div className="chat-modal-overlay" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="chat-modal">
        <header>
          <h3>Incoming {callType}</h3>
          <button type="button" onClick={() => setIncomingCall(null)} aria-label="Dismiss">
            ✕
          </button>
        </header>
        <div className="space-y-2 text-sm">
          <p>
            <strong>{callerName}</strong> is calling you.
          </p>
          <p>{incomingCall.is_group_call ? 'Group call' : 'Direct call'}</p>
        </div>
        <div className="chat-modal-actions">
          <button className="btn ghost" type="button" onClick={() => void handleDecline()} disabled={busy}>
            Decline
          </button>
          <button className="btn primary" type="button" onClick={() => void handleAnswer()} disabled={busy}>
            {busy ? 'Connecting...' : 'Answer'}
          </button>
        </div>
      </div>
    </div>
  )
}
