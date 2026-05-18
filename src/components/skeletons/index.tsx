import { Skeleton, SkeletonAvatar, SkeletonList, SkeletonText } from '../ui/skeleton'

export { Skeleton, SkeletonAvatar, SkeletonList, SkeletonText } from '../ui/skeleton'

// =============================================================================
// FeedCardSkeleton — matches FeedPage card layout
// =============================================================================
export function FeedCardSkeleton() {
  return (
    <article
      className="card"
      style={{ padding: 0, overflow: 'hidden' }}
      role="presentation"
      aria-hidden="true"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1.25rem 0' }}>
        <SkeletonAvatar size={32} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <Skeleton className="h-3" style={{ width: '40%' }} />
          <Skeleton className="h-2.5" style={{ width: '25%' }} />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div style={{ padding: '0.875rem 1.25rem' }}>
        <SkeletonText lines={3} lastLineWidth="75%" />
      </div>
      <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 1.25rem 1rem' }}>
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </article>
  )
}

export function FeedListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonList count={count} className="flex flex-col gap-3" data-testid="feed-skeleton">
      {() => <FeedCardSkeleton />}
    </SkeletonList>
  )
}

// =============================================================================
// ListRowSkeleton — small horizontal row (list-item layout)
// =============================================================================
export function ListRowSkeleton() {
  return (
    <div
      className="list-item"
      role="presentation"
      aria-hidden="true"
      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
    >
      <SkeletonAvatar size={32} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: 0 }}>
        <Skeleton className="h-3.5" style={{ width: '45%' }} />
        <Skeleton className="h-3" style={{ width: '70%' }} />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  )
}

export function ListRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonList count={count} className="flex flex-col gap-1">
      {() => <ListRowSkeleton />}
    </SkeletonList>
  )
}

// =============================================================================
// ProfileCardSkeleton — banner + avatar + name + tags + actions
// matches FoundersListPage / InvestorsListPage card shape
// =============================================================================
export function ProfileCardSkeleton() {
  return (
    <div
      className="card"
      role="presentation"
      aria-hidden="true"
      style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <Skeleton className="rounded-none" style={{ height: '80px', width: '100%' }} />
      <div style={{ padding: '0 1rem' }}>
        <SkeletonAvatar size={56} style={{ marginTop: '-28px', border: '3px solid hsl(var(--card))' }} />
      </div>
      <div style={{ padding: '0.5rem 1rem 1rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.5rem' }}>
        <Skeleton className="h-4" style={{ width: '55%' }} />
        <Skeleton className="h-3" style={{ width: '85%' }} />
        <Skeleton className="h-3" style={{ width: '70%' }} />
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div
          style={{
            display: 'flex',
            gap: '0.375rem',
            marginTop: 'auto',
            paddingTop: '0.625rem',
            borderTop: '1px solid hsl(var(--border))',
          }}
        >
          <Skeleton className="h-7" style={{ flex: 1 }} />
          <Skeleton className="h-7" style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  )
}

export function ProfileGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid-3" role="status" aria-busy="true" aria-live="polite" data-testid="profile-grid-skeleton">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <ProfileCardSkeleton key={i} />
      ))}
    </div>
  )
}

// =============================================================================
// FundCardSkeleton — wider card for fund/startup list shapes
// =============================================================================
export function FundCardSkeleton() {
  return (
    <div
      className="card"
      role="presentation"
      aria-hidden="true"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Skeleton className="h-10 w-10 rounded-md" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <Skeleton className="h-4" style={{ width: '60%' }} />
          <Skeleton className="h-3" style={{ width: '40%' }} />
        </div>
      </div>
      <SkeletonText lines={2} lastLineWidth="65%" />
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  )
}

export function FundGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid-3" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <FundCardSkeleton key={i} />
      ))}
    </div>
  )
}

