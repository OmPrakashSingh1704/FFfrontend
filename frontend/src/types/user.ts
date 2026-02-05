export type User = {
  id: string
  email: string
  full_name: string
  avatar_url?: string | null
  phone?: string | null
  role?: string
  league?: string
  credits?: number
  onboarding_completed?: boolean
}
