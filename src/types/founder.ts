export type PublicUser = {
  id: string
  full_name: string
  avatar_url?: string | null
  avatar?: string | null
  picture?: string | null
  background_image?: string | null
  background_picture?: string | null
  role?: string
  league?: string
}

export type FounderStartupSummary = {
  id: string
  slug: string
  name: string
  tagline?: string
  industry?: string
  stage?: string | null
  headquarters_city?: string
}

export type FounderProfile = {
  id: string
  user: PublicUser
  headline: string
  bio?: string
  location?: string
  linkedin_url?: string | null
  twitter_url?: string | null
  website_url?: string | null
  fundraising_status?: string
  current_stage?: string
  skills?: string[]
  profile_photo?: string | null
  is_public?: boolean
  /** Founder's visible startups — only included on detail endpoints, not lists. */
  startups?: FounderStartupSummary[]
  created_at?: string
  updated_at?: string
}
