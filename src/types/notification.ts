export type NotificationItem = {
  id: string
  type?: string
  title?: string
  message?: string
  link?: string
  related_user?: { id: string; full_name?: string; avatar_url?: string } | null
  is_read?: boolean
  created_at?: string
}
