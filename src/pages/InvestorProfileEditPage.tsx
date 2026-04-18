import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, MapPin, Linkedin, Twitter, Globe, FileText,
  TrendingUp, DollarSign, Building2, Save, Loader2, ArrowLeft, Eye,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { FormField } from '../components/FormField'
import { hasErrors, validateRequired } from '../lib/forms'

const INVESTOR_TYPE_OPTIONS = ['angel', 'vc', 'micro_vc', 'family_office', 'corporate_vc', 'accelerator', 'syndicate']
const INVESTOR_TYPE_LABELS: Record<string, string> = {
  angel: 'Angel', vc: 'VC', micro_vc: 'Micro VC', family_office: 'Family Office',
  corporate_vc: 'Corporate VC', accelerator: 'Accelerator', syndicate: 'Syndicate',
}
const DISCOVERABILITY_OPTIONS = ['open', 'selective', 'closed']
const DISCOVERABILITY_LABELS: Record<string, string> = {
  open: 'Open – Anyone can reach out',
  selective: 'Selective – Warm intros only',
  closed: 'Closed – Not accepting intros',
}
const STAGE_OPTIONS = ['Pre-Seed', 'Seed', 'Angel', 'Series A', 'Series B', 'Series C', 'Growth', 'Late Stage']
const INDUSTRY_OPTIONS = [
  'Technology', 'Financial Services', 'Healthcare & Life Sciences', 'Agriculture & Food',
  'Consumer & Retail', 'Transportation & Logistics', 'Energy & Sustainability',
  'Manufacturing & Industrial', 'Media & Entertainment', 'Professional Services', 'Education',
  'Real Estate', 'Government & Public Sector', 'Defence & Security',
]

type FormState = {
  display_name: string
  fund_name: string
  investor_type: string
  headline: string
  bio: string
  investment_thesis: string
  location: string
  check_size_min: string
  check_size_max: string
  stages_focus: string[]
  industries_focus: string[]
  geography_focus: string
  linkedin_url: string
  twitter_url: string
  website_url: string
  portfolio_companies: string
  discoverability_mode: string
  risk_appetite: string
  value_add: string
  board_seat_requirement: boolean
  lead_investor: boolean
  follow_on_participation: boolean
  co_invest_open: boolean
}

type FormErrors = Partial<Record<keyof FormState | 'form', string>>

