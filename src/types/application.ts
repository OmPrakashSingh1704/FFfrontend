export type ApplicationListItem = {
  id: string
  startup: string
  startup_name?: string
  fund: string
  fund_name?: string
  fund_logo?: string | null
  fund_application_link?: string | null
  status?: string
  applied_date?: string | null
  created_at?: string
  updated_at?: string
}

export type ApplicationDetail = {
  id: string
  startup: string
  startup_name?: string
  fund: string
  fund_name?: string
  // Opportunity URLs surfaced from the Fund row so the founder can re-open
  // the external application page from this detail view without re-finding
  // the fund. Null/undefined when the fund hasn't set these.
  fund_application_link?: string | null
  fund_website_url?: string | null
  fund_deadline?: string | null
  status?: string
  applied_date?: string | null
  notes?: string | null
  status_history?: Array<{
    id: string
    old_status?: string
    new_status?: string
    changed_by_name?: string
    notes?: string | null
    created_at?: string
  }>
  reminders?: Array<{
    id: string
    title: string
    description?: string | null
    due_date?: string
    status?: string
    created_at?: string
  }>
  created_at?: string
  updated_at?: string
}
