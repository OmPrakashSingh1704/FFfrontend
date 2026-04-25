import { AlertCircle, CheckCircle2 } from 'lucide-react'

export function WorkflowValidationBanner({ errors, valid }: { errors: string[]; valid: boolean }) {
  if (valid && errors.length === 0) {
    return (
      <div
        data-testid="wf-validation-ok"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0.5rem 0.75rem', borderRadius: 6,
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#22c55e',
          fontSize: '0.8125rem',
        }}
      >
        <CheckCircle2 size={14} /> Graph is valid
      </div>
    )
  }
  return (
    <div
      data-testid="wf-validation-errors"
      style={{
        padding: '0.5rem 0.75rem', borderRadius: 6,
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#ef4444',
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: errors.length > 0 ? 6 : 0, fontWeight: 600 }}>
        <AlertCircle size={14} /> Graph has {errors.length} issue{errors.length === 1 ? '' : 's'}
      </div>
      {errors.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 22, lineHeight: 1.5 }}>
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
    </div>
  )
}
