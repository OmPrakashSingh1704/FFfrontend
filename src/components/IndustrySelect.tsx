import { useEffect, useId, useRef, useState } from 'react'
import { Briefcase, ChevronDown } from 'lucide-react'
import { filterIndustries, INDUSTRIES } from '../lib/industryData'

/**
 * Single-select industry combobox.
 *
 * Behavior:
 *   - Bundled list is the only source — no network. The vocabulary is
 *     small enough (~80 entries) that any reasonable industry is one
 *     keystroke away.
 *   - Free typing still allowed. If the user's industry isn't in the
 *     list, they can keep what they typed and the value persists.
 *   - Stores a single string ("FinTech"), matching the existing backend
 *     shape for Startup.industry.
 */

const MAX_RESULTS = 8

type Props = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  required?: boolean
  inputClassName?: string
  id?: string
  'data-testid'?: string
  disabled?: boolean
}

export function IndustrySelect({
  value,
  onChange,
  placeholder = 'Start typing — e.g., FinTech, HealthTech…',
  required,
  inputClassName = 'input',
  id,
  'data-testid': testId,
  disabled,
}: Props) {
  const reactId = useId()
  const inputId = id || `${reactId}-industry`
  const listboxId = `${reactId}-listbox`

  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [highlight, setHighlight] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const filtered = value.trim()
      ? filterIndustries(value, MAX_RESULTS)
      : INDUSTRIES.slice(0, MAX_RESULTS)
    setSuggestions(filtered)
    setHighlight(filtered.length > 0 ? 0 : -1)
  }, [value])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const select = (pick: string) => {
    onChange(pick)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < suggestions.length) {
        e.preventDefault()
        select(suggestions[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        id={inputId}
        className={inputClassName}
        style={{ paddingRight: '2.25rem' }}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        data-testid={testId}
        disabled={disabled}
      />
      <button
        type="button"
        aria-label={open ? 'Close industry list' : 'Open industry list'}
        onClick={() => setOpen((prev) => !prev)}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: '0.5rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          padding: '0.25rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: 'hsl(var(--muted-foreground))',
        }}
      >
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          style={{
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            margin: 0,
            padding: '0.25rem 0',
            listStyle: 'none',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)',
            maxHeight: '16rem',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, idx) => {
            const active = idx === highlight
            return (
              <li
                key={s}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(s)
                }}
                onMouseEnter={() => setHighlight(idx)}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  background: active ? 'hsl(var(--muted))' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Briefcase
                  size={13}
                  strokeWidth={1.5}
                  style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
