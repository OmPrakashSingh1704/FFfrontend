import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, uploadRequest } from '../lib/api'
import { resolveMediaUrl } from '../lib/env'
import { useAuth } from '../context/AuthContext'
import { useFeatureFlags } from '../context/FeatureFlagsContext'
import { useToast } from '../context/ToastContext'
import { normalizeList } from '../lib/pagination'
import { FormField } from '../components/FormField'
import {
  User,
  Mail,
  Phone,
  Shield,
  Star,
  Calendar,
  Camera,
  Save,
  Loader2,
  Pencil,
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  Lock,
  Users,
  Eye,
  Building2,
  ChevronDown,
  ChevronRight,
  Award,
  MapPin,
  Linkedin,
  Twitter,
  Globe,
  TrendingUp,
  Zap,
  DollarSign,
} from 'lucide-react'
import { CopyLinkButton } from '../components/CopyLinkButton'
import type { StartupListItem } from '../types/startup'
import { hasErrors, validateRequired } from '../lib/forms'

type StartupDoc = {
  id: string
  name?: string
  document_type?: string
  file_url?: string
  file_size?: number | null
  access_level?: string
  uploaded_by_name?: string
  created_at?: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  pitch_deck: 'Pitch Deck',
  financial_projections: 'Financial Projections',
  cap_table: 'Cap Table',
  incorporation_docs: 'Incorporation Docs',
  founder_agreement: 'Founder Agreement',
  product_demo: 'Product Demo',
  other: 'Other',
}

const ACCESS_ICONS: Record<string, typeof Lock> = {
  private: Lock,
  team: Users,
  investor: Eye,
  public: Shield,
}

type DocQueueItem = {
  localId: string
  file: File
  docType: keyof typeof DOC_TYPE_LABELS
  accessLevel: keyof typeof ACCESS_ICONS
}

type StartupFormErrors = Partial<Record<'name' | 'description' | 'industry' | 'form', string>>

// ── Founder / Investor profile section ───────────────────────────────────────

const FOUNDER_STAGE_OPTIONS = ['idea', 'mvp', 'pre_seed', 'seed', 'series_a', 'series_b', 'growth']
const FOUNDER_STAGE_LABELS: Record<string, string> = {
  idea: 'Idea', mvp: 'MVP', pre_seed: 'Pre-Seed', seed: 'Seed',
  series_a: 'Series A', series_b: 'Series B', growth: 'Growth',
}
const FUNDRAISING_STATUS_OPTIONS = ['not_fundraising', 'open_to_conversations', 'actively_fundraising', 'closed']
const FUNDRAISING_STATUS_LABELS: Record<string, string> = {
  not_fundraising: 'Not Fundraising', open_to_conversations: 'Open to Conversations',
  actively_fundraising: 'Actively Fundraising', closed: 'Round Closed',
}
const INVESTOR_TYPE_OPTIONS = ['angel', 'vc', 'micro_vc', 'family_office', 'corporate_vc', 'accelerator', 'syndicate']
const INVESTOR_TYPE_LABELS: Record<string, string> = {
  angel: 'Angel', vc: 'VC', micro_vc: 'Micro VC', family_office: 'Family Office',
  corporate_vc: 'Corporate VC', accelerator: 'Accelerator', syndicate: 'Syndicate',
}
const DISCOVERABILITY_OPTIONS = ['open', 'selective', 'closed']
const DISCOVERABILITY_LABELS: Record<string, string> = {
  open: 'Open – Anyone can reach out', selective: 'Selective – Warm intros only', closed: 'Closed – Not accepting intros',
}
const INVESTOR_STAGE_OPTIONS = ['Pre-Seed', 'Seed', 'Angel', 'Series A', 'Series B', 'Series C', 'Growth', 'Late Stage']
const INDUSTRY_OPTIONS = [
  'Technology', 'Financial Services', 'Healthcare & Life Sciences', 'Agriculture & Food',
  'Consumer & Retail', 'Transportation & Logistics', 'Energy & Sustainability',
  'Manufacturing & Industrial', 'Media & Entertainment', 'Professional Services', 'Education', 'Real Estate',
]

type FounderForm = {
  headline: string; bio: string; location: string
  linkedin_url: string; twitter_url: string; website_url: string
  fundraising_status: string; current_stage: string; skills: string; is_public: boolean
}
type InvestorForm = {
  display_name: string; fund_name: string; investor_type: string
  headline: string; bio: string; investment_thesis: string; location: string
  check_size_min: string; check_size_max: string
  stages_focus: string[]; industries_focus: string[]; geography_focus: string
  linkedin_url: string; twitter_url: string; website_url: string
  portfolio_companies: string; discoverability_mode: string
  risk_appetite: string; value_add: string
  board_seat_requirement: boolean; lead_investor: boolean
  follow_on_participation: boolean; co_invest_open: boolean
}

const defaultFounderForm = (): FounderForm => ({
  headline: '', bio: '', location: '', linkedin_url: '', twitter_url: '',
  website_url: '', fundraising_status: '', current_stage: '', skills: '', is_public: true,
})
const defaultInvestorForm = (): InvestorForm => ({
  display_name: '', fund_name: '', investor_type: '', headline: '', bio: '',
  investment_thesis: '', location: '', check_size_min: '', check_size_max: '',
  stages_focus: [], industries_focus: [], geography_focus: '',
  linkedin_url: '', twitter_url: '', website_url: '', portfolio_companies: '',
  discoverability_mode: 'open', risk_appetite: '', value_add: '',
  board_seat_requirement: false, lead_investor: false, follow_on_participation: false, co_invest_open: false,
})

