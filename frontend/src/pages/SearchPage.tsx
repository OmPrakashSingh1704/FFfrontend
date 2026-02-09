import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'

type BackendSearchResult = {
  id: string
  index: string
  score: number
  source: Record<string, unknown>
  highlights: Record<string, string[]>
}

type BackendSearchResponse = {
  query: string
  total: number
  results: BackendSearchResult[]
  took_ms: number
}

type SearchResult = {
  id: string
  type: string
  title: string
  snippet: string
  highlightHtml: string | null
  url: string
}

type SearchSuggestion = {
  id?: string
  text?: string
  type?: string
  meta?: Record<string, unknown>
}

function buildResultUrl(type: string, id: string, source: Record<string, unknown>): string {
  switch (type) {
    case 'users': {
      const role = source.role as string | undefined
      if (role === 'founder') return `/app/founders/${id}`
      if (role === 'investor') return `/app/investors/${id}`
      return `/app/profile/${id}`
    }
    case 'startups':
      return `/app/startups/${id}`
    case 'feed':
      return `/app/feed`
    case 'messages':
      return `/app/chat/${source.conversation_id ?? id}`
    default:
      return `/app/search`
  }
}

function mapResult(raw: BackendSearchResult): SearchResult {
  const type = raw.index.replace(/^ff_/, '')

  const title = (raw.source.full_name ?? raw.source.name ?? raw.source.title ?? 'Untitled') as string

  const firstHighlight = Object.values(raw.highlights ?? {})?.[0]?.[0] ?? null
  const fallbackSnippet = (raw.source.description ?? raw.source.headline ?? raw.source.content ?? raw.source.tagline ?? '') as string

  const snippet = firstHighlight
    ? firstHighlight.replace(/<\/?mark>/g, '')
    : fallbackSnippet
  const highlightHtml = firstHighlight ?? null

  const url = buildResultUrl(type, raw.id, raw.source)

  return { id: raw.id, type, title, snippet, highlightHtml, url }
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestSuggest = useRef(0)

  const trimmedQuery = useMemo(() => query.trim(), [query])

  const runSearch = async (nextQuery?: string) => {
    const term = (nextQuery ?? query).trim()
    if (!term) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<BackendSearchResponse>(
        `/search/?q=${encodeURIComponent(term)}`,
      )
      setResults((data.results ?? []).map(mapResult))
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await runSearch()
  }

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setSuggestions([])
      return
    }
    const requestId = latestSuggest.current + 1
    latestSuggest.current = requestId
    setSuggestLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const data = await apiRequest<{ suggestions?: SearchSuggestion[] }>(
          `/search/autocomplete/?q=${encodeURIComponent(trimmedQuery)}&types=users,startups&limit=6`,
        )
        if (latestSuggest.current !== requestId) return
        setSuggestions(data.suggestions ?? [])
      } catch {
        if (latestSuggest.current === requestId) {
          setSuggestions([])
        }
      } finally {
        if (latestSuggest.current === requestId) {
          setSuggestLoading(false)
        }
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [trimmedQuery])

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Search</h1>
          <p>Find founders, startups, feed updates, and messages.</p>
        </div>
      </header>

      <form className="search-bar" onSubmit={handleSearch}>
        <div className="search-input-wrap">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSuggestOpen(true)
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setSuggestOpen(false), 150)
            }}
            placeholder="Search FoundersLib"
          />
          {suggestOpen && (suggestions.length > 0 || suggestLoading) ? (
            <div className="search-suggest-list">
              {suggestLoading ? <div className="search-suggest-item muted">Searching...</div> : null}
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.type ?? 'suggestion'}-${suggestion.id ?? suggestion.text}`}
                  type="button"
                  className="search-suggest-item"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const nextQuery = suggestion.text ?? ''
                    setQuery(nextQuery)
                    setSuggestOpen(false)
                    void runSearch(nextQuery)
                  }}
                >
                  <span>{suggestion.text ?? 'Suggestion'}</span>
                  <span className="search-suggest-type">{suggestion.type ?? 'result'}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="data-grid">
        {results.map((item) => (
          <div key={item.id} className="data-card">
            <span className="data-eyebrow">{item.type}</span>
            <h3>{item.title}</h3>
            {item.highlightHtml ? (
              <p dangerouslySetInnerHTML={{ __html: item.highlightHtml }} />
            ) : (
              <p>{item.snippet || 'No preview available.'}</p>
            )}
            <Link className="feed-link" to={item.url}>
              Open
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
