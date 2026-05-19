/**
 * Tiny shared picker for "which of my startups is this action for?"
 *
 * Used by fund-apply flows where the user might own multiple startups
 * and we shouldn't silently assume the first one. Two flows wire to this:
 *
 *   - FundsListPage: external-link apply → pick before opening the link,
 *     stash the choice in sessionStorage so the "Did you apply?" confirm
 *     dialog knows which startup to attach to the application row
 *   - FundDetailPage: in-app apply → pick before POSTing /applications/
 *
 * Callers should SKIP this modal when the user has exactly 1 startup —
 * picking is implicit there. When they have 0, the apply button is
 * disabled upstream with a hint to add a startup.
 */
import { X, Check, Loader2 } from 'lucide-react'
import { useState } from 'react'

export type PickerStartup = {
  id: string
  name: string
}

export function StartupPickerModal({
  open,
  startups,
  title = 'Apply with which startup?',
  description,
  onPick,
  onClose,
  submitting = false,
}: {
  open: boolean
  startups: PickerStartup[]
  title?: string
  description?: string
  onPick: (startupId: string) => void
  onClose: () => void
  submitting?: boolean
}) {
  const [selectedId, setSelectedId] = useState<string>('')

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="startup-picker-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 440,
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{title}</h3>
          <button
            type="button"
            className="btn-sm ghost"
            style={{ padding: 4 }}
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        {description ? (
          <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.875rem' }}>
            {description}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem', maxHeight: 240, overflowY: 'auto' }}>
          {startups.map((s) => {
            const active = selectedId === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                disabled={submitting}
                data-testid={`startup-picker-option-${s.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 0.75rem',
                  border: active ? '1px solid var(--gold)' : '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  background: active ? 'hsl(var(--muted))' : 'transparent',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 500,
                  color: 'hsl(var(--foreground))',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
                {active ? <Check size={14} style={{ color: 'var(--gold)' }} /> : null}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-sm ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-sm primary"
            disabled={!selectedId || submitting}
            onClick={() => selectedId && onPick(selectedId)}
            data-testid="startup-picker-confirm"
          >
            {submitting ? <><Loader2 size={12} className="animate-spin" /> Working…</> : <><Check size={12} /> Continue</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default StartupPickerModal
