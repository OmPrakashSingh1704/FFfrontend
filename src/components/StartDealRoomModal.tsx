import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Handshake, Loader2, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'

export type StartDealRoomTarget = {
  /** Startup UUID — the actual record interest is expressed against. */
  id: string
  /** Display name shown in the picker. */
  name: string
  /** Optional secondary line, e.g. industry or stage. */
  hint?: string
}

type Props = {
  open: boolean
  onClose: () => void
  /**
   * Candidate startups. Interpretation depends on `investorId`:
   *   - investor flow (investorId undefined): startups the investor is
   *     expressing interest IN. Length 1 hides the picker.
   *   - founder flow (investorId provided): startups the founder is
   *     expressing interest FROM. Length 1 hides the picker.
   * Length 0 shouldn't be reachable — caller should gate the trigger.
   */
  targets: StartDealRoomTarget[]
  /**
   * When set, this is the founder-side flow: the founder is expressing
   * interest in this investor on behalf of one of their startups. The
   * server still requires `startup_id` (picked from `targets`); we add
   * `investor_id` to the body.
   * When undefined, server resolves investor from request.user (the
   * classic investor-side flow).
   */
  investorId?: string
  /**
   * Optional context line shown at the top of the modal. Use it to name
   * the founder (e.g. "Building with Alex Morgan") so the investor knows
   * who they're about to engage with.
   */
  contextLine?: string
}

type InterestResponse = {
  detail: string
  deal_room_id?: string
  mutual?: boolean
}

/**
 * Modal that starts the deal-room flow from an investor side.
 *
 * Backend semantics (see ff_backend.deals.views.ExpressInterestView):
 *   - If the founder hasn't yet expressed interest in this investor, we
 *     create an InterestExpression and notify the founder. Status:
 *     "waiting for the other party".
 *   - If the founder HAS expressed interest, a DealRoom is auto-created
 *     and both sides get a notification. We navigate the investor straight
 *     into the new room so they can sign the NDA.
 *
 * The investor's own InvestorProfile is resolved server-side from
 * request.user, so the frontend doesn't have to pass investor_id.
 */
export function StartDealRoomModal({ open, onClose, targets, investorId, contextLine }: Props) {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const [selectedId, setSelectedId] = useState<string>(targets[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const isFounderFlow = !!investorId

  const handleSubmit = async () => {
    if (!selectedId || submitting) return
    setSubmitting(true)
    try {
      const res = await apiRequest<InterestResponse>('/deals/interest/', {
        method: 'POST',
        body: {
          startup_id: selectedId,
          investor_id: investorId,  // only set on founder flow; backend resolves from user on investor flow
          message: message.trim() || undefined,
        },
      })
      if (res.mutual && res.deal_room_id) {
        pushToast('Deal room opened — both sides have expressed interest.', 'success')
        onClose()
        navigate(`/app/deals/${res.deal_room_id}`)
      } else {
        const waitingMsg = isFounderFlow
          ? 'Interest sent. A deal room opens automatically once the investor reciprocates.'
          : 'Interest sent. A deal room opens automatically once the founder reciprocates.'
        pushToast(waitingMsg, 'success')
        onClose()
      }
    } catch (err: unknown) {
      const detail =
        (err as { details?: { detail?: string } })?.details?.detail
        ?? (err as { message?: string })?.message
        ?? 'Unable to start a deal room. Please try again.'
      pushToast(detail, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="start-deal-room-modal"
    >
      <div className="card w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Handshake className="w-4 h-4" style={{ color: 'var(--gold)' }} />
            Start a deal room
          </h2>
          <button type="button" className="btn-sm ghost" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {contextLine ? (
          <p className="text-xs mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {contextLine}
          </p>
        ) : null}

        <p className="text-sm mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {isFounderFlow ? (
            <>
              You'll express interest in this investor on behalf of one of your
              startups. The investor gets notified, and a private workspace with
              chat, documents, and a mutual-consent workflow opens the moment
              they reciprocate.
            </>
          ) : (
            <>
              You'll express interest in this startup. The founder gets notified,
              and a private workspace with chat, calls, documents, and a
              mutual-consent workflow opens the moment they reciprocate.
            </>
          )}
        </p>

        {targets.length > 1 ? (
          <div className="form-group">
            <label>{isFounderFlow ? 'From which startup?' : 'Which startup?'}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {targets.map((target) => (
                <label
                  key={target.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    background:
                      selectedId === target.id ? 'hsl(var(--muted) / 0.5)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="deal-room-target"
                    value={target.id}
                    checked={selectedId === target.id}
                    onChange={() => setSelectedId(target.id)}
                    data-testid={`deal-room-target-${target.id}`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{target.name}</div>
                    {target.hint ? (
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {target.hint}
                      </div>
                    ) : null}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="form-group"
            style={{
              padding: '0.625rem 0.75rem',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              background: 'hsl(var(--muted) / 0.4)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.25rem' }}>
              Startup
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{targets[0]?.name}</div>
            {targets[0]?.hint ? (
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                {targets[0].hint}
              </div>
            ) : null}
          </div>
        )}

        <div className="form-group">
          <label>Message (optional)</label>
          <textarea
            className="textarea"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="A short note about why you're interested. Founders see this in the notification."
            maxLength={500}
            data-testid="deal-room-message"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void handleSubmit()}
            disabled={!selectedId || submitting}
            data-testid="deal-room-submit"
          >
            {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <>Express interest</>}
          </button>
        </div>
      </div>
    </div>
  )
}
