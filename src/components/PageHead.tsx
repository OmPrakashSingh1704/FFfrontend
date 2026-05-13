import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'FoundersLib'
const SITE_URL = 'https://www.founderslib.in'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

type Props = {
  /**
   * Page title — appended with " — FoundersLib" automatically. Pass the
   * full sentence you want indexed; don't include the site suffix.
   */
  title: string
  /** Meta description. ~155 chars max for Google snippet. */
  description: string
  /**
   * Path part of the canonical URL (e.g. "/login"). Default "/". Used for
   * both `<link rel=canonical>` and `og:url` so social shares deduplicate.
   */
  path?: string
  /** OG/Twitter image absolute URL. Defaults to the site-wide og-image.png. */
  image?: string
  /**
   * If true, emits `<meta name="robots" content="noindex,follow">` so the
   * page is excluded from search results. Use for auth-walled or duplicate
   * routes that have no SEO value (everything under /app/*).
   */
  noindex?: boolean
}

/**
 * Per-route head fragment driven by react-helmet-async.
 *
 * The shell `index.html` carries sensible defaults for crawlers that don't
 * run JS; this component overrides those for users who do (so each route
 * gets its own title, canonical, and OG card). Both layers matter — Google
 * uses the rendered DOM, but LinkedIn/Slack/WhatsApp previews use only the
 * raw HTML, so the shell defaults are the ones link unfurlers see.
 */
export function PageHead({ title, description, path = '/', image, noindex }: Props) {
  const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const ogImage = image ?? DEFAULT_OG_IMAGE
  const fullTitle = path === '/' ? title : `${title} — ${SITE_NAME}`

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex ? <meta name="robots" content="noindex,follow" /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  )
}
