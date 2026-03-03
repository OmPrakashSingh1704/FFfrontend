export type TrustStatus = {
  league: string
  credits: number
  intro_requests_this_month: number
  intro_limit: number
  remaining_intros: number
  cooldown_until: string | null
  is_in_cooldown: boolean
  cooldown_seconds_remaining: number
  current_threshold: number
  next_league: string | null
  next_league_threshold: number | null
  points_to_next_league: number | null
}
