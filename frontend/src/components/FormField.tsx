import type { ReactNode } from 'react'

type FormFieldProps = {
  label: string
  error?: string
  icon?: ReactNode
  children: ReactNode
}

export function FormField({ label, error, icon, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <label className="flex items-center gap-2 text-sm text-slate-400">
        {icon}
        {label}
      </label>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
