import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Phone, Video, Mic, MicOff, VideoOff, PhoneOff,
  RefreshCw, ChevronDown, ChevronUp, Clock, ArrowLeft,
  Monitor, MonitorX, Minimize2,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { addActiveCallId } from '../lib/callSession'
import { useCall } from '../context/CallContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { CallEvent, CallSession } from '../types/call'

export function CallsPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const callIdParam = searchParams.get('callId')

  const {
    activeCall, setActiveCall, setInitiatorId,
    localStream, remoteStream,
    isMuted, isVideoOff, isScreenSharing,
    mediaError, wsStatus,
    toggleMute, toggleVideo, toggleScreenShare,
    endCall, minimizeCall, sendJson, lastMessage,
  } = useCall()

  const [history, setHistory] = useState<CallSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState('')
  const [callType, setCallType] = useState<'voice' | 'video'>('video')
  const [targetUserIds, setTargetUserIds] = useState('')
  const [targetUserEmails, setTargetUserEmails] = useState('')
  const [events, setEvents] = useState<CallEvent[]>([])
  const [showSignalingLog, setShowSignalingLog] = useState(false)

  const localVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node) node.srcObject = localStream
    },
    [localStream],
  )

  const remoteVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node) node.srcObject = remoteStream
    },
    [remoteStream],
  )

  // Collect signaling events for log
  useEffect(() => {
    if (!lastMessage?.data) return
    try {
      const event = JSON.parse(lastMessage.data as string) as CallEvent
      setEvents((prev) => [event, ...prev].slice(0, 12))
    } catch { /* ignore */ }
  }, [lastMessage])

  // Load call from URL param (incoming answer or direct link)
  useEffect(() => {
    if (!callIdParam || activeCall?.call_id === callIdParam) return
    let cancelled = false
    const loadCall = async () => {
      try {
        const call = await apiRequest<CallSession>(`/chat/calls/${callIdParam}/`)
        if (!cancelled) {
          setActiveCall(call)
          if (call.initiator_id) setInitiatorId(String(call.initiator_id))
          addActiveCallId(call.call_id)
          if (call.conversation_id) {
            setConversationId((prev) => prev || call.conversation_id!)
          }
        }
      } catch {
        if (!cancelled) pushToast('Unable to load call details', 'error')
      }
    }
    void loadCall()
    return () => { cancelled = true }
  }, [callIdParam, activeCall?.call_id, setActiveCall, setInitiatorId, pushToast])

  // Populate conversationId from query
  useEffect(() => {
    const fromQuery = searchParams.get('conversationId')
    if (fromQuery) setConversationId((prev) => prev || fromQuery)
  }, [searchParams])

  // Load call history
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<{ calls: CallSession[] }>('/chat/calls/history/')
        if (!cancelled) setHistory(data.calls ?? [])
      } catch {
        if (!cancelled) setError('Unable to load call history.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const handleStartCall = async () => {
    if (!conversationId.trim()) {
      setError('Enter a conversation ID to start a call.')
      return
    }
    setError(null)
    try {
      const ids = targetUserIds.split(',').map((v) => v.trim()).filter(Boolean)
      const emails = targetUserEmails.split(',').map((v) => v.trim()).filter(Boolean)
      const payload: Record<string, unknown> = {
        conversation_id: conversationId.trim(),
        call_type: callType,
      }
      if (ids.length) payload.target_user_ids = ids
      if (emails.length) payload.target_user_emails = emails

      const call = await apiRequest<CallSession>('/chat/calls/initiate/', {
        method: 'POST',
        body: payload,
      })
      setActiveCall(call)
      if (user?.id) setInitiatorId(String(user.id))
      addActiveCallId(call.call_id)
      pushToast('Call created. Waiting for response...', 'success')
      sendJson({ type: 'join_call', call_id: call.call_id })
    } catch {
      setError('Unable to start call.')
    }
  }

  const handleEndCall = async () => {
    await endCall()
    // Clear URL params so the load-from-URL effect doesn't re-fetch the now-ended call
    navigate('/app/calls', { replace: true })
  }

  const handleRefreshStatus = async () => {
    if (!activeCall) return
    try {
      const updated = await apiRequest<CallSession>(`/chat/calls/${activeCall.call_id}/`)
      setActiveCall(updated)
      if (updated.initiator_id) setInitiatorId(String(updated.initiator_id))
      pushToast('Call status updated', 'success')
    } catch {
      pushToast('Unable to refresh status', 'error')
    }
  }

  const formatDuration = (startedAt?: string, endedAt?: string) => {
    if (!startedAt) return '--'
    const start = new Date(startedAt).getTime()
    const end = endedAt ? new Date(endedAt).getTime() : Date.now()
    const seconds = Math.floor((end - start) / 1000)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Calls & Rooms</h1>
          <p className="page-description">Start a focused audio or video call when the thread is ready.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn-sm ghost"
            type="button"
            onClick={() => navigate(conversationId.trim() ? `/app/chat/${conversationId.trim()}` : '/app/chat')}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to chat
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`status-dot ${wsStatus === 'open' ? 'online' : 'offline'}`} />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              {wsStatus === 'open' ? 'Signaling live' : 'Signaling offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="card" style={{ borderColor: '#ef4444', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
        </div>
      ) : null}

      {/* Start Call Card */}
      <div className="section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Start a Call</span>
            <Phone style={{ width: 16, height: 16, color: 'var(--gold)' }} />
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>
            Send a real-time invite to a founder or investor.
          </p>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Conversation ID</label>
              <input
                className="input"
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
                placeholder="UUID"
              />
            </div>
            <div className="form-group">
              <label>Call Type</label>
              <div className="tabs">
                {(['video', 'voice'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`tab ${callType === option ? 'active' : ''}`}
                    onClick={() => setCallType(option)}
                  >
                    {option === 'video' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Video style={{ width: 14, height: 14 }} /> Video
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Phone style={{ width: 14, height: 14 }} /> Audio
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Target User IDs (optional)</label>
              <input
                className="input"
                value={targetUserIds}
                onChange={(e) => setTargetUserIds(e.target.value)}
                placeholder="uuid-1, uuid-2"
              />
            </div>
            <div className="form-group">
              <label>Target User Emails (optional)</label>
              <input
                className="input"
                value={targetUserEmails}
                onChange={(e) => setTargetUserEmails(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
          </div>
          <button className="btn-sm primary" type="button" onClick={() => void handleStartCall()}>
            <Phone style={{ width: 14, height: 14 }} />
            Send Invite
          </button>
        </div>
      </div>

      {/* Active Call Area */}
      {activeCall ? (
        <div className="section">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Video Stage */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                minHeight: '20rem',
                background: '#0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: '28rem' }}
                />
              ) : (
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
                  Waiting for remote video...
                </div>
              )}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  width: '10rem',
                  height: '7.5rem',
                  objectFit: 'cover',
                  borderRadius: '0.5rem',
                  border: '2px solid hsl(var(--border))',
                  background: '#111',
                }}
              />
            </div>

            {/* Controls Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {activeCall.call_type?.toUpperCase() || 'CALL'}
                </span>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  {activeCall.status || 'Connecting'}
                </span>
              </div>

              <button
                className="btn-sm ghost"
                type="button"
                onClick={toggleMute}
                disabled={!localStream}
              >
                {isMuted ? <MicOff style={{ width: 16, height: 16 }} /> : <Mic style={{ width: 16, height: 16 }} />}
              </button>

              <button
                className="btn-sm ghost"
                type="button"
                onClick={toggleVideo}
                disabled={!localStream || activeCall.call_type === 'voice'}
              >
                {isVideoOff ? <VideoOff style={{ width: 16, height: 16 }} /> : <Video style={{ width: 16, height: 16 }} />}
              </button>

              <button
                className="btn-sm ghost"
                type="button"
                onClick={() => void toggleScreenShare()}
                disabled={!activeCall}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                style={isScreenSharing ? { color: 'var(--gold)' } : undefined}
              >
                {isScreenSharing
                  ? <MonitorX style={{ width: 16, height: 16 }} />
                  : <Monitor style={{ width: 16, height: 16 }} />}
              </button>

              <button
                className="btn-sm ghost"
                type="button"
                onClick={() => void handleRefreshStatus()}
                title="Refresh status"
              >
                <RefreshCw style={{ width: 14, height: 14 }} />
              </button>

              {/* Minimize — keeps call running while navigating */}
              <button
                className="btn-sm ghost"
                type="button"
                onClick={minimizeCall}
                title="Minimize call"
              >
                <Minimize2 style={{ width: 14, height: 14 }} />
              </button>

              <button
                className="btn-sm primary"
                type="button"
                onClick={() => void handleEndCall()}
                style={{ background: '#ef4444' }}
              >
                <PhoneOff style={{ width: 14, height: 14 }} />
                End
              </button>
            </div>

            {mediaError ? (
              <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid hsl(var(--border))' }}>
                <p style={{ color: '#ef4444', fontSize: '0.8125rem' }}>{mediaError}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Call History */}
      <div className="section">
        <span className="section-label">Call History</span>
        {loading ? (
          <div className="empty-state" style={{ padding: '2rem 0' }}>
            <p className="empty-description">Loading call data...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="card">
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <Phone className="empty-icon" />
              <p className="empty-description">No calls yet.</p>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Conversation</th>
                  <th>Duration</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((call) => (
                  <tr key={call.call_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {call.call_type === 'video' ? (
                          <Video style={{ width: 14, height: 14, color: 'var(--gold)' }} />
                        ) : (
                          <Phone style={{ width: 14, height: 14, color: 'var(--gold)' }} />
                        )}
                        <span style={{ textTransform: 'capitalize' }}>{call.call_type || 'Call'}</span>
                      </div>
                    </td>
                    <td style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {call.conversation_id ? `${call.conversation_id.slice(0, 8)}...` : '--'}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock style={{ width: 12, height: 12, color: 'hsl(var(--muted-foreground))' }} />
                        {formatDuration(call.started_at ?? undefined, undefined)}
                      </span>
                    </td>
                    <td style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem' }}>
                      {call.started_at ? new Date(call.started_at).toLocaleString() : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Signaling Log */}
      <div className="section">
        <div className="card">
          <button
            type="button"
            onClick={() => setShowSignalingLog((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            <span className="card-title">Recent Signaling Events</span>
            {showSignalingLog
              ? <ChevronUp style={{ width: 16, height: 16, color: 'hsl(var(--muted-foreground))' }} />
              : <ChevronDown style={{ width: 16, height: 16, color: 'hsl(var(--muted-foreground))' }} />}
          </button>
          {showSignalingLog && (
            <div style={{ marginTop: '0.75rem' }}>
              {events.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>No live events yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {events.map((event, index) => (
                    <div
                      key={`${event.type}-${index}`}
                      className="list-item"
                      style={{ cursor: 'default', padding: '0.375rem 0.5rem' }}
                    >
                      <span className="badge info" style={{ fontSize: '0.6875rem' }}>{event.type}</span>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {event.call_id ? `Call ${String(event.call_id).slice(0, 8)}...` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
