import { useEffect, useRef, useState } from 'react'
import { apiRequest, uploadRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { StartupListItem } from '../types/startup'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

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

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Uploads</h1>
          <p>Manage profile images and startup logos.</p>
        </div>
      </header>

      <div className="upload-grid">
        <div className="upload-card">
          <h3>Profile picture</h3>
          <p>Upload a square profile picture.</p>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleUpload('profile-picture', event.target.files?.[0])}
            disabled={uploading !== null}
            ref={profileInputRef}
          />
          <button
            className="btn ghost"
            type="button"
            onClick={() => profileInputRef.current?.click()}
            disabled={uploading !== null}
          >
            {uploading === 'profile-picture' ? 'Uploading...' : 'Choose an image'}
          </button>
        </div>

        <div className="upload-card">
          <h3>Background picture</h3>
          <p>Upload a wide image for your profile cover.</p>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleUpload('background-picture', event.target.files?.[0])}
            disabled={uploading !== null}
            ref={backgroundInputRef}
          />
          <button
            className="btn ghost"
            type="button"
            onClick={() => backgroundInputRef.current?.click()}
            disabled={uploading !== null}
          >
            {uploading === 'background-picture' ? 'Uploading...' : 'Choose an image'}
          </button>
        </div>

        <div className="upload-card">
          <h3>Startup logo</h3>
          <p>Upload a logo for one of your startups.</p>
          <select
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
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleUpload('startup-logo', event.target.files?.[0])}
            disabled={uploading !== null || !startupId}
            ref={logoInputRef}
          />
          <button
            className="btn ghost"
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploading !== null || !startupId}
          >
            {uploading === 'startup-logo' ? 'Uploading...' : 'Choose a logo'}
          </button>
        </div>
      </div>
    </section>
  )
}
