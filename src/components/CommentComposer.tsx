import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent as ReactDragEvent, type KeyboardEvent } from 'react'
import { Send, Loader2, X, Check, Paperclip } from 'lucide-react'
import { apiRequest, uploadRequest } from '../lib/api'
import { cn } from '../lib/cn'

/**
 * Lightweight comment composer with optional attachments + @mention suggestions.
 *
 * Why not just MarkdownCanvas:
 *   Comments are mostly one-liners. The Write/Preview tabs + attachment-strip
 *   take more vertical room than the input itself. This composer auto-grows,
 *   supports keyboard submit, and keeps chrome to the bare minimum.
 *
 * Keyboard (no popup open):
 *   - Enter        → submit
 *   - Shift+Enter  → newline
 *   - Ctrl/⌘+Enter → also submit (Mac muscle memory)
 *   - Esc          → onCancel (when provided — i.e. when editing)
 *
 * Keyboard (mention popup open):
 *   - ArrowUp/Down → cycle suggestions
 *   - Enter / Tab  → insert selected suggestion (DOES NOT submit)
 *   - Esc          → close popup (no insert)
 *
 * Attachments (enableAttachments=true):
 *   Paste an image, drop a file, or click the paperclip → upload to
 *   /feed/attachments/upload/. The MIME allowlist + virus scan pipeline
 *   runs server-side. Markdown reference splices into the textarea at the
 *   cursor.
 *
 * Mentions (enableMentions=true):
 *   Type `@` followed by a name prefix. After ~150ms idle we hit the
 *   /search/autocomplete/ endpoint. Insert as plain text `@Full Name ` —
 *   not a markdown link, so the inserted text reads cleanly. (We don't
 *   have a clean user-id-to-profile-route mapping yet — see the chat fix
 *   from earlier this session.)
 */

const LINE_HEIGHT_PX = 20
const MIN_ROWS = 1
const MENTION_DEBOUNCE_MS = 150
const MAX_MENTION_PREFIX_LEN = 50
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

type Suggestion = {
  id: string
  text: string
  type: string
  meta?: { role?: string; [k: string]: unknown }
}

type AttachmentResponse = {
  id: string
  type: 'image' | 'video' | 'document' | 'audio'
  url: string
  file_name: string
  mime_type: string
  alt_text?: string
}

type Props = {
  value: string
  onChange: (next: string) => void
  /**
   * Called when the user submits. Receives the value with mentions encoded
   * as markdown links (`[@Name](/app/users/<id>)`), so parents can store /
   * post the canonical form even though the textarea shows clean `@Name`.
   */
  onSubmit: (encoded: string) => void
  onCancel?: () => void
  avatar?: React.ReactNode
  placeholder?: string
  submitting?: boolean
  disabled?: boolean
  maxLength?: number
  maxRows?: number
  compact?: boolean
  mode?: 'send' | 'save'
  /** Paperclip button + paste/drop file upload to /feed/attachments/upload/. */
  enableAttachments?: boolean
  /** `@` triggers a user-suggest popup that inserts a clean `@Name`. */
  enableMentions?: boolean
  /**
   * Mentions to seed when entering edit mode. Use {@link decodeMentions} on
   * stored content to obtain both the plain text and this list. Without this
   * the existing mention → user-id link is lost on edit.
   */
  initialMentions?: Mention[]
  'data-testid'?: string
}

export type CommentComposerHandle = {
  focus: () => void
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

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
  return `[${alt}](${att.url})`
}

function escapeRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export type Mention = { text: string; id: string }

/**
 * Convert canonical comment content (with `[@Name](/app/users/<id>)` markdown)
 * back to the cleaner display form `@Name`, returning the extracted mentions
 * so the composer can re-encode them on submit. Used when entering edit mode
 * on an existing comment so the textarea doesn't show ugly URLs.
 */
export function decodeMentions(canonical: string): { plain: string; mentions: Mention[] } {
  const mentions: Mention[] = []
  const plain = canonical.replace(
    /\[@([^\]\n]+)\]\(\/app\/users\/([^\s)]+)\)/g,
    (_, text: string, id: string) => {
      mentions.push({ text, id })
      return `@${text}`
    },
  )
  return { plain, mentions }
}

/**
 * Inverse of decodeMentions: turn plain `@Name` occurrences back into markdown
 * links using the recorded mention list. Walks left-to-right and consumes
 * mentions in insertion order, so duplicates are handled correctly. Names
 * not present in the mention list stay plain (user typed `@` manually,
 * didn't pick from the popup).
 */
