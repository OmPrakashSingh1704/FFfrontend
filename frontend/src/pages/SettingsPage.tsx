import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  Bell,
  Link2,
  Shield,
  Eye,
  Loader2,
  Save,
  Unplug,
  Plus,
  X,
  Key,
  QrCode,
  Smartphone,
} from 'lucide-react'

type NotificationPreferences = {
  email_notifications?: boolean
  push_notifications?: boolean
  chat_notifications?: boolean
  marketing_emails?: boolean
}

type ConnectedAccount = {
  id: string
  platform: string
  display_name?: string
  external_email?: string
  is_active?: boolean
  last_sync_at?: string | null
  error_message?: string | null
  created_at?: string
}

type AvailableIntegration = {
  platform: string
  display_name: string
  supports_threads?: boolean
  supports_reactions?: boolean
  supports_typing?: boolean
  supports_read_receipts?: boolean
}

const PLATFORM_LABELS: Record<string, string> = {
  slack: 'Slack',
  gmail: 'Gmail',
  teams: 'Microsoft Teams',
  discord: 'Discord',
  whatsapp_web: 'WhatsApp',
  whatsapp_business: 'WhatsApp Business',
  telegram: 'Telegram',
}

// Platforms that require a bot token / API key instead of OAuth
const TOKEN_BASED_PLATFORMS = new Set(['telegram', 'whatsapp_business'])

// Platforms that use QR code scanning (not yet supported in frontend)
const QR_BASED_PLATFORMS = new Set(['whatsapp_web'])

type TabKey = 'account' | 'notifications' | 'integrations' | 'privacy'

const TABS: { key: TabKey; label: string; icon: typeof Shield }[] = [
  { key: 'account', label: 'Account', icon: Shield },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'integrations', label: 'Integrations', icon: Link2 },
  { key: 'privacy', label: 'Privacy', icon: Eye },
]