function MultiSelect({
  options, selected, onChange,
}: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.8125rem',
            border: '1px solid',
            cursor: 'pointer',
            background: selected.includes(opt) ? 'hsl(var(--primary))' : 'transparent',
            color: selected.includes(opt) ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
            borderColor: selected.includes(opt) ? 'hsl(var(--primary))' : 'hsl(var(--border))',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function InvestorProfileEditPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const [form, setForm] = useState<FormState>({
    display_name: '', fund_name: '', investor_type: '', headline: '', bio: '',
    investment_thesis: '', location: '', check_size_min: '', check_size_max: '',
    stages_focus: [], industries_focus: [], geography_focus: '',
    linkedin_url: '', twitter_url: '', website_url: '',
    portfolio_companies: '', discoverability_mode: 'open', risk_appetite: '', value_add: '',
    board_seat_requirement: false, lead_investor: false,
    follow_on_participation: false, co_invest_open: false,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    apiRequest<Partial<FormState> & {
      check_size_min?: number | null; check_size_max?: number | null
      stages_focus?: string[]; industries_focus?: string[]
      geography_focus?: string[]; portfolio_companies?: string[]
    }>('/investors/profile/me/')
      .then((d) => {
        setForm({
          display_name: d.display_name ?? '',
          fund_name: d.fund_name ?? '',
          investor_type: d.investor_type ?? '',
          headline: d.headline ?? '',
          bio: d.bio ?? '',
          investment_thesis: d.investment_thesis ?? '',
          location: d.location ?? '',
          check_size_min: d.check_size_min != null ? String(d.check_size_min) : '',
          check_size_max: d.check_size_max != null ? String(d.check_size_max) : '',
          stages_focus: d.stages_focus ?? [],
          industries_focus: d.industries_focus ?? [],
          geography_focus: (d.geography_focus ?? []).join(', '),
          linkedin_url: d.linkedin_url ?? '',
          twitter_url: d.twitter_url ?? '',
          website_url: d.website_url ?? '',
          portfolio_companies: (d.portfolio_companies ?? []).join(', '),
          discoverability_mode: d.discoverability_mode ?? 'open',
          risk_appetite: d.risk_appetite ?? '',
          value_add: d.value_add ?? '',
          board_seat_requirement: d.board_seat_requirement ?? false,
          lead_investor: d.lead_investor ?? false,
          follow_on_participation: d.follow_on_participation ?? false,
          co_invest_open: d.co_invest_open ?? false,
        })
      })
      .catch(() => setIsNew(true))
      .finally(() => setLoading(false))
  }, [])

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setCheck = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.checked }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: FormErrors = validateRequired(form, ['display_name'])
    if (hasErrors(errs)) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      await apiRequest(isNew ? '/investors/profile/' : '/investors/profile/update/', {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify({
          display_name: form.display_name,
          fund_name: form.fund_name || null,
          investor_type: form.investor_type || null,
          headline: form.headline || null,
          bio: form.bio || null,
          investment_thesis: form.investment_thesis || null,
          location: form.location || null,
          check_size_min: form.check_size_min ? Number(form.check_size_min) : null,
          check_size_max: form.check_size_max ? Number(form.check_size_max) : null,
          stages_focus: form.stages_focus,
          industries_focus: form.industries_focus,
          geography_focus: form.geography_focus
            ? form.geography_focus.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          linkedin_url: form.linkedin_url || null,
          twitter_url: form.twitter_url || null,
          website_url: form.website_url || null,
          portfolio_companies: form.portfolio_companies
            ? form.portfolio_companies.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          discoverability_mode: form.discoverability_mode,
          risk_appetite: form.risk_appetite || null,
          value_add: form.value_add || null,
          board_seat_requirement: form.board_seat_requirement,
          lead_investor: form.lead_investor,
          follow_on_participation: form.follow_on_participation,
          co_invest_open: form.co_invest_open,
        }),
      })
      pushToast({ message: isNew ? 'Investor profile created' : 'Investor profile updated', type: 'success' })
      navigate('/app/profile')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      setErrors({ form: msg })
      pushToast({ message: msg, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn ghost" onClick={() => navigate('/app/profile')}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="page-title">{isNew ? 'Create Investor Profile' : 'Edit Investor Profile'}</h1>
            <p className="page-description">{isNew ? 'Set up your public investor profile' : 'Update your public investor profile'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Basic Info</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Display Name *" error={errors.display_name} icon={<User className="w-4 h-4" />}>
              <input
                className={`input ${errors.display_name ? 'input-error' : ''}`}
                value={form.display_name}
                onChange={set('display_name')}
                placeholder="Your name or alias"
              />
            </FormField>

            <FormField label="Fund Name" icon={<Building2 className="w-4 h-4" />}>
              <input
                className="input"
                value={form.fund_name}
                onChange={set('fund_name')}
                placeholder="e.g. Accel Partners"
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Investor Type" icon={<TrendingUp className="w-4 h-4" />}>
              <select className="input" value={form.investor_type} onChange={set('investor_type')}>
                <option value="">Select type</option>
                {INVESTOR_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{INVESTOR_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Location" icon={<MapPin className="w-4 h-4" />}>
              <input
                className="input"
                value={form.location}
                onChange={set('location')}
                placeholder="e.g. Mumbai, India"
              />
            </FormField>
          </div>

          <FormField label="Headline" icon={<User className="w-4 h-4" />}>
            <input
              className="input"
              value={form.headline}
              onChange={set('headline')}
              placeholder="e.g. Early-stage investor focused on deep tech"
            />
          </FormField>

          <FormField label="Bio" icon={<FileText className="w-4 h-4" />}>
            <textarea
              className="input"
              rows={4}
              value={form.bio}
              onChange={set('bio')}
              placeholder="Tell founders about your background and what you look for..."
            />
          </FormField>
        </div>

        {/* Investment Preferences */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Investment Preferences</h2>

          <FormField label="Investment Thesis" icon={<FileText className="w-4 h-4" />}>
            <textarea
              className="input"
              rows={3}
              value={form.investment_thesis}
              onChange={set('investment_thesis')}
              placeholder="Describe your investment philosophy..."
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Min Check Size ($)" icon={<DollarSign className="w-4 h-4" />}>
              <input
                className="input"
                type="number"
                min={0}
                value={form.check_size_min}
                onChange={set('check_size_min')}
                placeholder="e.g. 50000"
              />
            </FormField>

            <FormField label="Max Check Size ($)" icon={<DollarSign className="w-4 h-4" />}>
              <input
                className="input"
                type="number"
                min={0}
                value={form.check_size_max}
                onChange={set('check_size_max')}
                placeholder="e.g. 500000"
              />
            </FormField>
          </div>

          <FormField label="Stages Focus">
            <MultiSelect
              options={STAGE_OPTIONS}
              selected={form.stages_focus}
              onChange={(v) => setForm((prev) => ({ ...prev, stages_focus: v }))}
            />
          </FormField>

          <div style={{ marginTop: '1rem' }}>
            <FormField label="Industries Focus">
              <MultiSelect
                options={INDUSTRY_OPTIONS}
                selected={form.industries_focus}
                onChange={(v) => setForm((prev) => ({ ...prev, industries_focus: v }))}
              />
            </FormField>
          </div>

          <FormField label="Geography Focus (comma-separated)" icon={<MapPin className="w-4 h-4" />}>
            <input
              className="input"
              value={form.geography_focus}
              onChange={set('geography_focus')}
              placeholder="e.g. India, Southeast Asia, USA"
            />
          </FormField>
        </div>

        {/* Deal Preferences */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Deal Preferences</h2>

          <FormField label="Risk Appetite" icon={<TrendingUp className="w-4 h-4" />}>
            <select className="input" value={form.risk_appetite} onChange={set('risk_appetite')}>
              <option value="">Select</option>
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </FormField>

          <FormField label="Value Add" icon={<FileText className="w-4 h-4" />}>
            <textarea
              className="input"
              rows={2}
              value={form.value_add}
              onChange={set('value_add')}
              placeholder="How do you help portfolio companies beyond capital?"
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
            {(
              [
                ['board_seat_requirement', 'Requires Board Seat'],
                ['lead_investor', 'Can Lead Round'],
                ['follow_on_participation', 'Follow-on Participation'],
                ['co_invest_open', 'Open to Co-investing'],
              ] as [keyof FormState, string][]
            ).map(([field, label]) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form[field] as boolean}
                  onChange={setCheck(field)}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Portfolio */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Portfolio & Social</h2>

          <FormField label="Portfolio Companies (comma-separated)" icon={<Building2 className="w-4 h-4" />}>
            <input
              className="input"
              value={form.portfolio_companies}
              onChange={set('portfolio_companies')}
              placeholder="e.g. Razorpay, CRED, Zepto"
            />
          </FormField>

          <FormField label="LinkedIn" icon={<Linkedin className="w-4 h-4" />}>
            <input className="input" value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="https://linkedin.com/in/yourprofile" />
          </FormField>

          <FormField label="Twitter / X" icon={<Twitter className="w-4 h-4" />}>
            <input className="input" value={form.twitter_url} onChange={set('twitter_url')} placeholder="https://twitter.com/yourhandle" />
          </FormField>

          <FormField label="Website" icon={<Globe className="w-4 h-4" />}>
            <input className="input" value={form.website_url} onChange={set('website_url')} placeholder="https://yourfund.com" />
          </FormField>
        </div>

        {/* Visibility */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Discoverability</h2>
          <FormField label="Who can reach you?" icon={<Eye className="w-4 h-4" />}>
            <select className="input" value={form.discoverability_mode} onChange={set('discoverability_mode')}>
              {DISCOVERABILITY_OPTIONS.map((d) => (
                <option key={d} value={d}>{DISCOVERABILITY_LABELS[d]}</option>
              ))}
            </select>
          </FormField>
        </div>

        {errors.form && <p className="field-error" style={{ marginBottom: '1rem' }}>{errors.form}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={() => navigate('/app/profile')}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}