export function encodeMentions(text: string, mentions: Mention[]): string {
  if (mentions.length === 0) return text
  const idsByText = new Map<string, string[]>()
  for (const m of mentions) {
    const list = idsByText.get(m.text) ?? []
    list.push(m.id)
    idsByText.set(m.text, list)
  }
  // Sort longer names first so "Felix Johansson" wins over "Felix" when both
  // are mentioned. Matches the leading `@` plus the longest known name.
  const sortedNames = [...idsByText.keys()].sort((a, b) => b.length - a.length)
  if (sortedNames.length === 0) return text
  const pattern = new RegExp('@(' + sortedNames.map(escapeRegex).join('|') + ')', 'g')
  const consumed = new Map<string, number>()
  return text.replace(pattern, (match, name: string) => {
    const ids = idsByText.get(name)
    const idx = consumed.get(name) ?? 0
    if (!ids || idx >= ids.length) return match
    consumed.set(name, idx + 1)
    return `[@${name}](/app/users/${ids[idx]})`
  })
}

let __token = 0
function nextToken(): string {
  __token = (__token + 1) % 1_000_000
  return `ff-cmt-${Date.now().toString(36)}-${__token}`
}

/**
 * Look backwards from caret for the most recent `@` that's still a valid
 * mention trigger. A trigger is invalid if:
 *   - There's a whitespace or newline between caret and the `@`
 *   - The `@` is preceded by a non-whitespace character (e.g. email `foo@bar`)
 *   - The prefix is longer than MAX_MENTION_PREFIX_LEN (probably not a mention)
 *
 * Returns the index of the `@` in `value`, or -1.
 */
function findMentionTrigger(value: string, caret: number): number {
  for (let i = caret - 1; i >= 0 && caret - i <= MAX_MENTION_PREFIX_LEN + 1; i--) {
    const ch = value[i]
    if (ch === '@') {
      // The character BEFORE @ must be start-of-string or whitespace,
      // otherwise it's an email or url, not a mention.
      if (i === 0) return i
      const prev = value[i - 1]
      if (prev === ' ' || prev === '\n' || prev === '\t') return i
      return -1
    }
    if (ch === ' ' || ch === '\n' || ch === '\t') return -1
  }
  return -1
}

// ---------------------------------------------------------------------------

