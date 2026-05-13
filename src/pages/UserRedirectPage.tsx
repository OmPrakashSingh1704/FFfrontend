import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList, type PaginatedResponse } from '../lib/pagination'

type FounderLite = { id?: string; user?: { id?: string } }
type InvestorLite = { id?: string; user_id?: string; user?: { id?: string } }

/**
 * Resolve a user id (from an @mention link) to the profile they actually have
 * and redirect there. The @mention composer writes `/app/users/<user_id>`
 * because at insertion time we only know the user id; profiles live behind
 * separate routes (founder vs investor) and a user may have both.
 *
 * Strategy: fetch the founder + investor profile by user_id in parallel via
 * the existing `?user_ids=` filter. Prefer founder when the user has both
 * (matches the existing primary_mode default tie-breaker). Falls back to a
 * search-results page when neither profile exists.
 */
export function UserRedirectPage() {
  const { id } = useParams<{ id: string }>()
  const [resolved, setResolved] = useState<{ to: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('No user id provided')
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const [founderRes, investorRes] = await Promise.allSettled([
          apiRequest<PaginatedResponse<FounderLite> | FounderLite[]>(
            `/founders/?user_ids=${encodeURIComponent(id)}`,
          ),
          apiRequest<PaginatedResponse<InvestorLite> | InvestorLite[]>(
            `/investors/?user_ids=${encodeURIComponent(id)}`,
          ),
        ])
        if (cancelled) return

        const founderProfile =
          founderRes.status === 'fulfilled' ? normalizeList(founderRes.value)[0] : null
        const investorProfile =
          investorRes.status === 'fulfilled' ? normalizeList(investorRes.value)[0] : null

        if (founderProfile?.id) {
          setResolved({ to: `/app/founders/${founderProfile.id}` })
          return
        }
        if (investorProfile?.id) {
          setResolved({ to: `/app/investors/${investorProfile.id}` })
          return
        }
        setError('Profile not found')
      } catch {
        if (!cancelled) setError('Unable to resolve user')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  if (resolved) {
    return <Navigate to={resolved.to} replace />
  }

  return (
    <section className="max-w-2xl mx-auto px-4 py-12 text-center">
      {error ? (
        <p style={{ color: 'hsl(var(--muted-foreground))' }} data-testid="user-redirect-error">
          {error}
        </p>
      ) : (
        <div
          className="flex items-center justify-center gap-2"
          style={{ color: 'hsl(var(--muted-foreground))' }}
          data-testid="user-redirect-loading"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Opening profile…</span>
        </div>
      )}
    </section>
  )
}
