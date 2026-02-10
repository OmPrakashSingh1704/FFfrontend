import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { FormField } from '../components/FormField'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { apiRequest } from '../lib/api'
import { hasErrors, validateRequired } from '../lib/forms'

type Role = 'founder' | 'investor' | 'both'

type RoleErrors = Partial<Record<'role' | 'form', string>>
type ProfileErrors = Partial<Record<'full_name' | 'form', string>>
type FounderErrors = Partial<Record<'headline' | 'form', string>>
type StartupErrors = Partial<Record<'name' | 'description' | 'industry' | 'form', string>>
type InvestorErrors = Partial<
  Record<
    | 'display_name'
    | 'investor_type'
    | 'headline'
    | 'check_size_min'
    | 'check_size_max'
    | 'stages_focus'
    | 'industries_focus'
    | 'discoverability_mode'
    | 'form',
    string
  >
>

type OnboardingStep = {
  step: string
  title: string
  description: string
  required_fields: string[]
  optional_fields?: string[]
  rewards?: { credits?: number; reputation?: number }
}

type OnboardingStatus = {
  progress_percent: number
  completed_steps: number
  total_steps: number
  next_step: OnboardingStep | null
  is_complete: boolean
  completed_step_names: string[]
  role: string
}

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export function OnboardingPage() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { pushToast } = useToast()

  const [role, setRole] = useState<Role>((user?.role as Role) || 'founder')
  const [roleErrors, setRoleErrors] = useState<RoleErrors>({})
  const [savingRole, setSavingRole] = useState(false)

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '')
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [skills, setSkills] = useState('')
  const [founderErrors, setFounderErrors] = useState<FounderErrors>({})
  const [savingFounder, setSavingFounder] = useState(false)

  const [startupName, setStartupName] = useState('')
  const [startupDescription, setStartupDescription] = useState('')
  const [startupIndustry, setStartupIndustry] = useState('')
  const [startupStage, setStartupStage] = useState('')
  const [fundraisingStatus, setFundraisingStatus] = useState('')
  const [startupWebsite, setStartupWebsite] = useState('')
  const [startupTagline, setStartupTagline] = useState('')
  const [startupErrors, setStartupErrors] = useState<StartupErrors>({})
  const [savingStartup, setSavingStartup] = useState(false)

  const [displayName, setDisplayName] = useState(user?.full_name ?? '')
  const [investorType, setInvestorType] = useState('angel')
  const [investorHeadline, setInvestorHeadline] = useState('')
  const [fundName, setFundName] = useState('')
  const [investorBio, setInvestorBio] = useState('')
  const [investorLinkedin, setInvestorLinkedin] = useState('')
  const [checkSizeMin, setCheckSizeMin] = useState('')
  const [checkSizeMax, setCheckSizeMax] = useState('')
  const [stagesFocus, setStagesFocus] = useState('')
  const [industriesFocus, setIndustriesFocus] = useState('')
  const [geographyFocus, setGeographyFocus] = useState('')
  const [discoverabilityMode, setDiscoverabilityMode] = useState('closed')
  const [investorErrors, setInvestorErrors] = useState<InvestorErrors>({})
  const [savingInvestor, setSavingInvestor] = useState(false)

  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const [loadingSteps, setLoadingSteps] = useState(true)
  const [stepsError, setStepsError] = useState<string | null>(null)

  const [activeStep, setActiveStep] = useState(0)

  const isFounder = role === 'founder' || role === 'both'
  const isInvestor = role === 'investor' || role === 'both'

  const loadOnboarding = useCallback(async () => {
    setLoadingSteps(true)
    setStepsError(null)
    try {
      const [statusData, stepsData] = await Promise.all([
        apiRequest<OnboardingStatus>('/onboarding/status/'),
        apiRequest<OnboardingStep[]>('/onboarding/steps/'),
      ])
      setStatus(statusData)
      setSteps(stepsData)
    } catch {
      setStepsError('Unable to load onboarding steps.')
    } finally {
      setLoadingSteps(false)
    }
  }, [])

  useEffect(() => {
    void loadOnboarding()
  }, [loadOnboarding])

  useEffect(() => {
    if (user?.role) {
      setRole(user.role as Role)
    }
  }, [user?.role])

  useEffect(() => {
    setFullName(user?.full_name ?? '')
    setPhone(user?.phone ?? '')
    setAvatarUrl(user?.avatar_url ?? '')
    setDisplayName(user?.full_name ?? '')
  }, [user])

  const roleLabel = useMemo(() => {
    if (role === 'investor') return 'Investor'
    if (role === 'both') return 'Founder + Investor'
    return 'Founder'
  }, [role])

  // Build the visible steps list based on role
  const visibleSteps = useMemo(() => {
    const result: { id: string; label: string }[] = [
      { id: 'role', label: 'Role' },
      { id: 'profile', label: 'Profile' },
    ]
    if (isFounder) {
      result.push({ id: 'founder', label: 'Founder' })
      result.push({ id: 'startup', label: 'Startup' })
    }
    if (isInvestor) {
      result.push({ id: 'investor', label: 'Investor' })
    }
    return result
  }, [isFounder, isInvestor])

  const handleRoleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateRequired({ role })
    if (hasErrors(nextErrors)) {
      setRoleErrors(nextErrors)
      return
    }

    setSavingRole(true)
    setRoleErrors({})
    try {
      await apiRequest('/users/auth/select-role/', {
        method: 'PATCH',
        body: { role },
      })
      await refreshUser()
      await loadOnboarding()
      pushToast('Role updated', 'success')
      setActiveStep((s) => Math.min(s + 1, visibleSteps.length - 1))
    } catch {
      setRoleErrors({ form: 'Unable to update role. Please try again.' })
    } finally {
      setSavingRole(false)
    }
  }

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateRequired({ full_name: fullName })
    if (hasErrors(nextErrors)) {
      setProfileErrors(nextErrors)
      return
    }

    setSavingProfile(true)
    setProfileErrors({})
    try {
      await apiRequest('/users/me/profile/', {
        method: 'PUT',
        body: {
          full_name: fullName,
          phone: phone || undefined,
          avatar_url: avatarUrl || undefined,
        },
      })
      await refreshUser()
      pushToast('Profile updated', 'success')
      setActiveStep((s) => Math.min(s + 1, visibleSteps.length - 1))
    } catch {
      setProfileErrors({ form: 'Unable to update profile. Please try again.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleFounderSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateRequired({ headline })
    if (hasErrors(nextErrors)) {
      setFounderErrors(nextErrors)
      return
    }

    setSavingFounder(true)
    setFounderErrors({})
    try {
      await apiRequest('/onboarding/founder-profile/', {
        method: 'POST',
        body: {
          headline,
          bio: bio || undefined,
          location,
          linkedin_url: linkedinUrl || undefined,
          twitter_url: twitterUrl || undefined,
          website_url: websiteUrl || undefined,
          skills: parseList(skills),
        },
      })
      await refreshUser()
      await loadOnboarding()
      pushToast('Founder profile saved', 'success')
      setActiveStep((s) => Math.min(s + 1, visibleSteps.length - 1))
    } catch {
      setFounderErrors({ form: 'Unable to save founder profile. Please check your details.' })
    } finally {
      setSavingFounder(false)
    }
  }

  const handleStartupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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

    setSavingStartup(true)
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
          tagline: startupTagline || undefined,
        },
      })
      await loadOnboarding()
      pushToast('Startup saved', 'success')
      setActiveStep((s) => Math.min(s + 1, visibleSteps.length - 1))
    } catch {
      setStartupErrors({ form: 'Unable to save startup details. Please try again.' })
    } finally {
      setSavingStartup(false)
    }
  }

  const handleInvestorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: InvestorErrors = validateRequired({
      display_name: displayName,
      investor_type: investorType,
      headline: investorHeadline,
      check_size_min: checkSizeMin,
      stages_focus: stagesFocus,
      industries_focus: industriesFocus,
      discoverability_mode: discoverabilityMode,
    })

    const checkMinValue = checkSizeMin ? Number(checkSizeMin) : null
    const checkMaxValue = checkSizeMax ? Number(checkSizeMax) : null

    if (checkSizeMin && Number.isNaN(checkMinValue)) {
      nextErrors.check_size_min = 'Enter a numeric value'
    }

    if (checkSizeMax && Number.isNaN(checkMaxValue)) {
      nextErrors.check_size_max = 'Enter a numeric value'
    }

    if (
      checkMinValue !== null &&
      checkMaxValue !== null &&
      !Number.isNaN(checkMinValue) &&
      !Number.isNaN(checkMaxValue) &&
      checkMaxValue < checkMinValue
    ) {
      nextErrors.check_size_max = 'Max check size must be >= min'
    }

    if (hasErrors(nextErrors)) {
      setInvestorErrors(nextErrors)
      return
    }

    setSavingInvestor(true)
    setInvestorErrors({})
    try {
      await apiRequest('/onboarding/investor-profile/', {
        method: 'POST',
        body: {
          display_name: displayName,
          investor_type: investorType,
          headline: investorHeadline,
          fund_name: fundName || undefined,
          bio: investorBio || undefined,
          linkedin_url: investorLinkedin || undefined,
          check_size_min: checkMinValue ?? undefined,
          check_size_max: checkMaxValue ?? undefined,
          stages_focus: parseList(stagesFocus),
          industries_focus: parseList(industriesFocus),
          geography_focus: parseList(geographyFocus),
          discoverability_mode: discoverabilityMode,
        },
      })
      await refreshUser()
      await loadOnboarding()
      pushToast('Investor profile saved', 'success')
    } catch {
      setInvestorErrors({ form: 'Unable to save investor profile. Please review your details.' })
    } finally {
      setSavingInvestor(false)
    }
  }

  const handleSkip = async () => {
    try {
      await apiRequest('/onboarding/skip/', { method: 'POST' })
      await refreshUser()
      pushToast('Onboarding skipped', 'info')
      navigate('/app')
    } catch {
      pushToast('Unable to skip onboarding', 'warning')
    }
  }

  const currentStepId = visibleSteps[activeStep]?.id

  const renderStepContent = () => {
    if (loadingSteps) {
      return (
        <div className="card p-8">
          <div className="empty-state">
            <p className="empty-description">Loading steps...</p>
          </div>
        </div>
      )
    }
    if (stepsError) {
      return (
        <div className="card p-8">
          <div className="form-error">{stepsError}</div>
        </div>
      )
    }

    switch (currentStepId) {
      case 'role':
        return (
          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              1. Choose your role
            </h2>
            <p className="text-sm mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
              We use this to personalize onboarding steps.
            </p>
            <form onSubmit={handleRoleSubmit} className="space-y-5">
              {roleErrors.form ? <div className="form-error">{roleErrors.form}</div> : null}
              <div className="grid-3">
                {(['founder', 'investor', 'both'] as Role[]).map((value) => (
                  <label
                    key={value}
                    className="card p-4 flex items-center gap-3 cursor-pointer transition-all duration-200"
                    style={{
                      borderColor: role === value ? 'var(--gold)' : undefined,
                      background: role === value ? 'rgba(249, 115, 22, 0.05)' : undefined,
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={role === value}
                      onChange={() => setRole(value)}
                      className="sr-only"
                    />
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: role === value ? 'var(--gold)' : 'hsl(var(--border))',
                      }}
                    >
                      {role === value && (
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--gold)' }} />
                      )}
                    </div>
                    <span className="text-sm font-medium capitalize">
                      {value === 'both' ? 'Founder + Investor' : value}
                    </span>
                  </label>
                ))}
              </div>
              <button className="btn primary w-full" type="submit" disabled={savingRole}>
                {savingRole ? 'Saving...' : `Save role (${roleLabel})`}
              </button>
            </form>
          </div>
        )

      case 'profile':
        return (
          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              2. Profile basics
            </h2>
            <p className="text-sm mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Keep your contact details up to date.
            </p>
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              {profileErrors.form ? <div className="form-error">{profileErrors.form}</div> : null}
              <div className="form-group">
                <FormField label="Full name" error={profileErrors.full_name}>
                  <input
                    type="text"
                    className="input"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Alex Morgan"
                    required
                  />
                </FormField>
              </div>
              <div className="form-group">
                <FormField label="Phone (optional)">
                  <input
                    type="tel"
                    className="input"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+1 415 555 0123"
                  />
                </FormField>
              </div>
              <div className="form-group">
                <FormField label="Avatar URL (optional)">
                  <input
                    type="url"
                    className="input"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </FormField>
              </div>
              <button className="btn primary w-full" type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </form>
          </div>
        )

      case 'founder':
        return (
          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              3. Founder profile
            </h2>
            <p className="text-sm mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Add the essentials to unlock your onboarding credits.
            </p>
            <form onSubmit={handleFounderSubmit} className="space-y-5">
              {founderErrors.form ? <div className="form-error">{founderErrors.form}</div> : null}
              <div className="form-group">
                <FormField label="Headline" error={founderErrors.headline}>
                  <input
                    type="text"
                    className="input"
                    value={headline}
                    onChange={(event) => setHeadline(event.target.value)}
                    placeholder="Building AI tools for finance teams"
                    required
                  />
                </FormField>
              </div>
              <div className="form-group">
                <FormField label="Bio">
                  <textarea
                    className="textarea"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Short bio"
                  />
                </FormField>
              </div>
              <div className="form-group">
                <FormField label="Location">
                  <input
                    type="text"
                    className="input"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="San Francisco, CA"
                  />
                </FormField>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <FormField label="LinkedIn URL">
                    <input
                      type="url"
                      className="input"
                      value={linkedinUrl}
                      onChange={(event) => setLinkedinUrl(event.target.value)}
                      placeholder="https://linkedin.com/in/yourname"
                    />
                  </FormField>
                </div>
                <div className="form-group">
                  <FormField label="Twitter URL">
                    <input
                      type="url"
                      className="input"
                      value={twitterUrl}
                      onChange={(event) => setTwitterUrl(event.target.value)}
                      placeholder="https://x.com/yourhandle"
                    />
                  </FormField>
                </div>
              </div>
              <div className="form-group">
                <FormField label="Website URL">
                  <input
                    type="url"
                    className="input"
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="https://yourcompany.com"
                  />
                </FormField>
              </div>
              <div className="form-group">
                <FormField label="Skills (comma separated)">
                  <input
                    type="text"
                    className="input"
                    value={skills}
                    onChange={(event) => setSkills(event.target.value)}
                    placeholder="Product, Growth, AI"
                  />
                </FormField>
              </div>
              <button className="btn primary w-full" type="submit" disabled={savingFounder}>
                {savingFounder ? 'Saving...' : 'Save founder profile'}
              </button>
            </form>
          </div>
        )

      case 'startup':
        return (
          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              4. Startup details
            </h2>
            <p className="text-sm mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Add your startup information to complete onboarding.
            </p>
            <form onSubmit={handleStartupSubmit} className="space-y-5">
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
                    <select className="select" value={fundraisingStatus} onChange={(event) => setFundraisingStatus(event.target.value)}>
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
                <FormField label="Tagline">
                  <input
                    type="text"
                    className="input"
                    value={startupTagline}
                    onChange={(event) => setStartupTagline(event.target.value)}
                    placeholder="Optional short tagline"
                  />
                </FormField>
              </div>
              <button className="btn primary w-full" type="submit" disabled={savingStartup}>
                {savingStartup ? 'Saving...' : 'Save startup'}
              </button>
            </form>
          </div>
        )

      case 'investor':
        return (
          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              5. Investor profile & preferences
            </h2>
            <p className="text-sm mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Add the essentials so founders know how to engage with you.
            </p>
            <form onSubmit={handleInvestorSubmit} className="space-y-5">
              {investorErrors.form ? <div className="form-error">{investorErrors.form}</div> : null}
              <div className="grid-2">
                <div className="form-group">
                  <FormField label="Display name" error={investorErrors.display_name}>
                    <input
                      type="text"
                      className="input"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Jordan Lee"
                      required
                    />
                  </FormField>
                </div>
                <div className="form-group">
                  <FormField label="Investor type" error={investorErrors.investor_type}>
                    <select className="select" value={investorType} onChange={(event) => setInvestorType(event.target.value)}>
                      <option value="angel">Angel</option>
                      <option value="micro_vc">Micro VC</option>
                      <option value="vc">VC</option>
                      <option value="fund">Fund</option>
                      <option value="syndicate">Syndicate</option>
                      <option value="accelerator">Accelerator</option>
                    </select>
                  </FormField>
                </div>
              </div>
              <div className="form-group">
                <FormField label="Headline" error={investorErrors.headline}>
                  <input
                    type="text"
                    className="input"
                    value={investorHeadline}
                    onChange={(event) => setInvestorHeadline(event.target.value)}
                    placeholder="Backing fintech and climate founders"
                    required
                  />
                </FormField>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <FormField label="Fund name">
                    <input
                      type="text"
                      className="input"
                      value={fundName}
                      onChange={(event) => setFundName(event.target.value)}
                      placeholder="Northwind Capital"
                    />
                  </FormField>
                </div>
                <div className="form-group">
                  <FormField label="LinkedIn URL">
                    <input
                      type="url"
                      className="input"
                      value={investorLinkedin}
                      onChange={(event) => setInvestorLinkedin(event.target.value)}
                      placeholder="https://linkedin.com/in/yourname"
                    />
                  </FormField>
                </div>
              </div>
              <div className="form-group">
                <FormField label="Bio">
                  <textarea
                    className="textarea"
                    value={investorBio}
                    onChange={(event) => setInvestorBio(event.target.value)}
                    placeholder="Optional short bio"
                  />
                </FormField>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <FormField label="Check size min (USD)" error={investorErrors.check_size_min}>
                    <input
                      type="number"
                      className="input"
                      value={checkSizeMin}
                      onChange={(event) => setCheckSizeMin(event.target.value)}
                      placeholder="25000"
                      required
                    />
                  </FormField>
                </div>
                <div className="form-group">
                  <FormField label="Check size max (USD)" error={investorErrors.check_size_max}>
                    <input
                      type="number"
                      className="input"
                      value={checkSizeMax}
                      onChange={(event) => setCheckSizeMax(event.target.value)}
                      placeholder="250000"
                    />
                  </FormField>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <FormField label="Stages focus (comma separated)" error={investorErrors.stages_focus}>
                    <input
                      type="text"
                      className="input"
                      value={stagesFocus}
                      onChange={(event) => setStagesFocus(event.target.value)}
                      placeholder="seed, series_a"
                      required
                    />
                  </FormField>
                </div>
                <div className="form-group">
                  <FormField label="Industries focus (comma separated)" error={investorErrors.industries_focus}>
                    <input
                      type="text"
                      className="input"
                      value={industriesFocus}
                      onChange={(event) => setIndustriesFocus(event.target.value)}
                      placeholder="fintech, climate"
                      required
                    />
                  </FormField>
                </div>
              </div>
              <div className="form-group">
                <FormField label="Geography focus (comma separated)">
                  <input
                    type="text"
                    className="input"
                    value={geographyFocus}
                    onChange={(event) => setGeographyFocus(event.target.value)}
                    placeholder="North America, Europe"
                  />
                </FormField>
              </div>
              <div className="form-group">
                <FormField label="Discoverability mode" error={investorErrors.discoverability_mode}>
                  <select
                    className="select"
                    value={discoverabilityMode}
                    onChange={(event) => setDiscoverabilityMode(event.target.value)}
                  >
                    <option value="closed">Closed</option>
                    <option value="application_based">Application based</option>
                    <option value="open">Open</option>
                  </select>
                </FormField>
              </div>
              <button className="btn primary w-full" type="submit" disabled={savingInvestor}>
                {savingInvestor ? 'Saving...' : 'Save investor profile'}
              </button>
            </form>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12" style={{ minHeight: 'calc(100vh - 5rem)' }}>
      {/* Header */}
      <header className="text-center mb-8">
        <span
          className="text-xs uppercase tracking-widest font-medium"
          style={{ color: 'var(--gold)', fontFamily: "'Inter', sans-serif" }}
        >
          Onboarding
        </span>
        <h1 className="text-3xl sm:text-4xl font-medium mt-2 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
          Set up your profile
        </h1>
        <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Tell us a bit about your role so we can tailor the FoundersLib experience.
        </p>
      </header>

      {/* Step progress bar */}
      <div className="flex items-center justify-center mb-8">
        {visibleSteps.map((step, index) => {
          const isCompleted = index < activeStep
          const isCurrent = index === activeStep
          const isStepDone = status?.completed_step_names?.includes(
            steps.find((s) => s.step.toLowerCase().includes(step.id))?.step ?? ''
          )
          return (
            <div key={step.id} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveStep(index)}
                className="flex flex-col items-center gap-1.5 transition-all duration-200"
                style={{ cursor: 'pointer', background: 'none', border: 'none', padding: '0 4px' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200"
                  style={{
                    background: isCompleted || isStepDone
                      ? 'var(--gold)'
                      : isCurrent
                        ? 'rgba(249, 115, 22, 0.15)'
                        : 'hsl(var(--muted))',
                    color: isCompleted || isStepDone
                      ? 'white'
                      : isCurrent
                        ? 'var(--gold)'
                        : 'hsl(var(--muted-foreground))',
                    border: isCurrent ? '2px solid var(--gold)' : '2px solid transparent',
                  }}
                >
                  {isCompleted || isStepDone ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span
                  className="text-xs hidden sm:block"
                  style={{
                    color: isCurrent ? 'var(--gold)' : 'hsl(var(--muted-foreground))',
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {step.label}
                </span>
              </button>
              {index < visibleSteps.length - 1 && (
                <div
                  className="w-8 sm:w-12 h-0.5 mx-1"
                  style={{
                    background: isCompleted
                      ? 'var(--gold)'
                      : 'hsl(var(--border))',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress text */}
      {status && (
        <div className="text-center mb-6">
          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {status.completed_steps} of {status.total_steps} steps completed ({status.progress_percent}%)
          </p>
        </div>
      )}

      {/* Step content */}
      {renderStepContent()}

      {/* Footer buttons */}
      <div className="flex justify-between items-center mt-8 pt-6" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        <button className="btn-sm ghost" type="button" onClick={handleSkip}>
          Skip for now
        </button>
        <div className="flex gap-3">
          {activeStep > 0 && (
            <button
              className="btn-sm ghost"
              type="button"
              onClick={() => setActiveStep((s) => Math.max(s - 1, 0))}
            >
              Back
            </button>
          )}
          <button className="btn-sm primary" type="button" onClick={() => navigate('/app')}>
            Continue to dashboard
          </button>
        </div>
      </div>
    </section>
  )
}
