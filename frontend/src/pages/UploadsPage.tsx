import { useEffect, useRef, useState } from 'react'
import { apiRequest, uploadRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { StartupListItem } from '../types/startup'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Upload, User, Image, Building2, Loader2 } from 'lucide-react'

type UploadTarget = 'profile-picture' | 'background-picture' | 'startup-logo'

export function UploadsPage() {
  const { refreshUser } = useAuth()
  const { pushToast } = useToast()
  const [startups, setStartups] = useState<StartupListItem[]>([])
  const [startupId, setStartupId] = useState('')
  const [loadingStartups, setLoadingStartups] = useState(true)

  const [uploading, setUploading] = useState<UploadTarget | null>(null)
  const profileInputRef = useRef<HTMLInputElement | null>(null)
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingStartups(true)
      try {
        const data = await apiRequest<StartupListItem[] | { results: StartupListItem[] }>('/founders/my-startups/')
        if (!cancelled) {
          const items = normalizeList(data)
          setStartups(items)
          setStartupId(items[0]?.id ?? '')
        }
      } catch {
        if (!cancelled) {
          setStartups([])
        }
      } finally {
        if (!cancelled) {
          setLoadingStartups(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleUpload = async (target: UploadTarget, file?: File | null) => {
    if (!file) return
    setUploading(target)
    try {
      const formData = new FormData()
      formData.append('file', file)

      let path = '/upload/profile-picture/'
      if (target === 'background-picture') {
        path = '/upload/background-picture/'
      }
      if (target === 'startup-logo') {
        if (!startupId) {
          pushToast('Select a startup first', 'warning')
          return
        }
        path = `/upload/startups/${startupId}/logo/`
      }

      await uploadRequest(path, formData)
      pushToast('Upload successful', 'success')
      if (target === 'profile-picture' || target === 'background-picture') {
        await refreshUser()
      }
    } catch {
      pushToast('Upload failed', 'error')
    } finally {
      setUploading(null)
    }
  }

  const dropZoneStyle: React.CSSProperties = {
    border: '2px dashed hsl(var(--border))',
    borderRadius: 12,
    padding: '28px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'border-color 200ms ease, background 200ms ease',
    background: 'transparent',
    marginBottom: 12,
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Uploads</h1>
          <p className="page-description">Manage profile images and startup logos.</p>
        </div>
      </div>

      <div className="grid-3">
        {/* Profile Picture */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={14} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              <span className="card-title">Profile Picture</span>
            </div>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginBottom: 14, lineHeight: 1.5 }}>
            Upload a square image for your avatar.
          </p>
          <div
            style={dropZoneStyle}
            onClick={() => profileInputRef.current?.click()}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--gold)'
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.04)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'hsl(var(--border))'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <Upload size={24} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
              Drag and drop or click to browse
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
              PNG, JPG up to 5MB
            </span>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleUpload('profile-picture', event.target.files?.[0])}
            disabled={uploading !== null}
            ref={profileInputRef}
            style={{ display: 'none' }}
          />
          <button
            className="btn-sm primary"
            type="button"
            onClick={() => profileInputRef.current?.click()}
            disabled={uploading !== null}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {uploading === 'profile-picture' ? (
              <>
                <Loader2 size={14} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={14} strokeWidth={1.5} />
                Choose image
              </>
            )}
          </button>
        </div>

        {/* Background Picture */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Image size={14} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              <span className="card-title">Background Picture</span>
            </div>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginBottom: 14, lineHeight: 1.5 }}>
            Upload a wide image for your profile cover.
          </p>
          <div
            style={dropZoneStyle}
            onClick={() => backgroundInputRef.current?.click()}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--gold)'
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.04)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'hsl(var(--border))'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <Upload size={24} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
              Drag and drop or click to browse
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
              PNG, JPG up to 5MB, 1200x400 recommended
            </span>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleUpload('background-picture', event.target.files?.[0])}
            disabled={uploading !== null}
            ref={backgroundInputRef}
            style={{ display: 'none' }}
          />
          <button
            className="btn-sm primary"
            type="button"
            onClick={() => backgroundInputRef.current?.click()}
            disabled={uploading !== null}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {uploading === 'background-picture' ? (
              <>
                <Loader2 size={14} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={14} strokeWidth={1.5} />
                Choose image
              </>
            )}
          </button>
        </div>

        {/* Startup Logo */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={14} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              <span className="card-title">Startup Logo</span>
            </div>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginBottom: 14, lineHeight: 1.5 }}>
            Upload a logo for one of your startups.
          </p>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <select
              className="select"
              value={startupId}
              onChange={(event) => setStartupId(event.target.value)}
              disabled={loadingStartups || uploading !== null}
            >
              {startups.length === 0 ? (
                <option value="">No startups available</option>
              ) : (
                startups.map((startup) => (
                  <option key={startup.id} value={startup.id}>
                    {startup.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div
            style={{
              ...dropZoneStyle,
              opacity: !startupId ? 0.5 : 1,
              pointerEvents: !startupId ? 'none' : 'auto',
            }}
            onClick={() => logoInputRef.current?.click()}
            onMouseEnter={(e) => {
              if (startupId) {
                e.currentTarget.style.borderColor = 'var(--gold)'
                e.currentTarget.style.background = 'rgba(249, 115, 22, 0.04)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'hsl(var(--border))'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <Upload size={24} strokeWidth={1.5} style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
              Drag and drop or click to browse
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
              PNG, SVG up to 2MB, square recommended
            </span>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleUpload('startup-logo', event.target.files?.[0])}
            disabled={uploading !== null || !startupId}
            ref={logoInputRef}
            style={{ display: 'none' }}
          />
          <button
            className="btn-sm primary"
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploading !== null || !startupId}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {uploading === 'startup-logo' ? (
              <>
                <Loader2 size={14} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={14} strokeWidth={1.5} />
                Choose logo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
