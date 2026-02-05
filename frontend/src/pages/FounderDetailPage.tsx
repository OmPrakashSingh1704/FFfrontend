import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, TrendingUp, ExternalLink, Linkedin, Twitter, Globe } from 'lucide-react'
import { apiRequest } from '../lib/api'
import type { FounderProfile } from '../types/founder'

export function FounderDetailPage() {
  const { id } = useParams()
  const [founder, setFounder] = useState<FounderProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FounderProfile>(`/founders/${id}/`)
        if (!cancelled) {
          setFounder(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load founder profile.')
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
  }, [id])

  return (
    <section className="content-section" data-testid="founder-detail">
      <header className="content-header">
        <div>
          <Link to="/app/founders" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to founders
          </Link>
          <h1>{founder?.user?.full_name ?? 'Founder profile'}</h1>
          <p>{founder?.headline ?? 'Founder details and background.'}</p>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading profile...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {founder ? (
        <div className="content-card" data-testid="founder-profile-card">
          <div className="detail-grid">
            <div>
              <span className="data-eyebrow">Bio</span>
              <p className="text-slate-300 mt-2">{founder.bio || 'No bio provided yet.'}</p>
            </div>
            <div className="space-y-4">
              <div>
                <span className="data-eyebrow">Location</span>
                <p className="text-slate-300 mt-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  {founder.location || 'Not shared'}
                </p>
              </div>
              <div>
                <span className="data-eyebrow">Fundraising status</span>
                <p className="text-slate-300 mt-2">{founder.fundraising_status || 'Not specified'}</p>
              </div>
              <div>
                <span className="data-eyebrow">Stage</span>
                <p className="text-slate-300 mt-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  {founder.current_stage || 'Not specified'}
                </p>
              </div>
            </div>
          </div>

          {founder.skills && founder.skills.length > 0 ? (
            <div className="space-y-3">
              <span className="data-eyebrow">Skills</span>
              <div className="tag-list">
                {founder.skills.map((skill) => (
                  <span key={skill} className="tag">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <span className="data-eyebrow">Links</span>
            <div className="link-list">
              {founder.linkedin_url ? (
                <a 
                  href={founder.linkedin_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              ) : null}
              {founder.twitter_url ? (
                <a 
                  href={founder.twitter_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <Twitter className="w-4 h-4" />
                  Twitter
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              ) : null}
              {founder.website_url ? (
                <a 
                  href={founder.website_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  Website
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
