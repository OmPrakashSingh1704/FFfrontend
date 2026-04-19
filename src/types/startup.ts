export type StartupListItem = {
  id: string
  name: string
  slug: string
  tagline?: string | null
  industry?: string | null
  current_stage?: string | null
  headquarters_city?: string | null
  headquarters_country?: string | null
  logo_url?: string | null
  logo?: string | null
  fundraising_status?: string | null
  revenue_range?: string | null
  is_public?: boolean
  verification_tier?: number
  profile_completeness_score?: number
  created_at?: string
}

export type StartupDetail = {
  id: string
  name: string
  slug: string
  tagline?: string | null
  description?: string | null
  website_url?: string | null
  linkedin_url?: string | null
  twitter_url?: string | null
  industry?: string | null
  sub_industries?: string[]
  business_model?: string | null
  headquarters_city?: string | null
  headquarters_country?: string | null
  operating_countries?: string[]
  current_stage?: string | null
  total_funding_raised?: number | null
  currency_code?: string | null
  metrics?: Record<string, unknown>
  is_active?: boolean
  is_public?: boolean
  pitch_summary?: string | null
  deck_url?: string | null
  logo_url?: string | null
  logo?: string | null
  verification_tier?: number
  profile_completeness_score?: number
  revenue_range?: string | null
  traction_metrics?: Record<string, unknown>
  fundraising_status?: string | null
  funding_raised?: string | null
  funding_required?: number | null
  hiring_status?: boolean | null
  founders_list?: Array<{
    id: string | null
    profile_id?: string | null
    founder_profile_id?: string | null
    user_id?: string | null
    user?: string | null
    full_name: string
    avatar_url?: string | null
  }>
  members?: Array<{
    id: string
    user: string
    user_email?: string
    user_name?: string
    role?: string
    title?: string
    is_primary_contact?: boolean
  }>
  documents?: Array<{
    id: string
    name?: string
    document_type?: string
    file?: string
    file_url?: string
    file_size?: number | null
    access_level?: string
    uploaded_by_name?: string
    created_at?: string
    updated_at?: string
  }>
  created_at?: string
  updated_at?: string
}
