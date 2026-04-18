import type { PublicUser } from './founder'

export type ConnectionRequest = {
  id: string
  sender: PublicUser
  receiver: PublicUser
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  message: string
  created_at: string
  responded_at: string | null
  expires_at: string
}

export type SendConnectionRequest = {
  user_id: string
  message?: string
}
