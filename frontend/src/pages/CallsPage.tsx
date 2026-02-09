import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
            <label>
              Target user IDs (optional)
              <input
                value={targetUserIds}
                onChange={(event) => setTargetUserIds(event.target.value)}
                placeholder="uuid-1, uuid-2"
              />
            </label>
            <label>
              Target user emails (optional)
              <input
                value={targetUserEmails}
                onChange={(event) => setTargetUserEmails(event.target.value)}
                placeholder="user@example.com, founder@site.com"
              />
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
          {activeCall ? (
            <div className="call-media">
              <div className="call-media-stage">
                {remoteStream ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="call-video remote" />
                ) : (
                  <div className="call-media-placeholder">Waiting for remote video...</div>
                )}
                <video ref={localVideoRef} autoPlay playsInline muted className="call-video local" />
              </div>
              {mediaError ? <p className="form-error">{mediaError}</p> : null}
              <div className="call-media-actions">
                <button
                  className="btn ghost"
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
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  className="btn ghost"
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
                  {isVideoOff ? 'Camera on' : 'Camera off'}
                </button>
              </div>
            </div>
          ) : null}
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
