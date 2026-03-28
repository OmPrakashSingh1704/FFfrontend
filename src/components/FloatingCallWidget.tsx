import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Mic, MicOff, PhoneOff, Maximize2, Video, VideoOff, Monitor, MonitorX, GripHorizontal } from 'lucide-react'
import { useCall } from '../context/CallContext'

const WIDGET_WIDTH = 280
const WIDGET_HEIGHT = 220 // approximate: 158px video + ~62px controls

export function FloatingCallWidget() {
  const location = useLocation()
  const {
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    endCall,
    maximizeCall,
  } = useCall()

  const widgetRef = useRef<HTMLDivElement | null>(null)

  // Position: top-left corner of widget in viewport coords
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - WIDGET_WIDTH - 24,
    y: window.innerHeight - WIDGET_HEIGHT - 24,
  }))

  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Global mouse/touch move + up (attached once)
  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      if (!dragging.current) return
      const maxX = window.innerWidth - WIDGET_WIDTH
      const maxY = window.innerHeight - WIDGET_HEIGHT
      setPos({
        x: Math.max(0, Math.min(maxX, clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(maxY, clientY - dragOffset.current.y)),
      })
    }
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) onMove(t.clientX, t.clientY)
    }
    const onUp = () => { dragging.current = false }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  const startDrag = (clientX: number, clientY: number) => {
    dragging.current = true
    dragOffset.current = { x: clientX - pos.x, y: clientY - pos.y }
  }

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startDrag(e.clientX, e.clientY)
  }

  const onHandleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (t) startDrag(t.clientX, t.clientY)
  }

  // Callback refs: fire on element mount AND whenever the stream reference changes.
  // More reliable than useEffect+useRef for conditionally-rendered video elements.
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

  // Only show when there's an active call and user is NOT on the calls page
  if (!activeCall || location.pathname.startsWith('/app/calls')) return null

  return (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: `${WIDGET_WIDTH}px`,
        background: '#0a0a0a',
        borderRadius: '0.75rem',
        border: '1px solid hsl(var(--border))',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        zIndex: 9999,
        userSelect: 'none',
      }}
      role="region"
      aria-label="Active call"
    >
      {/* Drag handle */}
      <div
        onMouseDown={onHandleMouseDown}
        onTouchStart={onHandleTouchStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.3rem 0',
          cursor: 'grab',
          background: 'rgba(255,255,255,0.04)',
          touchAction: 'none',
        }}
        title="Drag to move"
      >
        <GripHorizontal style={{ width: 14, height: 14, color: 'hsl(var(--muted-foreground))', opacity: 0.6 }} />
      </div>

      {/* Video stage */}
      <div style={{ position: 'relative', height: '158px', background: '#111' }}>
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.75rem',
            }}
          >
            Connecting…
          </div>
        )}

        {/* Local PiP */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            bottom: '0.5rem',
            right: '0.5rem',
            width: '72px',
            height: '54px',
            objectFit: 'cover',
            borderRadius: '0.375rem',
            border: '1.5px solid hsl(var(--border))',
            background: '#000',
          }}
        />

        {/* Maximize button */}
        <button
          type="button"
          onClick={maximizeCall}
          title="Return to call"
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            background: 'rgba(0,0,0,0.6)',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.3rem',
            cursor: 'pointer',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Maximize2 style={{ width: 13, height: 13 }} />
        </button>

        {/* Call type badge */}
        <div
          style={{
            position: 'absolute',
            top: '0.5rem',
            left: '0.5rem',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '0.25rem',
            padding: '0.15rem 0.4rem',
            fontSize: '0.6rem',
            fontWeight: 600,
            color: 'var(--gold, #f59e0b)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {activeCall.call_type} · {activeCall.status}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.375rem',
          padding: '0.5rem 0.75rem',
          background: 'hsl(var(--card))',
        }}
      >
        <button
          className="btn-sm ghost"
          type="button"
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <MicOff style={{ width: 14, height: 14 }} />
          ) : (
            <Mic style={{ width: 14, height: 14 }} />
          )}
        </button>

        {activeCall.call_type !== 'voice' && (
          <button
            className="btn-sm ghost"
            type="button"
            onClick={toggleVideo}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? (
              <VideoOff style={{ width: 14, height: 14 }} />
            ) : (
              <Video style={{ width: 14, height: 14 }} />
            )}
          </button>
        )}

        <button
          className="btn-sm ghost"
          type="button"
          onClick={() => void toggleScreenShare()}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          style={isScreenSharing ? { color: 'var(--gold, #f59e0b)' } : undefined}
        >
          {isScreenSharing ? (
            <MonitorX style={{ width: 14, height: 14 }} />
          ) : (
            <Monitor style={{ width: 14, height: 14 }} />
          )}
        </button>

        <button
          className="btn-sm ghost"
          type="button"
          onClick={() => void endCall()}
          title="End call"
          style={{ color: '#ef4444', marginLeft: 'auto' }}
        >
          <PhoneOff style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  )
}
