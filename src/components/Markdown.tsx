import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { Download, File as FileIcon, FileSpreadsheet, FileText, FileType } from 'lucide-react'
import { cn } from '../lib/cn'
import { BACKEND_ORIGIN } from '../lib/env'
import type { FeedAttachment } from '../types/feed'

// Internal profile paths used by @mentions. /app/users/:id redirects to the
// founder or investor profile the user actually has (see UserRedirectPage).
const MENTION_PATH_RE = /^\/app\/(users|founders|investors)\//

type MarkdownProps = {
  children: string
  size?: 'sm' | 'base'
  className?: string
  'data-testid'?: string
  /**
   * Optional attachment metadata for URLs that appear in `children`. When
   * provided, the renderer can swap bare links into rich previews:
   *  - video URLs become <video> with a poster from thumbnail_url
   *  - document URLs become a card with filename, size, and icon
   *  - image URLs get aspect-ratio hints to prevent layout shift
   * Lookup is by exact URL match; URLs not in this list render as before.
   */
  attachments?: FeedAttachment[]
}

function humanFileSize(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function extLabel(att: FeedAttachment): string {
  // Prefer the filename extension; fall back to subtype from mime_type.
  const dot = att.file_name.lastIndexOf('.')
  if (dot > -1 && dot < att.file_name.length - 1) {
    return att.file_name.slice(dot + 1).toUpperCase().slice(0, 5)
  }
  const slash = att.mime_type.indexOf('/')
  return slash > -1 ? att.mime_type.slice(slash + 1).toUpperCase().slice(0, 5) : 'FILE'
}

function docIcon(att: FeedAttachment) {
  const m = att.mime_type
  if (m === 'application/pdf') return FileType
  if (m.includes('spreadsheet') || m.includes('excel')) return FileSpreadsheet
  if (m.includes('word') || m === 'text/plain') return FileText
  return FileIcon
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return ''
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/**
 * Hosts we trust for inline images. Anything else gets a placeholder.
 *
 * Why allowlist instead of denylist: untrusted `<img src>` is a privacy leak
 * (the image server learns the viewer's IP + every header the browser sends)
 * AND a way to track read receipts on private posts. Allowlist is the only
 * defense that scales.
 *
 * Add CDN domains here, never the other way around.
 */
const ALLOWED_IMAGE_HOST_RE = /\.(founderslib\.in|blob\.core\.windows\.net|googleusercontent\.com|gravatar\.com)$/i

function isSameOrigin(url: string): boolean {
  // Empty / relative paths are same-origin by definition.
  if (!url || url.startsWith('/')) return true
  try {
    const u = new URL(url)
    if (u.origin === window.location.origin) return true
    if (BACKEND_ORIGIN) {
      const backend = new URL(BACKEND_ORIGIN)
      if (u.origin === backend.origin) return true
    }
    return ALLOWED_IMAGE_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

/**
 * URL scheme allowlist for markdown links. react-markdown v10 already
 * filters `javascript:` and most `data:` schemes via its default schema,
 * but explicit > implicit. This drops anything that isn't http(s), mailto,
 * tel, or a same-origin relative path.
 */
function safeUrlTransform(url: string): string {
  if (!url) return ''
  // Same-origin relative paths (`/app/...`) and fragments (`#section`) pass.
  if (url.startsWith('/') || url.startsWith('#')) return url
  try {
    const u = new URL(url, window.location.origin)
    if (u.protocol === 'http:' || u.protocol === 'https:') return url
    if (u.protocol === 'mailto:' || u.protocol === 'tel:') return url
  } catch {
    // Fall through to reject.
  }
  return ''
}

export function Markdown({ children, size = 'base', className, 'data-testid': testId, attachments }: MarkdownProps) {
  // URL → FeedAttachment lookup. Built once per render so the per-link/per-img
  // handlers below stay O(1). Keys must match the exact URL the composer
  // wrote into the markdown — backend storage returns the same string both
  // in the upload response and in FeedAttachment.url.
  const attachmentMap = useMemo(() => {
    const m = new Map<string, FeedAttachment>()
    if (attachments) {
      for (const att of attachments) {
        if (att.url) m.set(att.url, att)
      }
    }
    return m
  }, [attachments])

  return (
    <div
      className={cn('markdown-prose', size === 'sm' && 'markdown-prose-sm', className)}
      data-testid={testId}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrlTransform}
        components={{
          a: ({ children, href, ...props }) => {
            // @mention rendering: links to internal profile paths are styled
            // as a colored chip and routed via react-router so we don't reload
            // the SPA. The composer writes mentions as `[@Name](/app/users/<id>)`.
            if (typeof href === 'string' && MENTION_PATH_RE.test(href)) {
              return (
                <Link
                  to={href}
                  className="markdown-mention"
                  data-testid="markdown-mention"
                >
                  {children}
                </Link>
              )
            }
            // Match the URL against attachments uploaded with this post.
            // When we have metadata we can render a richer preview than a
            // plain link allows — video poster, doc card, etc.
            const att = typeof href === 'string' ? attachmentMap.get(href) : undefined

            // Document attachment → preview card with filename + size + icon.
            // For PDFs the backend renders page 1 as a JPEG thumbnail and
            // stores it in thumbnail_url; when present we show the image
            // above the metadata so readers can recognize the file at a
            // glance. Without a thumbnail (Word, Excel, TXT) the card uses
            // just the file icon.
            if (att && att.type === 'document' && isSameOrigin(att.url)) {
              const Icon = docIcon(att)
              const size = humanFileSize(att.file_size)
              const hasThumb = !!att.thumbnail_url && isSameOrigin(att.thumbnail_url)
              return (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  download={att.file_name}
                  data-testid="markdown-doc-card"
                  style={{
                    display: 'flex',
                    flexDirection: hasThumb ? 'column' : 'row',
                    alignItems: hasThumb ? 'stretch' : 'center',
                    gap: hasThumb ? 0 : '0.625rem',
                    margin: '0.5rem 0',
                    padding: hasThumb ? 0 : '0.625rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    textDecoration: 'none',
                    color: 'inherit',
                    maxWidth: '100%',
                    overflow: 'hidden',
                  }}
                >
                  {hasThumb ? (
                    <img
                      src={att.thumbnail_url!}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: '100%',
                        maxHeight: '20rem',
                        objectFit: 'contain',
                        objectPosition: 'top',
                        background: 'hsl(var(--muted))',
                        borderBottom: '1px solid hsl(var(--border))',
                        display: 'block',
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: hasThumb ? '0.625rem 0.75rem' : 0,
                    }}
                  >
                    <Icon
                      style={{
                        width: '1.75rem',
                        height: '1.75rem',
                        flexShrink: 0,
                        strokeWidth: 1.5,
                        color: 'var(--gold)',
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {att.file_name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'hsl(var(--muted-foreground))',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {extLabel(att)}{size ? ` · ${size}` : ''}
                      </span>
                    </div>
                    <Download
                      style={{
                        width: '1rem',
                        height: '1rem',
                        flexShrink: 0,
                        strokeWidth: 1.5,
                        color: 'hsl(var(--muted-foreground))',
                      }}
                    />
                  </div>
                </a>
              )
            }

            // Video attachment → <video> with poster from thumbnail_url.
            // Backend generates the thumbnail via FFmpeg at mid-clip; without
            // it the player shows a blank black frame until first play.
            if (att && att.type === 'video' && isSameOrigin(att.url)) {
              return (
                <video
                  src={att.url}
                  controls
                  preload="metadata"
                  poster={att.thumbnail_url || undefined}
                  width={att.width || undefined}
                  height={att.height || undefined}
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block', margin: '0.5rem 0' }}
                  data-testid="markdown-inline-video"
                  aria-label={att.file_name + (att.duration ? ` (${formatDuration(att.duration)})` : '')}
                >
                  {children}
                </video>
              )
            }

            // Audio attachment → native player. No poster concept here, but
            // we still take the attachment path so future metadata (waveform,
            // duration label) has a hook to land in.
            if (att && att.type === 'audio' && isSameOrigin(att.url)) {
              return (
                <audio
                  src={att.url}
                  controls
                  preload="metadata"
                  style={{ display: 'block', margin: '0.5rem 0' }}
                  data-testid="markdown-inline-audio"
                >
                  {children}
                </audio>
              )
            }

            // Fallback for media-shaped URLs we couldn't match to an
            // attachment (e.g. the author hand-typed `[clip.mp4](url)`).
            // Keeps the pre-attachments behavior: trusted-host gate + native
            // controls, no poster image because we have no thumbnail.
            if (typeof href === 'string') {
              const lower = href.toLowerCase().split('?')[0].split('#')[0]
              const isVideo = /\.(mp4|webm|mov|m4v|mkv)$/.test(lower)
              const isAudio = /\.(mp3|wav|ogg|m4a)$/.test(lower)
              if ((isVideo || isAudio) && isSameOrigin(href)) {
                if (isVideo) {
                  return (
                    <video
                      src={href}
                      controls
                      preload="metadata"
                      style={{ maxWidth: '100%', borderRadius: 8, display: 'block', margin: '0.5rem 0' }}
                      data-testid="markdown-inline-video"
                    >
                      {children}
                    </video>
                  )
                }
                return (
                  <audio
                    src={href}
                    controls
                    preload="metadata"
                    style={{ display: 'block', margin: '0.5rem 0' }}
                    data-testid="markdown-inline-audio"
                  >
                    {children}
                  </audio>
                )
              }
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" {...props}>
                {children}
              </a>
            )
          },
          // Image src must be from a trusted host. Otherwise we'd leak the
          // viewer's IP / browser headers to whatever server the author put
          // in `![alt](...)`. Untrusted images render as a small inline note
          // so the reader sees the alt text and knows something was hidden.
          img: ({ src, alt, ...props }) => {
            const s = typeof src === 'string' ? src : ''
            if (!s || !isSameOrigin(s)) {
              return (
                <span
                  className="markdown-image-blocked"
                  title={`Image from untrusted host blocked: ${s || '(no src)'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    background: 'hsl(var(--muted))',
                    color: 'hsl(var(--muted-foreground))',
                  }}
                  data-testid="markdown-img-blocked"
                >
                  [image: {alt || 'untrusted source'}]
                </span>
              )
            }
            // Use known dimensions as layout hints so the browser can
            // reserve space before the image loads — eliminates content
            // shift as posts paint. The CSS keeps it responsive via
            // max-width/height: auto on .markdown-prose img.
            const att = attachmentMap.get(s)
            return (
              <img
                src={s}
                alt={alt || att?.alt_text || ''}
                loading="lazy"
                decoding="async"
                width={att?.width || undefined}
                height={att?.height || undefined}
                {...props}
              />
            )
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
