import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, TrendingUp, Plus, ArrowRight } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { StartupListItem } from '../types/startup'

export function StartupsListPage() {
  const [startups, setStartups] = useState<StartupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<StartupListItem[] | { results: StartupListItem[] }>('/founders/startups/')
        if (!cancelled) {
          setStartups(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load startups.')
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
  }, [])

  return (
    <section className="content-section" data-testid="startups-list">
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-cyan-400">Directory</span>
          </div>
          <h1>Startups</h1>
          <p>Explore the startups raising on FoundersLib.</p>
        </div>
        <Link className="btn ghost" to="/onboarding" data-testid="add-startup-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add my startup
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading startups...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid" data-testid="startups-grid">
          {startups.map((startup) => (
            <Link 
              key={startup.id} 
              to={`/app/startups/${startup.id}`} 
              className="data-card group"
              data-testid={`startup-card-${startup.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="data-eyebrow">Startup</span>
                <ArrowRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3>{startup.name}</h3>
              <p>{startup.tagline || 'No tagline provided yet.'}</p>
              <div className="data-meta">
                {startup.industry ? (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {startup.industry}
                  </span>
                ) : null}
                {startup.current_stage ? (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {startup.current_stage}
                  </span>
                ) : null}
                {startup.fundraising_status ? <span>{startup.fundraising_status}</span> : null}
              </div>
            </Link>
          ))}
          {startups.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No startups found. Be the first to add yours!
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
