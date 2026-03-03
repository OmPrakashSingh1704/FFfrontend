import type { PublicUser } from './founder'

export type Respect = {
  id: string
  from_user: PublicUser
  to_user: PublicUser
  reason: string
  created_at: string
  expires_at: string
}

export type RespectReceived = {
  id: string
  from_user: PublicUser
  reason: string
  created_at: string
  expires_at: string
}

export type RespectGiven = {
  id: string
  to_user: PublicUser
  reason: string
  created_at: string
  expires_at: string
}