// =============================================================================
// DetailPageSkeleton — header + 2 content sections
// matches FounderDetail / InvestorDetail / StartupDetail / FundDetail layouts
// =============================================================================
export function DetailPageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <span className="sr-only">Loading…</span>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Skeleton className="rounded-none" style={{ height: '140px', width: '100%' }} />
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <SkeletonAvatar
            size={96}
            style={{ marginTop: '-48px', border: '4px solid hsl(var(--card))', marginBottom: '1rem' }}
          />
          <Skeleton className="h-6 mb-2" style={{ width: '40%' }} />
          <Skeleton className="h-4 mb-3" style={{ width: '55%' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: '1.25rem' }}>
        <Skeleton className="h-4 mb-3" style={{ width: '25%' }} />
        <SkeletonText lines={4} lastLineWidth="70%" />
      </div>
      <div className="card" style={{ padding: '1.25rem' }}>
        <Skeleton className="h-4 mb-3" style={{ width: '25%' }} />
        <SkeletonText lines={3} />
      </div>
    </div>
  )
}

// =============================================================================
// ChatThreadSkeleton — sidebar conversation row
// =============================================================================
export function ChatThreadSkeleton() {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem' }}
    >
      <SkeletonAvatar size={40} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <Skeleton className="h-3.5" style={{ width: '50%' }} />
          <Skeleton className="h-2.5 w-8" />
        </div>
        <Skeleton className="h-3" style={{ width: '80%' }} />
      </div>
    </div>
  )
}

export function ChatThreadsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonList count={count} className="flex flex-col">
      {() => <ChatThreadSkeleton />}
    </SkeletonList>
  )
}

// =============================================================================
// ChatMessagesSkeleton — bubble pattern for active conversation
// =============================================================================
export function ChatMessagesSkeleton() {
  const pattern = [
    { side: 'left' as const, width: '60%' },
    { side: 'left' as const, width: '45%' },
    { side: 'right' as const, width: '50%' },
    { side: 'left' as const, width: '70%' },
    { side: 'right' as const, width: '40%' },
    { side: 'right' as const, width: '55%' },
  ]
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}
    >
      <span className="sr-only">Loading messages…</span>
      {pattern.map((p, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: p.side === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          <Skeleton className="h-9 rounded-2xl" style={{ width: p.width, maxWidth: '70%' }} />
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// StatsGridSkeleton — analytics / dashboard / billing stat cards
// =============================================================================
export function StatCardSkeleton() {
  return (
    <div className="card" role="presentation" aria-hidden="true" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <Skeleton className="h-3" style={{ width: '40%' }} />
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>
      <Skeleton className="h-7 mb-2" style={{ width: '50%' }} />
      <Skeleton className="h-3" style={{ width: '60%' }} />
    </div>
  )
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
      }}
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

// =============================================================================
// TableRowsSkeleton — admin tables and audit logs
// =============================================================================
export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '1rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid hsl(var(--border))',
        alignItems: 'center',
      }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: i === 0 ? '70%' : '50%' }} />
      ))}
    </div>
  )
}

export function TableRowsSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card" role="status" aria-busy="true" aria-live="polite" style={{ padding: 0, overflow: 'hidden' }}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </div>
  )
}

// =============================================================================
// FormSkeleton — profile edit, verification, onboarding forms
// =============================================================================
export function FormFieldSkeleton() {
  return (
    <div role="presentation" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <Skeleton className="h-3" style={{ width: '20%' }} />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div
      className="card"
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-5 mb-2" style={{ width: '30%' }} />
      {Array.from({ length: fields }).map((_, i) => (
        <FormFieldSkeleton key={i} />
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  )
}

// =============================================================================
// CenteredPageSkeleton — full-page spinner replacement (no specific shape)
// Used as a fallback when the page hasn't loaded its identity yet
// (e.g. FounderProfileEditPage / InvestorProfileEditPage initial fetch)
// =============================================================================
export function CenteredPageSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem 0' }}
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-7" style={{ width: '40%' }} />
      <Skeleton className="h-4" style={{ width: '60%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  )
}
