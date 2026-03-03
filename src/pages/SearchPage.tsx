import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowRight, Users, Briefcase, TrendingUp, Wallet } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'

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

type DiscoverItem = {
  id: string | number
  name?: string
  full_name?: string
  title?: string
  tagline?: string
  headline?: string
  industry?: string
  type?: string
  current_stage?: string
  fund_type?: string
  ticket_size_min?: number
  ticket_size_max?: number
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
  const [hasSearched, setHasSearched] = useState(false)
  const latestSuggest = useRef(0)

  // Discover state
  const [discoverStartups, setDiscoverStartups] = useState<DiscoverItem[]>([])
  const [discoverFounders, setDiscoverFounders] = useState<DiscoverItem[]>([])
  const [discoverInvestors, setDiscoverInvestors] = useState<DiscoverItem[]>([])
  const [discoverFunds, setDiscoverFunds] = useState<DiscoverItem[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(true)

  const trimmedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    let cancelled = false
    const loadDiscover = async () => {
      setDiscoverLoading(true)
      try {
        const [startups, founders, investors, funds] = await Promise.all([
          apiRequest<DiscoverItem[] | { results: DiscoverItem[] }>('/founders/startups/?limit=4'),
          apiRequest<DiscoverItem[] | { results: DiscoverItem[] }>('/founders/?limit=4'),
          apiRequest<DiscoverItem[] | { results: DiscoverItem[] }>('/investors/?limit=4'),
          apiRequest<DiscoverItem[] | { results: DiscoverItem[] }>('/funds/?limit=4'),
        ])
        if (!cancelled) {
          setDiscoverStartups(normalizeList(startups).slice(0, 4))
          setDiscoverFounders(normalizeList(founders).slice(0, 4))
          setDiscoverInvestors(normalizeList(investors).slice(0, 4))
          setDiscoverFunds(normalizeList(funds).slice(0, 4))
        }
      } catch {
        // Graceful — discover sections just won't show
      } finally {
        if (!cancelled) setDiscoverLoading(false)
      }
    }

    void loadDiscover()
    return () => { cancelled = true }
  }, [])

  const runSearch = async (nextQuery?: string) => {
    const term = (nextQuery ?? query).trim()
    if (!term) return
    setLoading(true)
    setError(null)
    setHasSearched(true)
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

  const showDiscover = !hasSearched && !loading

  return (
    <section className="content-section">
      {/* Search Header */}
      <div className="text-center mb-8">
        <h1 className="page-title mb-2">Search</h1>
        <p className="page-description">Find founders, startups, investors, and more.</p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="search-lg">
          <Search className="search-icon" />
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
            placeholder="Search FoundersLib..."
            data-testid="search-input"
          />
          {suggestOpen && (suggestions.length > 0 || suggestLoading) ? (
            <div className="float-panel">
              {suggestLoading ? (
                <div className="float-item" style={{ color: 'hsl(var(--muted-foreground))' }}>Searching...</div>
              ) : null}
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.type ?? 'suggestion'}-${suggestion.id ?? suggestion.text}`}
                  type="button"
                  className="float-item w-full text-left"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const nextQuery = suggestion.text ?? ''
                    setQuery(nextQuery)
                    setSuggestOpen(false)
                    void runSearch(nextQuery)
                  }}
                >
                  <span className="flex-1 text-sm">{suggestion.text ?? 'Suggestion'}</span>
                  <span className="tag">{suggestion.type ?? 'result'}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </form>

      {error ? <div className="form-error mb-4">{error}</div> : null}

      {/* Search Results */}
      {hasSearched && (
        <div className="grid-3 mb-8">
          {loading ? (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <Search className="empty-icon" />
              <span className="empty-title">No results found</span>
              <span className="empty-description">Try a different search term or browse the categories below.</span>
            </div>
          ) : (
            results.map((item) => (
              <Link key={item.id} to={item.url} className="card group">
                <span className="badge mb-2">{item.type}</span>
                <h3 className="text-sm font-medium mb-1">{item.title}</h3>
                {item.highlightHtml ? (
                  <p className="text-xs line-clamp-2" style={{ color: 'hsl(var(--muted-foreground))' }} dangerouslySetInnerHTML={{ __html: item.highlightHtml }} />
                ) : (
                  <p className="text-xs line-clamp-2" style={{ color: 'hsl(var(--muted-foreground))' }}>{item.snippet || 'No preview available.'}</p>
                )}
              </Link>
            ))
          )}
        </div>
      )}

      {/* Discover Sections */}
      {showDiscover && !discoverLoading && (
        <div className="space-y-8">
          {/* Trending Startups */}
          {discoverStartups.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-label flex items-center gap-2 mb-0">
                  <Briefcase className="w-3.5 h-3.5" /> Trending Startups
                </h2>
                <Link to="/app/startups" className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--gold)' }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid-4">
                {discoverStartups.map((item) => (
                  <Link key={item.id} to={`/app/startups/${item.id}`} className="card group">
                    <h3 className="text-sm font-medium mb-1">{item.name || 'Startup'}</h3>
                    <p className="text-xs line-clamp-2 mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>{item.tagline || ''}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {item.industry && <span className="tag">{item.industry}</span>}
                      {item.current_stage && <span className="tag">{item.current_stage}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Active Founders */}
          {discoverFounders.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-label flex items-center gap-2 mb-0">
                  <Users className="w-3.5 h-3.5" /> Active Founders
                </h2>
                <Link to="/app/founders" className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--gold)' }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid-4">
                {discoverFounders.map((item) => (
                  <Link key={item.id} to={`/app/founders/${item.id}`} className="card group">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="avatar">
                        {(item.full_name || item.name || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium truncate">{item.full_name || item.name || 'Founder'}</h3>
                        <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{item.headline || ''}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Investors */}
          {discoverInvestors.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-label flex items-center gap-2 mb-0">
                  <TrendingUp className="w-3.5 h-3.5" /> Investors
                </h2>
                <Link to="/app/investors" className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--gold)' }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid-4">
                {discoverInvestors.map((item) => (
                  <Link key={item.id} to={`/app/investors/${item.id}`} className="card group">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="avatar">
                        {(item.full_name || item.name || 'I').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium truncate">{item.full_name || item.name || 'Investor'}</h3>
                        <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{item.type || ''}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Open Funds */}
          {discoverFunds.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-label flex items-center gap-2 mb-0">
                  <Wallet className="w-3.5 h-3.5" /> Open Funds
                </h2>
                <Link to="/app/funds" className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--gold)' }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid-4">
                {discoverFunds.map((item) => (
                  <Link key={item.id} to={`/app/funds/${item.id}`} className="card group">
                    <h3 className="text-sm font-medium mb-1">{item.name || 'Fund'}</h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {item.fund_type && <span className="tag">{item.fund_type}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showDiscover && discoverLoading && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading discover content...</p>
        </div>
      )}
    </section>
  )
}
