import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Phone, Video, Mic, MicOff, VideoOff, PhoneOff,
  ArrowLeft, Monitor, MonitorX, Minimize2, PhoneIncoming, PhoneOutgoing,
  PhoneMissed,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { addActiveCallId } from '../lib/callSession'
import { useCall } from '../context/CallContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { CallSession } from '../types/call'
import { ListRowsSkeleton } from '../components/skeletons'
import { CallReconnectingOverlay } from '../components/CallReconnectingOverlay'

/**
 * Calls page — destination view for an active call + a clean history list.
 *
 * Design intent: this page is reached by clicking the phone/video icon in a
 * chat, or by accepting an incoming call. It is NOT a control panel for
 * starting calls — that flow lives in the chat header. Anything that smells
 * like a debug surface (UUID paste-in, raw signaling log, "refresh status"
 * button) has been removed so this page focuses on the actual call.
 */
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
    endCall, minimizeCall,
  } = useCall()

  const [history, setHistory] = useState<CallSession[]>([])
  const [loading, setLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [callDurationSec, setCallDurationSec] = useState(0)

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

  // Load call from URL param (deep-link or returning to a minimized call).
  //
  // Terminal-state guard: when the OTHER party hangs up, CallContext clears
  // activeCall via the call_ended WS event — but the URL on this side still
  // says ?callId=X. Without the status check below, this effect would
  // happily re-fetch the now-ENDED call and re-mount the call frame as if
  // we were still in it. Filter out terminal statuses; if we land on a
  // terminal call, just strip the URL param and show the empty state.
  useEffect(() => {
    if (!callIdParam || activeCall?.call_id === callIdParam) return
    let cancelled = false
    void (async () => {
      try {
        const call = await apiRequest<CallSession>(`/chat/calls/${callIdParam}/`)
        if (cancelled) return
        const terminal = new Set(['ended', 'missed', 'declined', 'failed'])
        if (call.status && terminal.has(String(call.status).toLowerCase())) {
          // Don't re-mount a finished call. Drop the URL param so the
          // user sees the empty state cleanly.
          navigate('/app/calls', { replace: true })
          return
        }
        setActiveCall(call)
        if (call.initiator_id) setInitiatorId(String(call.initiator_id))
        addActiveCallId(call.call_id)
      } catch {
        if (!cancelled) pushToast('Unable to load call details', 'error')
      }
    })()
    return () => { cancelled = true }
  }, [callIdParam, activeCall?.call_id, setActiveCall, setInitiatorId, pushToast, navigate])

  // Tick a duration timer for the active call. Independent of the backend's
  // duration_seconds (which only updates on call end) so the UI shows live
  // mm:ss without re-fetching.
  useEffect(() => {
    if (!activeCall?.started_at) {
      setCallDurationSec(0)
      return
    }
    const startedAt = new Date(activeCall.started_at).getTime()
    const tick = () => setCallDurationSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [activeCall?.started_at, activeCall?.call_id])

  // Load call history
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setHistoryError(null)
      try {
        const data = await apiRequest<{ calls: CallSession[] }>('/chat/calls/history/')
        if (!cancelled) setHistory(data.calls ?? [])
      } catch {
        if (!cancelled) setHistoryError('Unable to load call history.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const handleEndCall = async () => {
    // Strip the URL param FIRST so the load-from-URL effect can't re-fetch
    // the call mid-end (which would re-mount the call frame for an instant
    // before endCall finishes clearing state). endCall is optimistic — it
    // clears local state synchronously — so navigating now is safe.
    navigate('/app/calls', { replace: true })
    await endCall()
  }

  // Name of the remote participant for an active call. Falls back to a
  // friendly placeholder rather than leaking UUIDs.
  const remotePartyName = useMemo(() => {
    if (!activeCall) return ''
    const others = (activeCall.participants ?? []).filter((p) => String(p.user_id) !== String(user?.id))
    if (others.length === 0) {
      return activeCall.initiator_name ?? 'Connecting…'
    }
    if (others.length === 1) {
      return others[0].user_name ?? 'Participant'
    }
    return `${others[0].user_name ?? 'Participant'} and ${others.length - 1} more`
  }, [activeCall, user?.id])

  const callTypeLabel = activeCall?.call_type === 'voice' ? 'Voice call' : 'Video call'

  // Friendly name for a history row. Prefer the other participant's name; if
  // the current user initiated, show callees; otherwise show the initiator.
  const historyPartyName = (call: CallSession): string => {
    const others = (call.participants ?? []).filter((p) => String(p.user_id) !== String(user?.id))
    if (others.length === 1) return others[0].user_name ?? 'Unknown'
    if (others.length > 1) return `${others[0].user_name ?? 'Group'} +${others.length - 1}`
    return call.initiator_name ?? 'Unknown'
  }

  // Outgoing vs incoming vs missed icon for a history row.
  const historyIcon = (call: CallSession) => {
    if (call.status === 'missed' || call.status === 'declined') {
      return <PhoneMissed style={{ width: 14, height: 14, color: '#ef4444' }} />
    }
    if (String(call.initiator_id) === String(user?.id)) {
      return <PhoneOutgoing style={{ width: 14, height: 14, color: 'var(--gold)' }} />
    }
    return <PhoneIncoming style={{ width: 14, height: 14, color: 'var(--gold)' }} />
  }

  const formatDuration = (totalSec: number) => {
    if (totalSec < 0) return '0:00'
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const formatHistoryDuration = (call: CallSession): string => {
    if (call.duration_seconds == null || call.duration_seconds <= 0) {
      return call.status === 'missed' ? 'Missed' : 'No answer'
    }
    return formatDuration(call.duration_seconds)
  }

  const formatHistoryTime = (iso?: string | null) => {
    if (!iso) return '--'
    const date = new Date(iso)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calls</h1>
          <p className="page-description">
            Start a call from any conversation. Recent calls appear here.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn-sm ghost"
            type="button"
            onClick={() => navigate('/app/chat')}
            data-testid="calls-back-to-chat"
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to chat
          </button>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            title={wsStatus === 'open' ? 'Signaling connected' : 'Signaling disconnected — calls may fail'}
          >
            <span className={`status-dot ${wsStatus === 'open' ? 'online' : 'offline'}`} />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              {wsStatus === 'open' ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {activeCall ? (
        <div
          className="card"
          style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}
          data-testid="active-call-stage"
        >
          {/* Video stage — remote video fills, local PiP corners. */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: 'radial-gradient(circle at 50% 30%, #1a1a1a 0%, #050505 80%)',
              overflow: 'hidden',
            }}
          >
            <CallReconnectingOverlay />
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                data-testid="remote-video"
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                <div
                  style={{
                    width: '4.5rem',
                    height: '4.5rem',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                >
                  {activeCall.call_type === 'voice'
                    ? <Phone style={{ width: 28, height: 28 }} />
                    : <Video style={{ width: 28, height: 28 }} />}
                </div>
                <span style={{ fontSize: '0.875rem' }}>Waiting for the other side…</span>
              </div>
            )}

            {/* Top overlay: caller name + duration */}
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                padding: '0.875rem 1.25rem',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pointerEvents: 'none',
              }}
            >
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600 }} data-testid="active-call-name">
                  {remotePartyName}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{callTypeLabel}</div>
              </div>
              <div
                style={{
                  fontSize: '0.875rem',
                  fontVariantNumeric: 'tabular-nums',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '999px',
                }}
                data-testid="active-call-duration"
              >
                {formatDuration(callDurationSec)}
              </div>
            </div>

            {/* Local PiP — bottom-right */}
            {localStream && activeCall.call_type !== 'voice' && (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  width: '9rem',
                  height: '6.75rem',
                  objectFit: 'cover',
                  borderRadius: '0.625rem',
                  border: '2px solid rgba(255,255,255,0.18)',
                  background: '#111',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
                }}
                data-testid="local-video"
              />
            )}
          </div>

          {/* Floating control bar — pill-style, like FaceTime */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.625rem',
              padding: '1rem 1.25rem',
              borderTop: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              flexWrap: 'wrap',
            }}
          >
            <CallControlButton
              testId="call-toggle-mute"
              onClick={toggleMute}
              disabled={!localStream}
              active={isMuted}
              label={isMuted ? 'Unmute' : 'Mute'}
              activeColor="#ef4444"
            >
              {isMuted ? <MicOff style={{ width: 18, height: 18 }} /> : <Mic style={{ width: 18, height: 18 }} />}
            </CallControlButton>

            {activeCall.call_type !== 'voice' && (
              <CallControlButton
                testId="call-toggle-video"
                onClick={toggleVideo}
                disabled={!localStream}
                active={isVideoOff}
                label={isVideoOff ? 'Turn on video' : 'Turn off video'}
                activeColor="#ef4444"
              >
                {isVideoOff ? <VideoOff style={{ width: 18, height: 18 }} /> : <Video style={{ width: 18, height: 18 }} />}
              </CallControlButton>
            )}

            <CallControlButton
              testId="call-toggle-screen"
              onClick={() => void toggleScreenShare()}
              active={isScreenSharing}
              label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              activeColor="var(--gold)"
            >
              {isScreenSharing
                ? <MonitorX style={{ width: 18, height: 18 }} />
                : <Monitor style={{ width: 18, height: 18 }} />}
            </CallControlButton>

            <CallControlButton
              testId="call-minimize"
              onClick={minimizeCall}
              label="Minimize"
            >
              <Minimize2 style={{ width: 18, height: 18 }} />
            </CallControlButton>

            <button
              type="button"
              onClick={() => void handleEndCall()}
              data-testid="call-end"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                borderRadius: '999px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginLeft: '0.5rem',
              }}
            >
              <PhoneOff style={{ width: 16, height: 16 }} />
              End
            </button>
          </div>

          {mediaError ? (
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid hsl(var(--border))' }}>
              <p style={{ color: '#ef4444', fontSize: '0.8125rem', margin: 0 }}>{mediaError}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1.5rem' }} data-testid="no-active-call">
          <div className="empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
            <Phone className="empty-icon" />
            <p className="empty-description" style={{ marginBottom: '0.25rem' }}>
              No active call.
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              Open a conversation and tap the phone or video icon to start one.
            </p>
            <button
              type="button"
              className="btn-sm primary"
              style={{ marginTop: '1rem' }}
              onClick={() => navigate('/app/chat')}
              data-testid="goto-chat-empty"
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Open chat
            </button>
          </div>
        </div>
      )}

      <section className="section">
        <span className="section-label">Recent calls</span>
        {loading ? (
          <ListRowsSkeleton count={4} />
        ) : historyError ? (
          <div className="card" style={{ borderColor: '#ef4444', padding: '1rem' }}>
            <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{historyError}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="card">
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <Phone className="empty-icon" />
              <p className="empty-description">No calls yet.</p>
            </div>
          </div>
        ) : (
          <div
            className="card"
            style={{ padding: 0, overflow: 'hidden' }}
            data-testid="call-history"
          >
            {history.map((call, idx) => (
              <div
                key={call.call_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                  padding: '0.875rem 1rem',
                  borderTop: idx === 0 ? 'none' : '1px solid hsl(var(--border))',
                }}
                data-testid={`call-history-row-${call.call_id}`}
              >
                <div
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '50%',
                    background: 'hsl(var(--muted))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {call.call_type === 'video'
                    ? <Video style={{ width: 16, height: 16, color: 'var(--gold)' }} />
                    : <Phone style={{ width: 16, height: 16, color: 'var(--gold)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                    }}
                  >
                    {historyIcon(call)}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {historyPartyName(call)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'hsl(var(--muted-foreground))',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      marginTop: '0.125rem',
                    }}
                  >
                    <span>{call.call_type === 'video' ? 'Video' : 'Voice'}</span>
                    <span>·</span>
                    <span>{formatHistoryDuration(call)}</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
                  {formatHistoryTime(call.started_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

type CallControlButtonProps = {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  active?: boolean
  label: string
  testId?: string
  activeColor?: string
}

/**
 * Pill-style call control button. `active` flips the background to highlight
 * "currently doing this" state (muted, video off, sharing screen). Used for
 * all the in-call toggles so they look identical.
 */
function CallControlButton({
  onClick, children, disabled, active, label, testId, activeColor,
}: CallControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      data-testid={testId}
      style={{
        width: '2.75rem',
        height: '2.75rem',
        borderRadius: '50%',
        border: '1px solid hsl(var(--border))',
        background: active ? (activeColor ?? 'hsl(var(--primary))') : 'hsl(var(--background))',
        color: active ? 'white' : 'hsl(var(--foreground))',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}
