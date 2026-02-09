import { useEffect, useState } from 'react'
import { Plus, Send, X, ExternalLink } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import type { IntroRequest, IntroRequestCreate } from '../types/intro'
import type { StartupListItem } from '../types/startup'
import type { InvestorProfile } from '../types/investor'

type IntroTab = 'sent' | 'received'

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
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Intros</h1>
          <p>Track warm introductions and follow-ups.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {tab === 'sent' && (
            <button
              type="button"
              className="btn primary"
              onClick={openCreateForm}
              data-testid="request-intro-btn"
            >
              <Plus style={{ width: 16, height: 16, marginRight: 4 }} />
              Request Intro
            </button>
          )}
          <div className="segmented">
            {(['sent', 'received'] as IntroTab[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`segmented-btn ${tab === option ? 'active' : ''}`}
                onClick={() => { setTab(option); setShowForm(false) }}
                data-testid={`tab-${option}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Create Intro Form */}
      {showForm && tab === 'sent' && (
        <div className="inline-form" data-testid="create-intro-form">
          <div className="inline-form-header">
            <h3>Request an Introduction</h3>
            <button type="button" className="btn ghost sm" onClick={() => setShowForm(false)} data-testid="close-form-btn">
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <form onSubmit={handleCreate}>
            <div className="form-field">
              <label>Startup *</label>
              <select
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
            <div className="form-field">
              <label>Investor *</label>
              <select
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
            <div className="form-field">
              <label>Pitch Summary *</label>
              <textarea
                rows={3}
                value={createForm.pitch_summary}
                onChange={(e) => setCreateForm((f) => ({ ...f, pitch_summary: e.target.value }))}
                placeholder="Briefly describe your startup and what makes it compelling..."
                data-testid="pitch-summary-input"
              />
            </div>
            <div className="form-field">
              <label>Relevance Justification *</label>
              <textarea
                rows={2}
                value={createForm.relevance_justification}
                onChange={(e) => setCreateForm((f) => ({ ...f, relevance_justification: e.target.value }))}
                placeholder="Why is this investor a good fit?"
                data-testid="relevance-input"
              />
            </div>
            <div className="form-field">
              <label>Deck URL</label>
              <input
                type="url"
                value={createForm.deck_url}
                onChange={(e) => setCreateForm((f) => ({ ...f, deck_url: e.target.value }))}
                placeholder="https://..."
                data-testid="deck-url-input"
              />
            </div>
            <div className="form-field">
              <label>Additional Notes</label>
              <textarea
                rows={2}
                value={createForm.additional_notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, additional_notes: e.target.value }))}
                placeholder="Anything else the investor should know..."
                data-testid="additional-notes-input"
              />
            </div>
            <div className="inline-form-actions">
              <button type="submit" className="btn primary" disabled={formLoading} data-testid="submit-intro-btn">
                <Send style={{ width: 14, height: 14, marginRight: 4 }} />
                {formLoading ? 'Sending...' : 'Send Request'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="page-loader">Loading intros...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="empty-state" data-testid="empty-intros">
          <h3>No intros yet</h3>
          <p>{tab === 'sent' ? 'Send your first intro request to connect with investors!' : 'No intro requests received yet.'}</p>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="data-grid">
          {items.map((intro) => (
            <article key={intro.id} className="data-card" data-testid="intro-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className={`status-badge ${intro.status}`}>{intro.status}</span>
                {intro.credits_spent > 0 && tab === 'sent' ? (
                  <span className="data-eyebrow">{intro.credits_spent} credits</span>
                ) : null}
              </div>

              {tab === 'sent' ? (
                <>
                  <h3>{intro.startup_name} → {intro.investor_profile?.display_name || 'Investor'}</h3>
                  <p>{intro.pitch_summary ? `${intro.pitch_summary.slice(0, 150)}${intro.pitch_summary.length > 150 ? '...' : ''}` : 'No pitch summary.'}</p>
                  {intro.investor_response_message && (
                    <p style={{ marginTop: 8, fontStyle: 'italic' }}>Response: {intro.investor_response_message}</p>
                  )}
                </>
              ) : (
                <>
                  <h3>{intro.founder_user?.full_name || 'Founder'} — {intro.startup_name}</h3>
                  {intro.startup_tagline && <p style={{ marginBottom: 4 }}>{intro.startup_tagline}</p>}
                  {intro.startup_industry && <span className="data-eyebrow">{intro.startup_industry}</span>}
                  <p style={{ marginTop: 8 }}>{intro.pitch_summary ? `${intro.pitch_summary.slice(0, 200)}${intro.pitch_summary.length > 200 ? '...' : ''}` : ''}</p>
                  {intro.deck_url && (
                    <a href={intro.deck_url} target="_blank" rel="noopener noreferrer" className="btn ghost sm" style={{ marginTop: 8, display: 'inline-flex' }} data-testid="deck-link">
                      <ExternalLink style={{ width: 14, height: 14, marginRight: 4 }} />
                      View Deck
                    </a>
                  )}
                </>
              )}

              <div className="data-meta">
                <span>Created: {new Date(intro.created_at).toLocaleDateString()}</span>
                {intro.expires_at && <span>Expires: {new Date(intro.expires_at).toLocaleDateString()}</span>}
                {intro.responded_at && <span>Responded: {new Date(intro.responded_at).toLocaleDateString()}</span>}
              </div>

              {/* Respond actions for received pending intros */}
              {tab === 'received' && intro.status === 'pending' && (
                <div className="data-card-actions" style={{ flexDirection: 'column' }}>
                  {respondingTo === intro.id ? (
                    <>
                      <div className="form-field">
                        <label>Response message (optional)</label>
                        <textarea
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
                          className="btn accept sm"
                          disabled={respondLoading}
                          onClick={() => handleRespond(intro.id, 'accept')}
                          data-testid="confirm-accept-btn"
                        >
                          {respondLoading ? 'Accepting...' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          className="btn decline sm"
                          disabled={respondLoading}
                          onClick={() => handleRespond(intro.id, 'decline')}
                          data-testid="confirm-decline-btn"
                        >
                          {respondLoading ? 'Declining...' : 'Decline'}
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => { setRespondingTo(null); setResponseMessage('') }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn accept sm"
                        onClick={() => setRespondingTo(intro.id)}
                        data-testid="accept-btn"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn decline sm"
                        onClick={() => setRespondingTo(intro.id)}
                        data-testid="decline-btn"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
