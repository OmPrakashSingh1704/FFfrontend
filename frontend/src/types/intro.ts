export type IntroRequest = {
  id: string
  status?: string
  message?: string | null
  created_at?: string
  updated_at?: string
  requester_name?: string
  recipient_name?: string
}
