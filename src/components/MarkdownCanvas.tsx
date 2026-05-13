import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent as ReactDragEvent, type TextareaHTMLAttributes } from 'react'
import { Markdown } from './Markdown'
import { uploadRequest } from '../lib/api'
import { cn } from '../lib/cn'
import { File, FileVideo, FileAudio, FileText, GripVertical, ImageIcon, Loader2, Paperclip, X } from 'lucide-react'

/**
 * GitHub-style markdown editor with inline attachment support.
 *
 * Three ways to attach: paste an image from clipboard, drop one or more
 * files, or click the attach button. Each upload inserts a placeholder
 * at the cursor; when it completes, the placeholder is swapped for the
 * real markdown reference.
 *
 * Below the editor is an attachment strip — one chip per uploaded URL
 * still referenced in the markdown text. Click a chip to jump the caret
 * to the reference. X removes the reference from the markdown. Drag a
 * chip onto another to swap their positions in the text.
 *
 * Security chain (defense in depth):
 *   1. Browser-side size cap before upload
 *   2. POST /feed/attachments/upload/ runs SecurityScanner.scan() which
 *      rejects SVG, HTML, JS, EXE, polyglots by MIME + extension + magic
 *      bytes (see ff_backend/feed/attachment_processor.py)
 *   3. Async ClamAV scan after save
 *   4. Markdown renderer host-allowlists images/video/audio
 *   5. nginx middleware adds strict CSP on /media/*
 */

type AttachmentResponse = {
  id: string
  type: 'image' | 'video' | 'document' | 'audio'
  url: string
  file_name: string
  mime_type: string
  alt_text?: string
}

export type MarkdownCanvasHandle = {
  focus: () => void
}

type MarkdownCanvasProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children' | 'onChange' | 'value' | 'maxLength'> & {
  value: string
  onChange: (next: string) => void
  previewSize?: 'sm' | 'base'
  wrapperClassName?: string
  /** Max file size in MB. Default 25, matches backend cap. */
  maxFileSizeMB?: number
  /**
   * Cap on the text length. When set, the textarea enforces it natively
   * (browser blocks further keypresses) and a counter appears in the bottom
   * row when within 10% of the limit. Backend should enforce the same cap.
   */
  maxLength?: number
  'data-testid'?: string
}

const MAX_BYTES_DEFAULT = 25 * 1024 * 1024

function sanitizeAlt(s: string): string {
  return s.replace(/[\[\]\\]/g, '').slice(0, 120)
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function placeholderFor(file: File, token: string): string {
  return `![Uploading ${sanitizeAlt(file.name)}… (${token})]()`
}

function markdownFor(att: AttachmentResponse): string {
  const alt = sanitizeAlt(att.alt_text || att.file_name || 'attachment')
  if (att.type === 'image' || att.mime_type?.startsWith('image/')) {
    return `![${alt}](${att.url})`
  }
  // Videos / audio are rendered inline by the Markdown component when the
  // href ends in a known media extension and the host is trusted. So
  // `[clip.mp4](url)` becomes a <video controls> in the rendered post.
  return `[${alt}](${att.url})`
}

function spliceAt(value: string, start: number, end: number, insert: string): { value: string; cursor: number } {
  const before = value.slice(0, start)
  const after = value.slice(end)
  return { value: before + insert + after, cursor: start + insert.length }
}

function escapeRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

let __token = 0
function nextToken(): string {
  __token = (__token + 1) % 1_000_000
  return `ff-up-${Date.now().toString(36)}-${__token}`
}

// --- Attachment-strip parsing -----------------------------------------------

type ParsedRef = {
  /** Start index of the full markdown reference in the value string. */
  start: number
  /** End index (exclusive). */
  end: number
  /** The URL the reference points at. Must match an upload we tracked. */
  url: string
  /** Alt-text or link-text inside the brackets. */
  alt: string
  /** True if `![..](..)` (image syntax), false if `[..](..)` (link). */
  isImage: boolean
}

/**
 * Find every markdown reference whose URL we recognize as an attachment we
 * uploaded. Iteration order matches text order so the chip strip mirrors the
 * layout of the post body.
 */
function parseRefs(value: string, knownUrls: Set<string>): ParsedRef[] {
  const out: ParsedRef[] = []
  // Both `![alt](url)` and `[name](url)`. URL is everything between the
  // matching parens. Markdown spec is more permissive than this regex, but
  // for our own uploaded URLs the simple form is fine — we're matching
  // URLs we generated, not arbitrary author markdown.
  const re = /(!?)\[([^\]\n]*)\]\(([^)\n]+)\)/g
  for (const m of value.matchAll(re)) {
    const bang = m[1]
    const alt = m[2]
    const url = m[3]
    if (!knownUrls.has(url)) continue
    const startIdx = m.index ?? 0
    out.push({
      start: startIdx,
      end: startIdx + m[0].length,
      url,
      alt,
      isImage: bang === '!',
    })
  }
  return out
}

