import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Settings, HelpCircle, CreditCard, Bell, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { resolveMediaUrl } from '../lib/env'

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout } = useAuth()
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

  const handleLogout = () => {
    setIsOpen(false)
    void logout()
  }

  const avatarSrc = resolveMediaUrl(user?.picture) || resolveMediaUrl(user?.avatar_url)
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U'

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button
        className="profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile menu"
        data-testid="profile-dropdown-btn"
      >
        {avatarSrc ? (
          <img className="profile-avatar" src={avatarSrc} alt={user?.full_name ?? 'Profile'} />
        ) : (
          <span className="profile-avatar">{initials}</span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="profile-panel" data-testid="profile-panel">
          {/* User Info */}
          <div className="profile-info">
            {avatarSrc ? (
              <img className="profile-avatar-lg" src={avatarSrc} alt={user?.full_name ?? 'Profile'} />
            ) : (
              <span className="profile-avatar-lg">{initials}</span>
            )}
            <div className="profile-details">
              <strong>{user?.full_name || 'User'}</strong>
              <span>{user?.email || ''}</span>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="profile-menu">
            <Link 
              to="/app/profile" 
              className="profile-menu-item"
              onClick={() => setIsOpen(false)}
            >
              <User className="w-4 h-4" />
              My Profile
            </Link>
            <Link 
              to="/app/settings" 
              className="profile-menu-item"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <Link 
              to="/app/notifications" 
              className="profile-menu-item"
              onClick={() => setIsOpen(false)}
            >
              <Bell className="w-4 h-4" />
              Notifications
            </Link>
            <Link 
              to="/app/billing" 
              className="profile-menu-item"
              onClick={() => setIsOpen(false)}
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </Link>
            <Link
              to="/app/help"
              className="profile-menu-item"
              onClick={() => setIsOpen(false)}
            >
              <HelpCircle className="w-4 h-4" />
              Help & Support
            </Link>
          </nav>

          {/* Logout */}
          <div className="profile-footer">
            <button 
              type="button"
              className="profile-logout"
              onClick={handleLogout}
              data-testid="profile-logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
