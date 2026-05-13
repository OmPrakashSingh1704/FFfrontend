import { useEffect, useMemo } from 'react'
import { useToast } from '../context/ToastContext'
import { useNotifications } from '../context/NotificationsContext'
import { buildWsUrl } from '../lib/ws'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'

type RealtimePayload = {
  notification_id?: string
  type?: string
  title?: string
  message?: string
  link?: string | null
  created_at?: string
  related_user_id?: string | null
}

/**
 * Routes WS notification events from the chat consumer into:
 *  1. NotificationsContext — so the bell badge + dropdown list update live
 *     without the user having to click anything.
 *  2. A subtle toast — light "you've got a notification" surface for users
 *     not currently looking at the bell.
 *
 * The backend wraps every realtime notification (see
 * notifications.services.NotificationService._broadcast_notification) as
 * { type: "chat_notification" } at the channel-group level, then the chat
 * consumer forwards it to the client as { type: "notification", data: {...} }.
 */
export function RealtimeBridge() {
  const { status, accessToken } = useAuth()
  const { pushToast } = useToast()
  const { pushRealtime } = useNotifications()

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
        data?: RealtimePayload
      }
      if (event.type !== 'notification') return
      const payload = event.data ?? {}

      // Inject into the shared context so the dropdown + page see it
      // without re-fetching.
      if (payload.notification_id) {
        pushRealtime({
          id: payload.notification_id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          link: payload.link ?? undefined,
          created_at: payload.created_at,
          is_read: false,
        })
      }

      // Toast as a peripheral signal — kept short. The bell badge does the
      // real work of telling the user something's there.
      const message = payload.message || payload.title || 'New notification'
      pushToast(message, 'info')
    } catch {
      pushToast('New notification', 'info')
    }
  }, [lastMessage, pushToast, pushRealtime])

  return null
}
