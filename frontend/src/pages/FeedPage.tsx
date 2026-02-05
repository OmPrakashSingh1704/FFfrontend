import { useEffect, useMemo, useState } from 'react'
import { Activity, Sparkles, Send, ExternalLink, ThumbsUp, MessageCircle } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import type { FeedEvent } from '../types/feed'

type FeedTab = 'ranked' | 'trending' | 'all'

const feedEventTypes = [
  { value: 'startup_update', label: 'Startup update' },
  { value: 'funding_announcement', label: 'Funding announcement' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'opportunity_highlight', label: 'Opportunity highlight' },
  { value: 'platform_announcement', label: 'Platform announcement' },
  { value: 'investor_insight', label: 'Investor insight' },
]

export function FeedPage() {
  const { pushToast } = useToast()
  const [tab, setTab] = useState<FeedTab>('ranked')
  const [items, setItems] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    event_type: feedEventTypes[0].value,
    title: '',
    content: '',
    link_url: '',
    tags: '',
  })

  const tagList = useMemo(
    () =>
      form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const endpoint = tab === 'ranked' ? '/feed/ranked/' : tab === 'trending' ? '/feed/trending/' : '/feed/'
        const data = await apiRequest<FeedEvent[] | { results: FeedEvent[] }>(endpoint)
        if (!cancelled) {
          setItems(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load feed.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tab])

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('Title and content are required.')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await apiRequest('/feed/create/', {
        method: 'POST',
        body: {
          event_type: form.event_type,
          title: form.title.trim(),
          content: form.content.trim(),
          link_url: form.link_url.trim() || undefined,
          tags: tagList.length ? tagList : undefined,
        },
      })
      pushToast('Post created', 'success')
      if (tab !== 'all') {
        pushToast('Switch to “all” to see the latest post.', 'info')
      }
      setForm((prev) => ({ ...prev, title: '', content: '', link_url: '', tags: '' }))

      const endpoint = tab === 'ranked' ? '/feed/ranked/' : tab === 'trending' ? '/feed/trending/' : '/feed/'
      const data = await apiRequest<FeedEvent[] | { results: FeedEvent[] }>(endpoint)
      setItems(normalizeList(data))
    } catch {
      setFormError('Unable to publish post. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="content-section" data-testid="feed-page">
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-cyan-400">Network</span>
          </div>
          <h1>Feed</h1>
          <p>Signals, updates, and highlights across your network.</p>
        </div>
        <div className="segmented" data-testid="feed-tabs">
          {(['ranked', 'trending', 'all'] as FeedTab[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`segmented-btn ${tab === option ? 'active' : ''}`}
              onClick={() => setTab(option)}
              data-testid={`feed-tab-${option}`}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      <form className="feed-composer" onSubmit={handleCreate} data-testid="feed-composer">
        <header>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2>Create a post</h2>
          </div>
          <p>Share an update, milestone, or investor insight with your network.</p>
        </header>
        {formError ? <div className="form-error">{formError}</div> : null}
        <div className="composer-grid">
          <label>
            Event type
            <select
              value={form.event_type}
              onChange={(event) => setForm((prev) => ({ ...prev, event_type: event.target.value }))}
              data-testid="post-type-select"
            >
              {feedEventTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Announce your progress"
              data-testid="post-title-input"
            />
          </label>
        </div>
        <label>
          Content
          <textarea
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            rows={5}
            placeholder="Write the details you want investors to see."
            data-testid="post-content-textarea"
          />
        </label>
        <div className="composer-grid">
          <label>
            Link (optional)
            <input
              value={form.link_url}
              onChange={(event) => setForm((prev) => ({ ...prev, link_url: event.target.value }))}
              placeholder="https://"
              data-testid="post-link-input"
            />
          </label>
          <label>
            Tags (comma separated)
            <input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="launch, hiring, demo"
              data-testid="post-tags-input"
            />
          </label>
        </div>
        <div className="composer-actions">
          <p>{tagList.length ? `${tagList.length} tag${tagList.length === 1 ? '' : 's'} added` : 'Add tags to boost reach.'}</p>
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? 'Publishing...' : 'Publish post'}
          </button>
        </div>
      </form>

      {loading ? <div className="page-loader">Loading feed...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="feed-list">
          {items.map((item) => (
            <article key={item.id} className="feed-card">
              <div className="feed-meta">
                <span className="data-eyebrow">{item.event_type ?? 'Update'}</span>
                <span>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
              </div>
              <h3>{item.title || item.startup_name || 'Update'}</h3>
              <p>{item.content || 'No additional details provided.'}</p>
              <div className="data-meta">
                {item.startup_name ? <span>Startup: {item.startup_name}</span> : null}
                {item.like_count !== undefined ? <span>👍 {item.like_count}</span> : null}
                {item.comment_count !== undefined ? <span>💬 {item.comment_count}</span> : null}
              </div>
              {item.link_url ? (
                <a href={item.link_url} target="_blank" rel="noreferrer" className="feed-link">
                  View link
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
