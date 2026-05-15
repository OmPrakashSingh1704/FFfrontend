import { useState } from 'react'

/**
 * Compact tag row that collapses long lists behind a "+N more" toggle.
 *
 * Problem this solves: investor profiles can carry 20–70 industry chips
 * (sub-industries from onboarding) and rendering them all turns the
 * sidebar into a chip salad. A reader doesn't need to see "Cottage
 * Industries" inline to understand the investor's thesis — they need to
 * see the top few categories at a glance and be able to expand if they
 * actually care.
 *
 * Behaviour:
 *   - Renders up to `maxVisible` items normally.
 *   - If more exist, shows a "+N more" pill that toggles to reveal the
 *     rest in-place. A second click ("Show less") collapses it again.
 *   - Order is preserved as-given. If callers want a "primary first"
 *     order they should sort upstream.
 *
 * Used by PublicInvestorPage industries_focus. Generic enough to reuse
 * for founder skills, geography tags, sub-industries, etc.
 */
type Props = {
  tags: string[]
  maxVisible?: number
  /** Tailwind/CSS class applied to each chip. Defaults to the existing `badge`. */
  chipClassName?: string
  /** Optional formatter — e.g., to title-case underscored values. */
  formatter?: (tag: string) => string
  'data-testid'?: string
}

export function TagOverflow({
  tags,
  maxVisible = 6,
  chipClassName = 'badge',
  formatter,
  'data-testid': testId,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  if (tags.length === 0) return null

  const fits = tags.length <= maxVisible
  const visible = expanded || fits ? tags : tags.slice(0, maxVisible)
  const hiddenCount = tags.length - visible.length

  return (
    <div
      data-testid={testId}
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}
    >
      {visible.map((tag) => (
        <span key={tag} className={chipClassName}>
          {formatter ? formatter(tag) : tag}
        </span>
      ))}
      {!fits ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          data-testid={testId ? `${testId}-toggle` : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.2rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 500,
            border: '1px dashed hsl(var(--border))',
            background: 'transparent',
            color: 'hsl(var(--muted-foreground))',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {expanded ? 'Show less' : `+${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  )
}
