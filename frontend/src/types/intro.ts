import type { PublicUser } from './founder'

export type InvestorProfilePublic = {
  id: string
  display_name: string
  fund_name?: string | null
  investor_type?: string | null
  headline?: string | null
  is_verified?: boolean
}

export type IntroRequest = {
  id: string
  founder_user: PublicUser
  investor_profile: InvestorProfilePublic
  startup: string
  startup_name: string
  startup_tagline: string
  startup_industry: string
  pitch_summary: string
  relevance_justification: string
  deck_url: string | null
  additional_notes: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  responded_at: string | null
  investor_response_message: string
  credits_spent: number
  created_at: string
  expires_at: string
}

export type IntroRequestCreate = {
  investor_profile_id: string
  startup_id: string
  pitch_summary: string
  relevance_justification: string
  deck_url?: string
  additional_notes?: string
}
