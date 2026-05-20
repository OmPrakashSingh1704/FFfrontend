import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, User, X } from 'lucide-react'
import type { RecipientOption } from '../types/intro'

/**
 * Searchable people picker — replaces a static <select> for choosing a
 * recipient out of a list that's too long to scan.
 *
 * Behavior:
 *   - Text input filters the supplied recipients list by display_name and
 *     subtitle (case-insensitive substring).
 *   - Recipients are grouped by `type` (investors first, then founders)
 *     to match the existing optgroup convention in the intro form.
 *   - Keyboard: ArrowUp/Down move highlight, Enter selects, Esc closes.
 *   - When `value` is set, the input shows the selected name and an X
 *     button clears it.
 *
 * Source data comes from the parent — no internal fetching. Same shape
 * the old <select> used (`RecipientOption[]`).
 */

const MAX_RESULTS = 50

type Props = {
  recipients: RecipientOption[]
  value: string  // selected user_id
  onChange: (userId: string) => void
  placeholder?: string
  disabled?: boolean
  'data-testid'?: string
}

const TYPE_ORDER: RecipientOption['type'][] = ['investor', 'founder']
const TYPE_LABEL: Record<RecipientOption['type'], string> = {
  investor: 'Investors',
  founder: 'Founders',
}

export function RecipientPicker({
  recipients,
  value,
  onChange,
  placeholder = 'Search by name or fund…',
  disabled,
  'data-testid': testId,
}: Props) {
  const reactId = useId()
  const inputId = `${reactId}-recipient`
  const listboxId = `${reactId}-listbox`

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => recipients.find((r) => r.user_id === value) ?? null,
    [recipients, value],
  )

  // When `query` is empty AND something is already selected, show the
  // selected name in the input (read-only-feeling). When user starts
  // typing, query takes over.
  const inputValue = open ? query : selected?.display_name ?? ''

  // Filtered results grouped by type. Empty query → show everything up
  // to MAX_RESULTS so the dropdown isn't useless on first focus.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = recipients.filter((r) => {
      if (!q) return true
      const name = r.display_name.toLowerCase()
      const sub = (r.subtitle ?? '').toLowerCase()
      return name.includes(q) || sub.includes(q)
    })
    const limited = matches.slice(0, MAX_RESULTS)
    const byType: Record<string, RecipientOption[]> = {}
    for (const r of limited) {
      const key = r.type
      if (!byType[key]) byType[key] = []
      byType[key].push(r)
    }
    return TYPE_ORDER.flatMap((t) =>
      byType[t]?.length ? [{ type: t, items: byType[t] }] : [],
    )
  }, [recipients, query])

  // Flat list of just the items in render order — drives ArrowUp/Down.
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  // Reset highlight when the visible list changes.
  useEffect(() => {
    setHighlight(flat.length > 0 ? 0 : -1)
  }, [flat])

  // Close on click-outside.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (r: RecipientOption) => {
    onChange(r.user_id)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const clear = () => {
    onChange('')
    setQuery('')
    setOpen(true)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setHighlight((h) => Math.min(h + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && flat[highlight]) {
        e.preventDefault()
        pick(flat[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }} data-testid={testId}>
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'hsl(var(--muted-foreground))',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          id={inputId}
          className="input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            // Typing while a value is selected clears the selection so
            // the input doesn't show a stale name on top of new query.
            if (value) onChange('')
          }}
          onKeyDown={onKeyDown}
          style={{ paddingLeft: 30, paddingRight: 30 }}
          data-testid={testId ? `${testId}-input` : undefined}
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear selection"
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'hsl(var(--muted-foreground))',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--muted-foreground))',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 280,
            overflowY: 'auto',
            background: 'hsl(var(--popover))',
            color: 'hsl(var(--popover-foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 30,
          }}
        >
          {flat.length === 0 ? (
            <div
              style={{
                padding: '12px 14px',
                fontSize: 13,
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              No people found
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.type}>
                <div
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'hsl(var(--muted-foreground))',
                    background: 'hsl(var(--muted))',
                  }}
                >
                  {TYPE_LABEL[group.type]}
                </div>
                {group.items.map((r) => {
                  const flatIndex = flat.indexOf(r)
                  const isHighlighted = flatIndex === highlight
                  return (
                    <button
                      key={r.user_id}
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHighlight(flatIndex)}
                      onClick={() => pick(r)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: isHighlighted
                          ? 'hsl(var(--accent))'
                          : 'transparent',
                        color: isHighlighted
                          ? 'hsl(var(--accent-foreground))'
                          : 'inherit',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <User
                        size={16}
                        style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.display_name}
                        </div>
                        {r.subtitle && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'hsl(var(--muted-foreground))',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {r.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
