import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
      acc.push(p)
      return acc
    }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
      <button
        className="btn-sm ghost"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        data-testid="prev-page"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        Prev
      </button>

      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {pages.map((p, idx) =>
          p === '...'
            ? <span key={`ellipsis-${idx}`} style={{ padding: '0.25rem 0.5rem', color: 'hsl(var(--muted-foreground))' }}>…</span>
            : <button
                key={p}
                className={`btn-sm ${p === page ? 'primary' : 'ghost'}`}
                onClick={() => onChange(p as number)}
                data-testid={`page-${p}`}
                style={{ minWidth: '2rem' }}
              >
                {p}
              </button>
        )}
      </div>

      <button
        className="btn-sm ghost"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        data-testid="next-page"
      >
        Next
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}