function MultiSelectChips({ options, selected, onChange }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => toggle(opt)} style={{
          padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.8rem', border: '1px solid',
          cursor: 'pointer', transition: 'all 0.15s',
          background: selected.includes(opt) ? 'hsl(var(--primary))' : 'transparent',
          color: selected.includes(opt) ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
          borderColor: selected.includes(opt) ? 'hsl(var(--primary))' : 'hsl(var(--border))',
        }}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { pushToast } = useToast()
  const flags = useFeatureFlags()

  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'profile' | 'background' | null>(null)
  const [founderProfileId, setFounderProfileId] = useState<string | null>(null)
  const [investorProfileId, setInvestorProfileId] = useState<string | null>(null)

  // Founder / Investor profile section
  const role = user?.role
  const showFounder = role === 'founder' || role === 'both'
  const showInvestor = role === 'investor' || role === 'both'
  const [profileTab, setProfileTab] = useState<'founder' | 'investor'>(showFounder ? 'founder' : 'investor')
  const [founderForm, setFounderForm] = useState<FounderForm>(defaultFounderForm())
  const [founderIsNew, setFounderIsNew] = useState(false)
  const [founderLoading, setFounderLoading] = useState(true)
  const [founderSaving, setFounderSaving] = useState(false)
  const [founderErrors, setFounderErrors] = useState<Partial<Record<keyof FounderForm | 'form', string>>>({})
  const [investorForm, setInvestorForm] = useState<InvestorForm>(defaultInvestorForm())
  const [investorIsNew, setInvestorIsNew] = useState(false)
  const [investorLoading, setInvestorLoading] = useState(true)
  const [investorSaving, setInvestorSaving] = useState(false)
  const [investorErrors, setInvestorErrors] = useState<Partial<Record<keyof InvestorForm | 'form', string>>>({})

  const profileInputRef = useRef<HTMLInputElement | null>(null)
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)

  // My startups & documents
  const [myStartups, setMyStartups] = useState<StartupListItem[]>([])
  const [loadingStartups, setLoadingStartups] = useState(true)
  const [expandedStartup, setExpandedStartup] = useState<string | null>(null)
  const [startupDocs, setStartupDocs] = useState<Record<string, StartupDoc[]>>({})
  const [loadingDocs, setLoadingDocs] = useState<string | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [docQueues, setDocQueues] = useState<Record<string, DocQueueItem[]>>({})
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [showStartupForm, setShowStartupForm] = useState(false)
  const [creatingStartup, setCreatingStartup] = useState(false)
  const [startupName, setStartupName] = useState('')
  const [startupDescription, setStartupDescription] = useState('')
  const [startupIndustry, setStartupIndustry] = useState('')
  const [startupStage, setStartupStage] = useState('')
  const [fundraisingStatus, setFundraisingStatus] = useState('')
  const [startupWebsite, setStartupWebsite] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [solutionDescription, setSolutionDescription] = useState('')
  const [uniqueValueProp, setUniqueValueProp] = useState('')
  const [whyNow, setWhyNow] = useState('')
  const [startupErrors, setStartupErrors] = useState<StartupFormErrors>({})

  const avatarUrl = resolveMediaUrl(user?.avatar ?? user?.picture ?? user?.avatar_url)
  const backgroundUrl = resolveMediaUrl(user?.background_image ?? user?.background_picture)
  const hasBackground = Boolean(backgroundUrl)

  // Load shareable profile IDs + full profile data for edit forms
  useEffect(() => {
    if (showFounder) {
      setFounderLoading(true)
      apiRequest<{
        id?: string; headline?: string; bio?: string; location?: string
        linkedin_url?: string; twitter_url?: string; website_url?: string
        fundraising_status?: string; current_stage?: string; skills?: string[]; is_public?: boolean
      }>('/founders/profile/me/')
        .then((d) => {
          if (d.id) setFounderProfileId(d.id)
          setFounderForm({
            headline: d.headline ?? '', bio: d.bio ?? '', location: d.location ?? '',
            linkedin_url: d.linkedin_url ?? '', twitter_url: d.twitter_url ?? '',
            website_url: d.website_url ?? '', fundraising_status: d.fundraising_status ?? '',
            current_stage: d.current_stage ?? '', skills: (d.skills ?? []).join(', '),
            is_public: d.is_public ?? true,
          })
          setFounderIsNew(false)
        })
        .catch(() => setFounderIsNew(true))
        .finally(() => setFounderLoading(false))
    } else {
      setFounderLoading(false)
    }

    if (showInvestor) {
      setInvestorLoading(true)
      apiRequest<{
        id?: string; display_name?: string; fund_name?: string; investor_type?: string
        headline?: string; bio?: string; investment_thesis?: string; location?: string
        check_size_min?: number | null; check_size_max?: number | null
        stages_focus?: string[]; industries_focus?: string[]; geography_focus?: string[]
        linkedin_url?: string; twitter_url?: string; website_url?: string
        portfolio_companies?: string[]; discoverability_mode?: string
        risk_appetite?: string; value_add?: string
        board_seat_requirement?: boolean; lead_investor?: boolean
        follow_on_participation?: boolean; co_invest_open?: boolean
      }>('/investors/profile/me/')
        .then((d) => {
          if (d.id) setInvestorProfileId(d.id)
          setInvestorForm({
            display_name: d.display_name ?? '', fund_name: d.fund_name ?? '',
            investor_type: d.investor_type ?? '', headline: d.headline ?? '',
            bio: d.bio ?? '', investment_thesis: d.investment_thesis ?? '',
            location: d.location ?? '',
            check_size_min: d.check_size_min != null ? String(d.check_size_min) : '',
            check_size_max: d.check_size_max != null ? String(d.check_size_max) : '',
            stages_focus: d.stages_focus ?? [], industries_focus: d.industries_focus ?? [],
            geography_focus: (d.geography_focus ?? []).join(', '),
            linkedin_url: d.linkedin_url ?? '', twitter_url: d.twitter_url ?? '',
            website_url: d.website_url ?? '',
            portfolio_companies: (d.portfolio_companies ?? []).join(', '),
            discoverability_mode: d.discoverability_mode ?? 'open',
            risk_appetite: d.risk_appetite ?? '', value_add: d.value_add ?? '',
            board_seat_requirement: d.board_seat_requirement ?? false,
            lead_investor: d.lead_investor ?? false,
            follow_on_participation: d.follow_on_participation ?? false,
            co_invest_open: d.co_invest_open ?? false,
          })
          setInvestorIsNew(false)
        })
        .catch(() => setInvestorIsNew(true))
        .finally(() => setInvestorLoading(false))
    } else {
      setInvestorLoading(false)
    }
  }, [showFounder, showInvestor])

  const handleSaveFounderProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateRequired(founderForm, ['headline'])
    if (hasErrors(errs)) { setFounderErrors(errs); return }
    setFounderErrors({})
    setFounderSaving(true)
    try {
      const res = await apiRequest<{ id: string }>(
        founderIsNew ? '/founders/profile/' : '/founders/profile/update/',
        {
          method: founderIsNew ? 'POST' : 'PATCH',
          body: JSON.stringify({
            headline: founderForm.headline, bio: founderForm.bio || null,
            location: founderForm.location || null, linkedin_url: founderForm.linkedin_url || null,
            twitter_url: founderForm.twitter_url || null, website_url: founderForm.website_url || null,
            fundraising_status: founderForm.fundraising_status || null,
            current_stage: founderForm.current_stage || null,
            skills: founderForm.skills ? founderForm.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
            is_public: founderForm.is_public,
          }),
        },
      )
      if (res.id) setFounderProfileId(res.id)
      setFounderIsNew(false)
      pushToast({ message: founderIsNew ? 'Founder profile created' : 'Founder profile updated', type: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      setFounderErrors({ form: msg })
    } finally {
      setFounderSaving(false)
    }
  }

  const handleSaveInvestorProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateRequired(investorForm, ['display_name'])
    if (hasErrors(errs)) { setInvestorErrors(errs); return }
    setInvestorErrors({})
    setInvestorSaving(true)
    try {
      const res = await apiRequest<{ id: string }>(
        investorIsNew ? '/investors/profile/' : '/investors/profile/update/',
        {
          method: investorIsNew ? 'POST' : 'PATCH',
          body: JSON.stringify({
            display_name: investorForm.display_name, fund_name: investorForm.fund_name || null,
            investor_type: investorForm.investor_type || null, headline: investorForm.headline || null,
            bio: investorForm.bio || null, investment_thesis: investorForm.investment_thesis || null,
            location: investorForm.location || null,
            check_size_min: investorForm.check_size_min ? Number(investorForm.check_size_min) : null,
            check_size_max: investorForm.check_size_max ? Number(investorForm.check_size_max) : null,
            stages_focus: investorForm.stages_focus, industries_focus: investorForm.industries_focus,
            geography_focus: investorForm.geography_focus
              ? investorForm.geography_focus.split(',').map((s) => s.trim()).filter(Boolean) : [],
            linkedin_url: investorForm.linkedin_url || null, twitter_url: investorForm.twitter_url || null,
            website_url: investorForm.website_url || null,
            portfolio_companies: investorForm.portfolio_companies
              ? investorForm.portfolio_companies.split(',').map((s) => s.trim()).filter(Boolean) : [],
            discoverability_mode: investorForm.discoverability_mode,
            risk_appetite: investorForm.risk_appetite || null, value_add: investorForm.value_add || null,
            board_seat_requirement: investorForm.board_seat_requirement,
            lead_investor: investorForm.lead_investor,
            follow_on_participation: investorForm.follow_on_participation,
            co_invest_open: investorForm.co_invest_open,
          }),
        },
      )
      if (res.id) setInvestorProfileId(res.id)
      setInvestorIsNew(false)
      pushToast({ message: investorIsNew ? 'Investor profile created' : 'Investor profile updated', type: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      setInvestorErrors({ form: msg })
    } finally {
      setInvestorSaving(false)
    }
  }

  // Load user's startups
  const loadStartups = useCallback(async () => {
    setLoadingStartups(true)
    try {
      const data = await apiRequest<StartupListItem[] | { results: StartupListItem[] }>(
        '/founders/my-startups/',
      )
      setMyStartups(normalizeList(data))
    } catch {
      setMyStartups([])
    } finally {
      setLoadingStartups(false)
    }
  }, [])

  useEffect(() => {
    void loadStartups()
  }, [loadStartups])

  // Load docs when a startup is expanded
  const toggleStartup = async (startupId: string) => {
    if (expandedStartup === startupId) {
      setExpandedStartup(null)
      return
    }
    setExpandedStartup(startupId)

    if (startupDocs[startupId]) return // already loaded

    setLoadingDocs(startupId)
    try {
      const data = await apiRequest<StartupDoc[] | { results: StartupDoc[] }>(
        `/founders/startups/${startupId}/documents/`,
      )
      setStartupDocs((prev) => ({ ...prev, [startupId]: normalizeList(data) }))
    } catch {
      pushToast('Failed to load documents', 'error')
    } finally {
      setLoadingDocs(null)
    }
  }

  const resetStartupForm = () => {
    setStartupName('')
    setStartupDescription('')
    setStartupIndustry('')
    setStartupStage('')
    setFundraisingStatus('')
    setStartupWebsite('')
    setProblemStatement('')
    setSolutionDescription('')
    setUniqueValueProp('')
    setWhyNow('')
    setStartupErrors({})
  }

  const handleCreateStartup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateRequired({
      name: startupName,
      description: startupDescription,
      industry: startupIndustry,
    })
    if (hasErrors(nextErrors)) {
      setStartupErrors(nextErrors)
      return
    }

    setCreatingStartup(true)
    setStartupErrors({})
    try {
      await apiRequest('/onboarding/startup/', {
        method: 'POST',
        body: {
          name: startupName,
          description: startupDescription,
          industry: startupIndustry,
          stage: startupStage || undefined,
          fundraising_status: fundraisingStatus || undefined,
          website_url: startupWebsite || undefined,
          problem_statement: problemStatement || undefined,
          solution_description: solutionDescription || undefined,
          unique_value_proposition: uniqueValueProp || undefined,
          why_now: whyNow || undefined,
        },
      })
      await loadStartups()
      pushToast('Startup saved', 'success')
      resetStartupForm()
      setShowStartupForm(false)
    } catch {
      setStartupErrors({ form: 'Unable to save startup details. Please try again.' })
    } finally {
      setCreatingStartup(false)
    }
  }

  const createQueueId = (startupId: string) =>
    `${startupId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const addFilesToQueue = (startupId: string, files: File[]) => {
    if (files.length === 0) return
    setDocQueues((prev) => {
      const nextItems = files.map((file) => ({
        localId: createQueueId(startupId),
        file,
        docType: 'pitch_deck' as const,
        accessLevel: 'investor' as const,
      }))
      return {
        ...prev,
        [startupId]: [...(prev[startupId] ?? []), ...nextItems],
      }
    })
  }

  const updateQueueItem = <T extends 'docType' | 'accessLevel'>(
    startupId: string,
    localId: string,
    field: T,
    value: DocQueueItem[T],
  ) => {
    setDocQueues((prev) => {
      const queue = prev[startupId]
      if (!queue) return prev
      return {
        ...prev,
        [startupId]: queue.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)),
      }
    })
  }

  const removeFromQueue = (startupId: string, localId: string) => {
    setDocQueues((prev) => {
      const queue = prev[startupId]
      if (!queue) return prev
      const nextQueue = queue.filter((item) => item.localId !== localId)
      if (nextQueue.length === 0) {
        const { [startupId]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [startupId]: nextQueue }
    })
  }

  const uploadQueue = async (startupId: string) => {
    const queue = docQueues[startupId]
    if (!queue?.length) return

    setUploadingDoc(startupId)
    let failed = 0
    try {
      await Promise.all(
        queue.map(async (item) => {
          const formData = new FormData()
          formData.append('file', item.file)
          formData.append('name', item.file.name)
          formData.append('document_type', item.docType)
          formData.append('access_level', item.accessLevel)
          try {
            await uploadRequest(`/founders/startups/${startupId}/documents/`, formData)
          } catch {
            failed++
          }
        }),
      )
      const data = await apiRequest<StartupDoc[] | { results: StartupDoc[] }>(
        `/founders/startups/${startupId}/documents/`,
      )
      setStartupDocs((prev) => ({ ...prev, [startupId]: normalizeList(data) }))
      setDocQueues((prev) => ({ ...prev, [startupId]: [] }))

      const succeeded = queue.length - failed
      if (succeeded > 0) pushToast(`${succeeded} document${succeeded !== 1 ? 's' : ''} uploaded`, 'success')
      if (failed > 0) pushToast(`${failed} upload${failed !== 1 ? 's' : ''} failed`, 'error')
    } catch {
      pushToast('Failed to upload documents', 'error')
    } finally {
      setUploadingDoc(null)
      const ref = docInputRefs.current[startupId]
      if (ref) ref.value = ''
    }
  }

  const handleDocDelete = async (startupId: string, docId: string) => {
    try {
      await apiRequest(`/founders/startups/${startupId}/documents/${docId}/`, {
        method: 'DELETE',
      })
      setStartupDocs((prev) => ({
        ...prev,
        [startupId]: (prev[startupId] ?? []).filter((d) => d.id !== docId),
      }))
      pushToast('Document removed', 'success')
    } catch {
      pushToast('Failed to remove document', 'error')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiRequest('/users/me/profile/', {
        method: 'PATCH',
        body: { full_name: fullName, phone: phone || null },
      })
      await refreshUser()
      pushToast('Profile updated', 'success')
      setEditing(false)
    } catch {
      pushToast('Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (target: 'profile' | 'background', file?: File | null) => {
    if (!file) return
    setUploading(target)
    try {
      const formData = new FormData()
      const path = target === 'profile' ? '/users/me/avatar/' : '/users/me/background/'
      formData.append(target === 'profile' ? 'avatar' : 'background', file)
      await uploadRequest(path, formData)
      await refreshUser()
      pushToast(`${target === 'profile' ? 'Profile picture' : 'Background'} updated`, 'success')
    } catch {
      pushToast('Upload failed', 'error')
    } finally {
      setUploading(null)
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null

  const initials = (user?.full_name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const headerTextColor = hasBackground ? '#fff' : undefined
  const headerTextShadow = hasBackground ? '0 2px 8px rgba(0, 0, 0, 0.45)' : undefined
  const headerSubtleColor = hasBackground ? 'rgba(255, 255, 255, 0.88)' : 'hsl(var(--muted-foreground))'
  const headerOverlapOffset = hasBackground ? 72 : 32
  const avatarLift = 16

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-description">View and manage your personal information</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {founderProfileId && (
            <CopyLinkButton url={`${window.location.origin}/app/founders/${founderProfileId}`} label="Share founder profile" />
          )}
          {investorProfileId && (
            <CopyLinkButton url={`${window.location.origin}/app/investors/${investorProfileId}`} label="Share investor profile" />
          )}
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden', padding: 0 }}>
        {/* Background banner */}
        <div
          style={{
            height: 170,
            background: backgroundUrl
              ? `linear-gradient(180deg, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.7) 100%), url(${backgroundUrl}) center/cover`
              : 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--card)))',
            backgroundRepeat: 'no-repeat',
            position: 'relative',
          }}
        >
          <button
            className="btn-sm ghost"
            type="button"
            data-testid="upload-background"
            disabled={uploading !== null}
            onClick={() => backgroundInputRef.current?.click()}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none' }}
          >
            {uploading === 'background' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
            Change
          </button>
          <input
            type="file"
            accept="image/*"
            ref={backgroundInputRef}
            className="sr-only"
            onChange={(e) => handleUpload('background', e.target.files?.[0])}
          />
        </div>

        {/* Avatar + Info */}
        <div
          style={{
            padding: '0 1.5rem 1.5rem',
            marginTop: -headerOverlapOffset,
            paddingTop: headerOverlapOffset,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', marginTop: -(headerOverlapOffset + avatarLift) }}>
              <div className="avatar xl" style={{ border: '3px solid hsl(var(--card))' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.full_name ?? 'Avatar'} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                data-testid="upload-profile-picture"
                disabled={uploading !== null}
                onClick={() => profileInputRef.current?.click()}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: -4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--gold)',
                  color: '#fff',
                  border: '2px solid hsl(var(--card))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {uploading === 'profile' ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Camera size={10} />
                )}
              </button>
              <input
                type="file"
                accept="image/*"
                ref={profileInputRef}
                className="sr-only"
                onChange={(e) => handleUpload('profile', e.target.files?.[0])}
              />
            </div>

            <div style={{ flex: 1, paddingBottom: 4 }}>
              <h2
                className="text-xl font-semibold"
                style={{ marginBottom: 2, color: headerTextColor, textShadow: headerTextShadow }}
              >
                {user?.full_name || 'User'}
              </h2>
              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: headerSubtleColor,
                  fontSize: '0.875rem',
                  textShadow: headerTextShadow,
                }}
              >
                <Mail size={14} strokeWidth={1.5} color={hasBackground ? '#fff' : undefined} />
                {user?.email}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid-4">
            {flags.leagues && (
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">League</span>
                  <div className="stat-icon"><Award size={16} strokeWidth={1.5} /></div>
                </div>
                <span className="stat-value">{user?.league ?? '--'}</span>
              </div>
            )}
            {flags.credits && (
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Credits</span>
                  <div className="stat-icon"><Star size={16} strokeWidth={1.5} /></div>
                </div>
                <span className="stat-value">{user?.credits ?? 0}</span>
              </div>
            )}
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Member since</span>
                <div className="stat-icon"><Calendar size={16} strokeWidth={1.5} /></div>
              </div>
              <span className="stat-value" style={{ fontSize: '0.875rem' }}>{memberSince ?? '--'}</span>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Role</span>
                <div className="stat-icon"><Shield size={16} strokeWidth={1.5} /></div>
              </div>
              <span className="stat-value" style={{ textTransform: 'capitalize' }}>{user?.role ?? 'Member'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Profile Details</span>
          {!editing && (
            <button
              className="btn-sm ghost"
              type="button"
              data-testid="edit-profile"
              onClick={() => {
                setFullName(user?.full_name ?? '')
                setPhone(user?.phone ?? '')
                setEditing(true)
              }}
            >
              <Pencil size={12} strokeWidth={1.5} />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSave()
            }}
          >
            <div className="form-group">
              <label>
                <User size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                Full name
              </label>
              <input
                className="input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="input-full-name"
                placeholder="Your full name"
              />
            </div>

            <div className="form-group">
              <label>
                <Phone size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                Phone
              </label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
                placeholder="Phone number"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                className="btn-sm ghost"
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn-sm primary"
                type="submit"
                data-testid="save-profile"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={12} />
                    Save
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="list-item" style={{ cursor: 'default' }}>
              <User size={14} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Full name</span>
              <span style={{ fontSize: '0.875rem' }}>{user?.full_name || '--'}</span>
            </div>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="list-item" style={{ cursor: 'default' }}>
              <Mail size={14} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Email</span>
              <span style={{ fontSize: '0.875rem' }}>{user?.email}</span>
            </div>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="list-item" style={{ cursor: 'default' }}>
              <Phone size={14} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Phone</span>
              <span style={{ fontSize: '0.875rem' }}>{user?.phone || '--'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Founder / Investor Profile Section */}
      {(showFounder || showInvestor) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">
              {showFounder && showInvestor ? 'Founder & Investor Profile' : showFounder ? 'Founder Profile' : 'Investor Profile'}
            </span>
            {(showFounder && founderProfileId) && profileTab === 'founder' && (
              <CopyLinkButton url={`${window.location.origin}/app/founders/${founderProfileId}`} label="Share" />
            )}
            {(showInvestor && investorProfileId) && profileTab === 'investor' && (
              <CopyLinkButton url={`${window.location.origin}/app/investors/${investorProfileId}`} label="Share" />
            )}
          </div>

          {/* Tabs */}
          {showFounder && showInvestor && (
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid hsl(var(--border))', marginBottom: '1.5rem' }}>
              {(['founder', 'investor'] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setProfileTab(tab)} style={{
                  padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 500, border: 'none',
                  cursor: 'pointer', background: 'transparent', borderBottom: `2px solid ${profileTab === tab ? 'hsl(var(--primary))' : 'transparent'}`,
                  color: profileTab === tab ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  marginBottom: '-1px', transition: 'all 0.15s',
                }}>
                  {tab === 'founder' ? 'Founder Profile' : 'Investor Profile'}
                </button>
              ))}
            </div>
          )}

          {/* ── Founder Profile Form ── */}
          {profileTab === 'founder' && showFounder && (
            founderLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <form onSubmit={(e) => { void handleSaveFounderProfile(e) }}>
                {founderIsNew && (
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem', padding: '0.75rem', background: 'hsl(var(--muted))', borderRadius: '0.5rem' }}>
                    You don't have a founder profile yet. Fill in the details below to create one.
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label><User size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Headline *</label>
                    <input className={`input${founderErrors.headline ? ' input-error' : ''}`} value={founderForm.headline}
                      onChange={(e) => setFounderForm((p) => ({ ...p, headline: e.target.value }))}
                      placeholder="e.g. Building the future of fintech" />
                    {founderErrors.headline && <span className="field-error">{founderErrors.headline}</span>}
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label><FileText size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Bio</label>
                    <textarea className="input" rows={3} value={founderForm.bio}
                      onChange={(e) => setFounderForm((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="Tell investors about yourself..." />
                  </div>

                  <div className="form-group">
                    <label><MapPin size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Location</label>
                    <input className="input" value={founderForm.location}
                      onChange={(e) => setFounderForm((p) => ({ ...p, location: e.target.value }))}
                      placeholder="e.g. Bangalore, India" />
                  </div>

                  <div className="form-group">
                    <label><TrendingUp size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Current Stage</label>
                    <select className="input" value={founderForm.current_stage}
                      onChange={(e) => setFounderForm((p) => ({ ...p, current_stage: e.target.value }))}>
                      <option value="">Select stage</option>
                      {FOUNDER_STAGE_OPTIONS.map((s) => <option key={s} value={s}>{FOUNDER_STAGE_LABELS[s]}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><TrendingUp size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Fundraising Status</label>
                    <select className="input" value={founderForm.fundraising_status}
                      onChange={(e) => setFounderForm((p) => ({ ...p, fundraising_status: e.target.value }))}>
                      <option value="">Select status</option>
                      {FUNDRAISING_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{FUNDRAISING_STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><Zap size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Skills (comma-separated)</label>
                    <input className="input" value={founderForm.skills}
                      onChange={(e) => setFounderForm((p) => ({ ...p, skills: e.target.value }))}
                      placeholder="e.g. Product, Engineering, Sales" />
                  </div>

                  <div className="form-group">
                    <label><Linkedin size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />LinkedIn</label>
                    <input className="input" value={founderForm.linkedin_url}
                      onChange={(e) => setFounderForm((p) => ({ ...p, linkedin_url: e.target.value }))}
                      placeholder="https://linkedin.com/in/..." />
                  </div>

                  <div className="form-group">
                    <label><Twitter size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Twitter / X</label>
                    <input className="input" value={founderForm.twitter_url}
                      onChange={(e) => setFounderForm((p) => ({ ...p, twitter_url: e.target.value }))}
                      placeholder="https://twitter.com/..." />
                  </div>

                  <div className="form-group">
                    <label><Globe size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Website</label>
                    <input className="input" value={founderForm.website_url}
                      onChange={(e) => setFounderForm((p) => ({ ...p, website_url: e.target.value }))}
                      placeholder="https://yoursite.com" />
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={founderForm.is_public}
                        onChange={(e) => setFounderForm((p) => ({ ...p, is_public: e.target.checked }))} />
                      <Eye size={13} strokeWidth={1.5} />
                      Public profile
                    </label>
                  </div>
                </div>

                {founderErrors.form && <p className="field-error" style={{ marginTop: '0.5rem' }}>{founderErrors.form}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" className="btn-sm primary" disabled={founderSaving}>
                    {founderSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {founderIsNew ? 'Create Profile' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )
          )}

          {/* ── Investor Profile Form ── */}
          {profileTab === 'investor' && showInvestor && (
            investorLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <form onSubmit={(e) => { void handleSaveInvestorProfile(e) }}>
                {investorIsNew && (
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.25rem', padding: '0.75rem', background: 'hsl(var(--muted))', borderRadius: '0.5rem' }}>
                    You don't have an investor profile yet. Fill in the details below to create one.
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label><User size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Display Name *</label>
                    <input className={`input${investorErrors.display_name ? ' input-error' : ''}`} value={investorForm.display_name}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, display_name: e.target.value }))}
                      placeholder="Your name or alias" />
                    {investorErrors.display_name && <span className="field-error">{investorErrors.display_name}</span>}
                  </div>

                  <div className="form-group">
                    <label><Building2 size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Fund Name</label>
                    <input className="input" value={investorForm.fund_name}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, fund_name: e.target.value }))}
                      placeholder="e.g. Accel Partners" />
                  </div>

                  <div className="form-group">
                    <label><TrendingUp size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Investor Type</label>
                    <select className="input" value={investorForm.investor_type}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, investor_type: e.target.value }))}>
                      <option value="">Select type</option>
                      {INVESTOR_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{INVESTOR_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><MapPin size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Location</label>
                    <input className="input" value={investorForm.location}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, location: e.target.value }))}
                      placeholder="e.g. Mumbai, India" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label><User size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Headline</label>
                    <input className="input" value={investorForm.headline}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, headline: e.target.value }))}
                      placeholder="e.g. Early-stage investor focused on deep tech" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label><FileText size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Bio</label>
                    <textarea className="input" rows={3} value={investorForm.bio}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="Tell founders about your background..." />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label><FileText size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Investment Thesis</label>
                    <textarea className="input" rows={2} value={investorForm.investment_thesis}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, investment_thesis: e.target.value }))}
                      placeholder="Describe your investment philosophy..." />
                  </div>

                  <div className="form-group">
                    <label><DollarSign size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Min Check Size ($)</label>
                    <input className="input" type="number" min={0} value={investorForm.check_size_min}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, check_size_min: e.target.value }))}
                      placeholder="e.g. 50000" />
                  </div>

                  <div className="form-group">
                    <label><DollarSign size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Max Check Size ($)</label>
                    <input className="input" type="number" min={0} value={investorForm.check_size_max}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, check_size_max: e.target.value }))}
                      placeholder="e.g. 500000" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Stages Focus</label>
                    <MultiSelectChips options={INVESTOR_STAGE_OPTIONS} selected={investorForm.stages_focus}
                      onChange={(v) => setInvestorForm((p) => ({ ...p, stages_focus: v }))} />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Industries Focus</label>
                    <MultiSelectChips options={INDUSTRY_OPTIONS} selected={investorForm.industries_focus}
                      onChange={(v) => setInvestorForm((p) => ({ ...p, industries_focus: v }))} />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label><MapPin size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Geography Focus (comma-separated)</label>
                    <input className="input" value={investorForm.geography_focus}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, geography_focus: e.target.value }))}
                      placeholder="e.g. India, Southeast Asia, USA" />
                  </div>

                  <div className="form-group">
                    <label><TrendingUp size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Risk Appetite</label>
                    <select className="input" value={investorForm.risk_appetite}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, risk_appetite: e.target.value }))}>
                      <option value="">Select</option>
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label><Eye size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Discoverability</label>
                    <select className="input" value={investorForm.discoverability_mode}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, discoverability_mode: e.target.value }))}>
                      {DISCOVERABILITY_OPTIONS.map((d) => <option key={d} value={d}>{DISCOVERABILITY_LABELS[d]}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label><FileText size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Value Add</label>
                    <textarea className="input" rows={2} value={investorForm.value_add}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, value_add: e.target.value }))}
                      placeholder="How do you help beyond capital?" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label><Building2 size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Portfolio Companies (comma-separated)</label>
                    <input className="input" value={investorForm.portfolio_companies}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, portfolio_companies: e.target.value }))}
                      placeholder="e.g. Razorpay, CRED, Zepto" />
                  </div>

                  <div className="form-group">
                    <label><Linkedin size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />LinkedIn</label>
                    <input className="input" value={investorForm.linkedin_url}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, linkedin_url: e.target.value }))}
                      placeholder="https://linkedin.com/in/..." />
                  </div>

                  <div className="form-group">
                    <label><Twitter size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Twitter / X</label>
                    <input className="input" value={investorForm.twitter_url}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, twitter_url: e.target.value }))}
                      placeholder="https://twitter.com/..." />
                  </div>

                  <div className="form-group">
                    <label><Globe size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />Website</label>
                    <input className="input" value={investorForm.website_url}
                      onChange={(e) => setInvestorForm((p) => ({ ...p, website_url: e.target.value }))}
                      placeholder="https://yourfund.com" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ marginBottom: '0.5rem', display: 'block' }}>Deal Preferences</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                      {([
                        ['board_seat_requirement', 'Requires Board Seat'],
                        ['lead_investor', 'Can Lead Round'],
                        ['follow_on_participation', 'Follow-on Participation'],
                        ['co_invest_open', 'Open to Co-investing'],
                      ] as [keyof InvestorForm, string][]).map(([field, label]) => (
                        <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                          <input type="checkbox" checked={investorForm[field] as boolean}
                            onChange={(e) => setInvestorForm((p) => ({ ...p, [field]: e.target.checked }))} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {investorErrors.form && <p className="field-error" style={{ marginTop: '0.5rem' }}>{investorErrors.form}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" className="btn-sm primary" disabled={investorSaving}>
                    {investorSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {investorIsNew ? 'Create Profile' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )
          )}
        </div>
      )}

      {/* My Startups & Documents */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Building2 size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
            My Startups &amp; Documents
          </span>
        </div>

        {loadingStartups ? (
          <div className="empty-state" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span className="empty-description">Loading startups...</span>
          </div>
        ) : myStartups.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="empty-state" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
              <div className="empty-icon"><Building2 size={24} /></div>
              <span className="empty-title">No startups yet</span>
              <span className="empty-description">
                You are not a member of any startup yet.{' '}
                <Link to="/app/startups" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                  Browse startups
                </Link>
              </span>
              <button
                className="btn primary"
                type="button"
                onClick={() => setShowStartupForm((prev) => !prev)}
                style={{ marginTop: '1rem' }}
              >
                {showStartupForm ? 'Hide form' : 'Add startup'}
              </button>
            </div>

            {showStartupForm ? (
              <div
                style={{
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  background: 'hsl(var(--card))',
                }}
              >
                <h3 className="text-lg font-semibold" style={{ marginBottom: '0.25rem' }}>
                  Startup details
                </h3>
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Add your startup information to complete onboarding.
                </p>

                <form onSubmit={handleCreateStartup} className="space-y-5">
                  {startupErrors.form ? <div className="form-error">{startupErrors.form}</div> : null}
                  <div className="form-group">
                    <FormField label="Startup name" error={startupErrors.name}>
                      <input
                        type="text"
                        className="input"
                        value={startupName}
                        onChange={(event) => setStartupName(event.target.value)}
                        placeholder="FoundersLib"
                        required
                      />
                    </FormField>
                  </div>
                  <div className="form-group">
                    <FormField label="Description" error={startupErrors.description}>
                      <textarea
                        className="textarea"
                        value={startupDescription}
                        onChange={(event) => setStartupDescription(event.target.value)}
                        placeholder="What does your company do?"
                      />
                    </FormField>
                  </div>
                  <div className="form-group">
                    <FormField label="Industry" error={startupErrors.industry}>
                      <input
                        type="text"
                        className="input"
                        value={startupIndustry}
                        onChange={(event) => setStartupIndustry(event.target.value)}
                        placeholder="Fintech"
                        required
                      />
                    </FormField>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <FormField label="Stage">
                        <select className="select" value={startupStage} onChange={(event) => setStartupStage(event.target.value)}>
                          <option value="">Select stage</option>
                          <option value="idea">Idea</option>
                          <option value="mvp">MVP</option>
                          <option value="seed">Seed</option>
                          <option value="series_a">Series A</option>
                          <option value="series_b_plus">Series B+</option>
                        </select>
                      </FormField>
                    </div>
                    <div className="form-group">
                      <FormField label="Fundraising status">
                        <select
                          className="select"
                          value={fundraisingStatus}
                          onChange={(event) => setFundraisingStatus(event.target.value)}
                        >
                          <option value="">Select status</option>
                          <option value="not_raising">Not raising</option>
                          <option value="raising">Raising</option>
                          <option value="closed">Closed</option>
                        </select>
                      </FormField>
                    </div>
                  </div>
                  <div className="form-group">
                    <FormField label="Website URL">
                      <input
                        type="url"
                        className="input"
                        value={startupWebsite}
                        onChange={(event) => setStartupWebsite(event.target.value)}
                        placeholder="https://yourstartup.com"
                      />
                    </FormField>
                  </div>
                  <div className="form-group">
                    <FormField label="Problem Statement">
                      <textarea
                        className="textarea"
                        value={problemStatement}
                        onChange={(event) => setProblemStatement(event.target.value)}
                        placeholder="What core problem are you solving?"
                      />
                    </FormField>
                  </div>
                  <div className="form-group">
                    <FormField label="Solution / Product Description">
                      <textarea
                        className="textarea"
                        value={solutionDescription}
                        onChange={(event) => setSolutionDescription(event.target.value)}
                        placeholder="Describe your solution or product."
                      />
                    </FormField>
                  </div>
                  <div className="form-group">
                    <FormField label="Unique Value Proposition (UVP)">
                      <textarea
                        className="textarea"
                        value={uniqueValueProp}
                        onChange={(event) => setUniqueValueProp(event.target.value)}
                        placeholder="What makes you stand out?"
                      />
                    </FormField>
                  </div>
                  <div className="form-group">
                    <FormField label="Why Now? (Market timing)">
                      <textarea
                        className="textarea"
                        value={whyNow}
                        onChange={(event) => setWhyNow(event.target.value)}
                        placeholder="Why is this the right time for your startup?"
                      />
                    </FormField>
                  </div>
                  <button className="btn primary w-full" type="submit" disabled={creatingStartup}>
                    {creatingStartup ? 'Saving...' : 'Save startup'}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

            {myStartups.map((s) => {
              const isExpanded = expandedStartup === s.id
              const docs = startupDocs[s.id] ?? []
              const isLoadingThis = loadingDocs === s.id
              const isUploadingThis = uploadingDoc === s.id

              return (
                <div
                  key={s.id}
                  className="card"
                  data-testid={`startup-${s.id}`}
                  style={{ padding: 0, overflow: 'hidden' }}
                >
                  <button
                    className="list-item"
                    onClick={() => void toggleStartup(s.id)}
                    data-testid={`toggle-startup-${s.id}`}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: isExpanded ? '0.75rem 0.75rem 0 0' : undefined }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      {s.logo_url ? (
                        <img
                          src={resolveMediaUrl(s.logo_url) ?? ''}
                          alt={s.name}
                          style={{ width: 32, height: 32, borderRadius: '0.5rem', objectFit: 'cover' }}
                        />
                      ) : (
                        <div className="avatar" style={{ borderRadius: '0.5rem' }}>
                          <Building2 size={14} />
                        </div>
                      )}
                      <div style={{ textAlign: 'left', minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{s.name}</span>
                        {s.industry && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{s.industry}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {docs.length > 0 && (
                        <span className="badge">{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
                      )}
                      <span
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'contents' }}
                      >
                        <Link
                          to={`/app/startups/${s.id}`}
                          className="btn-sm ghost"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          data-testid={`open-startup-${s.id}`}
                        >
                          <ExternalLink size={12} strokeWidth={1.5} />
                          Open
                        </Link>
                        <CopyLinkButton
                          url={`${window.location.origin}/app/startups/${s.id}`}
                          label="Share"
                        />
                      </span>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid hsl(var(--border))' }}>
                      {/* Hidden file input per startup */}
                      <input
                        ref={(el) => { docInputRefs.current[s.id] = el }}
                        type="file"
                        className="sr-only"
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          addFilesToQueue(s.id, Array.from(e.target.files ?? []))
                          e.target.value = ''
                        }}
                        data-testid={`doc-file-input-${s.id}`}
                      />

                      {/* Add files + Upload all bar */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 0', borderBottom: (docQueues[s.id]?.length ?? 0) > 0 ? '1px solid hsl(var(--border))' : undefined }}>
                        <button
                          className="btn-sm ghost"
                          disabled={isUploadingThis}
                          onClick={() => docInputRefs.current[s.id]?.click()}
                          data-testid={`add-files-${s.id}`}
                        >
                          <Upload size={12} />
                          Add files
                        </button>
                        {(docQueues[s.id]?.length ?? 0) > 0 && (
                          <button
                            className="btn-sm primary"
                            disabled={isUploadingThis}
                            onClick={() => void uploadQueue(s.id)}
                            data-testid={`upload-queue-${s.id}`}
                          >
                            {isUploadingThis ? (
                              <><Loader2 size={12} className="animate-spin" /> Uploading...</>
                            ) : (
                              <><Upload size={12} /> Upload {docQueues[s.id].length} file{docQueues[s.id].length !== 1 ? 's' : ''}</>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Staging queue */}
                      {(docQueues[s.id]?.length ?? 0) > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0.5rem 0', borderBottom: '1px solid hsl(var(--border))' }}>
                          {docQueues[s.id].map((item) => (
                            <div key={item.localId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.375rem 0' }}>
                              <FileText size={13} strokeWidth={1.5} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                              <span style={{ flex: 1, minWidth: 100, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.file.name}
                              </span>
                              <select
                                className="select"
                                value={item.docType}
                                onChange={(e) =>
                                  updateQueueItem(s.id, item.localId, 'docType', e.target.value as DocQueueItem['docType'])
                                }
                                style={{ flex: '0 0 auto', minWidth: 130, fontSize: '0.75rem' }}
                              >
                                {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                                  <option key={val} value={val}>{label}</option>
                                ))}
                              </select>
                              <select
                                className="select"
                                value={item.accessLevel}
                                onChange={(e) =>
                                  updateQueueItem(
                                    s.id,
                                    item.localId,
                                    'accessLevel',
                                    e.target.value as DocQueueItem['accessLevel'],
                                  )
                                }
                                style={{ flex: '0 0 auto', minWidth: 100, fontSize: '0.75rem' }}
                              >
                                <option value="private">Private</option>
                                <option value="team">Team</option>
                                <option value="investor">Investor</option>
                                <option value="public">Public</option>
                              </select>
                              <button
                                className="btn-sm ghost"
                                style={{ padding: '0.25rem', flexShrink: 0 }}
                                onClick={() => removeFromQueue(s.id, item.localId)}
                              >
                                <Trash2 size={12} style={{ color: '#ef4444' }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}


                      {/* Docs list */}
                      {isLoadingThis ? (
                        <div className="empty-state" style={{ padding: '1rem 0' }}>
                          <Loader2 size={16} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                          <span className="empty-description">Loading documents...</span>
                        </div>
                      ) : docs.length === 0 ? (
                        <div className="empty-state" style={{ padding: '1rem 0' }}>
                          <span className="empty-description">No documents yet. Upload a pitch deck to get started.</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {docs.map((doc) => {
                            const AccessIcon = ACCESS_ICONS[doc.access_level ?? 'private'] ?? Lock
                            return (
                              <div key={doc.id} className="list-item" data-testid={`doc-${doc.id}`} style={{ cursor: 'default' }}>
                                <FileText size={16} strokeWidth={1.5} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{doc.name}</span>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                    {DOC_TYPE_LABELS[doc.document_type ?? ''] ?? doc.document_type}
                                    {doc.file_size ? ` \u00B7 ${formatFileSize(doc.file_size)}` : ''}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span className="tag" title={doc.access_level ?? 'private'}>
                                    <AccessIcon size={10} style={{ marginRight: 4 }} />
                                    {doc.access_level ?? 'private'}
                                  </span>
                                  {doc.file_url ? (
                                    <a
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn-sm ghost"
                                      data-testid={`view-doc-${doc.id}`}
                                      style={{ padding: '0.25rem' }}
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                  ) : null}
                                  <button
                                    className="btn-sm ghost"
                                    onClick={() => void handleDocDelete(s.id, doc.id)}
                                    data-testid={`delete-doc-${doc.id}`}
                                    style={{ padding: '0.25rem', color: '#ef4444' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
