import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    } catch {
      setStartupErrors({ form: 'Unable to save startup details. Please try again.' })
    } finally {
      setSavingStartup(false)
    }
  }

  const handleInvestorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateRequired({
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

  return (
    <section className="onboarding">
      <header className="onboarding-header">
        <span className="eyebrow">Onboarding</span>
        <h1>Set up your profile</h1>
        <p>Tell us a bit about your role so we can tailor the FoundersLib experience.</p>
      </header>

      <div className="onboarding-progress">
        <div>
          <h3>Progress</h3>
          <p>
            {status ? `${status.completed_steps} of ${status.total_steps} steps` : 'Loading steps...'}
          </p>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${status?.progress_percent ?? 0}%` }} />
        </div>
        {status?.next_step ? (
          <div className="next-step">
            <span className="eyebrow">Next step</span>
            <h4>{status.next_step.title}</h4>
            <p>{status.next_step.description}</p>
          </div>
        ) : null}
      </div>

      <div className="step-list">
        <h3>Onboarding steps</h3>
        {loadingSteps ? (
          <div className="page-loader">Loading steps...</div>
        ) : stepsError ? (
          <div className="form-error">{stepsError}</div>
        ) : (
          <ul>
            {steps.map((step) => {
              const done = status?.completed_step_names?.includes(step.step)
              return (
                <li key={step.step} className={done ? 'completed' : ''}>
                  <span className="step-title">
                    {done ? '✓' : '•'} {step.title}
                  </span>
                  <span className="step-desc">{step.description}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="onboarding-grid">
        <div className="onboarding-card">
          <h2>1. Choose your role</h2>
          <p>We use this to personalize onboarding steps.</p>
          <form onSubmit={handleRoleSubmit} className="onboarding-form">
            {roleErrors.form ? <div className="form-error">{roleErrors.form}</div> : null}
            <div className="role-options">
              {(['founder', 'investor', 'both'] as Role[]).map((value) => (
                <label key={value} className={`role-option ${role === value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                  />
                  <span>{value === 'both' ? 'Founder + Investor' : value}</span>
                </label>
              ))}
            </div>
            <button className="btn primary" type="submit" disabled={savingRole}>
              {savingRole ? 'Saving...' : `Save role (${roleLabel})`}
            </button>
          </form>
        </div>

        <div className="onboarding-card">
          <h2>2. Profile basics</h2>
          <p>Keep your contact details up to date.</p>
          <form onSubmit={handleProfileSubmit} className="onboarding-form">
            {profileErrors.form ? <div className="form-error">{profileErrors.form}</div> : null}
            <FormField label="Full name" error={profileErrors.full_name}>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Alex Morgan"
                required
              />
            </FormField>
            <FormField label="Phone (optional)">
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 415 555 0123"
              />
            </FormField>
            <FormField label="Avatar URL (optional)">
              <input
                type="url"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://..."
              />
            </FormField>
            <button className="btn primary" type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>

        {isFounder ? (
          <div className="onboarding-card">
            <h2>3. Founder profile</h2>
            <p>Add the essentials to unlock your onboarding credits.</p>
            <form onSubmit={handleFounderSubmit} className="onboarding-form">
              {founderErrors.form ? <div className="form-error">{founderErrors.form}</div> : null}
              <FormField label="Headline" error={founderErrors.headline}>
                <input
                  type="text"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder="Building AI tools for finance teams"
                  required
                />
              </FormField>
              <FormField label="Bio">
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Short bio"
                />
              </FormField>
              <FormField label="Location">
                <input
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="San Francisco, CA"
                />
              </FormField>
              <FormField label="LinkedIn URL">
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                />
              </FormField>
              <FormField label="Twitter URL">
                <input
                  type="url"
                  value={twitterUrl}
                  onChange={(event) => setTwitterUrl(event.target.value)}
                  placeholder="https://x.com/yourhandle"
                />
              </FormField>
              <FormField label="Website URL">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://yourcompany.com"
                />
              </FormField>
              <FormField label="Skills (comma separated)">
                <input
                  type="text"
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                  placeholder="Product, Growth, AI"
                />
              </FormField>
              <button className="btn primary" type="submit" disabled={savingFounder}>
                {savingFounder ? 'Saving...' : 'Save founder profile'}
              </button>
            </form>
          </div>
        ) : null}

        {isFounder ? (
          <div className="onboarding-card">
            <h2>4. Startup details</h2>
            <p>Add your startup information to complete onboarding.</p>
            <form onSubmit={handleStartupSubmit} className="onboarding-form">
              {startupErrors.form ? <div className="form-error">{startupErrors.form}</div> : null}
              <FormField label="Startup name" error={startupErrors.name}>
                <input
                  type="text"
                  value={startupName}
                  onChange={(event) => setStartupName(event.target.value)}
                  placeholder="FoundersLib"
                  required
                />
              </FormField>
              <FormField label="Description" error={startupErrors.description}>
                <textarea
                  value={startupDescription}
                  onChange={(event) => setStartupDescription(event.target.value)}
                  placeholder="What does your company do?"
                />
              </FormField>
              <FormField label="Industry" error={startupErrors.industry}>
                <input
                  type="text"
                  value={startupIndustry}
                  onChange={(event) => setStartupIndustry(event.target.value)}
                  placeholder="Fintech"
                  required
                />
              </FormField>
              <FormField label="Stage">
                <select value={startupStage} onChange={(event) => setStartupStage(event.target.value)}>
                  <option value="">Select stage</option>
                  <option value="idea">Idea</option>
                  <option value="mvp">MVP</option>
                  <option value="seed">Seed</option>
                  <option value="series_a">Series A</option>
                  <option value="series_b_plus">Series B+</option>
                </select>
              </FormField>
              <FormField label="Fundraising status">
                <select value={fundraisingStatus} onChange={(event) => setFundraisingStatus(event.target.value)}>
                  <option value="">Select status</option>
                  <option value="not_raising">Not raising</option>
                  <option value="raising">Raising</option>
                  <option value="closed">Closed</option>
                </select>
              </FormField>
              <FormField label="Website URL">
                <input
                  type="url"
                  value={startupWebsite}
                  onChange={(event) => setStartupWebsite(event.target.value)}
                  placeholder="https://yourstartup.com"
                />
              </FormField>
              <FormField label="Tagline">
                <input
                  type="text"
                  value={startupTagline}
                  onChange={(event) => setStartupTagline(event.target.value)}
                  placeholder="Optional short tagline"
                />
              </FormField>
              <button className="btn primary" type="submit" disabled={savingStartup}>
                {savingStartup ? 'Saving...' : 'Save startup'}
              </button>
            </form>
          </div>
        ) : null}

        {isInvestor ? (
          <div className="onboarding-card">
            <h2>5. Investor profile & preferences</h2>
            <p>Add the essentials so founders know how to engage with you.</p>
            <form onSubmit={handleInvestorSubmit} className="onboarding-form">
              {investorErrors.form ? <div className="form-error">{investorErrors.form}</div> : null}
              <FormField label="Display name" error={investorErrors.display_name}>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Jordan Lee"
                  required
                />
              </FormField>
              <FormField label="Investor type" error={investorErrors.investor_type}>
                <select value={investorType} onChange={(event) => setInvestorType(event.target.value)}>
                  <option value="angel">Angel</option>
                  <option value="micro_vc">Micro VC</option>
                  <option value="vc">VC</option>
                  <option value="fund">Fund</option>
                  <option value="syndicate">Syndicate</option>
                  <option value="accelerator">Accelerator</option>
                </select>
              </FormField>
              <FormField label="Headline" error={investorErrors.headline}>
                <input
                  type="text"
                  value={investorHeadline}
                  onChange={(event) => setInvestorHeadline(event.target.value)}
                  placeholder="Backing fintech and climate founders"
                  required
                />
              </FormField>
              <FormField label="Fund name">
                <input
                  type="text"
                  value={fundName}
                  onChange={(event) => setFundName(event.target.value)}
                  placeholder="Northwind Capital"
                />
              </FormField>
              <FormField label="LinkedIn URL">
                <input
                  type="url"
                  value={investorLinkedin}
                  onChange={(event) => setInvestorLinkedin(event.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                />
              </FormField>
              <FormField label="Bio">
                <textarea
                  value={investorBio}
                  onChange={(event) => setInvestorBio(event.target.value)}
                  placeholder="Optional short bio"
                />
              </FormField>
              <FormField label="Check size min (USD)" error={investorErrors.check_size_min}>
                <input
                  type="number"
                  value={checkSizeMin}
                  onChange={(event) => setCheckSizeMin(event.target.value)}
                  placeholder="25000"
                  required
                />
              </FormField>
              <FormField label="Check size max (USD)" error={investorErrors.check_size_max}>
                <input
                  type="number"
                  value={checkSizeMax}
                  onChange={(event) => setCheckSizeMax(event.target.value)}
                  placeholder="250000"
                />
              </FormField>
              <FormField label="Stages focus (comma separated)" error={investorErrors.stages_focus}>
                <input
                  type="text"
                  value={stagesFocus}
                  onChange={(event) => setStagesFocus(event.target.value)}
                  placeholder="seed, series_a"
                  required
                />
              </FormField>
              <FormField label="Industries focus (comma separated)" error={investorErrors.industries_focus}>
                <input
                  type="text"
                  value={industriesFocus}
                  onChange={(event) => setIndustriesFocus(event.target.value)}
                  placeholder="fintech, climate"
                  required
                />
              </FormField>
              <FormField label="Geography focus (comma separated)">
                <input
                  type="text"
                  value={geographyFocus}
                  onChange={(event) => setGeographyFocus(event.target.value)}
                  placeholder="North America, Europe"
                />
              </FormField>
              <FormField label="Discoverability mode" error={investorErrors.discoverability_mode}>
                <select
                  value={discoverabilityMode}
                  onChange={(event) => setDiscoverabilityMode(event.target.value)}
                >
                  <option value="closed">Closed</option>
                  <option value="application_based">Application based</option>
                  <option value="open">Open</option>
                </select>
              </FormField>
              <button className="btn primary" type="submit" disabled={savingInvestor}>
                {savingInvestor ? 'Saving...' : 'Save investor profile'}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      <div className="onboarding-footer">
        <button className="btn ghost" type="button" onClick={handleSkip}>
          Skip for now
        </button>
        <button className="btn primary" type="button" onClick={() => navigate('/app')}>
          Continue to dashboard
        </button>
      </div>
    </section>
  )
}