function kindFromAttachment(att: AttachmentResponse): 'image' | 'video' | 'audio' | 'document' {
  if (att.type === 'image' || att.mime_type?.startsWith('image/')) return 'image'
  if (att.type === 'video' || att.mime_type?.startsWith('video/')) return 'video'
  if (att.type === 'audio' || att.mime_type?.startsWith('audio/')) return 'audio'
  return 'document'
}

function iconFor(kind: 'image' | 'video' | 'audio' | 'document') {
  if (kind === 'video') return FileVideo
  if (kind === 'audio') return FileAudio
  if (kind === 'document') return FileText
  return File
}

// ---------------------------------------------------------------------------

export const MarkdownCanvas = forwardRef<MarkdownCanvasHandle, MarkdownCanvasProps>(
  function MarkdownCanvas(
    {
      value,
      onChange,
      previewSize = 'base',
      wrapperClassName,
      maxFileSizeMB = 25,
      maxLength,
      'data-testid': testId,
      placeholder,
      ...textareaProps
    },
    ref,
  ) {
    const [mode, setMode] = useState<'write' | 'preview'>('write')
    const [uploadCount, setUploadCount] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    /** When set, after the next paint we move the textarea selection here. */
    const [caretSelectRange, setCaretSelectRange] = useState<[number, number] | null>(null)

    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const valueRef = useRef(value)
    valueRef.current = value

    /**
     * Every upload that has resolved this session, keyed by URL. Used to
     * rebuild the attachment strip from the markdown text alone — if the
     * user types a URL by hand that we didn't upload, it won't appear in
     * the strip (we have no metadata for it).
     */
    const attachmentsRef = useRef<Map<string, AttachmentResponse>>(new Map())
    const [attachmentVersion, setAttachmentVersion] = useState(0)

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }), [])

    const maxBytes = Math.min(maxFileSizeMB * 1024 * 1024, MAX_BYTES_DEFAULT)

    // Apply pending caret selection AFTER React has flushed the new value.
    useEffect(() => {
      if (!caretSelectRange) return
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        ta.setSelectionRange(caretSelectRange[0], caretSelectRange[1])
      }
      setCaretSelectRange(null)
    }, [caretSelectRange])

    const insertAtCursor = useCallback((text: string) => {
      const ta = textareaRef.current
      const current = valueRef.current
      if (!ta) {
        onChange(current + text)
        return
      }
      const start = ta.selectionStart ?? current.length
      const end = ta.selectionEnd ?? current.length
      const { value: next, cursor } = spliceAt(current, start, end, text)
      onChange(next)
      window.requestAnimationFrame(() => {
        if (ta) {
          ta.focus()
          ta.setSelectionRange(cursor, cursor)
        }
      })
    }, [onChange])

    const replacePlaceholder = useCallback((
      token: string,
      replacement: string,
      /** When true, after replacement, select the alt-text region for editing. */
      selectAlt: boolean,
    ) => {
      const current = valueRef.current
      const re = new RegExp(
        '!\\[Uploading [^\\]]*\\(' + escapeRegex(token) + '\\)\\]\\(\\)',
      )
      const match = current.match(re)
      if (!match || match.index === undefined) return
      const next = current.slice(0, match.index) + replacement + current.slice(match.index + match[0].length)
      onChange(next)

      if (selectAlt) {
        const altMatch = replacement.match(/!\[([^\]]*)\]\(/)
        if (altMatch) {
          const altStart = match.index + 2 // after "!["
          const altEnd = altStart + altMatch[1].length
          setCaretSelectRange([altStart, altEnd])
        }
      }
    }, [onChange])

    const handleFile = useCallback(async (file: File, isSingle: boolean) => {
      setError(null)
      if (file.size > maxBytes) {
        setError(`${file.name} is too large (${formatBytes(file.size)}). Max ${maxFileSizeMB} MB.`)
        return
      }

      const token = nextToken()
      insertAtCursor(placeholderFor(file, token))
      setUploadCount((n) => n + 1)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt_text', '')
      formData.append('order', '0')

      try {
        const resp = await uploadRequest<AttachmentResponse>(
          '/feed/attachments/upload/',
          formData,
        )
        attachmentsRef.current.set(resp.url, resp)
        setAttachmentVersion((v) => v + 1)
        const md = markdownFor(resp)
        // Only select alt-text on a solo image upload — multi-drop would
        // otherwise yank the caret around as each upload completes.
        const selectAlt = isSingle && (resp.type === 'image' || resp.mime_type?.startsWith('image/'))
        replacePlaceholder(token, md, selectAlt)
      } catch (err: unknown) {
        const details = (err as { details?: { error?: string; details?: string[] } })?.details
        const msg = details?.details?.[0] || details?.error || (err as Error).message || 'Upload failed'
        replacePlaceholder(token, `[Upload failed: ${sanitizeAlt(file.name)}]`, false)
        setError(`${file.name}: ${msg}`)
      } finally {
        setUploadCount((n) => Math.max(0, n - 1))
      }
    }, [maxBytes, maxFileSizeMB, insertAtCursor, replacePlaceholder])

    const handleFiles = useCallback((files: FileList | File[]) => {
      const arr = Array.from(files)
      const isSingle = arr.length === 1
      arr.forEach((f) => void handleFile(f, isSingle))
    }, [handleFile])

    const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const files: File[] = []
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        handleFiles(files)
      }
    }, [handleFiles])

    const handleDrop = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
      // If this came from an attachment-chip drag (reorder), let the chip
      // handler manage it. Files-from-OS drag has no `attachment` type.
      if (e.dataTransfer?.types?.includes('application/x-ff-attachment')) return
      e.preventDefault()
      setIsDragOver(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        handleFiles(files)
      }
    }, [handleFiles])

    const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
        setIsDragOver(true)
      }
    }, [])

    const handleDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
      if (e.currentTarget === e.target) setIsDragOver(false)
    }, [])

    const handleFilePicker = (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) handleFiles(files)
      e.target.value = ''
    }

    // -- attachment strip state ----------------------------------------------

    const refs = useMemo<ParsedRef[]>(() => {
      const known = new Set(attachmentsRef.current.keys())
      // attachmentVersion is referenced so we re-derive when the map mutates.
      void attachmentVersion
      return parseRefs(value, known)
    }, [value, attachmentVersion])

    const jumpToRef = useCallback((r: ParsedRef) => {
      const ta = textareaRef.current
      if (!ta) return
      setMode('write')
      window.requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(r.start, r.end)
        // Approximate scroll into view: line-height ~18px times lines above.
        const linesBefore = value.slice(0, r.start).split('\n').length - 1
        ta.scrollTop = Math.max(0, linesBefore * 18 - 40)
      })
    }, [value])

    const removeRef = useCallback((r: ParsedRef) => {
      const next = value.slice(0, r.start) + value.slice(r.end)
      // Tidy whitespace: collapse runs of blank lines left behind by removal.
      const cleaned = next.replace(/\n{3,}/g, '\n\n')
      onChange(cleaned)
      attachmentsRef.current.delete(r.url)
      setAttachmentVersion((v) => v + 1)
    }, [value, onChange])

    /** Swap two markdown references in-place. Replaces the later one first so the earlier index stays valid. */
    const swapRefs = useCallback((fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return
      const a = refs[fromIdx]
      const b = refs[toIdx]
      if (!a || !b) return
      const aText = value.slice(a.start, a.end)
      const bText = value.slice(b.start, b.end)
      let next = value
      if (a.start < b.start) {
        next = next.slice(0, b.start) + aText + next.slice(b.end)
        next = next.slice(0, a.start) + bText + next.slice(a.end)
      } else {
        next = next.slice(0, a.start) + bText + next.slice(a.end)
        next = next.slice(0, b.start) + aText + next.slice(b.end)
      }
      onChange(next)
    }, [refs, value, onChange])

    // -- chip drag-and-drop handlers -----------------------------------------

    const handleChipDragStart = (e: ReactDragEvent<HTMLDivElement>, idx: number) => {
      e.dataTransfer.setData('application/x-ff-attachment', String(idx))
      e.dataTransfer.effectAllowed = 'move'
    }

    const handleChipDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
      if (e.dataTransfer.types.includes('application/x-ff-attachment')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }
    }

    const handleChipDrop = (e: ReactDragEvent<HTMLDivElement>, toIdx: number) => {
      e.preventDefault()
      e.stopPropagation()
      const raw = e.dataTransfer.getData('application/x-ff-attachment')
      if (!raw) return
      const fromIdx = parseInt(raw, 10)
      if (!Number.isNaN(fromIdx)) swapRefs(fromIdx, toIdx)
    }

    // -- render --------------------------------------------------------------

    return (
      <div
        className={cn('flex flex-col min-w-0', wrapperClassName)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid={testId ? `${testId}-wrapper` : undefined}
      >
        {/* Toolbar */}
        <div
          className="tabs"
          style={{ marginBottom: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
        >
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              type="button"
              className={`tab ${mode === 'write' ? 'active' : ''}`}
              onClick={() => setMode('write')}
              data-testid={testId ? `${testId}-write-tab` : undefined}
            >
              Write
            </button>
            <button
              type="button"
              className={`tab ${mode === 'preview' ? 'active' : ''}`}
              onClick={() => setMode('preview')}
              data-testid={testId ? `${testId}-preview-tab` : undefined}
            >
              Preview
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            {uploadCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Loader2 size={12} className="animate-spin" />
                Uploading {uploadCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-sm ghost"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              data-testid={testId ? `${testId}-attach-btn` : 'markdown-attach-btn'}
              title="Attach file (drag-drop or paste also works)"
              aria-label="Attach file"
            >
              <Paperclip size={12} strokeWidth={1.5} />
              Attach
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFilePicker}
              data-testid={testId ? `${testId}-file-input` : undefined}
            />
          </div>
        </div>

        {/* Drop target */}
        <div
          style={{
            position: 'relative',
            borderRadius: 8,
            outline: isDragOver ? '2px dashed hsl(var(--primary))' : 'none',
            outlineOffset: 2,
            transition: 'outline-color 120ms',
          }}
        >
          {mode === 'write' ? (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onPaste={handlePaste}
              placeholder={placeholder}
              maxLength={maxLength}
              data-testid={testId}
              {...textareaProps}
            />
          ) : (
            <div className="markdown-preview-container" style={{ minHeight: textareaProps.style?.minHeight }}>
              {value.trim() ? (
                <Markdown size={previewSize}>{value}</Markdown>
              ) : (
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem', margin: 0 }}>
                  Nothing to preview
                </p>
              )}
            </div>
          )}

          {isDragOver && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                background: 'hsl(var(--primary) / 0.05)',
                borderRadius: 8,
                fontSize: '0.875rem',
                color: 'hsl(var(--primary))',
                fontWeight: 500,
              }}
            >
              <Paperclip size={20} strokeWidth={1.5} style={{ marginRight: 8 }} />
              Drop to attach
            </div>
          )}
        </div>

        {/* Attachment strip */}
        {refs.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '0.375rem',
              overflowX: 'auto',
              marginTop: '0.5rem',
              paddingBottom: '0.25rem',
            }}
            data-testid={testId ? `${testId}-attachments` : 'markdown-attachments'}
          >
            {refs.map((r, idx) => {
              const att = attachmentsRef.current.get(r.url)
              const kind = att ? kindFromAttachment(att) : (r.isImage ? 'image' : 'document')
              const Icon = iconFor(kind)
              return (
                <div
                  key={`${r.url}-${r.start}`}
                  draggable
                  onDragStart={(e) => handleChipDragStart(e, idx)}
                  onDragOver={handleChipDragOver}
                  onDrop={(e) => handleChipDrop(e, idx)}
                  data-testid={`markdown-chip-${idx}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.25rem 0.375rem 0.25rem 0.25rem',
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--muted) / 0.5)',
                    cursor: 'grab',
                    flexShrink: 0,
                    maxWidth: 240,
                  }}
                >
                  <span
                    onMouseDown={(e) => e.preventDefault()}
                    style={{ color: 'hsl(var(--muted-foreground))', display: 'inline-flex' }}
                    aria-hidden
                  >
                    <GripVertical size={12} strokeWidth={1.5} />
                  </span>
                  {kind === 'image' ? (
                    <img
                      src={r.url}
                      alt={r.alt || ''}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: 32,
                        height: 32,
                        objectFit: 'cover',
                        borderRadius: 4,
                        flexShrink: 0,
                        background: 'hsl(var(--muted))',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                        background: 'hsl(var(--muted))',
                        color: 'hsl(var(--muted-foreground))',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => jumpToRef(r)}
                    title="Jump to this reference in the text"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      color: 'hsl(var(--foreground))',
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 150,
                    }}
                  >
                    {r.alt || att?.file_name || 'attachment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRef(r)}
                    title="Remove attachment from post"
                    aria-label="Remove attachment"
                    data-testid={`markdown-chip-remove-${idx}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: 'hsl(var(--muted-foreground))',
                      display: 'inline-flex',
                    }}
                  >
                    <X size={12} strokeWidth={1.5} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Hint + error row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, minHeight: 18, gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', flex: 1, minWidth: 0 }}>
            <ImageIcon size={10} strokeWidth={1.5} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            Drag, paste, or click Attach. Images, video, audio, PDFs, Office docs. Markdown supported.
          </span>
          {error && (
            <span style={{ fontSize: '0.7rem', color: '#ef4444' }} data-testid="markdown-canvas-error">
              {error}
            </span>
          )}
          {/* Char counter — only render when we're getting close to the cap. */}
          {maxLength !== undefined && (maxLength - value.length) < maxLength * 0.1 && (
            <span
              style={{
                fontSize: '0.7rem',
                color: (maxLength - value.length) < 200 ? '#ef4444' : 'hsl(var(--muted-foreground))',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
              aria-live="polite"
              data-testid="markdown-canvas-charcount"
            >
              {value.length.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    )
  },
)
