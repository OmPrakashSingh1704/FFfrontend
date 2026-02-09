export type InvestorStats = {
  pending_intros: number
  accepted_intros: number
  declined_intros: number
  total_intros: number
  saved_startups: number
  portfolio_count: number
  is_verified: boolean
  discoverability_mode: string
}

export type InvestorProfile = {
  id: string
  user?: { id: string; full_name?: string; avatar_url?: string | null }
  display_name: string
  fund_name?: string | null
  investor_type?: string | null
  headline?: string | null
  bio?: string | null
  investment_thesis?: string | null
  location?: string | null
  check_size_min?: number | null
  check_size_max?: number | null
  stages_focus?: string[]
  industries_focus?: string[]
  geography_focus?: string[]
  linkedin_url?: string | null
  twitter_url?: string | null
  website_url?: string | null
  is_verified?: boolean
  discoverability_mode?: string | null
}
