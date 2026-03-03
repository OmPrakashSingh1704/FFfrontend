import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { NotificationItem } from '../types/notification'

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load notifications when opened
  useEffect(() => {
    if (!isOpen) return
    
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [listData, unreadData] = await Promise.all([
          apiRequest<NotificationItem[] | { results: NotificationItem[] }>('/notifications/?limit=5'),
          apiRequest<{ count: number } | { unread_count: number }>('/notifications/unread-count/'),
        ])
        if (!cancelled) {
          setItems(normalizeList(listData).slice(0, 5))
          const count = 'count' in unreadData ? unreadData.count : unreadData.unread_count
          setUnread(count ?? 0)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load notifications')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [isOpen])

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read/`, { method: 'POST' })
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, is_read: true } : item
      ))
      setUnread(prev => Math.max(0, prev - 1))
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="notification-dropdown" ref={dropdownRef}>
      <button 
        className="header-icon-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        data-testid="notification-dropdown-btn"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="notification-badge" data-testid="notification-badge">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel" data-testid="notification-panel">
          <header className="notification-panel-header">
            <h3>Notifications</h3>
            <button 
              className="notification-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="notification-panel-content">
            {loading && (
              <div className="notification-loading">Loading...</div>
            )}
            
            {error && (
              <div className="notification-error">{error}</div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="notification-empty">
                <Bell className="w-8 h-8" />
                <p>All caught up!</p>
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <div className="notification-list">
                {items.map(item => (
                  <div 
                    key={item.id} 
                    className={`notification-item ${item.is_read ? 'read' : 'unread'}`}
                    onClick={() => !item.is_read && handleMarkAsRead(item.id)}
                  >
                    <div className="notification-item-header">
                      <span className="notification-type">{item.notification_type ?? 'Update'}</span>
                      {!item.is_read && <span className="notification-dot" />}
                    </div>
                    <h4>{item.title ?? 'Notification'}</h4>
                    <p>{item.message ?? ''}</p>
                    {item.created_at && (
                      <span className="notification-time">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <footer className="notification-panel-footer">
            <Link 
              to="/app/notifications" 
              className="btn ghost"
              onClick={() => setIsOpen(false)}
            >
              View all notifications
            </Link>
          </footer>
        </div>
      )}
    </div>
  )
}
