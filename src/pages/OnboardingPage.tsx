import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown } from 'lucide-react'
import { FormField } from '../components/FormField'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { apiRequest, uploadRequest } from '../lib/api'
import { hasErrors, validateRequired } from '../lib/forms'

type Role = 'founder' | 'investor' | 'both'

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

const INVESTOR_STAGE_OPTIONS = [
  'Pre-Seed',
  'Seed',
  'Angel',
  'Series A',
  'Series B',
  'Series C',
  'Growth',
  'Late Stage',
  'Private Equity',
  'Pre-IPO',
]

const PRIMARY_INDUSTRY_OPTIONS = [
  'Technology',
  'Financial Services',
  'Healthcare & Life Sciences',
  'Agriculture & Food',
  'Consumer & Retail',
  'Transportation & Logistics',
  'Energy & Sustainability',
  'Manufacturing & Industrial',
  'Infrastructure & Real Estate',
  'Media & Entertainment',
  'Professional Services',
  'Education & Knowledge',
  'Rural & Traditional Industries',
  'Aerospace & Defense',
  'Telecommunications',
  'Hospitality, Tourism & Leisure',
]

const INDUSTRY_DETAIL_OPTIONS = [
  'Artificial Intelligence',
  'AI/ML',
  'Software',
  'Data Technology',
  'Blockchain',
  'IoT',
  'Robotics',
  'SpaceTech',
  'FinTech',
  'InsurTech',
  'WealthTech',
  'LendingTech',
  'RegTech',
  'HealthTech',
  'BioTech',
  'MedTech',
  'Telemedicine',
  'E-Commerce',
  'RetailTech',
  'FoodTech',
  'DairyTech',
  'Precision Farming',
  'FashionTech',
  'Logistics Tech',
  'MobilityTech',
  'AutomotiveTech',
  'CleanTech',
  'EnergyTech',
  'ClimateTech',
  'Waste Management',
  'ManufacturingTech',
  'Electronics Manufacturing',
  'Textile',
  'Chemical Manufacturing',
  'Packaging',
  'ConstructionTech',
  'PropTech',
  'Smart Cities',
  'WaterTech',
  'MediaTech',
  'AdTech',
  'Gaming',
  'EntertainmentTech',
  'HRTech',
  'LegalTech',
  'MarTech',
  'GovTech',
  'Research Platforms',
  'Skill Development',
  'Handloom',
  'Handicrafts',
  'Cottage Industries',
  'DefenseTech',
  'Satellite Systems',
  'TelecomTech',
  'Network Infrastructure',
  'HospitalityTech',
  'TravelTech',
  'LeisureTech',
]

const PRIMARY_SECONDARY_MAP: Record<string, string[]> = {
  Technology: ['Artificial Intelligence', 'AI/ML', 'SaaS', 'Cybersecurity', 'Blockchain', 'IoT', 'Robotics'],
  'Financial Services': ['FinTech', 'InsurTech', 'WealthTech', 'LendingTech', 'RegTech'],
  'Healthcare & Life Sciences': ['HealthTech', 'BioTech', 'MedTech', 'Telemedicine'],
  'Agriculture & Food': ['AgriTech', 'FoodTech', 'DairyTech', 'Precision Farming'],
  'Consumer & Retail': ['E-Commerce', 'RetailTech', 'FashionTech', 'Consumer Brands'],
  'Transportation & Logistics': ['Logistics Tech', 'MobilityTech', 'AutomotiveTech'],
  'Energy & Sustainability': ['CleanTech', 'EnergyTech', 'ClimateTech'],
  'Manufacturing & Industrial': ['ManufacturingTech', 'Electronics Manufacturing', 'Textile'],
  'Infrastructure & Real Estate': ['PropTech', 'ConstructionTech', 'Smart Cities'],
  'Media & Entertainment': ['MediaTech', 'Gaming', 'AdTech', 'EntertainmentTech'],
  'Professional Services': ['HRTech', 'LegalTech', 'MarTech', 'GovTech'],
  'Education & Knowledge': ['EdTech', 'Research Platforms', 'Skill Development'],
  'Rural & Traditional Industries': ['Handicrafts', 'Handloom', 'Cottage Industries'],
  'Aerospace & Defense': ['SpaceTech', 'DefenseTech', 'Satellite Systems'],
  Telecommunications: ['TelecomTech', 'Network Infrastructure'],
  'Hospitality, Tourism & Leisure': ['HospitalityTech', 'TravelTech', 'LeisureTech'],
}

