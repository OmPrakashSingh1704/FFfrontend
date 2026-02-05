import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'
import { buildWsUrl } from '../lib/ws'
import { getTokens } from '../lib/tokenStorage'
import { useWebSocket } from '../hooks/useWebSocket'
import { useToast } from '../context/ToastContext'
import type { CallEvent, CallSession } from '../types/call'

export function CallsPage() {
  const { pushToast } = useToast()
  const tokens = getTokens()
  const [history, setHistory] = useState<CallSession[]>([])
  const [activeCall, setActiveCall] = useState<CallSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState('')
  const [callType, setCallType] = useState<'voice' | 'video'>('video')
  const [events, setEvents] = useState<CallEvent[]>([])
  const [callStatus, setCallStatus] = useState<CallSession | null>(null)

  const wsUrl = useMemo(() => buildWsUrl('/ws/calls/', tokens.accessToken), [tokens.accessToken])
  const { lastMessage, status: wsStatus, sendJson } = useWebSocket(wsUrl, { reconnect: true })

  useEffect(() => {
    let cancelled = false
    const loadHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<{ calls: CallSession[] }>('/chat/calls/history/')
        if (!cancelled) {
          setHistory(data.calls ?? [])
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load call history.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!lastMessage?.data) return
    try {
      const event = JSON.parse(lastMessage.data as string) as CallEvent
      setEvents((prev) => [event, ...prev].slice(0, 12))
    } catch {
      // ignore malformed events
    }
  }, [lastMessage, pushToast])

  useEffect(() => {
    if (wsStatus !== 'open') return
    if (!activeCall?.call_id) return
    sendJson({ type: 'join_call', call_id: activeCall.call_id })
    return () => {
      sendJson({ type: 'leave_call', call_id: activeCall.call_id })
    }
  }, [activeCall?.call_id, sendJson, wsStatus])

  const handleStartCall = async () => {
    if (!conversationId.trim()) {
      setError('Enter a conversation id to start a call.')
      return
    }
    setError(null)
    try {
      const call = await apiRequest<CallSession>('/chat/calls/initiate/', {
        method: 'POST',
        body: { conversation_id: conversationId.trim(), call_type: callType },
      })
      setActiveCall(call)
      setCallStatus(call)
      pushToast('Call created. Waiting for response...', 'success')
      sendJson({ type: 'join_call', call_id: call.call_id })
    } catch {
      setError('Unable to start call.')
    }
  }

  const handleEndCall = async () => {
    if (!activeCall) return
    try {
      await apiRequest(`/chat/calls/${activeCall.call_id}/end/`, { method: 'POST' })
      pushToast('Call ended', 'info')
      setActiveCall(null)
      setCallStatus(null)
    } catch {
      pushToast('Unable to end call', 'error')
    }
  }

  const handleRefreshStatus = async () => {
    if (!activeCall) return
    try {
      const status = await apiRequest<CallSession>(`/chat/calls/${activeCall.call_id}/`)
      setCallStatus(status)
      pushToast('Call status updated', 'success')
    } catch {
      pushToast('Unable to refresh status', 'error')
    }
  }

  return (
    <section className="content-section calls-page">
      <header className="content-header">
        <div>
          <h1>Calls & Rooms</h1>
          <p>Start a focused audio or video call when the thread is ready.</p>
        </div>
        <div className="chat-status">
          <span className={`chat-status-dot ${wsStatus}`} />
          <span>{wsStatus === 'open' ? 'Signaling live' : 'Signaling offline'}</span>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading call data...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="calls-grid">
        <div className="call-card">
          <h2>Start a call</h2>
          <p>Send a real-time invite to a founder or investor.</p>
          <div className="form-grid">
            <label>
              Conversation id
              <input value={conversationId} onChange={(event) => setConversationId(event.target.value)} placeholder="UUID" />
            </label>
            <label>
              Call type
              <div className="segmented">
                {(['video', 'voice'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`segmented-btn ${callType === option ? 'active' : ''}`}
                    onClick={() => setCallType(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <button className="btn primary" type="button" onClick={() => void handleStartCall()}>
            Send invite
          </button>
        </div>

        <div className="call-card">
          <h2>Active call</h2>
          {activeCall ? (
            <div className="call-active">
              <div>
                <strong>{activeCall.call_type?.toUpperCase() || 'CALL'}</strong>
                <p>Status: {callStatus?.status || activeCall.status || 'Connecting'}</p>
              </div>
              <div className="call-actions">
                <button className="btn ghost" type="button" onClick={() => void handleRefreshStatus()}>
                  Refresh
                </button>
                <button className="btn ghost" type="button" onClick={() => void handleEndCall()}>
                  End call
                </button>
              </div>
            </div>
          ) : (
            <p>No active call yet. Select a conversation to start one.</p>
          )}
        </div>

        <div className="call-card">
          <h2>Recent signaling</h2>
          <div className="call-log">
            {events.length === 0 ? <p>No live events yet.</p> : null}
            {events.map((event, index) => (
              <div key={`${event.type}-${index}`} className="call-log-item">
                <span>{event.type}</span>
                <span>{event.call_id ? `Call ${event.call_id}` : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="call-card">
          <h2>Call history</h2>
          <div className="call-history">
            {history.length === 0 && !loading ? <p>No calls yet.</p> : null}
            {history.map((call) => (
              <div key={call.call_id} className="call-history-item">
                <div>
                  <strong>{call.call_type || 'Call'}</strong>
                  <p>Conversation: {call.conversation_id || '—'}</p>
                </div>
                <span>{call.started_at ? new Date(call.started_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
