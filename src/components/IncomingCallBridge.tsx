import { useState } from 'react'
import { useCall } from '../context/CallContext'

export function IncomingCallBridge() {
  const { incomingCall, answerIncoming, declineIncoming } = useCall()
  const [busy, setBusy] = useState(false)

  if (!incomingCall?.call_id) return null

  const callerName = incomingCall.caller?.name || 'Someone'
  const callType = incomingCall.call_type?.toUpperCase() || 'CALL'

  const handleAnswer = async () => {
    setBusy(true)
    await answerIncoming()
    setBusy(false)
  }

  const handleDecline = async () => {
    setBusy(true)
    await declineIncoming()
    setBusy(false)
  }

  return (
    <div className="chat-modal-overlay" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="chat-modal">
        <header>
          <h3>Incoming {callType}</h3>
          <button type="button" onClick={() => void handleDecline()} aria-label="Dismiss">
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
