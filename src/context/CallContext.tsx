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

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const offerInProgress = useRef(false)
  const lastMessageRef = useRef<string | null>(null)

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
    setLocalStream(null)
    setRemoteStream(null)
    setMediaError(null)
    setIsMuted(false)
    setIsVideoOff(false)
    setIsScreenSharing(false)
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
        const [stream] = event.streams
        setRemoteStream(stream ?? new MediaStream([event.track]))
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
    if (!activeCall) return
    try {
      await apiRequest(`/chat/calls/${activeCall.call_id}/end/`, { method: 'POST' })
      removeActiveCallId(activeCall.call_id)
      pushToast('Call ended', 'info')
    } catch {
      pushToast('Unable to end call', 'error')
    }
    setActiveCall(null)
    setInitiatorId(null)
    cleanupMedia()
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

  // ── Initiator: create offer ───────────────────────────────────────

  useEffect(() => {
    if (!activeCall?.call_id || !remoteUserId || wsStatus !== 'open' || !isInitiator) return
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
        /* ignore */
      }
    }
    void setup()
    return () => {
      cancelled = true
    }
  }, [activeCall?.call_id, ensureLocalStream, ensurePeerConnection, isInitiator, remoteUserId, sendJson, wsStatus])

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

      if (type === 'webrtc_offer' && event.sdp && event.from_user_id) {
        const pc = ensurePeerConnection(event.from_user_id as string)
        ensureLocalStream()
          .then((stream) => {
            stream.getTracks().forEach((track) => {
              if (!pc.getSenders().some((s) => s.track === track)) pc.addTrack(track, stream)
            })
            return pc.setRemoteDescription({ type: 'offer', sdp: event.sdp as string })
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

      if (type === 'webrtc_answer' && event.sdp) {
        const pc = pcRef.current
        if (pc && !pc.currentRemoteDescription) {
          pc.setRemoteDescription({ type: 'answer', sdp: event.sdp as string }).catch(() => null)
        }
      }

      if (type === 'webrtc_ice_candidate' && event.candidate) {
        pcRef.current
          ?.addIceCandidate(new RTCIceCandidate(event.candidate as RTCIceCandidateInit))
          .catch(() => null)
      }
    } catch {
      /* ignore malformed */
    }
  }, [activeCall, cleanupMedia, ensureLocalStream, ensurePeerConnection, lastMessage, sendJson])

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
