import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, MapPin, Linkedin, Twitter, Globe, FileText,
  TrendingUp, Zap, Eye, Save, Loader2, ArrowLeft,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { FormField } from '../components/FormField'
import { hasErrors, validateRequired } from '../lib/forms'

const STAGE_OPTIONS = ['idea', 'mvp', 'pre_seed', 'seed', 'series_a', 'series_b', 'growth']
const STAGE_LABELS: Record<string, string> = {
  idea: 'Idea', mvp: 'MVP', pre_seed: 'Pre-Seed', seed: 'Seed',
  series_a: 'Series A', series_b: 'Series B', growth: 'Growth',
}
const FUNDRAISING_OPTIONS = ['not_fundraising', 'open_to_conversations', 'actively_fundraising', 'closed']
const FUNDRAISING_LABELS: Record<string, string> = {
  not_fundraising: 'Not Fundraising',
  open_to_conversations: 'Open to Conversations',
  actively_fundraising: 'Actively Fundraising',
  closed: 'Round Closed',
}

type FormState = {
  headline: string
  bio: string
  location: string
  linkedin_url: string
  twitter_url: string
  website_url: string
  fundraising_status: string
  current_stage: string
  skills: string
  is_public: boolean
}

type FormErrors = Partial<Record<keyof FormState | 'form', string>>

export function FounderProfileEditPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const [form, setForm] = useState<FormState>({
    headline: '', bio: '', location: '',
    linkedin_url: '', twitter_url: '', website_url: '',
    fundraising_status: '', current_stage: '', skills: '', is_public: true,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    apiRequest<{
      headline?: string; bio?: string; location?: string
      linkedin_url?: string; twitter_url?: string; website_url?: string
      fundraising_status?: string; current_stage?: string
      skills?: string[]; is_public?: boolean
    }>('/founders/profile/me/')
      .then((d) => {
        setForm({
          headline: d.headline ?? '',
          bio: d.bio ?? '',
          location: d.location ?? '',
          linkedin_url: d.linkedin_url ?? '',
          twitter_url: d.twitter_url ?? '',
          website_url: d.website_url ?? '',
          fundraising_status: d.fundraising_status ?? '',
          current_stage: d.current_stage ?? '',
          skills: (d.skills ?? []).join(', '),
          is_public: d.is_public ?? true,
        })
      })
      .catch(() => setIsNew(true))
      .finally(() => setLoading(false))
  }, [])

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: FormErrors = {
      ...validateRequired(form, ['headline']),
    }
    if (hasErrors(errs)) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      await apiRequest(isNew ? '/founders/profile/' : '/founders/profile/update/', {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify({
          headline: form.headline,
          bio: form.bio || null,
          location: form.location || null,
          linkedin_url: form.linkedin_url || null,
          twitter_url: form.twitter_url || null,
          website_url: form.website_url || null,
          fundraising_status: form.fundraising_status || null,
          current_stage: form.current_stage || null,
          skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
          is_public: form.is_public,
        }),
      })
      pushToast({ message: isNew ? 'Founder profile created' : 'Founder profile updated', type: 'success' })
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
            <h1 className="page-title">{isNew ? 'Create Founder Profile' : 'Edit Founder Profile'}</h1>
            <p className="page-description">{isNew ? 'Set up your public founder profile' : 'Update your public founder profile'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Basic Info</h2>

          <FormField label="Headline *" error={errors.headline} icon={<User className="w-4 h-4" />}>
            <input
              className={`input ${errors.headline ? 'input-error' : ''}`}
              value={form.headline}
              onChange={set('headline')}
              placeholder="e.g. Building the future of fintech"
            />
          </FormField>

          <FormField label="Bio" icon={<FileText className="w-4 h-4" />}>
            <textarea
              className="input"
              rows={4}
              value={form.bio}
              onChange={set('bio')}
              placeholder="Tell investors about yourself and your journey..."
            />
          </FormField>

          <FormField label="Location" icon={<MapPin className="w-4 h-4" />}>
            <input
              className="input"
              value={form.location}
              onChange={set('location')}
              placeholder="e.g. Bangalore, India"
            />
          </FormField>
        </div>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Startup Status</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Current Stage" icon={<TrendingUp className="w-4 h-4" />}>
              <select className="input" value={form.current_stage} onChange={set('current_stage')}>
                <option value="">Select stage</option>
                {STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Fundraising Status" icon={<TrendingUp className="w-4 h-4" />}>
              <select className="input" value={form.fundraising_status} onChange={set('fundraising_status')}>
                <option value="">Select status</option>
                {FUNDRAISING_OPTIONS.map((s) => (
                  <option key={s} value={s}>{FUNDRAISING_LABELS[s]}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Skills (comma-separated)" icon={<Zap className="w-4 h-4" />}>
            <input
              className="input"
              value={form.skills}
              onChange={set('skills')}
              placeholder="e.g. Product, Engineering, Sales, Marketing"
            />
          </FormField>
        </div>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Social Links</h2>

          <FormField label="LinkedIn" icon={<Linkedin className="w-4 h-4" />}>
            <input
              className="input"
              value={form.linkedin_url}
              onChange={set('linkedin_url')}
              placeholder="https://linkedin.com/in/yourprofile"
            />
          </FormField>

          <FormField label="Twitter / X" icon={<Twitter className="w-4 h-4" />}>
            <input
              className="input"
              value={form.twitter_url}
              onChange={set('twitter_url')}
              placeholder="https://twitter.com/yourhandle"
            />
          </FormField>

          <FormField label="Website" icon={<Globe className="w-4 h-4" />}>
            <input
              className="input"
              value={form.website_url}
              onChange={set('website_url')}
              placeholder="https://yourwebsite.com"
            />
          </FormField>
        </div>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Visibility</h2>
          <FormField label="Public Profile" icon={<Eye className="w-4 h-4" />}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => setForm((prev) => ({ ...prev, is_public: e.target.checked }))}
              />
              <span className="text-sm">Make my founder profile visible to other users</span>
            </label>
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
