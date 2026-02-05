export type PublicUser = {
  id: string
  full_name: string
  avatar_url?: string | null
  picture?: string | null
  role?: string
  league?: string
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
  is_public?: boolean
  created_at?: string
  updated_at?: string
}
