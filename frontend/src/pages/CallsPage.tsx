import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, RefreshCw, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { addActiveCallId, removeActiveCallId } from '../lib/callSession'
import { buildWsUrl } from '../lib/ws'
import { getTokens } from '../lib/tokenStorage'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { CallEvent, CallSession } from '../types/call'

export function CallsPage() {
  const { pushToast } = useToast()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const callIdParam = searchParams.get('callId')
  const tokens = getTokens()
  const [history, setHistory] = useState<CallSession[]>([])
  const [activeCall, setActiveCall] = useState<CallSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState('')
  const [callType, setCallType] = useState<'voice' | 'video'>('video')
  const [targetUserIds, setTargetUserIds] = useState('')
  const [targetUserEmails, setTargetUserEmails] = useState('')
  const [events, setEvents] = useState<CallEvent[]>([])
  const [callStatus, setCallStatus] = useState<CallSession | null>(null)
  const [initiatorId, setInitiatorId] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [showSignalingLog, setShowSignalingLog] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const offerInProgress = useRef(false)

  const wsUrl = useMemo(() => buildWsUrl('/ws/calls/', tokens.accessToken), [tokens.accessToken])
  const { lastMessage, status: wsStatus, sendJson } = useWebSocket(wsUrl, { reconnect: true })

  const activeCallType = callStatus?.call_type ?? activeCall?.call_type ?? callType
  const isInitiator = initiatorId && user?.id ? String(initiatorId) === String(user.id) : false
  const remoteUserId = useMemo(() => {
    const participants = callStatus?.participants ?? activeCall?.participants ?? []
    const current = String(user?.id ?? '')
    const other = participants.find((participant) => String(participant.user_id) !== current)
    return other?.user_id
  }, [activeCall?.participants, callStatus?.participants, user?.id])

  const cleanupMedia = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop())
    }
    setLocalStream(null)
    setRemoteStream(null)
    setMediaError(null)
    setIsMuted(false)
    setIsVideoOff(false)
  }, [localStream, remoteStream])

  const ensureLocalStream = useCallback(async () => {
    if (localStream) return localStream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: activeCallType !== 'voice',
      })
      setLocalStream(stream)
      return stream
    } catch {
      setMediaError('Unable to access camera or microphone.')
      throw new Error('media_denied')
    }
  }, [activeCallType, localStream])

  const ensurePeerConnection = useCallback(
    (targetUserId: string) => {
      if (pcRef.current) return pcRef.current
      const iceServers = callStatus?.ice_servers ?? activeCall?.ice_servers
      const pc = new RTCPeerConnection(
        iceServers && Array.isArray(iceServers) && iceServers.length
          ? { iceServers: iceServers as RTCIceServer[] }
          : undefined,
      )

      pc.onicecandidate = (event) => {
        if (!event.candidate || !activeCall?.call_id) return
        sendJson({
          type: 'ice_candidate',
          call_id: activeCall.call_id,
          to_user_id: targetUserId,
          candidate: event.candidate,
        })
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams
        if (stream) {
          setRemoteStream(stream)
        } else {
          setRemoteStream((prev) => {
            if (prev) return prev
            return new MediaStream([event.track])
          })
        }
      }

      pcRef.current = pc
      return pc
    },
    [activeCall?.call_id, activeCall?.ice_servers, callStatus?.ice_servers, sendJson],
  )

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
    const fromQuery = searchParams.get('conversationId')
    if (!fromQuery) return
    setConversationId((prev) => (prev ? prev : fromQuery))
  }, [searchParams])

  useEffect(() => {
    if (!callIdParam) return
    let cancelled = false
    const loadCall = async () => {
      try {
        const call = await apiRequest<CallSession>(`/chat/calls/${callIdParam}/`)
        if (!cancelled) {
          setActiveCall(call)
          setCallStatus(call)
          if (call.initiator_id) {
            setInitiatorId(String(call.initiator_id))
          }
          addActiveCallId(call.call_id)
          if (call.conversation_id) {
            setConversationId((prev) => (prev ? prev : call.conversation_id ?? ''))
          }
        }
      } catch {
        if (!cancelled) {
          pushToast('Unable to load incoming call details', 'error')
        }
      }
    }

    void loadCall()
    return () => {
      cancelled = true
    }
  }, [callIdParam, pushToast])

  useEffect(() => {
    if (!lastMessage?.data) return
    try {
      const event = JSON.parse(lastMessage.data as string) as CallEvent & {
        sdp?: string
        candidate?: RTCIceCandidateInit
        call_id?: string
        from_user_id?: string
      }
      const eventCallId = event.call_id ? String(event.call_id) : null

      if (event.type === 'call_ended' && event.call_id) {
        removeActiveCallId(event.call_id)
        if (activeCall?.call_id && String(activeCall.call_id) === eventCallId) {
          setActiveCall(null)
          setCallStatus(null)
          cleanupMedia()
        }
      }

      if (activeCall?.call_id && eventCallId && String(activeCall.call_id) === eventCallId) {
        if (event.type === 'webrtc_offer' && event.sdp && event.from_user_id) {
          const pc = ensurePeerConnection(event.from_user_id)
          ensureLocalStream()
            .then((stream) => {
              stream.getTracks().forEach((track) => {
                if (!pc.getSenders().some((sender) => sender.track === track)) {
                  pc.addTrack(track, stream)
                }
              })
              return pc.setRemoteDescription({ type: 'offer', sdp: event.sdp })
            })
            .then(() => pc.createAnswer())
            .then((answer) => pc.setLocalDescription(answer).then(() => answer))
            .then((answer) => {
              sendJson({
                type: 'answer',
                call_id: activeCall.call_id,
                to_user_id: event.from_user_id,
                sdp: answer.sdp,
              })
            })
            .catch(() => null)
        }

        if (event.type === 'webrtc_answer' && event.sdp) {
          const pc = pcRef.current
          if (pc && !pc.currentRemoteDescription) {
            pc.setRemoteDescription({ type: 'answer', sdp: event.sdp }).catch(() => null)
          }
        }

        if (event.type === 'webrtc_ice_candidate' && event.candidate) {
          const pc = pcRef.current
          if (pc) {
            pc.addIceCandidate(new RTCIceCandidate(event.candidate)).catch(() => null)
          }
        }
      }

      setEvents((prev) => [event, ...prev].slice(0, 12))
    } catch {
      // ignore malformed events
    }
  }, [activeCall?.call_id, cleanupMedia, ensureLocalStream, ensurePeerConnection, lastMessage, pushToast, sendJson])

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
      const ids = targetUserIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      const emails = targetUserEmails
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      const payload: Record<string, unknown> = {
        conversation_id: conversationId.trim(),
        call_type: callType,
      }
      if (ids.length) {
        payload.target_user_ids = ids
      }
      if (emails.length) {
        payload.target_user_emails = emails
      }

      const call = await apiRequest<CallSession>('/chat/calls/initiate/', {
        method: 'POST',
        body: payload,
      })
      setActiveCall(call)
      setCallStatus(call)
      if (user?.id) {
        setInitiatorId(String(user.id))
      }
      addActiveCallId(call.call_id)
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
      removeActiveCallId(activeCall.call_id)
      setActiveCall(null)
      setCallStatus(null)
      cleanupMedia()
    } catch {
      pushToast('Unable to end call', 'error')
    }
  }

  const handleRefreshStatus = async () => {
    if (!activeCall) return
    try {
      const status = await apiRequest<CallSession>(`/chat/calls/${activeCall.call_id}/`)
      setCallStatus(status)
      if (status.initiator_id) {
        setInitiatorId(String(status.initiator_id))
      }
      pushToast('Call status updated', 'success')
    } catch {
      pushToast('Unable to refresh status', 'error')
    }
  }

  useEffect(() => {
    if (!localVideoRef.current) return
    localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (!remoteVideoRef.current) return
    remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    if (!activeCall?.call_id || !remoteUserId || wsStatus !== 'open') return
    let cancelled = false

    const setup = async () => {
      try {
        const stream = await ensureLocalStream()
        if (cancelled) return
        const pc = ensurePeerConnection(remoteUserId)
        stream.getTracks().forEach((track) => {
          if (!pc.getSenders().some((sender) => sender.track === track)) {
            pc.addTrack(track, stream)
          }
        })

        if (isInitiator && !offerInProgress.current) {
          offerInProgress.current = true
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          sendJson({
            type: 'offer',
            call_id: activeCall.call_id,
            to_user_id: remoteUserId,
            sdp: offer.sdp,
          })
          offerInProgress.current = false
        }
      } catch {
        // ignore
      }
    }

    void setup()
    return () => {
      cancelled = true
    }
  }, [activeCall?.call_id, ensureLocalStream, ensurePeerConnection, isInitiator, remoteUserId, sendJson, wsStatus])

  useEffect(() => {
    if (activeCall) return
    cleanupMedia()
  }, [activeCall, cleanupMedia])

  useEffect(() => {
    return () => cleanupMedia()
  }, [cleanupMedia])

  const formatDuration = (startedAt?: string, endedAt?: string) => {
    if (!startedAt) return '--'
    const start = new Date(startedAt).getTime()
    const end = endedAt ? new Date(endedAt).getTime() : Date.now()
    const seconds = Math.floor((end - start) / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Calls & Rooms</h1>
          <p className="page-description">Start a focused audio or video call when the thread is ready.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`status-dot ${wsStatus === 'open' ? 'online' : 'offline'}`} />
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            {wsStatus === 'open' ? 'Signaling live' : 'Signaling offline'}
          </span>
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
                onChange={(event) => setConversationId(event.target.value)}
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
                onChange={(event) => setTargetUserIds(event.target.value)}
                placeholder="uuid-1, uuid-2"
              />
            </div>
            <div className="form-group">
              <label>Target User Emails (optional)</label>
              <input
                className="input"
                value={targetUserEmails}
                onChange={(event) => setTargetUserEmails(event.target.value)}
                placeholder="user@example.com, founder@site.com"
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
            {/* Call Media Stage */}
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
              {/* Local video PiP */}
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

            {/* Floating Controls Bar */}
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
                  {callStatus?.status || activeCall.status || 'Connecting'}
                </span>
              </div>
              <button
                className="btn-sm ghost"
                type="button"
                onClick={() => {
                  const tracks = localStream?.getAudioTracks() ?? []
                  tracks.forEach((track) => {
                    track.enabled = isMuted
                  })
                  setIsMuted((prev) => !prev)
                }}
                disabled={!localStream}
              >
                {isMuted ? <MicOff style={{ width: 16, height: 16 }} /> : <Mic style={{ width: 16, height: 16 }} />}
              </button>
              <button
                className="btn-sm ghost"
                type="button"
                onClick={() => {
                  const tracks = localStream?.getVideoTracks() ?? []
                  tracks.forEach((track) => {
                    track.enabled = isVideoOff
                  })
                  setIsVideoOff((prev) => !prev)
                }}
                disabled={!localStream || activeCallType === 'voice'}
              >
                {isVideoOff ? <VideoOff style={{ width: 16, height: 16 }} /> : <Video style={{ width: 16, height: 16 }} />}
              </button>
              <button className="btn-sm ghost" type="button" onClick={() => void handleRefreshStatus()}>
                <RefreshCw style={{ width: 14, height: 14 }} />
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

            {/* Media Error */}
            {mediaError ? (
              <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid hsl(var(--border))' }}>
                <p style={{ color: '#ef4444', fontSize: '0.8125rem' }}>{mediaError}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Recent Calls - Data Table */}
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
                      {call.conversation_id ? call.conversation_id.slice(0, 8) + '...' : '--'}
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

      {/* Signaling Log - Collapsible */}
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
              : <ChevronDown style={{ width: 16, height: 16, color: 'hsl(var(--muted-foreground))' }} />
            }
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
