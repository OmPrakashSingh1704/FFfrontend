import { useEffect, useMemo } from 'react'
import { useToast } from '../context/ToastContext'
import { buildWsUrl } from '../lib/ws'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'

export function RealtimeBridge() {
  const { status, accessToken } = useAuth()
  const { pushToast } = useToast()

  const url = useMemo(() => {
    if (status !== 'authenticated') {
      return null
    }
    return buildWsUrl('/ws/chat/', accessToken)
  }, [status, accessToken])

  const { lastMessage } = useWebSocket(url, { reconnect: status === 'authenticated' })

  useEffect(() => {
    if (!lastMessage?.data) return
    try {
      const event = JSON.parse(lastMessage.data as string) as {
        type?: string
        data?: { title?: string; message?: string; notification_type?: string }
      }
      if (event.type !== 'notification') return
      const payload = event.data ?? {}
      const message = payload.message || payload.title || 'New notification'
      pushToast(message, payload.notification_type === 'error' ? 'error' : 'info')
    } catch {
      pushToast('New notification', 'info')
    }
  }, [lastMessage, pushToast])

  return null
}
