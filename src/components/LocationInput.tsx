import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { filterLocations } from '../lib/locationData'

/**
 * Location autocomplete with bundled-list-first strategy.
 *
 * Strategy:
 *   1. **Local list (primary)** — every keystroke filters the bundled
 *      `LOCATIONS` list at `lib/locationData.ts`. Instant, zero network.
 *      Covers all countries + ~200 cities globally.
 *
 *   2. **Photon (fallback only)** — if the local filter returns ZERO
 *      matches and the user has typed 3+ characters, we hit
 *      photon.komoot.io after a debounce. Aborted at 3s so a slow API
 *      can never block the UI. Results are cached in-session so the
 *      same query never re-fetches.
 *
 * Storage is still a single string ("Bangalore, India") so backend
 * shape doesn't change.
 */

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/'
const DEBOUNCE_MS = 300
const PHOTON_MIN_LENGTH = 3
const PHOTON_TIMEOUT_MS = 3000
const MAX_RESULTS = 7

// Module-scoped cache. Same query within a session never hits the API
// twice. `null` value means "we tried and got nothing" — still cached so
// we don't retry.
const photonCache = new Map<string, string[]>()
const PHOTON_CACHE_MAX = 100

type PhotonFeature = {
  properties?: {
    name?: string
    city?: string
    state?: string
    country?: string
  }
}

function formatSuggestion(feat: PhotonFeature): string | null {
  const p = feat.properties || {}
  const parts: string[] = []
  const primary = p.name || p.city
  if (primary) parts.push(primary)
  if (p.state && p.state !== primary) parts.push(p.state)
  if (p.country && p.country !== primary) parts.push(p.country)
  if (parts.length === 0) return null
  const seen = new Set<string>()
  return parts.filter((x) => {
    const k = x.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).join(', ')
}

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

export function LocationInput({
  value,
  onChange,
  placeholder = 'Start typing a city or country…',
  required,
  inputClassName = 'input',
  id,
  'data-testid': testId,
  disabled,
}: Props) {
  const reactId = useId()
  const inputId = id || `${reactId}-location`
  const listboxId = `${reactId}-listbox`

  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track the latest query so a late-returning Photon response can't
  // overwrite suggestions for a newer keystroke.
  const latestQueryRef = useRef<string>('')

  useEffect(() => {
    const q = value.trim()
    latestQueryRef.current = q

    // STEP 1: local filter, always synchronous.
    const local = filterLocations(q, MAX_RESULTS)
    setSuggestions(local)
    setHighlight(local.length > 0 ? 0 : -1)

    // STEP 2: Photon fallback only if local is empty and query is long
    // enough. Anything shorter is too ambiguous for global geocoding.
    if (local.length > 0 || q.length < PHOTON_MIN_LENGTH) {
      setLoading(false)
      return
    }

    // Cache check.
    const cacheKey = q.toLowerCase()
    const cached = photonCache.get(cacheKey)
    if (cached !== undefined) {
      setSuggestions(cached)
      setHighlight(cached.length > 0 ? 0 : -1)
      setLoading(false)
      return
    }

    setLoading(true)
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), PHOTON_TIMEOUT_MS)
    const debounceHandle = setTimeout(async () => {
      const queryAtFire = q
      try {
        const url = `${PHOTON_ENDPOINT}?q=${encodeURIComponent(queryAtFire)}&limit=${MAX_RESULTS}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`Photon ${res.status}`)
        const data: { features?: PhotonFeature[] } = await res.json()
        const formatted: string[] = []
        const seen = new Set<string>()
        for (const f of data.features ?? []) {
          const label = formatSuggestion(f)
          if (!label) continue
          const key = label.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          formatted.push(label)
          if (formatted.length >= MAX_RESULTS) break
        }
        // Cache it. Evict oldest if at capacity.
        if (photonCache.size >= PHOTON_CACHE_MAX) {
          const oldest = photonCache.keys().next().value
          if (oldest !== undefined) photonCache.delete(oldest)
        }
        photonCache.set(cacheKey, formatted)
        if (latestQueryRef.current !== queryAtFire) return
        setSuggestions(formatted)
        setHighlight(formatted.length > 0 ? 0 : -1)
      } catch {
        // Timeout / network / abort — silently leave suggestions empty.
        // Cache the empty result for this query so we don't retry.
        photonCache.set(cacheKey, [])
      } finally {
        clearTimeout(timeoutHandle)
        if (latestQueryRef.current === queryAtFire) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(debounceHandle)
      clearTimeout(timeoutHandle)
      controller.abort()
    }
  }, [value])

  // Close on outside click.
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
    setSuggestions([])
    setHighlight(-1)
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
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
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
      {loading && (
        <Loader2
          className="animate-spin"
          size={14}
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'hsl(var(--muted-foreground))',
            pointerEvents: 'none',
          }}
        />
      )}
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
            maxHeight: '14rem',
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
                  // Prevent input blur before click handler runs.
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
                <MapPin size={13} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
