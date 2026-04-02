import { useEffect, useRef, useState } from 'react'
import { MessageSquarePlus, X, Bug, Lightbulb, MessageCircle, Send, Loader2, Paperclip, FileImage, FileVideo } from 'lucide-react'
import { uploadRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'

/** Dispatch this event anywhere to programmatically open the feedback panel. */
export const FEEDBACK_OPEN_EVENT = 'ff:feedback:open'

type FeedbackType = 'bug' | 'feature' | 'general'

const TYPES: { value: FeedbackType; label: string; icon: typeof Bug }[] = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'feature', label: 'Feature', icon: Lightbulb },
  { value: 'general', label: 'General', icon: MessageCircle },
]

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime,video/webm'

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '0.8rem',
  borderRadius: 6,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--muted))',
  color: 'hsl(var(--foreground))',
  outline: 'none',
  boxSizing: 'border-box',
}

export function FeedbackWidget() {
  const { pushToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('general')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(FEEDBACK_OPEN_EVENT, handler)
    return () => window.removeEventListener(FEEDBACK_OPEN_EVENT, handler)
  }, [])

  const reset = () => {
    setType('general')
    setTitle('')
    setDescription('')
    setAttachment(null)
    setAttachError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    setOpen(false)
    reset()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAttachError(null)
    if (!file) { setAttachment(null); return }

    if (!ALLOWED_TYPES.has(file.type)) {
      setAttachError('Unsupported file type. Use images (PNG/JPG/GIF/WebP) or videos (MP4/MOV/WebM).')
      e.target.value = ''
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setAttachError(`File too large (${formatBytes(file.size)}). Max is 10 MB.`)
      e.target.value = ''
      return
    }
    setAttachment(file)
  }

  const removeAttachment = () => {
    setAttachment(null)
    setAttachError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    const formData = new FormData()
    formData.append('feedback_type', type)
    formData.append('title', title.trim())
    formData.append('description', description.trim())
    formData.append('page_url', window.location.pathname)
    if (attachment) formData.append('attachment', attachment)

    setSubmitting(true)
    try {
      await uploadRequest('/feedback/', formData)
      pushToast('Feedback submitted — thank you!', 'success')
      handleClose()
    } catch {
      pushToast('Failed to submit feedback. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const isVideo = attachment?.type.startsWith('video/')

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        data-testid="feedback-trigger"
        aria-label="Send feedback"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 1000,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--gold)',
          color: 'hsl(var(--background))',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.25)'
        }}
      >
        <MessageSquarePlus size={18} strokeWidth={1.5} />
      </button>

      {/* Modal backdrop + panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1001,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '1.5rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div
            className="card"
            style={{
              width: 320,
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Send Feedback</span>
              <button
                onClick={handleClose}
                data-testid="feedback-close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Type selector */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    data-testid={`feedback-type-${value}`}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      borderRadius: 6,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      border: `1px solid ${type === value ? 'var(--gold)' : 'hsl(var(--border))'}`,
                      background: type === value ? 'var(--gold)' : 'transparent',
                      color: type === value ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      transition: 'all 0.12s',
                    }}
                  >
                    <Icon size={11} strokeWidth={1.5} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Title (optional) */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                maxLength={150}
                data-testid="feedback-title"
                style={inputStyle}
              />

              {/* Description */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue or your idea..."
                required
                rows={4}
                maxLength={2000}
                data-testid="feedback-description"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 90, fontFamily: 'inherit' }}
              />

              {/* Attachment */}
              <div>
                {attachment ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--muted))',
                    fontSize: '0.75rem',
                  }}>
                    {isVideo
                      ? <FileVideo size={13} style={{ flexShrink: 0, color: 'hsl(var(--muted-foreground))' }} />
                      : <FileImage size={13} style={{ flexShrink: 0, color: 'hsl(var(--muted-foreground))' }} />
                    }
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachment.name}
                    </span>
                    <span style={{ flexShrink: 0, color: 'hsl(var(--muted-foreground))' }}>
                      {formatBytes(attachment.size)}
                    </span>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      data-testid="feedback-attachment-remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 0, display: 'flex' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="feedback-attach-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      border: '1px dashed hsl(var(--border))',
                      background: 'transparent',
                      color: 'hsl(var(--muted-foreground))',
                      cursor: 'pointer',
                      width: '100%',
                      justifyContent: 'center',
                      transition: 'border-color 0.12s, color 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(var(--foreground))'; e.currentTarget.style.borderColor = 'hsl(var(--foreground))' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.borderColor = 'hsl(var(--border))' }}
                  >
                    <Paperclip size={12} strokeWidth={1.5} />
                    Attach image or video
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', opacity: 0.6 }}>max 10 MB</span>
                  </button>
                )}
                {attachError && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#ef4444' }}>{attachError}</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={handleFileChange}
                  data-testid="feedback-file-input"
                  style={{ display: 'none' }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !description.trim()}
                data-testid="feedback-submit"
                className="btn-sm primary"
                style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 5, minWidth: 80, justifyContent: 'center' }}
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
