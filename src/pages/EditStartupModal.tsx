import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { StartupDetail } from '../types/startup'

type Props = {
  startup: StartupDetail
  onClose: () => void
  onSave: (updated: StartupDetail) => void
}

type Tab = 'basic' | 'fundraising'

export function EditStartupModal({ startup, onClose, onSave }: Props) {
  const { pushToast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const [form, setForm] = useState<Partial<StartupDetail>>({
    name: startup.name ?? '',
    tagline: startup.tagline ?? '',
    description: startup.description ?? '',
    website_url: startup.website_url ?? '',
    linkedin_url: startup.linkedin_url ?? '',
    industry: startup.industry ?? '',
    headquarters_city: startup.headquarters_city ?? '',
    headquarters_country: startup.headquarters_country ?? '',
    current_stage: startup.current_stage ?? '',
    fundraising_status: startup.fundraising_status ?? '',
    funding_raised: startup.funding_raised ?? '',
    funding_required: startup.funding_required ?? undefined,
    currency_code: startup.currency_code ?? 'USD',
    pitch_summary: startup.pitch_summary ?? '',
    deck_url: startup.deck_url ?? '',
    hiring_status: startup.hiring_status ?? false,
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await apiRequest<StartupDetail>(`/founders/startups/${startup.id}/`, {
        method: 'PATCH',
        body: form,
      })
      onSave(updated)
      pushToast('Startup updated', 'success')
    } catch (err: unknown) {
      const detail = (err as Record<string, unknown>)?.detail
      if (detail && typeof detail === 'object') {
        Object.entries(detail as Record<string, string[]>).forEach(([field, msgs]) => {
          pushToast(`${field}: ${msgs.join(', ')}`, 'error')
        })
      } else if (typeof detail === 'string') {
        if (detail.includes('403') || (err as { status?: number })?.status === 403) {
          pushToast('You no longer have permission to edit this startup.', 'error')
        } else {
          pushToast(detail, 'error')
        }
      } else {
        pushToast('Failed to save changes', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure? This hides your startup from discovery and cannot be undone easily.')) return
    setDeactivating(true)
    try {
      await apiRequest(`/founders/startups/${startup.id}/`, {
        method: 'PATCH',
        body: { is_active: false },
      })
      pushToast('Startup deactivated', 'success')
      window.location.href = '/app/my-startups'
    } catch {
      pushToast('Failed to deactivate startup', 'error')
      setDeactivating(false)
    }
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '0.375rem 0.875rem',
    borderRadius: 6,
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: activeTab === t ? 'hsl(var(--primary))' : 'transparent',
    color: activeTab === t ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="edit-startup-modal"
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Edit Startup</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
            data-testid="close-modal-btn"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'hsl(var(--muted))', borderRadius: 8, padding: 3 }}>
          <button type="button" style={tabStyle('basic')} onClick={() => setActiveTab('basic')} data-testid="tab-basic">Basic Info</button>
          <button type="button" style={tabStyle('fundraising')} onClick={() => setActiveTab('fundraising')} data-testid="tab-fundraising">Fundraising</button>
        </div>

        {activeTab === 'basic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Name</span>
              <input className="input" value={form.name as string} onChange={set('name')} data-testid="input-name" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Tagline</span>
              <input className="input" value={form.tagline as string} onChange={set('tagline')} data-testid="input-tagline" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Description</span>
              <textarea className="input" rows={3} value={form.description as string} onChange={set('description')} data-testid="input-description" style={{ resize: 'vertical' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Website URL</span>
              <input className="input" type="url" value={form.website_url as string} onChange={set('website_url')} data-testid="input-website-url" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>LinkedIn URL</span>
              <input className="input" type="url" value={form.linkedin_url as string} onChange={set('linkedin_url')} data-testid="input-linkedin-url" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Industry</span>
              <input className="input" value={form.industry as string} onChange={set('industry')} data-testid="input-industry" />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem', flex: 1 }}>
                <span style={{ fontWeight: 500 }}>City</span>
                <input className="input" value={form.headquarters_city as string} onChange={set('headquarters_city')} data-testid="input-hq-city" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem', flex: 1 }}>
                <span style={{ fontWeight: 500 }}>Country</span>
                <input className="input" value={form.headquarters_country as string} onChange={set('headquarters_country')} data-testid="input-hq-country" />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Stage</span>
              <select className="select" value={form.current_stage as string} onChange={set('current_stage')} data-testid="select-stage">
                <option value="">Select stage</option>
                <option value="idea">Idea</option>
                <option value="mvp">MVP</option>
                <option value="seed">Seed</option>
                <option value="series_a">Series A</option>
                <option value="series_b_plus">Series B+</option>
              </select>
            </label>
          </div>
        )}

        {activeTab === 'fundraising' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Fundraising Status</span>
              <select className="select" value={form.fundraising_status as string} onChange={set('fundraising_status')} data-testid="select-fundraising-status">
                <option value="">Select status</option>
                <option value="not_raising">Not Raising</option>
                <option value="raising">Raising</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Funding Raised (e.g. $500K)</span>
              <input className="input" value={form.funding_raised as string} onChange={set('funding_raised')} data-testid="input-funding-raised" />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem', flex: 2 }}>
                <span style={{ fontWeight: 500 }}>Funding Required</span>
                <input
                  className="input"
                  type="number"
                  value={form.funding_required ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, funding_required: e.target.value ? Number(e.target.value) : undefined }))}
                  data-testid="input-funding-required"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem', flex: 1 }}>
                <span style={{ fontWeight: 500 }}>Currency</span>
                <input className="input" maxLength={3} value={form.currency_code as string} onChange={set('currency_code')} data-testid="input-currency-code" />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Pitch Summary</span>
              <textarea className="input" rows={3} value={form.pitch_summary as string} onChange={set('pitch_summary')} data-testid="input-pitch-summary" style={{ resize: 'vertical' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500 }}>Deck URL</span>
              <input className="input" type="url" value={form.deck_url as string} onChange={set('deck_url')} data-testid="input-deck-url" />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.hiring_status === true}
                onChange={(e) => setForm((prev) => ({ ...prev, hiring_status: e.target.checked }))}
                data-testid="checkbox-hiring-status"
              />
              <span style={{ fontWeight: 500 }}>Currently hiring</span>
            </label>

            {/* Danger Zone */}
            <div style={{ marginTop: '0.5rem', border: '1px solid hsl(var(--destructive) / 0.4)', borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--destructive))', marginBottom: '0.25rem' }}>Danger Zone</div>
              <div style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem' }}>
                Deactivate Startup — hides your startup from all discovery and search. Members can still access it.
              </div>
              <button
                type="button"
                className="btn-sm"
                style={{ border: '1px solid hsl(var(--destructive))', color: 'hsl(var(--destructive))', background: 'transparent' }}
                onClick={() => void handleDeactivate()}
                disabled={deactivating}
                data-testid="deactivate-btn"
              >
                {deactivating ? <Loader2 size={12} className="animate-spin" /> : null}
                Deactivate
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <button type="button" className="btn-sm ghost" onClick={onClose} data-testid="cancel-btn">Cancel</button>
          <button
            type="button"
            className="btn-sm primary"
            onClick={() => void handleSave()}
            disabled={saving}
            data-testid="save-btn"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
