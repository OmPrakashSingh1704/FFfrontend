import { useEffect, useState } from 'react'
import { Plus, Send, X, ExternalLink, ArrowRight, Clock, Calendar } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import type { IntroRequest, IntroRequestCreate } from '../types/intro'
import type { StartupListItem } from '../types/startup'
import type { InvestorProfile } from '../types/investor'

type IntroTab = 'sent' | 'received'

const statusBadgeClass: Record<string, string> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'error',
}

export function IntrosPage() {
  const { pushToast } = useToast()
  const [tab, setTab] = useState<IntroTab>('sent')
  const [items, setItems] = useState<IntroRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [myStartups, setMyStartups] = useState<StartupListItem[]>([])
  const [investors, setInvestors] = useState<InvestorProfile[]>([])
  const [formLoading, setFormLoading] = useState(false)
  const [createForm, setCreateForm] = useState<IntroRequestCreate>({
    investor_profile_id: '',
    startup_id: '',
    pitch_summary: '',
    relevance_justification: '',
    deck_url: '',
    additional_notes: '',
  })

  // Respond state
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseMessage, setResponseMessage] = useState('')
  const [respondLoading, setRespondLoading] = useState(false)

  const loadIntros = async (cancelled: { current: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = tab === 'sent' ? '/intros/sent/' : '/intros/received/'
      const data = await apiRequest<IntroRequest[] | { results: IntroRequest[] }>(endpoint)
      if (!cancelled.current) {
        setItems(normalizeList(data))
      }
    } catch {
      if (!cancelled.current) {
        setError('Unable to load intro requests.')
      }
    } finally {
      if (!cancelled.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const cancelled = { current: false }
    void loadIntros(cancelled)
    return () => { cancelled.current = true }
  }, [tab])

  // Load form data when opening create form
  const openCreateForm = async () => {
    setShowForm(true)
    try {
      const [startupsData, investorsData] = await Promise.all([
        apiRequest<StartupListItem[] | { results: StartupListItem[] }>('/founders/my-startups/'),
        apiRequest<InvestorProfile[] | { results: InvestorProfile[] }>('/investors/'),
      ])
      setMyStartups(normalizeList(startupsData))
      setInvestors(normalizeList(investorsData))
    } catch {
      pushToast('Failed to load form options.', 'error')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.startup_id || !createForm.investor_profile_id || !createForm.pitch_summary || !createForm.relevance_justification) {
      pushToast('Please fill in all required fields.', 'warning')
      return
    }
    setFormLoading(true)
    try {
      const body: IntroRequestCreate = {
        investor_profile_id: createForm.investor_profile_id,
        startup_id: createForm.startup_id,
        pitch_summary: createForm.pitch_summary,
        relevance_justification: createForm.relevance_justification,
      }
      if (createForm.deck_url) body.deck_url = createForm.deck_url
      if (createForm.additional_notes) body.additional_notes = createForm.additional_notes

      await apiRequest<IntroRequest>('/intros/', { method: 'POST', body })
      pushToast('Intro request sent!', 'success')
      setShowForm(false)
      setCreateForm({ investor_profile_id: '', startup_id: '', pitch_summary: '', relevance_justification: '', deck_url: '', additional_notes: '' })
      // Refresh list
      const cancelled = { current: false }
      void loadIntros(cancelled)
    } catch {
      pushToast('Failed to send intro request.', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleRespond = async (introId: string, action: 'accept' | 'decline') => {
    setRespondLoading(true)
    try {
      const updated = await apiRequest<IntroRequest>(`/intros/${introId}/respond/`, {
        method: 'POST',
        body: { action, message: responseMessage || undefined },
      })
      pushToast(`Intro ${action === 'accept' ? 'accepted' : 'declined'}.`, 'success')
      setItems((prev) => prev.map((item) => (item.id === introId ? updated : item)))
      setRespondingTo(null)
      setResponseMessage('')
    } catch {
      pushToast(`Failed to ${action} intro.`, 'error')
    } finally {
      setRespondLoading(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Introductions</h1>
          <p className="page-description">Track warm introductions and follow-ups.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {tab === 'sent' && (
            <button
              type="button"
              className="btn-sm primary"
              onClick={openCreateForm}
              data-testid="request-intro-btn"
            >
              <Plus style={{ width: 14, height: 14 }} />
              Request Intro
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {(['sent', 'received'] as IntroTab[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`tab ${tab === option ? 'active' : ''}`}
            onClick={() => { setTab(option); setShowForm(false) }}
            data-testid={`tab-${option}`}
          >
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      {/* Create Intro Modal Overlay */}
      {showForm && tab === 'sent' && (
        <div
          data-testid="create-intro-form"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '32rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Request an Introduction</h2>
              <button type="button" className="btn-sm ghost" onClick={() => setShowForm(false)} data-testid="close-form-btn">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Startup *</label>
                <select
                  className="select"
                  value={createForm.startup_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, startup_id: e.target.value }))}
                  data-testid="startup-select"
                >
                  <option value="">Select your startup</option>
                  {myStartups.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Investor *</label>
                <select
                  className="select"
                  value={createForm.investor_profile_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, investor_profile_id: e.target.value }))}
                  data-testid="investor-select"
                >
                  <option value="">Select an investor</option>
                  {investors.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.display_name}{inv.fund_name ? ` (${inv.fund_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Pitch Summary *</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={createForm.pitch_summary}
                  onChange={(e) => setCreateForm((f) => ({ ...f, pitch_summary: e.target.value }))}
                  placeholder="Briefly describe your startup and what makes it compelling..."
                  data-testid="pitch-summary-input"
                />
              </div>
              <div className="form-group">
                <label>Relevance Justification *</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={createForm.relevance_justification}
                  onChange={(e) => setCreateForm((f) => ({ ...f, relevance_justification: e.target.value }))}
                  placeholder="Why is this investor a good fit?"
                  data-testid="relevance-input"
                />
              </div>
              <div className="form-group">
                <label>Deck URL</label>
                <input
                  className="input"
                  type="url"
                  value={createForm.deck_url}
                  onChange={(e) => setCreateForm((f) => ({ ...f, deck_url: e.target.value }))}
                  placeholder="https://..."
                  data-testid="deck-url-input"
                />
              </div>
              <div className="form-group">
                <label>Additional Notes</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={createForm.additional_notes}
                  onChange={(e) => setCreateForm((f) => ({ ...f, additional_notes: e.target.value }))}
                  placeholder="Anything else the investor should know..."
                  data-testid="additional-notes-input"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={formLoading} data-testid="submit-intro-btn">
                  <Send style={{ width: 14, height: 14, marginRight: 4 }} />
                  {formLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {loading ? (
        <div className="empty-state" data-testid="intros-loading">
          <p className="empty-description">Loading intros...</p>
        </div>
      ) : null}

      {error ? (
        <div className="card" style={{ borderColor: '#ef4444', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
        </div>
      ) : null}

      {/* Empty State */}
      {!loading && !error && items.length === 0 ? (
        <div className="empty-state" data-testid="empty-intros">
          <Send className="empty-icon" />
          <h3 className="empty-title">No intros yet</h3>
          <p className="empty-description">
            {tab === 'sent' ? 'Send your first intro request to connect with investors!' : 'No intro requests received yet.'}
          </p>
        </div>
      ) : null}

      {/* Intro List */}
      {!loading && !error && items.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((intro) => (
            <div key={intro.id} className="card" data-testid="intro-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                {/* Status Badge */}
                <span className={`badge ${statusBadgeClass[intro.status] || ''}`}>
                  {intro.status}
                </span>
                {intro.credits_spent > 0 && tab === 'sent' ? (
                  <span className="tag">{intro.credits_spent} credits</span>
                ) : null}
              </div>

              {tab === 'sent' ? (
                <div>
                  {/* Flow indicator: Startup -> Investor */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{intro.startup_name}</span>
                    <ArrowRight style={{ width: 16, height: 16, color: 'var(--gold)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{intro.investor_profile?.display_name || 'Investor'}</span>
                  </div>
                  <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {intro.pitch_summary ? `${intro.pitch_summary.slice(0, 150)}${intro.pitch_summary.length > 150 ? '...' : ''}` : 'No pitch summary.'}
                  </p>
                  {intro.investor_response_message && (
                    <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', background: 'hsl(var(--muted))', fontSize: '0.875rem' }}>
                      <span style={{ fontWeight: 500 }}>Response:</span>{' '}
                      <span style={{ fontStyle: 'italic', color: 'hsl(var(--muted-foreground))' }}>{intro.investor_response_message}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{intro.founder_user?.full_name || 'Founder'}</span>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>--</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{intro.startup_name}</span>
                  </div>
                  {intro.startup_tagline && (
                    <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>{intro.startup_tagline}</p>
                  )}
                  {intro.startup_industry && <span className="tag">{intro.startup_industry}</span>}
                  <p style={{ marginTop: '0.5rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {intro.pitch_summary ? `${intro.pitch_summary.slice(0, 200)}${intro.pitch_summary.length > 200 ? '...' : ''}` : ''}
                  </p>
                  {intro.deck_url && (
                    <a href={intro.deck_url} target="_blank" rel="noopener noreferrer" className="btn-sm ghost" style={{ marginTop: '0.5rem', display: 'inline-flex' }} data-testid="deck-link">
                      <ExternalLink style={{ width: 14, height: 14 }} />
                      View Deck
                    </a>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <hr className="divider" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar style={{ width: 12, height: 12 }} />
                  Created: {new Date(intro.created_at).toLocaleDateString()}
                </span>
                {intro.expires_at && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    Expires: {new Date(intro.expires_at).toLocaleDateString()}
                  </span>
                )}
                {intro.responded_at && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    Responded: {new Date(intro.responded_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Respond actions for received pending intros */}
              {tab === 'received' && intro.status === 'pending' && (
                <div style={{ marginTop: '0.75rem' }}>
                  {respondingTo === intro.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Response message (optional)</label>
                        <textarea
                          className="textarea"
                          rows={2}
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          placeholder="Add a message..."
                          data-testid="response-message-input"
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-sm primary"
                          disabled={respondLoading}
                          onClick={() => handleRespond(intro.id, 'accept')}
                          data-testid="confirm-accept-btn"
                        >
                          {respondLoading ? 'Accepting...' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          className="btn-sm ghost"
                          disabled={respondLoading}
                          onClick={() => handleRespond(intro.id, 'decline')}
                          data-testid="confirm-decline-btn"
                        >
                          {respondLoading ? 'Declining...' : 'Decline'}
                        </button>
                        <button
                          type="button"
                          className="btn-sm ghost"
                          onClick={() => { setRespondingTo(null); setResponseMessage('') }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-sm primary"
                        onClick={() => setRespondingTo(intro.id)}
                        data-testid="accept-btn"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn-sm ghost"
                        onClick={() => setRespondingTo(intro.id)}
                        data-testid="decline-btn"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
