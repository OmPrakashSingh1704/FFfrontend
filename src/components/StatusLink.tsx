import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { STATUS_PAGE_SUMMARY_URL, STATUS_PAGE_URL } from '../lib/env'

type Health = 'operational' | 'degraded' | 'down' | 'unknown'

const COLORS: Record<Health, string> = {
  operational: '#10b981',
  degraded: '#f59e0b',
  down: '#ef4444',
  unknown: '#9ca3af',
}

const LABELS: Record<Health, string> = {
  operational: 'All systems operational',
  degraded: 'Partial degradation',
  down: 'Service disruption',
  unknown: 'System status',
}

const POLL_MS = 60_000

function classifyBetterStack(json: unknown): Health {
  if (!json || typeof json !== 'object') return 'unknown'
  const data = (json as { data?: { attributes?: { aggregate_state?: string } } }).data
  const state = data?.attributes?.aggregate_state
  if (state === 'up' || state === 'operational') return 'operational'
  if (state === 'degraded' || state === 'maintenance') return 'degraded'
  if (state === 'down' || state === 'has_incidents') return 'down'
  return 'unknown'
}

export function useStatusHealth(): Health {
  const [health, setHealth] = useState<Health>('unknown')

  useEffect(() => {
    if (!STATUS_PAGE_SUMMARY_URL) return

    let cancelled = false
    const fetchOnce = async () => {
      try {
        const res = await fetch(STATUS_PAGE_SUMMARY_URL, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setHealth('unknown')
          return
        }
        const json = await res.json()
        if (!cancelled) setHealth(classifyBetterStack(json))
      } catch {
        if (!cancelled) setHealth('unknown')
      }
    }

    fetchOnce()
    const id = window.setInterval(fetchOnce, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return health
}

type StatusLinkProps = {
  variant?: 'inline' | 'badge'
  className?: string
  showLabel?: boolean
}

export function StatusLink({ variant = 'inline', className, showLabel = true }: StatusLinkProps) {
  const health = useStatusHealth()

  if (!STATUS_PAGE_URL) return null

  const dotColor = COLORS[health]
  const label = LABELS[health]

  if (variant === 'badge') {
    return (
      <a
        href={STATUS_PAGE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        data-testid="status-page-link"
        title={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: 'hsl(var(--muted-foreground))',
          textDecoration: 'none',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 0 2px ${dotColor}33`,
          }}
        />
        {showLabel && <span>{label}</span>}
      </a>
    )
  }

  return (
    <a
      href={STATUS_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-testid="status-page-link"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.875rem',
        color: 'hsl(var(--muted-foreground))',
        textDecoration: 'none',
      }}
    >
      <Activity size={14} strokeWidth={1.5} style={{ color: dotColor }} />
      <span>System status</span>
    </a>
  )
}
