import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Heart, MessageSquare } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { Markdown } from './Markdown'
import type { FeedEvent } from '../types/feed'

/**
 * Public, read-only feed posts attributed to a single profile.
 *
 * Pass exactly one identifier. The component renders nothing if the list
 * is empty, so the parent page can drop it in without conditional logic.
 *
 * Posts here are intentionally simpler than the main /feed/ cards: no
 * inline like/comment buttons, no menu, no composer. Public viewers tap
 * a card to deep-link to the full post in the feed (auth-walled). Anon
 * visitors get the title + a preview to drive sign-up.
 */
type Props =
  | { startupId: string; founderUserId?: never; investorUserId?: never }
  | { startupId?: never; founderUserId: string; investorUserId?: never }
  | { startupId?: never; founderUserId?: never; investorUserId: string }

type PostsResponse = {
  results: FeedEvent[]
  count: number
  next: number | null
}

function relativeTime(iso?: string) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export function ProfilePosts(props: Props) {
  const [posts, setPosts] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if ('startupId' in props && props.startupId) params.set('startup_id', props.startupId)
    if ('founderUserId' in props && props.founderUserId) params.set('founder_user_id', props.founderUserId)
    if ('investorUserId' in props && props.investorUserId) params.set('investor_user_id', props.investorUserId)
    params.set('limit', '10')

    void (async () => {
      try {
        const data = await apiRequest<PostsResponse>(`/public/profile-feed/?${params.toString()}`)
        if (!cancelled) setPosts(data.results ?? [])
      } catch {
        if (!cancelled) setPosts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [props])

  if (loading) {
    return (
      <section className="mb-8" data-testid="profile-posts-loading">
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Posts
        </h2>
        <div className="flex items-center justify-center" style={{ padding: '1.5rem 0', color: 'hsl(var(--muted-foreground))' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      </section>
    )
  }

  if (posts.length === 0) return null

  return (
    <section className="mb-8" data-testid="profile-posts">
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 inline-flex items-center gap-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Posts
        <span className="badge" style={{ fontSize: '0.7rem' }}>{posts.length}</span>
      </h2>
      {/* Horizontal rail: latest post is left-most (backend returns -created_at).
          Each card sticks to ~300px wide so a few are visible at once on
          desktop and one fully on mobile, the rest accessible by horizontal
          scroll (touchpad / shift+wheel / drag). overflow-y: hidden prevents
          the rail from creating a vertical scrollbar when card content is
          taller than usual. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '0.75rem',
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '0.5rem',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {posts.map((p) => {
          const primary = p.attributions?.[0]
          const rest = (p.attributions ?? []).slice(1)
          return (
            <article
              key={p.id}
              className="card"
              data-testid={`profile-post-${p.id}`}
              style={{
                padding: '1rem',
                width: 300,
                flex: '0 0 300px',
                scrollSnapAlign: 'start',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Byline: stacked avatars + primary identity + timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
                {(p.attributions ?? []).slice(0, 3).map((a, idx) => (
                  <div
                    key={`${a.kind}-${a.id}`}
                    className="avatar"
                    style={{
                      marginLeft: idx === 0 ? 0 : '-0.5rem',
                      border: '2px solid hsl(var(--card))',
                      zIndex: 3 - idx,
                      position: 'relative',
                      width: 28,
                      height: 28,
                    }}
                    title={`${a.name}${a.role_label ? ` · ${a.role_label}` : ''}`}
                  >
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>
                        {(a.name || '?').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    {primary?.link ? (
                      <Link
                        to={primary.link}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {primary?.name ?? p.author?.full_name ?? 'Unknown'}
                      </Link>
                    ) : (
                      <span>{primary?.name ?? p.author?.full_name ?? 'Unknown'}</span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                      {relativeTime(p.created_at)}
                    </span>
                  </div>
                  {rest.length > 0 && (
                    <p style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                      also by{' '}
                      {rest.map((a, idx) => (
                        <span key={`${a.kind}-${a.id}`}>
                          {idx > 0 ? ' · ' : ''}
                          {a.name}{a.role_label ? ` (${a.role_label})` : ''}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>

              {/* Body */}
              {p.title ? (
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    margin: '0 0 0.375rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={p.title}
                >
                  {p.title}
                </h3>
              ) : null}
              {p.content ? (
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: 'hsl(var(--foreground))',
                    lineHeight: 1.5,
                    flex: 1,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  <Markdown size="sm" attachments={p.attachments}>{p.content.length > 200 ? `${p.content.slice(0, 200)}…` : p.content}</Markdown>
                </div>
              ) : null}

              {/* Engagement counts (read-only) */}
              {((p.like_count ?? 0) > 0 || (p.comment_count ?? 0) > 0) && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.625rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  {(p.like_count ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {p.like_count}
                    </span>
                  )}
                  {(p.comment_count ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {p.comment_count}
                    </span>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
