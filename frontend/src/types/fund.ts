export type FundListItem = {
  id: string
  name: string
  slug?: string
  fund_type?: string | null
  opportunity_type?: string | null
  organization?: string | null
  logo_url?: string | null
  stages?: string[]
  industries?: string[]
  min_ticket_size?: number | null
  max_ticket_size?: number | null
  headquarters_city?: string | null
  headquarters_country?: string | null
  is_featured?: boolean
  is_sponsored?: boolean
  deadline?: string | null
}

export type FundDetail = FundListItem & {
  description?: string | null
  website_url?: string | null
  geographies?: string[]
  aum?: number | null
  fund_size?: number | null
  vintage_year?: number | null
  application_link?: string | null
  application_process?: string | null
  funding_amount?: string | null
  eligibility?: string | null
  tags?: string[]
  is_active?: boolean
  posted_by?: {
    id: string
    display_name: string
    fund_name?: string | null
    is_verified?: boolean
  } | null
  applicant_count?: number
  funded_count?: number
  is_saved?: boolean
  created_at?: string
  updated_at?: string
}
