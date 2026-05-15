import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { addActiveCallId, removeActiveCallId } from '../lib/callSession'
import { buildWsUrl } from '../lib/ws'
import { getTokens } from '../lib/tokenStorage'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import type { CallSession } from '../types/call'

export type IncomingCallEvent = {
  type?: string
  call_id?: string
  call_type?: string
  conversation_id?: string
  caller?: { user_id?: string; name?: string }
  is_group_call?: boolean
}

interface CallContextValue {
  activeCall: CallSession | null
  incomingCall: IncomingCallEvent | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isMuted: boolean
  isVideoOff: boolean
  isScreenSharing: boolean
  mediaError: string | null
  wsStatus: string
  initiatorId: string | null
  lastMessage: MessageEvent | null
  setActiveCall: (call: CallSession | null) => void
  setInitiatorId: (id: string | null) => void
  sendJson: (data: unknown) => void
  endCall: () => Promise<void>
  toggleMute: () => void
  toggleVideo: () => void
  toggleScreenShare: () => Promise<void>
  answerIncoming: () => Promise<void>
  declineIncoming: () => Promise<void>
  minimizeCall: () => void
  maximizeCall: () => void
}

const CallContext = createContext<CallContextValue | null>(null)

export function CallProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { user, status } = useAuth()
  const { pushToast } = useToast()
  const tokens = getTokens()

  const [activeCall, setActiveCall] = useState<CallSession | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null)
  const [initiatorId, setInitiatorId] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  // True once the remote peer has joined this call (received via
  // `participant_joined`/`participant_update` from the backend). The
  // initiator MUST wait for this before sending the WebRTC offer — otherwise
  // the offer arrives at the receiver's user channel while their activeCall
  // is still null (they haven't tapped Accept yet) and the message handler
  // silently drops it. Receiver's "Waiting for the other side…" forever was
  // exactly this race.
  const [peerJoined, setPeerJoined] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const offerInProgress = useRef(false)
  const lastMessageRef = useRef<string | null>(null)
  // ICE candidates that arrived before the peer connection had a remote
  // description. addIceCandidate rejects in that state, so without this
  // buffer the candidates are lost forever — fatal on symmetric NAT where
  // every relay candidate matters. Flushed after setRemoteDescription.
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])

  const wsUrl = useMemo(() => {
    if (status !== 'authenticated') return null
    return buildWsUrl('/ws/calls/', tokens.accessToken)
  }, [status, tokens.accessToken])

  const { lastMessage, status: wsStatus, sendJson } = useWebSocket(wsUrl, {
    reconnect: status === 'authenticated',
  })

  const activeCallType = activeCall?.call_type ?? 'video'

  const remoteUserId = useMemo(() => {
    const participants = activeCall?.participants ?? []
    const current = String(user?.id ?? '')
    return participants.find((p) => String(p.user_id) !== current)?.user_id
  }, [activeCall?.participants, user?.id])

  const isInitiator = useMemo(
    () => (initiatorId && user?.id ? String(initiatorId) === String(user.id) : false),
    [initiatorId, user?.id],
  )

  // ── Media ─────────────────────────────────────────────────────────

  const cleanupMedia = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    localStream?.getTracks().forEach((t) => t.stop())
    remoteStream?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    offerInProgress.current = false
    pendingCandidatesRef.current = []
    setLocalStream(null)
    setRemoteStream(null)
    setMediaError(null)
    setIsMuted(false)
    setIsVideoOff(false)
    setIsScreenSharing(false)
  }, [localStream, remoteStream])

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    const queued = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      } catch {
        /* stale candidate — ignore */
      }
    }
  }, [])

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
      const iceServers = activeCall?.ice_servers
      const pc = new RTCPeerConnection(
        iceServers?.length ? { iceServers: iceServers as RTCIceServer[] } : undefined,
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
        // ontrack fires once per track (audio + video are separate events).
        // The old code replaced remoteStream on every event, so the second
        // event would wipe the first track. Preserve all tracks instead.
        const [incoming] = event.streams
        setRemoteStream((prev) => {
          if (incoming) {
            // Peer attached a stream via pc.addTrack(track, stream). The
            // same stream object is reused across track events, so once
            // we've seen it we just keep it — React skips the re-render.
            return prev?.id === incoming.id ? prev : incoming
          }
          const existing = prev ? prev.getTracks() : []
          if (existing.some((t) => t.id === event.track.id)) return prev
          return new MediaStream([...existing, event.track])
        })
      }
      pcRef.current = pc
      return pc
    },
    [activeCall?.call_id, activeCall?.ice_servers, sendJson],
  )

  // ── Controls ──────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted
    })
    setIsMuted((prev) => !prev)
  }, [isMuted, localStream])

  const toggleVideo = useCallback(() => {
    if (activeCallType === 'voice') return
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = isVideoOff
    })
    setIsVideoOff((prev) => !prev)
  }, [activeCallType, isVideoOff, localStream])

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    const pc = pcRef.current
    const cameraTrack = localStream?.getVideoTracks()[0]
    if (pc && cameraTrack) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) void sender.replaceTrack(cameraTrack)
    }
    setIsScreenSharing(false)
    if (activeCall?.call_id) {
      sendJson({ type: 'media_update', call_id: activeCall.call_id, is_screen_sharing: false })
    }
  }, [activeCall?.call_id, localStream, sendJson])

  const toggleScreenShare = useCallback(async () => {
    if (!activeCall?.call_id) return
    if (isScreenSharing) {
      stopScreenShare()
      return
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      screenStreamRef.current = screenStream
      const screenTrack = screenStream.getVideoTracks()[0]
      const pc = pcRef.current
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(screenTrack)
        else pc.addTrack(screenTrack, screenStream)
      }
      screenTrack.onended = stopScreenShare
      setIsScreenSharing(true)
      sendJson({ type: 'media_update', call_id: activeCall.call_id, is_screen_sharing: true })
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') pushToast('Unable to share screen', 'error')
    }
  }, [activeCall?.call_id, isScreenSharing, stopScreenShare, sendJson, pushToast])

  const endCall = useCallback(async () => {
    const call = activeCall
    if (!call) return
    // Optimistic local cleanup — fire BEFORE the network round-trip so the
    // call frame disappears instantly even if the backend is slow or the WS
    // is dead. If the API ends up failing the server-side row stays "active"
    // a bit longer, but Celery's stale-call cleanup will expire it.
    setActiveCall(null)
    setInitiatorId(null)
    removeActiveCallId(call.call_id)
    cleanupMedia()
    try {
      await apiRequest(`/chat/calls/${call.call_id}/end/`, { method: 'POST' })
      pushToast('Call ended', 'info')
    } catch {
      pushToast('Call ended locally — server cleanup may lag.', 'warning')
    }
  }, [activeCall, cleanupMedia, pushToast])

  // ── Incoming call ─────────────────────────────────────────────────

  const answerIncoming = useCallback(async () => {
    if (!incomingCall?.call_id) return
    try {
      const call = await apiRequest<CallSession>(
        `/chat/calls/${incomingCall.call_id}/answer/`,
        { method: 'POST' },
      )
      setIncomingCall(null)
      setActiveCall(call)
      if (call.initiator_id) setInitiatorId(String(call.initiator_id))
      addActiveCallId(call.call_id)
      pushToast('Call connected', 'success')
      const params = new URLSearchParams({ callId: call.call_id })
      const convId = incomingCall.conversation_id ?? call.conversation_id
      if (convId) params.set('conversationId', convId)
      navigate(`/app/calls?${params.toString()}`)
    } catch {
      pushToast('Unable to answer call', 'error')
    }
  }, [incomingCall, navigate, pushToast])

  const declineIncoming = useCallback(async () => {
    if (!incomingCall?.call_id) return
    try {
      await apiRequest(`/chat/calls/${incomingCall.call_id}/decline/`, {
        method: 'POST',
        body: { reason: 'declined' },
      })
      removeActiveCallId(incomingCall.call_id)
      pushToast('Call declined', 'info')
      setIncomingCall(null)
    } catch {
      pushToast('Unable to decline call', 'error')
    }
  }, [incomingCall, pushToast])

  // ── Navigation ────────────────────────────────────────────────────

  const minimizeCall = useCallback(() => {
    navigate('/app/chat')
  }, [navigate])

  const maximizeCall = useCallback(() => {
    if (!activeCall?.call_id) return
    const params = new URLSearchParams({ callId: activeCall.call_id })
    if (activeCall.conversation_id) params.set('conversationId', activeCall.conversation_id)
    navigate(`/app/calls?${params.toString()}`)
  }, [activeCall, navigate])

  // ── Ring timeout (client-side safety net) ────────────────────────
  // If the call stays in 'ringing' status for 35 s the caller gets stuck.
  // Celery Beat handles it server-side, but in dev it may not run.
  // This timer clears the UI on the caller side after the same duration.
  //
  // Use refs for cleanupMedia/pushToast so the timer is NOT restarted when
  // localStream changes (cleanupMedia identity changes with it), which would
  // keep resetting the countdown and prevent the toast from ever firing.
  const cleanupMediaRef = useRef(cleanupMedia)
  cleanupMediaRef.current = cleanupMedia
  const pushToastRef = useRef(pushToast)
  pushToastRef.current = pushToast

  useEffect(() => {
    if (!activeCall?.call_id || activeCall.status !== 'ringing') return
    const callId = activeCall.call_id
    const timer = setTimeout(() => {
      // Tell the backend so it marks the call MISSED and clears the conversation lock
      apiRequest(`/chat/calls/${callId}/end/`, { method: 'POST', body: { reason: 'no_answer' } })
        .catch(() => { /* backend may have already cleaned it up via Celery */ })
      removeActiveCallId(callId)
      setActiveCall((prev) =>
        prev?.call_id === callId && prev.status === 'ringing' ? null : prev,
      )
      setInitiatorId(null)
      cleanupMediaRef.current()
      pushToastRef.current('No answer — call ended.', 'info')
    }, 35_000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.call_id, activeCall?.status])

  // ── Join/Leave WS call group ──────────────────────────────────────

  useEffect(() => {
    if (wsStatus !== 'open' || !activeCall?.call_id) return
    sendJson({ type: 'join_call', call_id: activeCall.call_id })
    return () => {
      sendJson({ type: 'leave_call', call_id: activeCall.call_id })
    }
  }, [activeCall?.call_id, sendJson, wsStatus])

  // Reset peerJoined whenever we switch calls so the next call starts fresh.
  useEffect(() => {
    setPeerJoined(false)
  }, [activeCall?.call_id])

  // ── Initiator: create offer ───────────────────────────────────────
  // Gated on `peerJoined` — see comment on the state declaration.

  useEffect(() => {
    if (!activeCall?.call_id || !remoteUserId || wsStatus !== 'open' || !isInitiator) return
    if (!peerJoined) return
    let cancelled = false
    const setup = async () => {
      try {
        const stream = await ensureLocalStream()
        if (cancelled) return
        const pc = ensurePeerConnection(String(remoteUserId))
        stream.getTracks().forEach((track) => {
          if (!pc.getSenders().some((s) => s.track === track)) pc.addTrack(track, stream)
        })
        if (!offerInProgress.current) {
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
        offerInProgress.current = false
      }
    }
    void setup()
    return () => {
      cancelled = true
    }
  }, [activeCall?.call_id, ensureLocalStream, ensurePeerConnection, isInitiator, peerJoined, remoteUserId, sendJson, wsStatus])

  // ── WebSocket message handler ─────────────────────────────────────

  useEffect(() => {
    if (!lastMessage?.data) return
    if (lastMessageRef.current === lastMessage.data) return
    lastMessageRef.current = lastMessage.data as string

    try {
      const event = JSON.parse(lastMessage.data as string) as Record<string, unknown>
      const type = event.type as string
      const eventCallId = event.call_id ? String(event.call_id) : null

      if (type === 'incoming_call' && event.call_id) {
        addActiveCallId(event.call_id as string)
        setIncomingCall((prev) =>
          prev?.call_id === (event.call_id as string) ? prev : (event as IncomingCallEvent),
        )
      }

      if (type === 'call_ended' && event.call_id) {
        removeActiveCallId(event.call_id as string)
        setIncomingCall((prev) => (prev?.call_id === event.call_id ? null : prev))
        if (activeCall?.call_id && String(activeCall.call_id) === eventCallId) {
          setActiveCall(null)
          setInitiatorId(null)
          cleanupMedia()
        }
      }

      if (!activeCall?.call_id || !eventCallId || String(activeCall.call_id) !== eventCallId) return

      // Receiver clicked Accept → backend broadcasts participant_joined (via
      // call.broadcast_call_event in answer_call). Initiator flips peerJoined
      // and the create-offer effect fires. Also catch `participant_update`
      // and `joined_call` defensively in case the backend emits one of those
      // first (some flows do).
      if (type === 'call_event' && event.event_type === 'participant_joined') {
        if (event.data && (event.data as { user_id?: string }).user_id !== String(user?.id ?? '')) {
          setPeerJoined(true)
        }
      }
      if (type === 'participant_update' && event.user_id && String(event.user_id) !== String(user?.id ?? '')) {
        if (event.status === 'connected') setPeerJoined(true)
      }

      if (type === 'webrtc_offer' && event.sdp && event.from_user_id) {
        const pc = ensurePeerConnection(event.from_user_id as string)
        const fromUserId = event.from_user_id as string
        const offerSdp = event.sdp as string
        ;(async () => {
          try {
            // Order matters on the answerer: setRemoteDescription LOCKS IN
            // the m-line layout from the offer; addTrack then attaches our
            // senders to those m-lines; createAnswer generates SDP that
            // matches. The previous order (addTrack → setRemoteDescription
            // → createAnswer) created m-lines from our local tracks first,
            // then the remote description didn't match, and codec
            // negotiation broke — the other side's video failed to decode.
            await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
            const stream = await ensureLocalStream()
            stream.getTracks().forEach((track) => {
              if (!pc.getSenders().some((s) => s.track === track)) {
                pc.addTrack(track, stream)
              }
            })
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sendJson({
              type: 'answer',
              call_id: activeCall.call_id,
              to_user_id: fromUserId,
              sdp: answer.sdp,
            })
            await flushPendingCandidates()
          } catch {
            /* malformed SDP or media denied */
          }
        })()
      }

      if (type === 'webrtc_answer' && event.sdp) {
        const pc = pcRef.current
        if (pc && !pc.currentRemoteDescription) {
          pc.setRemoteDescription({ type: 'answer', sdp: event.sdp as string })
            .then(() => flushPendingCandidates())
            .catch(() => null)
        }
      }

      if (type === 'webrtc_ice_candidate' && event.candidate) {
        const pc = pcRef.current
        const cand = event.candidate as RTCIceCandidateInit
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => null)
        } else {
          // Buffer until setRemoteDescription completes. Without this,
          // candidates arriving in the gap between offer-send and
          // answer-receive (or before the answerer processes the offer)
          // are silently rejected and lost — fatal on symmetric NAT.
          pendingCandidatesRef.current.push(cand)
        }
      }
    } catch {
      /* ignore malformed */
    }
  }, [activeCall, cleanupMedia, ensureLocalStream, ensurePeerConnection, flushPendingCandidates, lastMessage, sendJson, user?.id])

  useEffect(() => {
    if (!activeCall) cleanupMedia()
  }, [activeCall, cleanupMedia])

  // Warn before tab close/refresh while on an active call
  useEffect(() => {
    if (!activeCall) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You are on an active call. Leaving will end the call.'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [activeCall])

  // Heartbeat to prevent call WebSocket from being dropped by Azure/proxy idle timeouts
  useEffect(() => {
    if (wsStatus !== 'open') return
    const id = window.setInterval(() => {
      sendJson({ type: 'ping' })
    }, 30_000)
    return () => window.clearInterval(id)
  }, [wsStatus, sendJson])

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        isScreenSharing,
        mediaError,
        wsStatus,
        initiatorId,
        lastMessage,
        setActiveCall,
        setInitiatorId,
        sendJson,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        answerIncoming,
        declineIncoming,
        minimizeCall,
        maximizeCall,
      }}
    >
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}
