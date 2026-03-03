export type User = {
  id: string
  email: string
  full_name: string
  avatar_url?: string | null
  picture?: string | null
  phone?: string | null
  role?: string
  league?: string
  credits?: number
  onboarding_completed?: boolean
  background_picture?: string | null
  created_at?: string
  subscription_tier?: string
  email_verified?: boolean
  status?: string
}
