import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { useNotifications } from '../context/NotificationsContext'

/**
 * Bell + dropdown in the header.
 *
 * State lives in NotificationsContext: badge updates the instant the WS
 * pushes a new notification (via RealtimeBridge → pushRealtime). The
 * dropdown just renders what's in the context — no fetching-on-open logic
 * here anymore.
 *
 * Items are wrapped in <Link> when they have a `link` field, so clicking
 * navigates to the relevant page and marks the notification read. The
 * server-side link values are now /app/* prefixed correctly (see
 * notifications.services).
 */
export function NotificationDropdown() {
  const navigate = useNavigate()
  const { items, unreadCount, markRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
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

  const visibleItems = items.slice(0, 5)

  const handleItemClick = (id: string, link: string | undefined, wasUnread: boolean) => {
    if (wasUnread) void markRead(id)
    setIsOpen(false)
    if (link) navigate(link)
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
        {unreadCount > 0 && (
          <span className="notification-badge" data-testid="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
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
            {visibleItems.length === 0 ? (
              <div className="notification-empty">
                <Bell className="w-8 h-8" />
                <p>All caught up!</p>
              </div>
            ) : (
              <div className="notification-list">
                {visibleItems.map((item) => {
                  const isUnread = item.is_read === false
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`notification-item ${isUnread ? 'unread' : 'read'}`}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        cursor: item.link ? 'pointer' : 'default',
                      }}
                      onClick={() => handleItemClick(item.id, item.link, isUnread)}
                      data-testid={`notification-item-${item.id}`}
                    >
                      <div className="notification-item-header">
                        <span className="notification-type">{item.type ?? 'Update'}</span>
                        {isUnread && <span className="notification-dot" />}
                      </div>
                      <h4>{item.title ?? 'Notification'}</h4>
                      <p>{item.message ?? ''}</p>
                      {item.created_at && (
                        <span className="notification-time">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </button>
                  )
                })}
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
