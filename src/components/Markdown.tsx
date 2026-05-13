import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import { BACKEND_ORIGIN } from '../lib/env'

// Internal profile paths used by @mentions. /app/users/:id redirects to the
// founder or investor profile the user actually has (see UserRedirectPage).
const MENTION_PATH_RE = /^\/app\/(users|founders|investors)\//

type MarkdownProps = {
  children: string
  size?: 'sm' | 'base'
  className?: string
  'data-testid'?: string
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

export function Markdown({ children, size = 'base', className, 'data-testid': testId }: MarkdownProps) {
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
            // Video / audio inline rendering: if the link points at a media
            // file on a trusted host, render the native controls instead of
            // a plain link. Keeps markdown source readable (`[clip.mp4](url)`)
            // and produces a real player on the page.
            //
            // The trusted-host gate is the same one images use — playing an
            // arbitrary remote video would leak the viewer's IP to whatever
            // server the author put in the link.
            if (typeof href === 'string') {
              const lower = href.toLowerCase().split('?')[0].split('#')[0]
              const isVideo = /\.(mp4|webm|mov|m4v)$/.test(lower)
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
            return <img src={s} alt={alt || ''} loading="lazy" decoding="async" {...props} />
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
