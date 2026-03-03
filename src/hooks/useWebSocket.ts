import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type WebSocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

type UseWebSocketOptions = {
  protocols?: string | string[]
  reconnect?: boolean
  reconnectInterval?: number
  onMessage?: (event: MessageEvent) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: () => void
}

export function useWebSocket(url: string | null, options: UseWebSocketOptions = {}) {
  const {
    protocols,
    reconnect = true,
    reconnectInterval = 2000,
    onMessage,
    onOpen,
    onClose,
    onError,
  } = options

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number | null>(null)
  const [status, setStatus] = useState<WebSocketStatus>(url ? 'connecting' : 'idle')
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null)

  const closeSocket = useCallback(() => {
    if (reconnectTimer.current) {
      window.clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }

    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!url) {
      closeSocket()
      setStatus('idle')
      return
    }

    let cancelled = false

    const connect = () => {
      if (cancelled) {
        return
      }

      setStatus('connecting')
      const socket = new WebSocket(url, protocols)
      socketRef.current = socket

      socket.onopen = () => {
        if (cancelled) return
        setStatus('open')
        onOpen?.()
      }

      socket.onmessage = (event) => {
        if (cancelled) return
        setLastMessage(event)
        onMessage?.(event)
      }

      socket.onerror = () => {
        if (cancelled) return
        setStatus('error')
        onError?.()
      }

      socket.onclose = () => {
        if (cancelled) return
        setStatus('closed')
        onClose?.()
        if (reconnect) {
          reconnectTimer.current = window.setTimeout(connect, reconnectInterval)
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      closeSocket()
    }
  }, [url, protocols, reconnect, reconnectInterval, onMessage, onOpen, onClose, onError, closeSocket])

  const send = useCallback((data: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(data)
    }
  }, [])

  const sendJson = useCallback(
    (payload: unknown) => {
      send(JSON.stringify(payload))
    },
    [send],
  )

  return useMemo(
    () => ({
      status,
      send,
      sendJson,
      lastMessage,
      socket: socketRef.current,
      close: closeSocket,
    }),
    [status, send, sendJson, lastMessage, closeSocket],
  )
}