export function SettingsPage() {
  const { user } = useAuth()
  const { pushToast } = useToast()

  const [activeTab, setActiveTab] = useState<TabKey>('account')

  // Notification preferences
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    email_notifications: true,
    push_notifications: true,
    chat_notifications: true,
    marketing_emails: false,
  })
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Connected accounts
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  // Available integrations
  const [available, setAvailable] = useState<AvailableIntegration[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)

  // Token input modal
  const [tokenModal, setTokenModal] = useState<{ platform: string; label: string } | null>(null)
  const [tokenValue, setTokenValue] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [submittingToken, setSubmittingToken] = useState(false)
  const tokenInputRef = useRef<HTMLInputElement | null>(null)

  // QR code modal
  const [qrModal, setQrModal] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<string>('loading')
  const [qrError, setQrError] = useState<string | null>(null)
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadPrefs = async () => {
      setLoadingPrefs(true)
      try {
        const data = await apiRequest<NotificationPreferences>('/notifications/preferences/')
        if (!cancelled) setPrefs(data)
      } catch {
        // Use defaults
      } finally {
        if (!cancelled) setLoadingPrefs(false)
      }
    }

    const loadAccounts = async () => {
      setLoadingAccounts(true)
      try {
        const data = await apiRequest<{ accounts: ConnectedAccount[] }>('/integrations/accounts/')
        if (!cancelled) {
          setAccounts(data.accounts ?? [])
        }
      } catch {
        if (!cancelled) setAccounts([])
      } finally {
        if (!cancelled) setLoadingAccounts(false)
      }
    }

    const loadAvailable = async () => {
      setLoadingAvailable(true)
      try {
        const data = await apiRequest<{ integrations: AvailableIntegration[] }>('/integrations/')
        if (!cancelled) {
          setAvailable(data.integrations ?? [])
        }
      } catch {
        if (!cancelled) setAvailable([])
      } finally {
        if (!cancelled) setLoadingAvailable(false)
      }
    }

    void loadPrefs()
    void loadAccounts()
    void loadAvailable()
    return () => { cancelled = true }
  }, [])

  // Focus token input when modal opens
  useEffect(() => {
    if (tokenModal) {
      setTimeout(() => tokenInputRef.current?.focus(), 100)
    }
  }, [tokenModal])

  // Cleanup QR polling on unmount or modal close
  const stopQrPolling = useCallback(() => {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current)
      qrPollRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!qrModal) stopQrPolling()
    return stopQrPolling
  }, [qrModal, stopQrPolling])

  const openQrModal = async () => {
    setQrModal(true)
    setQrCode(null)
    setQrStatus('loading')
    setQrError(null)
    stopQrPolling()

    try {
      const data = await apiRequest<{
        session_id: string
        qr_code?: string
        qr_data?: string
        status?: string
        expires_in?: number
      }>('/integrations/whatsapp/qr/')

      setQrCode(data.qr_code ?? null)
      setQrStatus(data.status ?? 'pending')

      // Start polling for scan status
      qrPollRef.current = setInterval(() => {
        void pollQrStatus(data.session_id)
      }, 3000)
    } catch {
      setQrStatus('error')
      setQrError('Failed to generate QR code. Make sure the WhatsApp bridge is running.')
    }
  }

  const pollQrStatus = async (sessionId: string) => {
    try {
      const data = await apiRequest<{
        status: string
        account_id?: string
        phone_number?: string
        name?: string
        error?: string
      }>('/integrations/whatsapp/qr/', {
        method: 'POST',
        body: { session_id: sessionId },
      })

      if (data.status === 'connected') {
        stopQrPolling()
        setQrStatus('connected')
        if (data.account_id) {
          setAccounts((prev) => [
            ...prev,
            {
              id: data.account_id!,
              platform: 'whatsapp_web',
              display_name: data.name ?? 'WhatsApp',
              is_active: true,
            },
          ])
        }
        pushToast('WhatsApp connected successfully', 'success')
        setTimeout(() => setQrModal(false), 1500)
      } else if (data.status === 'scanned') {
        setQrStatus('scanned')
      } else if (data.error) {
        stopQrPolling()
        setQrStatus('error')
        setQrError(data.error)
      }
    } catch {
      // Keep polling on transient errors
    }
  }

  const handleSavePrefs = async () => {
    setSavingPrefs(true)
    try {
      await apiRequest('/notifications/preferences/', {
        method: 'PATCH',
        body: prefs,
      })
      pushToast('Preferences saved', 'success')
    } catch {
      pushToast('Failed to save preferences', 'error')
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleConnect = async (platform: string) => {
    const label = PLATFORM_LABELS[platform] ?? platform

    // QR-based platforms: open QR code modal
    if (QR_BASED_PLATFORMS.has(platform)) {
      void openQrModal()
      return
    }

    // Token-based platforms: show input modal instead of OAuth redirect
    if (TOKEN_BASED_PLATFORMS.has(platform)) {
      setTokenValue('')
      setPhoneNumberId('')
      setTokenModal({ platform, label })
      return
    }

    // OAuth-based platforms: redirect to auth URL
    setConnecting(platform)
    try {
      const data = await apiRequest<{ auth_url: string }>(
        `/integrations/${platform}/connect/`,
        { method: 'POST' },
      )
      if (data.auth_url) {
        window.location.href = data.auth_url
      }
    } catch (err: unknown) {
      const detail = (err as { details?: { error?: string } })?.details?.error
      pushToast(detail ?? `Failed to connect ${label}`, 'error')
      setConnecting(null)
    }
  }

  const handleTokenSubmit = async () => {
    if (!tokenModal || !tokenValue.trim()) return

    // WhatsApp Business requires both token and phone number ID
    const isWaBusiness = tokenModal.platform === 'whatsapp_business'
    if (isWaBusiness && !phoneNumberId.trim()) return

    // WhatsApp Business expects "token:phone_number_id" format
    const token = isWaBusiness
      ? `${tokenValue.trim()}:${phoneNumberId.trim()}`
      : tokenValue.trim()

    setSubmittingToken(true)
    try {
      const data = await apiRequest<{ status: string; account_id: string; display_name?: string; platform: string }>(
        `/integrations/${tokenModal.platform}/token-connect/`,
        { method: 'POST', body: { token } },
      )
      setAccounts((prev) => [
        ...prev,
        {
          id: data.account_id,
          platform: data.platform,
          display_name: data.display_name,
          is_active: true,
        },
      ])
      pushToast(`${tokenModal.label} connected successfully`, 'success')
      setTokenModal(null)
      setTokenValue('')
      setPhoneNumberId('')
    } catch {
      pushToast(`Failed to connect ${tokenModal.label}`, 'error')
    } finally {
      setSubmittingToken(false)
    }
  }

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId)
    try {
      await apiRequest(`/integrations/accounts/${accountId}/disconnect/`, { method: 'POST' })
      setAccounts((prev) => prev.filter((a) => a.id !== accountId))
      pushToast('Account disconnected', 'success')
    } catch {
      pushToast('Failed to disconnect account', 'error')
    } finally {
      setDisconnecting(null)
    }
  }

  const togglePref = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Platforms the user hasn't connected yet
  const connectedPlatforms = new Set(accounts.map((a) => a.platform))
  const unconnectedPlatforms = available.filter((p) => !connectedPlatforms.has(p.platform))

  const notifItems: { key: keyof NotificationPreferences; label: string; desc: string; testid: string }[] = [
    { key: 'email_notifications', label: 'Email notifications', desc: 'Receive important updates via email', testid: 'toggle-email-notifications' },
    { key: 'push_notifications', label: 'Push notifications', desc: 'Browser and mobile push alerts', testid: 'toggle-push-notifications' },
    { key: 'chat_notifications', label: 'Chat notifications', desc: 'Alerts for new messages and calls', testid: 'toggle-chat-notifications' },
    { key: 'marketing_emails', label: 'Marketing emails', desc: 'Product updates and newsletters', testid: 'toggle-marketing-emails' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">Manage your account preferences and integrations</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            type="button"
          >
            <t.icon size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== Account Tab ===== */}
      {activeTab === 'account' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Account Information</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="list-item" style={{ cursor: 'default' }}>
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Email</span>
              <span style={{ fontSize: '0.875rem' }}>{user?.email}</span>
            </div>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="list-item" style={{ cursor: 'default' }}>
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Email verified</span>
              <span className={`badge ${user?.email_verified ? 'success' : 'warning'}`}>
                {user?.email_verified ? 'Yes' : 'No'}
              </span>
            </div>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="list-item" style={{ cursor: 'default' }}>
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Status</span>
              <span className="badge success" style={{ textTransform: 'capitalize' }}>{user?.status ?? 'Active'}</span>
            </div>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="list-item" style={{ cursor: 'default' }}>
              <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Role</span>
              <span className="badge info" style={{ textTransform: 'capitalize' }}>{user?.role ?? 'Member'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== Notifications Tab ===== */}
      {activeTab === 'notifications' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Notification Preferences</span>
          </div>

          {loadingPrefs ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span className="empty-description">Loading preferences...</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {notifItems.map((item) => {
                  const isOn = prefs[item.key] ?? false
                  return (
                    <div
                      key={item.key}
                      className="list-item"
                      data-testid={item.testid}
                      onClick={() => togglePref(item.key)}
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div>
                        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>{item.label}</span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{item.desc}</span>
                      </div>
                      <div
                        className={`toggle-switch${isOn ? ' active' : ''}`}
                        role="switch"
                        aria-checked={isOn}
                      >
                        <span className="toggle-dot" />
                      </div>
                    </div>
                  )
                })}
              </div>

              <hr className="divider" />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn-sm primary"
                  type="button"
                  data-testid="save-preferences"
                  disabled={savingPrefs}
                  onClick={() => void handleSavePrefs()}
                >
                  {savingPrefs ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={12} />
                      Save preferences
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== Integrations Tab ===== */}
      {activeTab === 'integrations' && (
        <>
          {/* Connected Accounts */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <span className="card-title">Connected Accounts</span>
            </div>

            {loadingAccounts ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <span className="empty-description">Loading integrations...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <div className="empty-icon"><Unplug size={24} /></div>
                <span className="empty-title">No connected accounts</span>
                <span className="empty-description">Connect external platforms to extend your FoundersLib experience.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {accounts.map((account) => (
                  <div key={account.id} className="list-item" style={{ cursor: 'default', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>
                        {account.display_name ?? PLATFORM_LABELS[account.platform] ?? account.platform}
                      </span>
                      {account.external_email && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{account.external_email}</span>
                      )}
                      {account.error_message && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#ef4444' }}>{account.error_message}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {account.is_active === false && (
                        <span className="badge warning">Inactive</span>
                      )}
                      <button
                        className="btn-sm ghost"
                        type="button"
                        data-testid={`disconnect-${account.platform}`}
                        disabled={disconnecting === account.id}
                        onClick={() => void handleDisconnect(account.id)}
                      >
                        {disconnecting === account.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          'Disconnect'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Platforms */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Connect a Platform</span>
            </div>

            {loadingAvailable ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <span className="empty-description">Loading platforms...</span>
              </div>
            ) : unconnectedPlatforms.length === 0 && available.length > 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '1rem 0' }}>
                All available platforms are already connected.
              </p>
            ) : unconnectedPlatforms.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '1rem 0' }}>
                No integrations are available at this time.
              </p>
            ) : (
              <div className="grid-3">
                {unconnectedPlatforms.map((integration) => {
                  const isTokenBased = TOKEN_BASED_PLATFORMS.has(integration.platform)
                  const isQrBased = QR_BASED_PLATFORMS.has(integration.platform)
                  return (
                    <div key={integration.platform} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: 4 }}>
                          {integration.display_name ?? PLATFORM_LABELS[integration.platform] ?? integration.platform}
                        </span>
                        {isTokenBased && (
                          <span className="tag" style={{ marginBottom: 6 }}>Requires API token</span>
                        )}
                        {isQrBased && (
                          <span className="tag" style={{ marginBottom: 6 }}>Requires QR code scan</span>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {integration.supports_threads && <span className="badge">Threads</span>}
                          {integration.supports_reactions && <span className="badge">Reactions</span>}
                          {integration.supports_typing && <span className="badge">Typing</span>}
                          {integration.supports_read_receipts && <span className="badge">Read receipts</span>}
                        </div>
                      </div>
                      <button
                        className="btn-sm primary"
                        type="button"
                        data-testid={`connect-${integration.platform}`}
                        disabled={connecting !== null}
                        onClick={() => void handleConnect(integration.platform)}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {connecting === integration.platform ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            {isTokenBased ? <Key size={12} /> : <Plus size={12} />}
                            Connect
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== Privacy Tab ===== */}
      {activeTab === 'privacy' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Privacy Settings</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="list-item" style={{ justifyContent: 'space-between' }}>
              <div>
                <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>Profile visibility</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Control who can see your profile</span>
              </div>
              <div className="toggle-switch active" role="switch" aria-checked={true}>
                <span className="toggle-dot" />
              </div>
            </div>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="list-item" style={{ justifyContent: 'space-between' }}>
              <div>
                <span style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem' }}>Search indexing</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Allow your profile to appear in search results</span>
              </div>
              <div className="toggle-switch active" role="switch" aria-checked={true}>
                <span className="toggle-dot" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Input Modal */}
      {tokenModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => !submittingToken && setTokenModal(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, margin: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <span className="card-title">Connect {tokenModal.label}</span>
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => setTokenModal(null)}
                disabled={submittingToken}
                style={{ padding: '0.25rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>
              {tokenModal.platform === 'telegram'
                ? 'Enter your Telegram Bot Token. You can get one by messaging @BotFather on Telegram.'
                : tokenModal.platform === 'whatsapp_business'
                  ? 'Enter your WhatsApp Business API credentials from the Meta Developer portal.'
                  : `Enter your ${tokenModal.label} API token to connect.`}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleTokenSubmit()
              }}
            >
              <div className="form-group">
                <label>
                  <Key size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                  {tokenModal.platform === 'telegram' ? 'Bot Token' : 'Access Token'}
                </label>
                <input
                  ref={tokenInputRef}
                  className="input"
                  type="password"
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  placeholder={
                    tokenModal.platform === 'telegram'
                      ? '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
                      : 'Paste your access token here'
                  }
                  data-testid="token-input"
                  disabled={submittingToken}
                  autoComplete="off"
                />
              </div>

              {tokenModal.platform === 'whatsapp_business' && (
                <div className="form-group">
                  <label>
                    <Shield size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                    Phone Number ID
                  </label>
                  <input
                    className="input"
                    type="text"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="e.g. 100234567890123"
                    data-testid="phone-number-id-input"
                    disabled={submittingToken}
                    autoComplete="off"
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  className="btn-sm ghost"
                  type="button"
                  onClick={() => setTokenModal(null)}
                  disabled={submittingToken}
                >
                  Cancel
                </button>
                <button
                  className="btn-sm primary"
                  type="submit"
                  data-testid="submit-token"
                  disabled={
                    submittingToken ||
                    !tokenValue.trim() ||
                    (tokenModal.platform === 'whatsapp_business' && !phoneNumberId.trim())
                  }
                >
                  {submittingToken ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus size={12} />
                      Connect
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp QR Code Modal */}
      {qrModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => { stopQrPolling(); setQrModal(false) }}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 420, margin: '1rem', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <span className="card-title">Connect WhatsApp</span>
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => { stopQrPolling(); setQrModal(false) }}
                style={{ padding: '0.25rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1rem 0' }}>
              {qrStatus === 'loading' && (
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                  <span className="empty-description">Generating QR code...</span>
                </div>
              )}

              {qrStatus === 'error' && (
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <div className="empty-icon"><QrCode size={32} /></div>
                  <span className="empty-description">{qrError ?? 'Something went wrong.'}</span>
                  <button
                    className="btn-sm ghost"
                    type="button"
                    onClick={() => void openQrModal()}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Try again
                  </button>
                </div>
              )}

              {(qrStatus === 'pending' || qrStatus === 'scanned') && (
                <>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', textAlign: 'left', marginBottom: '1rem', padding: '0.75rem', background: 'hsl(var(--muted) / 0.5)', borderRadius: '0.5rem' }}>
                    <Smartphone size={18} strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0, color: 'var(--gold)' }} />
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      <p><strong>1.</strong> Open WhatsApp on your phone</p>
                      <p><strong>2.</strong> Go to Settings &gt; Linked Devices</p>
                      <p><strong>3.</strong> Tap "Link a Device" and scan this code</p>
                    </div>
                  </div>

                  <div data-testid="whatsapp-qr" style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                    {qrCode ? (
                      <img
                        src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                        alt="WhatsApp QR Code"
                        style={{ maxWidth: 200, borderRadius: '0.5rem' }}
                      />
                    ) : (
                      <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--muted))', borderRadius: '0.5rem' }}>
                        <QrCode size={64} style={{ color: 'hsl(var(--muted-foreground))' }} />
                      </div>
                    )}
                  </div>

                  {qrStatus === 'scanned' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--gold)' }}>
                      <Loader2 size={14} className="animate-spin" />
                      <span>QR code scanned -- finishing setup...</span>
                    </div>
                  )}

                  {qrStatus === 'pending' && (
                    <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Waiting for scan...</p>
                  )}
                </>
              )}

              {qrStatus === 'connected' && (
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontSize: '1.5rem', fontWeight: 700 }}>
                    &#10003;
                  </div>
                  <span className="empty-title">WhatsApp connected successfully!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
