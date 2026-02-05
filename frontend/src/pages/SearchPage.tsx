import { useState } from 'react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'

type SearchResult = {
  id?: string
  type?: string
  title?: string
  snippet?: string
  url?: string
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<SearchResult[] | { results: SearchResult[] }>(
        `/search/?q=${encodeURIComponent(query)}`,
      )
      setResults(normalizeList(data))
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Search</h1>
          <p>Find founders, startups, feed updates, and messages.</p>
        </div>
      </header>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search FoundersLib"
        />
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="data-grid">
        {results.map((item, index) => (
          <div key={`${item.id ?? index}`} className="data-card">
            <span className="data-eyebrow">{item.type ?? 'Result'}</span>
            <h3>{item.title ?? 'Untitled'}</h3>
            <p>{item.snippet ?? 'No preview available.'}</p>
            {item.url ? (
              <a className="feed-link" href={item.url} target="_blank" rel="noreferrer">
                Open
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
