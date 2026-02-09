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

export function SettingsPage() {
  const { user } = useAuth()
  const { pushToast } = useToast()

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

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your account preferences and integrations.</p>
        </div>
      </header>

      {/* Account Info */}
      <div className="content-card">
        <div className="settings-section-header">
          <Shield size={18} strokeWidth={1.5} />
          <h2>Account</h2>
        </div>
        <div className="settings-info-grid">
          <div className="settings-info-row">
            <span className="settings-info-label">Email</span>
            <span className="settings-info-value">{user?.email}</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Email verified</span>
            <span className="settings-info-value">
              {user?.email_verified ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Status</span>
            <span className="settings-info-value capitalize">{user?.status ?? 'Active'}</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Role</span>
            <span className="settings-info-value capitalize">{user?.role ?? 'Member'}</span>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="content-card">
        <div className="settings-section-header">
          <Bell size={18} strokeWidth={1.5} />
          <h2>Notifications</h2>
        </div>

        {loadingPrefs ? (
          <div className="page-loader">Loading preferences…</div>
        ) : (
          <>
            <div className="settings-toggle-list">
              <label className="settings-toggle-row" data-testid="toggle-email-notifications">
                <div>
                  <span className="settings-toggle-label">Email notifications</span>
                  <span className="settings-toggle-desc">Receive important updates via email</span>
                </div>
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={prefs.email_notifications ?? true}
                  onChange={() => togglePref('email_notifications')}
                />
              </label>
              <label className="settings-toggle-row" data-testid="toggle-push-notifications">
                <div>
                  <span className="settings-toggle-label">Push notifications</span>
                  <span className="settings-toggle-desc">Browser and mobile push alerts</span>
                </div>
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={prefs.push_notifications ?? true}
                  onChange={() => togglePref('push_notifications')}
                />
              </label>
              <label className="settings-toggle-row" data-testid="toggle-chat-notifications">
                <div>
                  <span className="settings-toggle-label">Chat notifications</span>
                  <span className="settings-toggle-desc">Alerts for new messages and calls</span>
                </div>
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={prefs.chat_notifications ?? true}
                  onChange={() => togglePref('chat_notifications')}
                />
              </label>
              <label className="settings-toggle-row" data-testid="toggle-marketing-emails">
                <div>
                  <span className="settings-toggle-label">Marketing emails</span>
                  <span className="settings-toggle-desc">Product updates and newsletters</span>
                </div>
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={prefs.marketing_emails ?? false}
                  onChange={() => togglePref('marketing_emails')}
                />
              </label>
            </div>

            <div className="settings-save-row">
              <button
                className="btn primary"
                type="button"
                data-testid="save-preferences"
                disabled={savingPrefs}
                onClick={() => void handleSavePrefs()}
              >
                {savingPrefs ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save preferences
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Connected Integrations */}
      <div className="content-card">
        <div className="settings-section-header">
          <Link2 size={18} strokeWidth={1.5} />
          <h2>Connected accounts</h2>
        </div>

        {loadingAccounts ? (
          <div className="page-loader">Loading integrations…</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Unplug className="w-8 h-8" />
            </div>
            <h3>No connected accounts</h3>
            <p>Connect external platforms to extend your FoundersLib experience.</p>
          </div>
        ) : (
          <div className="settings-accounts-list">
            {accounts.map((account) => (
              <div key={account.id} className="settings-account-row">
                <div className="settings-account-info">
                  <span className="settings-account-platform">
                    {account.display_name ?? PLATFORM_LABELS[account.platform] ?? account.platform}
                  </span>
                  {account.external_email && (
                    <span className="settings-account-user">{account.external_email}</span>
                  )}
                  {account.error_message && (
                    <span className="settings-account-error">{account.error_message}</span>
                  )}
                </div>
                <div className="settings-account-actions">
                  {account.is_active === false && (
                    <span className="settings-account-badge inactive">Inactive</span>
                  )}
                  <button
                    className="btn ghost"
                    type="button"
                    data-testid={`disconnect-${account.platform}`}
                    disabled={disconnecting === account.id}
                    onClick={() => void handleDisconnect(account.id)}
                  >
                    {disconnecting === account.id ? (
                      <Loader2 size={14} className="animate-spin" />
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

      {/* Available Platforms to Connect */}
      <div className="content-card">
        <div className="settings-section-header">
          <Plus size={18} strokeWidth={1.5} />
          <h2>Connect a platform</h2>
        </div>

        {loadingAvailable ? (
          <div className="page-loader">Loading platforms…</div>
        ) : unconnectedPlatforms.length === 0 && available.length > 0 ? (
          <p className="billing-muted">All available platforms are already connected.</p>
        ) : unconnectedPlatforms.length === 0 ? (
          <p className="billing-muted">No integrations are available at this time.</p>
        ) : (
          <div className="settings-platforms-grid">
            {unconnectedPlatforms.map((integration) => {
              const isTokenBased = TOKEN_BASED_PLATFORMS.has(integration.platform)
              const isQrBased = QR_BASED_PLATFORMS.has(integration.platform)
              return (
                <div key={integration.platform} className="settings-platform-card">
                  <div className="settings-platform-info">
                    <span className="settings-platform-name">
                      {integration.display_name ?? PLATFORM_LABELS[integration.platform] ?? integration.platform}
                    </span>
                    {isTokenBased && (
                      <span className="settings-platform-auth-hint">Requires API token</span>
                    )}
                    {isQrBased && (
                      <span className="settings-platform-auth-hint">Requires QR code scan</span>
                    )}
                    <div className="settings-platform-caps">
                      {integration.supports_threads && <span className="settings-cap-badge">Threads</span>}
                      {integration.supports_reactions && <span className="settings-cap-badge">Reactions</span>}
                      {integration.supports_typing && <span className="settings-cap-badge">Typing</span>}
                      {integration.supports_read_receipts && <span className="settings-cap-badge">Read receipts</span>}
                    </div>
                  </div>
                  <button
                    className="btn primary"
                    type="button"
                    data-testid={`connect-${integration.platform}`}
                    disabled={connecting !== null}
                    onClick={() => void handleConnect(integration.platform)}
                  >
                    {connecting === integration.platform ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        {isTokenBased ? <Key size={14} /> : <Plus size={14} />}
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

      {/* Privacy */}
      <div className="content-card">
        <div className="settings-section-header">
          <Eye size={18} strokeWidth={1.5} />
          <h2>Privacy</h2>
        </div>
        <div className="settings-info-grid">
          <div className="settings-info-row">
            <span className="settings-info-label">Profile visibility</span>
            <span className="settings-info-value">Public</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Search indexing</span>
            <span className="settings-info-value">Enabled</span>
          </div>
        </div>
      </div>

      {/* Token Input Modal */}
      {tokenModal && (
        <div className="settings-modal-overlay" onClick={() => !submittingToken && setTokenModal(null)}>
          <div
            className="settings-modal content-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h2>Connect {tokenModal.label}</h2>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setTokenModal(null)}
                disabled={submittingToken}
              >
                <X size={18} />
              </button>
            </div>

            <p className="settings-modal-desc">
              {tokenModal.platform === 'telegram'
                ? 'Enter your Telegram Bot Token. You can get one by messaging @BotFather on Telegram.'
                : tokenModal.platform === 'whatsapp_business'
                  ? 'Enter your WhatsApp Business API credentials from the Meta Developer portal.'
                  : `Enter your ${tokenModal.label} API token to connect.`}
            </p>

            <form
              className="settings-modal-form"
              onSubmit={(e) => {
                e.preventDefault()
                void handleTokenSubmit()
              }}
            >
              <label className="profile-field">
                <span className="profile-field-label">
                  <Key size={14} strokeWidth={1.5} />
                  {tokenModal.platform === 'telegram' ? 'Bot Token' : 'Access Token'}
                </span>
                <input
                  ref={tokenInputRef}
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
              </label>

              {tokenModal.platform === 'whatsapp_business' && (
                <label className="profile-field">
                  <span className="profile-field-label">
                    <Shield size={14} strokeWidth={1.5} />
                    Phone Number ID
                  </span>
                  <input
                    type="text"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="e.g. 100234567890123"
                    data-testid="phone-number-id-input"
                    disabled={submittingToken}
                    autoComplete="off"
                  />
                </label>
              )}

              <div className="profile-edit-actions">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setTokenModal(null)}
                  disabled={submittingToken}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
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
                      <Loader2 size={14} className="animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
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
        <div className="settings-modal-overlay" onClick={() => { stopQrPolling(); setQrModal(false) }}>
          <div
            className="settings-modal content-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h2>Connect WhatsApp</h2>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => { stopQrPolling(); setQrModal(false) }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="qr-modal-body">
              {qrStatus === 'loading' && (
                <div className="qr-modal-loading">
                  <Loader2 size={32} className="animate-spin" />
                  <p>Generating QR code…</p>
                </div>
              )}

              {qrStatus === 'error' && (
                <div className="qr-modal-error">
                  <QrCode size={32} />
                  <p>{qrError ?? 'Something went wrong.'}</p>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => void openQrModal()}
                  >
                    Try again
                  </button>
                </div>
              )}

              {(qrStatus === 'pending' || qrStatus === 'scanned') && (
                <>
                  <div className="qr-modal-instructions">
                    <Smartphone size={18} strokeWidth={1.5} />
                    <div>
                      <p><strong>1.</strong> Open WhatsApp on your phone</p>
                      <p><strong>2.</strong> Go to Settings &gt; Linked Devices</p>
                      <p><strong>3.</strong> Tap "Link a Device" and scan this code</p>
                    </div>
                  </div>

                  <div className="qr-modal-code" data-testid="whatsapp-qr">
                    {qrCode ? (
                      <img
                        src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                        alt="WhatsApp QR Code"
                      />
                    ) : (
                      <div className="qr-modal-placeholder">
                        <QrCode size={64} />
                      </div>
                    )}
                  </div>

                  {qrStatus === 'scanned' && (
                    <div className="qr-modal-scanned">
                      <Loader2 size={16} className="animate-spin" />
                      <span>QR code scanned — finishing setup…</span>
                    </div>
                  )}

                  {qrStatus === 'pending' && (
                    <p className="qr-modal-hint">Waiting for scan…</p>
                  )}
                </>
              )}

              {qrStatus === 'connected' && (
                <div className="qr-modal-success">
                  <div className="qr-modal-success-icon">✓</div>
                  <p>WhatsApp connected successfully!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
