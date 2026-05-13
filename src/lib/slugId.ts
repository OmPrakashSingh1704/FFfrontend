/**
 * Helpers for the `<slug>-<short-uuid>` URL pattern used on profile pages.
 *
 * The "short uuid" is the first 8 hex chars of the resource UUID. At v7's
 * time-based generation that's roughly 4 billion buckets per millisecond,
 * which means collisions are statistically impossible within a single
 * resource type at any scale we'd realistically hit. The full UUID is the
 * source of truth on the backend; the slug part is purely cosmetic — if
 * a user renames themselves, old URLs continue to resolve because we only
 * parse the short-uuid suffix.
 *
 *   buildProfileUrl('founders', 'alex morgan', '019cbf98-373a-760c-b11c-7c9d97cbbce4')
 *     -> '/founders/alex-morgan-019cbf98'
 *
 *   parseSlugId('alex-morgan-019cbf98')
 *     -> { slug: 'alex-morgan', shortId: '019cbf98' }
 *
 *   parseSlugId('019cbf98-373a-760c-b11c-7c9d97cbbce4')   // raw UUID still parses
 *     -> { slug: '', shortId: '019cbf98' }
 */

/** Lowercase, hyphenated, ASCII-only. Mirrors backend Django slugify behavior closely enough for routing. */
export function slugify(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** First 8 hex chars of a UUID. Strips dashes first so v7 UUIDs work too. */
export function shortUuid(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 8).toLowerCase()
}

/** Build a profile URL like /founders/alex-morgan-019cbf98. */
export function buildProfileUrl(
  resource: 'founders' | 'investors' | 'startups',
  nameOrSlug: string | null | undefined,
  uuid: string,
): string {
  const slug = slugify(nameOrSlug)
  const short = shortUuid(uuid)
  return slug ? `/${resource}/${slug}-${short}` : `/${resource}/${short}`
}

/**
 * Pull the short uuid (and decorative slug) out of a route param.
 *
 * Accepts:
 *   - `alex-morgan-019cbf98` → slug + 8-hex short id
 *   - `019cbf98` → bare short id (no slug part)
 *   - `019cbf98-373a-760c-b11c-7c9d97cbbce4` → bare full UUID (use first 8)
 *   - anything else → returns null so caller can render not-found
 *
 * Note: this is purely the FRONTEND ROUTING shortener. Network calls still
 * need a full UUID to hit the backend, which is why we return a flag for
 * "looks like a full UUID" — callers can detect that and use it directly
 * without a separate lookup.
 */
export function parseSlugId(
  param: string | undefined,
): { slug: string; shortId: string; isFullUuid: boolean } | null {
  if (!param) return null
  const normalized = param.toLowerCase()

  // Full UUID (with dashes) — 36 chars in canonical form
  const fullUuidPattern = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
  if (fullUuidPattern.test(normalized)) {
    return { slug: '', shortId: normalized.slice(0, 8), isFullUuid: true }
  }

  // <slug>-<8 hex chars> at the end
  const slugWithShortId = /^(.*?)-([0-9a-f]{8})$/
  const match = normalized.match(slugWithShortId)
  if (match) {
    const [, slug, shortId] = match
    // Avoid treating a bare 8-hex as having a "slug" — slug stays empty.
    if (!slug) return { slug: '', shortId, isFullUuid: false }
    return { slug, shortId, isFullUuid: false }
  }

  // Bare 8 hex chars — no slug, just the short id
  if (/^[0-9a-f]{8}$/.test(normalized)) {
    return { slug: '', shortId: normalized, isFullUuid: false }
  }

  return null
}