export const CommentComposer = forwardRef<CommentComposerHandle, Props>(
  function CommentComposer({
    value,
    onChange,
    onSubmit,
    onCancel,
    avatar,
    placeholder = 'Write a comment…',
    submitting = false,
    disabled = false,
    maxLength = 2000,
    maxRows = 6,
    compact = false,
    mode = 'send',
    enableAttachments = false,
    enableMentions = false,
    initialMentions,
    'data-testid': testId,
  }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const valueRef = useRef(value)
    valueRef.current = value
    // Mention list seeded from `initialMentions` (edit mode) and appended to
    // by the autocomplete popup. Kept in a ref because mutations don't need
    // to trigger re-renders — we only consult the list on submit.
    const mentionsRef = useRef<Mention[]>(initialMentions ? [...initialMentions] : [])

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }), [])

    useLayoutEffect(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.style.height = 'auto'
      const desired = Math.min(ta.scrollHeight, maxRows * LINE_HEIGHT_PX + 16)
      ta.style.height = `${desired}px`
    }, [value, maxRows])

    // -- attachments ---------------------------------------------------------

    const [uploadCount, setUploadCount] = useState(0)
    const [attachError, setAttachError] = useState<string | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)

    const insertAtCursor = useCallback((text: string) => {
      const ta = textareaRef.current
      const current = valueRef.current
      if (!ta) {
        onChange(current + text)
        return
      }
      const start = ta.selectionStart ?? current.length
      const end = ta.selectionEnd ?? current.length
      const next = current.slice(0, start) + text + current.slice(end)
      onChange(next)
      window.requestAnimationFrame(() => {
        if (ta) {
          ta.focus()
          const newCaret = start + text.length
          ta.setSelectionRange(newCaret, newCaret)
        }
      })
    }, [onChange])

    const replacePlaceholder = useCallback((token: string, replacement: string) => {
      const current = valueRef.current
      const re = new RegExp(
        '!\\[Uploading [^\\]]*\\(' + escapeRegex(token) + '\\)\\]\\(\\)',
      )
      const match = current.match(re)
      if (!match || match.index === undefined) return
      onChange(current.slice(0, match.index) + replacement + current.slice(match.index + match[0].length))
    }, [onChange])

    const handleFile = useCallback(async (file: File) => {
      setAttachError(null)
      if (file.size > MAX_UPLOAD_BYTES) {
        setAttachError(`${file.name} is too large (${formatBytes(file.size)}). Max 25 MB.`)
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
        replacePlaceholder(token, markdownFor(resp))
      } catch (err: unknown) {
        const details = (err as { details?: { error?: string; details?: string[] } })?.details
        const msg = details?.details?.[0] || details?.error || (err as Error).message || 'Upload failed'
        replacePlaceholder(token, `[Upload failed: ${sanitizeAlt(file.name)}]`)
        setAttachError(`${file.name}: ${msg}`)
      } finally {
        setUploadCount((n) => Math.max(0, n - 1))
      }
    }, [insertAtCursor, replacePlaceholder])

    const handleFiles = useCallback((files: FileList | File[]) => {
      Array.from(files).forEach((f) => void handleFile(f))
    }, [handleFile])

    const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
      if (!enableAttachments) return
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
    }, [enableAttachments, handleFiles])

    const handleDrop = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
      if (!enableAttachments) return
      e.preventDefault()
      setIsDragOver(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) handleFiles(files)
    }, [enableAttachments, handleFiles])

    const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
      if (!enableAttachments) return
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
        setIsDragOver(true)
      }
    }, [enableAttachments])

    const handleDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
      if (e.currentTarget === e.target) setIsDragOver(false)
    }, [])

    const handleFilePicker = (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) handleFiles(files)
      e.target.value = ''
    }

    // -- mentions ------------------------------------------------------------

    const [mentionPrefix, setMentionPrefix] = useState<string | null>(null)
    const [mentionStart, setMentionStart] = useState<number>(-1)
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [selectedIdx, setSelectedIdx] = useState(0)
    const [mentionLoading, setMentionLoading] = useState(false)
    const mentionRequestRef = useRef(0) // race-guard for out-of-order responses

    const popupOpen = enableMentions && mentionPrefix !== null

    /** Re-detect mention trigger any time value or caret moves. */
    const detectMention = useCallback(() => {
      if (!enableMentions) return
      const ta = textareaRef.current
      if (!ta) return
      const caret = ta.selectionStart ?? 0
      const at = findMentionTrigger(valueRef.current, caret)
      if (at < 0) {
        setMentionPrefix(null)
        setMentionStart(-1)
        return
      }
      const prefix = valueRef.current.slice(at + 1, caret)
      setMentionStart(at)
      setMentionPrefix(prefix)
    }, [enableMentions])

    // Debounced fetch of suggestions whenever the prefix changes.
    useEffect(() => {
      if (mentionPrefix === null) {
        setSuggestions([])
        setSelectedIdx(0)
        return
      }
      if (mentionPrefix.length === 0) {
        // Show empty hint state — don't burn an API call on every `@`.
        setSuggestions([])
        return
      }
      const requestId = ++mentionRequestRef.current
      const timer = window.setTimeout(async () => {
        setMentionLoading(true)
        try {
          const params = new URLSearchParams({
            q: mentionPrefix,
            types: 'users',
            limit: '5',
          })
          const data = await apiRequest<{ suggestions: Suggestion[] }>(
            `/search/autocomplete/?${params.toString()}`,
          )
          // Ignore out-of-order responses (user typed faster than network).
          if (requestId !== mentionRequestRef.current) return
          setSuggestions(data.suggestions ?? [])
          setSelectedIdx(0)
        } catch {
          if (requestId !== mentionRequestRef.current) return
          setSuggestions([])
        } finally {
          if (requestId === mentionRequestRef.current) setMentionLoading(false)
        }
      }, MENTION_DEBOUNCE_MS)
      return () => window.clearTimeout(timer)
    }, [mentionPrefix])

    const insertMention = useCallback((s: Suggestion) => {
      const ta = textareaRef.current
      if (!ta) return
      const current = valueRef.current
      const caret = ta.selectionStart ?? current.length
      if (mentionStart < 0) return
      // Show clean `@Name ` in the textarea; the user-id is recorded in
      // mentionsRef and only spliced back in on submit (see encodeMentions).
      // Keeps the typing experience readable without losing the link target.
      const replacement = `@${s.text} `
      const next = current.slice(0, mentionStart) + replacement + current.slice(caret)
      mentionsRef.current.push({ text: s.text, id: s.id })
      onChange(next)
      const newCaret = mentionStart + replacement.length
      window.requestAnimationFrame(() => {
        if (ta) {
          ta.focus()
          ta.setSelectionRange(newCaret, newCaret)
        }
      })
      setMentionPrefix(null)
      setMentionStart(-1)
      setSuggestions([])
    }, [mentionStart, onChange])

    const closeMention = useCallback(() => {
      setMentionPrefix(null)
      setMentionStart(-1)
      setSuggestions([])
    }, [])

    // -- submit / keyboard ---------------------------------------------------

    const canSubmit = !disabled && !submitting && value.trim().length > 0 && uploadCount === 0

    const handleSubmitInternal = useCallback(() => {
      if (!canSubmit) return
      const encoded = encodeMentions(value, mentionsRef.current)
      onSubmit(encoded)
    }, [canSubmit, value, onSubmit])

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Mention popup intercepts Enter/Tab/Arrows/Esc.
      if (popupOpen && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIdx((i) => (i + 1) % suggestions.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          const s = suggestions[selectedIdx]
          if (s) insertMention(s)
          return
        }
      }
      if (popupOpen && e.key === 'Escape') {
        e.preventDefault()
        closeMention()
        return
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        handleSubmitInternal()
        return
      }
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault()
        onCancel()
      }
    }

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
      // Run mention detection AFTER the caret has moved in the new value.
      // requestAnimationFrame because selectionStart on `e.target` may still
      // reflect the pre-update position in some browsers.
      if (enableMentions) {
        window.requestAnimationFrame(detectMention)
      }
    }

    const handleSelect = () => {
      // Caret moved without a content change (arrow key, click). Re-detect.
      if (enableMentions) detectMention()
    }

    // -- render --------------------------------------------------------------

    const charsRemaining = maxLength - value.length
    const showCounter = charsRemaining < maxLength * 0.1

    return (
      <div
        className={cn('comment-composer', compact && 'comment-composer-compact')}
        style={{
          display: 'flex',
          gap: compact ? '0.375rem' : '0.625rem',
          alignItems: 'flex-start',
          position: 'relative',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid={testId ? `${testId}-wrapper` : undefined}
      >
        {!compact && avatar && (
          <div
            className="avatar"
            style={{
              width: '1.5rem',
              height: '1.5rem',
              fontSize: '0.625rem',
              flexShrink: 0,
              marginTop: '0.25rem',
            }}
          >
            {avatar}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            className="textarea"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onSelect={handleSelect}
            onBlur={() => {
              // Defer close so a click on a suggestion lands first.
              window.setTimeout(closeMention, 150)
            }}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={MIN_ROWS}
            style={{
              minHeight: '2.25rem',
              fontSize: '0.8125rem',
              resize: 'none',
              overflow: 'hidden',
              paddingRight: enableAttachments ? '4.25rem' : '2.75rem',
              lineHeight: `${LINE_HEIGHT_PX}px`,
              width: '100%',
              boxSizing: 'border-box',
              outline: isDragOver ? '2px dashed hsl(var(--primary))' : undefined,
              outlineOffset: isDragOver ? 2 : undefined,
            }}
            data-testid={testId}
            disabled={submitting}
          />

          {/* Inline actions */}
          <div
            style={{
              position: 'absolute',
              right: '0.375rem',
              bottom: '0.375rem',
              display: 'flex',
              gap: '0.25rem',
              alignItems: 'center',
            }}
          >
            {uploadCount > 0 && (
              <span
                title={`Uploading ${uploadCount} file(s)`}
                style={{ color: 'hsl(var(--muted-foreground))', display: 'inline-flex' }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            )}
            {enableAttachments && (
              <>
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  title="Attach file (paste/drop also works)"
                  aria-label="Attach file"
                  style={{ padding: '0.25rem', minWidth: 0 }}
                  data-testid={testId ? `${testId}-attach` : undefined}
                >
                  <Paperclip className="w-3 h-3" strokeWidth={1.5} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={handleFilePicker}
                  data-testid={testId ? `${testId}-file-input` : undefined}
                />
              </>
            )}
            {onCancel && (
              <button
                type="button"
                className="btn-sm ghost"
                onClick={onCancel}
                disabled={submitting}
                title="Cancel (Esc)"
                aria-label="Cancel"
                style={{ padding: '0.25rem', minWidth: 0 }}
                data-testid={testId ? `${testId}-cancel` : undefined}
              >
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              className="btn-sm primary"
              onClick={handleSubmitInternal}
              disabled={!canSubmit}
              title={mode === 'save' ? 'Save (Enter)' : 'Send (Enter)'}
              aria-label={mode === 'save' ? 'Save comment' : 'Send comment'}
              style={{ padding: '0.25rem 0.5rem', minWidth: 0 }}
              data-testid={testId ? `${testId}-submit` : undefined}
            >
              {submitting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : mode === 'save' ? (
                <Check className="w-3 h-3" strokeWidth={1.5} />
              ) : (
                <Send className="w-3 h-3" strokeWidth={1.5} />
              )}
            </button>
          </div>

          {showCounter && (
            <span
              style={{
                position: 'absolute',
                right: enableAttachments ? '6.5rem' : '5.5rem',
                bottom: '0.5rem',
                fontSize: '0.625rem',
                color: charsRemaining < 100 ? '#ef4444' : 'hsl(var(--muted-foreground))',
                pointerEvents: 'none',
              }}
              aria-live="polite"
            >
              {charsRemaining}
            </span>
          )}

          {/* Mention popup */}
          {popupOpen && (
            <MentionPopup
              prefix={mentionPrefix ?? ''}
              suggestions={suggestions}
              selectedIdx={selectedIdx}
              loading={mentionLoading}
              onPick={insertMention}
              onHover={setSelectedIdx}
              testId={testId}
            />
          )}

          {attachError && (
            <p
              style={{
                fontSize: '0.7rem',
                color: '#ef4444',
                margin: '0.25rem 0 0',
              }}
              data-testid={testId ? `${testId}-attach-error` : undefined}
            >
              {attachError}
            </p>
          )}
        </div>
      </div>
    )
  },
)

// ---------------------------------------------------------------------------
// MentionPopup
// ---------------------------------------------------------------------------

type MentionPopupProps = {
  prefix: string
  suggestions: Suggestion[]
  selectedIdx: number
  loading: boolean
  onPick: (s: Suggestion) => void
  onHover: (idx: number) => void
  testId?: string
}

function MentionPopup({ prefix, suggestions, selectedIdx, loading, onPick, onHover, testId }: MentionPopupProps) {
  // Anchor the popup BELOW the textarea, aligned to its left edge. This keeps
  // positioning math trivial — caret-anchored popups need a mirror-element
  // measurement trick that's brittle in resizing textareas.
  const hasResults = suggestions.length > 0
  const showHint = !hasResults && (prefix.length === 0 || loading)

  return (
    <div
      role="listbox"
      aria-label="Mention suggestions"
      data-testid={testId ? `${testId}-mention-popup` : 'mention-popup'}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 2,
        minWidth: 240,
        maxWidth: 320,
        background: 'hsl(var(--popover))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        zIndex: 20,
        overflow: 'hidden',
        fontSize: '0.8125rem',
      }}
      onMouseDown={(e) => e.preventDefault() /* keep textarea focus */}
    >
      {showHint && (
        <div style={{ padding: '0.5rem 0.75rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
          {loading ? 'Searching…' : prefix.length === 0 ? 'Type a name to mention…' : 'No matches'}
        </div>
      )}
      {!showHint && !hasResults && (
        <div style={{ padding: '0.5rem 0.75rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
          No matches for "@{prefix}"
        </div>
      )}
      {hasResults && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 240, overflowY: 'auto' }}>
          {suggestions.map((s, i) => (
            <li
              key={`${s.id}-${i}`}
              role="option"
              aria-selected={i === selectedIdx}
              data-testid={testId ? `${testId}-mention-item-${i}` : `mention-item-${i}`}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(s)}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                background: i === selectedIdx ? 'hsl(var(--muted))' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <div
                className="avatar"
                style={{ width: '1.5rem', height: '1.5rem', fontSize: '0.625rem', flexShrink: 0 }}
                aria-hidden
              >
                {s.text
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.text}
                </div>
                {s.meta?.role && (
                  <div style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }}>
                    {String(s.meta.role)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composer hint (unchanged from previous version)
// ---------------------------------------------------------------------------

export function ComposerHint({ show }: { show: boolean }) {
  const [mounted, setMounted] = useState(show)
  useEffect(() => {
    if (show) setMounted(true)
    else {
      const id = window.setTimeout(() => setMounted(false), 200)
      return () => window.clearTimeout(id)
    }
  }, [show])
  if (!mounted) return null
  return (
    <p
      style={{
        margin: '0.25rem 0 0',
        fontSize: '0.625rem',
        color: 'hsl(var(--muted-foreground))',
        opacity: show ? 0.8 : 0,
        transition: 'opacity 180ms',
        paddingLeft: '2.125rem',
      }}
    >
      Enter to send · Shift+Enter for newline · @ to mention · paste / drop to attach
    </p>
  )
}