const buildSecondaryOptions = (primaries: string[]) => {
  if (primaries.length === 0) {
    return [...INDUSTRY_DETAIL_OPTIONS]
  }
  const set = new Set<string>()
  primaries.forEach((primary) => {
    const options = PRIMARY_SECONDARY_MAP[primary] ?? []
    options.forEach((option) => set.add(option))
  })
  return set.size > 0 ? Array.from(set) : [...INDUSTRY_DETAIL_OPTIONS]
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { pushToast } = useToast()

  const [role, setRole] = useState<Role>((user?.role as Role) || 'founder')
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const avatarUploadInputRef = useRef<HTMLInputElement | null>(null)
  const stageDropdownRef = useRef<HTMLDivElement | null>(null)
  const primaryIndustryDropdownRef = useRef<HTMLDivElement | null>(null)
  const secondaryIndustryDropdownRef = useRef<HTMLDivElement | null>(null)
  const hasInitializedPrimarySelection = useRef(false)
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

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
  const [problemStatement, setProblemStatement] = useState('')
  const [solutionDescription, setSolutionDescription] = useState('')
  const [uniqueValueProp, setUniqueValueProp] = useState('')
  const [whyNow, setWhyNow] = useState('')
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
  const [stagesFocus, setStagesFocus] = useState<string[]>([])
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false)
  const [primaryIndustries, setPrimaryIndustries] = useState<string[]>(PRIMARY_INDUSTRY_OPTIONS)
  const [secondaryIndustries, setSecondaryIndustries] = useState<string[]>(() => buildSecondaryOptions(PRIMARY_INDUSTRY_OPTIONS))
  const [primaryIndustryDropdownOpen, setPrimaryIndustryDropdownOpen] = useState(false)
  const [secondaryIndustryDropdownOpen, setSecondaryIndustryDropdownOpen] = useState(false)
  const [geographyFocus, setGeographyFocus] = useState('')
  const [discoverabilityMode, setDiscoverabilityMode] = useState('closed')
  const [investorErrors, setInvestorErrors] = useState<InvestorErrors>({})
  const [savingInvestor, setSavingInvestor] = useState(false)

  const dropdownPanelStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: 'calc(100% + 0.35rem)',
      left: 0,
      width: '100%',
      minWidth: '22rem',
      zIndex: 25,
      maxHeight: '16rem',
      overflowY: 'auto',
      border: '1px solid hsl(var(--border))',
      boxShadow: '0 18px 30px rgba(15, 23, 42, 0.18)',
      borderRadius: '0.75rem',
      background: 'hsl(var(--card))',
      padding: '0.5rem',
    }),
    [],
  )

  const dropdownListStyle = useMemo<CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
    }),
    [],
  )

  const getOptionStyle = useCallback(
    (active: boolean): CSSProperties => ({
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.35rem 0.6rem',
      cursor: 'pointer',
      borderRadius: '0.5rem',
      background: active ? 'rgba(212, 171, 104, 0.12)' : 'transparent',
      border: active ? '1px solid hsl(var(--border))' : '1px solid transparent',
      color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
      fontSize: '0.875rem',
      transition: 'background 0.15s ease, border 0.15s ease, color 0.15s ease',
      width: '100%',
      minWidth: '19rem',
    }),
    [],
  )

  const toggleStageSelection = useCallback((stage: string) => {
    setStagesFocus((prev) => {
      if (prev.includes(stage)) {
        return prev.filter((item) => item !== stage)
      }
      const next = [...prev, stage]
      return INVESTOR_STAGE_OPTIONS.filter((option) => next.includes(option))
    })
  }, [])

  const getAllowedSecondary = useCallback((primaries: string[]) => buildSecondaryOptions(primaries), [])

  const togglePrimaryIndustrySelection = useCallback(
    (industry: string) => {
      setPrimaryIndustries((prev) => {
        let next: string[]
        if (prev.includes(industry)) {
          next = prev.filter((item) => item !== industry)
        } else {
          next = PRIMARY_INDUSTRY_OPTIONS.filter((option) => [...prev, industry].includes(option))
        }
        const allowed = getAllowedSecondary(next)
        setSecondaryIndustries((prevSecondary) => prevSecondary.filter((item) => allowed.includes(item)))
        return next
      })
    },
    [getAllowedSecondary],
  )

  const availableSecondaryIndustries = useMemo(() => getAllowedSecondary(primaryIndustries), [getAllowedSecondary, primaryIndustries])

  const toggleSecondaryIndustrySelection = useCallback(
    (industry: string) => {
      setSecondaryIndustries((prev) => {
        if (prev.includes(industry)) {
          return prev.filter((item) => item !== industry)
        }
        const combined = [...prev, industry]
        return availableSecondaryIndustries.filter((option) => combined.includes(option))
      })
    },
    [availableSecondaryIndustries],
  )
  const combinedIndustries = useMemo(
    () => [...primaryIndustries, ...secondaryIndustries],
    [primaryIndustries, secondaryIndustries],
  )

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
    if (status?.role) {
      setRole(status.role as Role)
    }
  }, [status?.role])

  useEffect(() => {
    setFullName(user?.full_name ?? '')
    setPhone(user?.phone ?? '')
    setDisplayName(user?.full_name ?? '')
  }, [user])

  useEffect(() => {
    if (hasInitializedPrimarySelection.current) {
      return
    }
    hasInitializedPrimarySelection.current = true
    setPrimaryIndustries((current) => (current.length > 0 ? current : [...PRIMARY_INDUSTRY_OPTIONS]))
  }, [])

  useEffect(() => {
    if (!stageDropdownOpen && !primaryIndustryDropdownOpen && !secondaryIndustryDropdownOpen) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (stageDropdownOpen && stageDropdownRef.current && !stageDropdownRef.current.contains(target)) {
        setStageDropdownOpen(false)
      }
      if (primaryIndustryDropdownOpen && primaryIndustryDropdownRef.current && !primaryIndustryDropdownRef.current.contains(target)) {
        setPrimaryIndustryDropdownOpen(false)
      }
      if (secondaryIndustryDropdownOpen && secondaryIndustryDropdownRef.current && !secondaryIndustryDropdownRef.current.contains(target)) {
        setSecondaryIndustryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [stageDropdownOpen, primaryIndustryDropdownOpen, secondaryIndustryDropdownOpen])

  // Build the visible steps list based on role
  const visibleSteps = useMemo(() => {
    const result: { id: string; label: string }[] = [{ id: 'profile', label: 'Profile' }]
    if (isFounder) {
      result.push({ id: 'founder', label: 'Founder' })
      result.push({ id: 'startup', label: 'Startup' })
    }
    if (isInvestor) {
      result.push({ id: 'investor', label: 'Investor' })
    }
    return result
  }, [isFounder, isInvestor])

  const setActiveStepById = useCallback((stepId: string) => {
    const index = visibleSteps.findIndex((step) => step.id === stepId)
    if (index !== -1) {
      setActiveStep(index)
    }
  }, [visibleSteps])

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
        },
      })
      await refreshUser()
      pushToast('Profile updated', 'success')
      if (visibleSteps.some((step) => step.id === 'founder')) {
        setActiveStepById('founder')
      } else {
        setActiveStep((s) => Math.min(s + 1, visibleSteps.length - 1))
      }
    } catch {
      setProfileErrors({ form: 'Unable to update profile. Please try again.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAvatarUpload = async (file?: File | null) => {
    if (!file) return
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await uploadRequest('/upload/profile-picture/', formData)
      await refreshUser()
      pushToast('Avatar uploaded', 'success')
    } catch {
      pushToast('Unable to upload avatar. Please try again.', 'error')
    } finally {
      setUploadingAvatar(false)
      if (avatarUploadInputRef.current) {
        avatarUploadInputRef.current.value = ''
      }
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
          problem_statement: problemStatement || undefined,
          solution_description: solutionDescription || undefined,
          unique_value_proposition: uniqueValueProp || undefined,
          why_now: whyNow || undefined,
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
      stages_focus: stagesFocus.join(','),
      industries_focus: combinedIndustries.join(','),
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
          stages_focus: stagesFocus,
          industries_focus: combinedIndustries,
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
      case 'profile':
        return (
          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              Profile basics
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
                <FormField label="Avatar (upload only)">
                  <div className="flex gap-3 items-center">
                    <button
                      type="button"
                      className="btn ghost flex-1"
                      disabled={uploadingAvatar}
                      onClick={() => avatarUploadInputRef.current?.click()}
                    >
                      {uploadingAvatar ? 'Uploading…' : 'Choose image'}
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      JPG or PNG, up to 5MB.
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={avatarUploadInputRef}
                    className="sr-only"
                    onChange={(event) => handleAvatarUpload(event.target.files?.[0])}
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
              Founder profile
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
                <div className="form-group" style={{ minWidth: '22rem' }}>
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
              Startup details
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
              Investor profile & preferences
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
              <div className="form-group">
                <FormField label="Stages focus" error={investorErrors.stages_focus}>
                  <div ref={stageDropdownRef} className="relative" style={{ minWidth: '22rem', maxWidth: '100%' }}>
                    <button
                      type="button"
                      className="input flex items-center justify-between gap-2"
                      onClick={() => setStageDropdownOpen((open) => !open)}
                      aria-haspopup="listbox"
                      aria-expanded={stageDropdownOpen}
                      data-testid="investor-stage-select"
                    >
                      {stagesFocus.length > 0 ? (
                        <div
                          className="flex gap-1 items-center"
                          style={{
                            minHeight: '1.25rem',
                            flexWrap: 'wrap',
                            maxHeight: '4rem',
                            overflowY: 'auto',
                          }}
                        >
                          {stagesFocus.map((stage) => (
                            <span key={stage} className="badge" style={{ whiteSpace: 'nowrap' }}>
                              {stage}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Choose your stages</span>
                      )}
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${stageDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {stageDropdownOpen && (
                      <div className="card" style={dropdownPanelStyle} role="listbox" aria-multiselectable="true">
                        <div style={dropdownListStyle}>
                          {INVESTOR_STAGE_OPTIONS.map((stage) => {
                            const checked = stagesFocus.includes(stage)
                            return (
                              <label key={stage} style={getOptionStyle(checked)}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleStageSelection(stage)}
                                  style={{ accentColor: 'var(--gold)' }}
                                />
                                <span>{stage}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </FormField>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <FormField label="Primary industry focus" error={investorErrors.industries_focus}>
                    <div ref={primaryIndustryDropdownRef} className="relative" style={{ minWidth: '16rem', maxWidth: '20rem', width: '100%' }}>
                      <button
                        type="button"
                        className="input flex items-center justify-between gap-2"
                        onClick={() => setPrimaryIndustryDropdownOpen((open) => !open)}
                        aria-haspopup="listbox"
                        aria-expanded={primaryIndustryDropdownOpen}
                        data-testid="investor-primary-industry-select"
                      >
                        {primaryIndustries.length > 0 ? (
                          <div
                            className="flex gap-1 items-center"
                            style={{
                            minHeight: '1.25rem',
                            flexWrap: 'wrap',
                            maxHeight: '4rem',
                            overflowY: 'auto',
                          }}
                          >
                            {primaryIndustries.map((industry) => (
                              <span key={industry} className="badge" style={{ whiteSpace: 'nowrap' }}>
                                {industry}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Choose primary focus</span>
                        )}
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${primaryIndustryDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {primaryIndustryDropdownOpen && (
                        <div className="card" style={dropdownPanelStyle} role="listbox" aria-multiselectable="true">
                          <div style={dropdownListStyle}>
                            {PRIMARY_INDUSTRY_OPTIONS.map((industry) => {
                              const checked = primaryIndustries.includes(industry)
                              return (
                                <label key={industry} style={getOptionStyle(checked)}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePrimaryIndustrySelection(industry)}
                                    style={{ accentColor: 'var(--gold)' }}
                                  />
                                  <span>{industry}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </FormField>
                </div>
                <div className="form-group">
                  <FormField label="Industry focus" error={investorErrors.industries_focus}>
                    <div ref={secondaryIndustryDropdownRef} className="relative" style={{ minWidth: '16rem', maxWidth: '32rem', width: '100%' }}>
                      <button
                        type="button"
                        className="input flex items-center justify-between gap-2"
                        onClick={() => setSecondaryIndustryDropdownOpen((open) => !open)}
                        aria-haspopup="listbox"
                        aria-expanded={secondaryIndustryDropdownOpen}
                        data-testid="investor-industry-select"
                      >
                        {secondaryIndustries.length > 0 ? (
                          <div
                            className="flex gap-1 items-center"
                            style={{
                              minHeight: '1.25rem',
                              flexWrap: 'wrap',
                              maxHeight: '4.5rem',
                              overflowY: 'auto',
                            }}
                          >
                            {secondaryIndustries.map((industry) => (
                              <span key={industry} className="badge" style={{ whiteSpace: 'nowrap' }}>
                                {industry}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Choose industries</span>
                        )}
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${secondaryIndustryDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {secondaryIndustryDropdownOpen && (
                        <div className="card" style={dropdownPanelStyle} role="listbox" aria-multiselectable="true">
                          <div style={dropdownListStyle}>
                            {availableSecondaryIndustries.map((industry) => {
                              const checked = secondaryIndustries.includes(industry)
                              return (
                                <label key={industry} style={getOptionStyle(checked)}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSecondaryIndustrySelection(industry)}
                                    style={{ accentColor: 'var(--gold)' }}
                                  />
                                  <span>{industry}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
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
