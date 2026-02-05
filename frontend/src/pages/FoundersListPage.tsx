import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, MapPin, TrendingUp, ArrowRight, UserPlus, MessageCircle } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { FounderProfile } from '../types/founder'

export function FoundersListPage() {
  const [founders, setFounders] = useState<FounderProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FounderProfile[] | { results: FounderProfile[] }>('/founders/')
        if (!cancelled) {
          setFounders(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load founders.')
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

  const handleStartChat = (e: React.MouseEvent, founder: FounderProfile) => {
    e.preventDefault()
    e.stopPropagation()
    // Navigate to chat with founder's user ID as participant
    const userId = founder.user?.id || founder.id
    navigate(`/app/chat?newChat=${userId}&name=${encodeURIComponent(founder.user?.full_name || 'Founder')}`)
  }

  return (
    <section className="content-section" data-testid="founders-list">
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-cyan-400">Directory</span>
          </div>
          <h1>Founders</h1>
          <p>Browse founder profiles and reach out with context.</p>
        </div>
        <Link className="btn ghost" to="/onboarding" data-testid="update-profile-btn">
          <UserPlus className="w-4 h-4 mr-2" />
          Update my profile
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading founders...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid" data-testid="founders-grid">
          {founders.map((founder) => (
            <div 
              key={founder.id} 
              className="data-card group"
              data-testid={`founder-card-${founder.id}`}
            >
              <Link to={`/app/founders/${founder.id}`} className="data-card-content">
                <div className="flex items-center justify-between">
                  <span className="data-eyebrow">Founder</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3>{founder.user?.full_name ?? 'Founder'}</h3>
                <p>{founder.headline || 'Building something amazing'}</p>
                <div className="data-meta">
                  {founder.location ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {founder.location}
                    </span>
                  ) : null}
                  {founder.current_stage ? (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {founder.current_stage}
                    </span>
                  ) : null}
                  {founder.fundraising_status ? <span>{founder.fundraising_status}</span> : null}
                </div>
              </Link>
              <div className="data-card-actions">
                <button 
                  type="button"
                  className="btn-chat"
                  onClick={(e) => handleStartChat(e, founder)}
                  data-testid={`chat-founder-${founder.id}`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Start Chat
                </button>
              </div>
            </div>
          ))}
          {founders.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No founders found. Check back soon!
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
