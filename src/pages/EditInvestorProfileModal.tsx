import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { InvestorProfile } from '../types/investor'

type Props = {
  profile: InvestorProfile
  onClose: () => void
  onSave: (updated: InvestorProfile) => void
}

type Tab = 'basic' | 'thesis' | 'links'

const STAGE_OPTIONS = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'series_c_plus', label: 'Series C+' },
  { value: 'growth', label: 'Growth' },
]

const INVESTOR_TYPES = [
  { value: 'angel', label: 'Angel' },
  { value: 'vc', label: 'Venture Capital' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'accelerator', label: 'Accelerator' },
]

export function EditInvestorProfileModal({ profile, onClose, onSave }: Props) {
  const { pushToast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    display_name: profile.display_name ?? '',
    fund_name: profile.fund_name ?? '',
    investor_type: profile.investor_type ?? '',
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    investment_thesis: profile.investment_thesis ?? '',
    check_size_min: profile.check_size_min ?? null as number | null,
    check_size_max: profile.check_size_max ?? null as number | null,
    stages_focus: profile.stages_focus ?? [],
    industries_focus_text: (profile.industries_focus ?? []).join(', '),
    linkedin_url: profile.linkedin_url ?? '',
    twitter_url: profile.twitter_url ?? '',
    website_url: profile.website_url ?? '',
  })

  const setText = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const toggleStage = (stage: string) => {
    setForm((prev) => {
      const next = prev.stages_focus.includes(stage)
        ? prev.stages_focus.filter((s) => s !== stage)
        : [...prev.stages_focus, stage]
      return { ...prev, stages_focus: next }
    })
  }

  const handleSave = async () => {
    // Client-side validation for fields the backend marks NOT NULL + non-blank.
    const displayName = form.display_name.trim()
    const headline = form.headline.trim()
    const investorType = form.investor_type.trim()
    if (!displayName) {
      pushToast('Display name is required.', 'error')
      setActiveTab('basic')
      return
    }
    if (!headline) {
      pushToast('Headline is required.', 'error')
      setActiveTab('basic')
      return
    }
    if (!investorType) {
      pushToast('Investor type is required.', 'error')
      setActiveTab('basic')
      return
    }

    setSaving(true)
    try {
      // Field nullability matters: bio / location / investment_thesis / headline
      // are NOT NULL with blank=True on the model — send "" not null.
      // fund_name / urls / check_size_* are nullable — null is fine when empty.
      const payload = {
        display_name: displayName,
        fund_name: form.fund_name.trim() || null,
        investor_type: investorType,
        headline: headline,
        bio: form.bio,
        location: form.location,
        investment_thesis: form.investment_thesis,
        check_size_min: form.check_size_min,
        check_size_max: form.check_size_max,
        stages_focus: form.stages_focus,
        industries_focus: form.industries_focus_text
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        linkedin_url: form.linkedin_url.trim() || null,
        twitter_url: form.twitter_url.trim() || null,
        website_url: form.website_url.trim() || null,
      }
      const updated = await apiRequest<InvestorProfile>('/investors/profile/update/', {
        method: 'PATCH',
        body: payload,
      })
      onSave(updated)
      pushToast('Profile updated', 'success')
    } catch (err: unknown) {
      // DRF returns errors as either { detail: "msg" } or { field: ["msg", ...] }.
      // The api wrapper surfaces the parsed body on `details` (and sometimes
      // `detail`) — handle both shapes.
      const errObj = err as Record<string, unknown>
      const body = (errObj.details ?? errObj.detail ?? errObj) as Record<string, unknown>
      if (body && typeof body === 'object') {
        const fieldErrors = Object.entries(body)
          .filter(([k]) => k !== 'detail')
          .filter(([, v]) => Array.isArray(v) || typeof v === 'string')
        if (fieldErrors.length > 0) {
          fieldErrors.forEach(([field, msgs]) => {
            const text = Array.isArray(msgs) ? msgs.join(', ') : String(msgs)
            pushToast(`${field}: ${text}`, 'error')
          })
        } else if (typeof body.detail === 'string') {
          pushToast(body.detail, 'error')
        } else {
          pushToast('Failed to save changes', 'error')
        }
      } else {
        pushToast('Failed to save changes', 'error')
      }
    } finally {
      setSaving(false)
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

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.8125rem',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="edit-investor-modal"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Edit Investor Profile</h2>
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
          <button type="button" style={tabStyle('basic')} onClick={() => setActiveTab('basic')} data-testid="tab-basic">Basic</button>
          <button type="button" style={tabStyle('thesis')} onClick={() => setActiveTab('thesis')} data-testid="tab-thesis">Thesis</button>
          <button type="button" style={tabStyle('links')} onClick={() => setActiveTab('links')} data-testid="tab-links">Links</button>
        </div>

        {activeTab === 'basic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Display name</span>
              <input className="input" value={form.display_name} onChange={setText('display_name')} data-testid="input-display-name" />
            </label>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Fund name</span>
              <input className="input" value={form.fund_name} onChange={setText('fund_name')} data-testid="input-fund-name" placeholder="Independent" />
            </label>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Investor type</span>
              <select className="select" value={form.investor_type} onChange={setText('investor_type')} data-testid="select-investor-type">
                <option value="">Select type</option>
                {INVESTOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Headline</span>
              <input className="input" value={form.headline} onChange={setText('headline')} data-testid="input-headline" />
            </label>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Location</span>
              <input className="input" value={form.location} onChange={setText('location')} data-testid="input-location" />
            </label>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Bio</span>
              <textarea className="input" rows={3} value={form.bio} onChange={setText('bio')} data-testid="input-bio" style={{ resize: 'vertical' }} />
            </label>
          </div>
        )}

        {activeTab === 'thesis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Investment thesis</span>
              <textarea className="input" rows={4} value={form.investment_thesis} onChange={setText('investment_thesis')} data-testid="input-thesis" style={{ resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label style={{ ...labelStyle, flex: 1 }}>
                <span style={{ fontWeight: 500 }}>Check size min (USD)</span>
                <input
                  className="input"
                  type="number"
                  value={form.check_size_min ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, check_size_min: e.target.value ? Number(e.target.value) : null }))}
                  data-testid="input-check-min"
                />
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>
                <span style={{ fontWeight: 500 }}>Check size max (USD)</span>
                <input
                  className="input"
                  type="number"
                  value={form.check_size_max ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, check_size_max: e.target.value ? Number(e.target.value) : null }))}
                  data-testid="input-check-max"
                />
              </label>
            </div>
            <div>
              <span style={{ fontWeight: 500, fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>Preferred stages</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {STAGE_OPTIONS.map((s) => {
                  const active = form.stages_focus.includes(s.value)
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleStage(s.value)}
                      data-testid={`stage-toggle-${s.value}`}
                      style={{
                        padding: '0.25rem 0.625rem',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: '1px solid hsl(var(--border))',
                        background: active ? 'hsl(var(--primary))' : 'transparent',
                        color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                      }}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Industries (comma-separated)</span>
              <input
                className="input"
                value={form.industries_focus_text}
                onChange={setText('industries_focus_text')}
                placeholder="fintech, healthtech, climate"
                data-testid="input-industries"
              />
            </label>
          </div>
        )}

        {activeTab === 'links' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>LinkedIn URL</span>
              <input className="input" type="url" value={form.linkedin_url} onChange={setText('linkedin_url')} data-testid="input-linkedin" />
            </label>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Twitter / X URL</span>
              <input className="input" type="url" value={form.twitter_url} onChange={setText('twitter_url')} data-testid="input-twitter" />
            </label>
            <label style={labelStyle}>
              <span style={{ fontWeight: 500 }}>Website URL</span>
              <input className="input" type="url" value={form.website_url} onChange={setText('website_url')} data-testid="input-website" />
            </label>
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
