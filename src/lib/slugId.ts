/**
 * Helpers for the `<slug>-<role?>-<half-uuid>` URL pattern used on
 * profile pages.
 *
 * Format:
 *   - Founders:   /founders/jane-doe-founder-019e26476225a780
 *   - Investors:  /investors/acme-vc-investor-019e26476225a780
 *   - Startups:   /startups/acme-robotics-019e26476225a780
 *
 * The half-UUID is the first 16 hex chars of the resource UUID (dashes
 * stripped). At 16 hex chars that's 18 quintillion buckets — collisions
 * are statistically impossible within a single resource type at any
 * scale we'd realistically hit. The full UUID is the source of truth on
 * the backend; the slug + role part is purely cosmetic.
 *
 * The role component (founder/investor) carries semantic meaning a bot
 * or curious URL reader can latch onto. Startups don't include a role
 * because the resource type is already in the path (/startups/...).
 *
 *   buildProfileUrl('founders', 'alex morgan', '019cbf98-...')
 *     -> '/founders/alex-morgan-founder-019cbf98373a760c'
 *
 *   parseSlugId('alex-morgan-founder-019cbf98373a760c')
 *     -> { slug: 'alex-morgan-founder', shortId: '019cbf98373a760c' }
 *
 *   parseSlugId('alex-morgan-019cbf98')   // legacy 8-hex still parses
 *     -> { slug: 'alex-morgan', shortId: '019cbf98' }
 *
 *   parseSlugId('019cbf98-373a-760c-b11c-7c9d97cbbce4')   // raw UUID
 *     -> { slug: '', shortId: '019cbf98373a760c', isFullUuid: true }
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

/**
 * First 16 hex chars of a UUID (dashes stripped) — the "half UUID".
 * Past versions of this helper returned only 8 chars; older URLs with
 * an 8-char suffix still resolve correctly via parseSlugId() below.
 */
export function shortUuid(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 16).toLowerCase()
}

type Resource = 'founders' | 'investors' | 'startups'

// Resource → role token mapping. Startups intentionally have no role
// suffix because the path already encodes "startup" semantically and
// repeating it ("acme-robotics-startup-...") would be redundant noise.
const RESOURCE_ROLE: Record<Resource, string | null> = {
  founders: 'founder',
  investors: 'investor',
  startups: null,
}

/** Build a profile URL like /founders/alex-morgan-founder-019cbf98373a760c. */
export function buildProfileUrl(
  resource: Resource,
  nameOrSlug: string | null | undefined,
  uuid: string,
): string {
  const slug = slugify(nameOrSlug)
  const short = shortUuid(uuid)
  const role = RESOURCE_ROLE[resource]

  // Compose <slug>-<role>-<half-uuid>, dropping any empty segment so
  // we never emit `--` or trailing dashes for resources without a
  // slug or without a role.
  const parts = [slug, role, short].filter(Boolean) as string[]
  return `/${resource}/${parts.join('-')}`
}

/**
 * Pull the short uuid (and decorative slug) out of a route param.
 *
 * Accepts (in priority order):
 *   - Full canonical UUID `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
 *   - `<slug>-<16 hex chars>` (current format, role-aware slug included)
 *   - `<slug>-<8 hex chars>` (legacy format — kept for backward compat)
 *   - Bare 8-or-16 hex string with no slug
 *   - Anything else → null so the caller can render not-found.
 *
 * The returned `shortId` is whatever the URL carried — 8 hex chars for
 * legacy URLs, 16 for current ones. Backend lookup uses a startswith
 * match on the full UUID, so both lengths resolve correctly to the
 * canonical resource.
 */
export function parseSlugId(
  param: string | undefined,
): { slug: string; shortId: string; isFullUuid: boolean } | null {
  if (!param) return null
  const normalized = param.toLowerCase()

  // Full UUID (canonical, with dashes) — 36 chars.
  const fullUuidPattern = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
  if (fullUuidPattern.test(normalized)) {
    return {
      slug: '',
      // Strip dashes and take the first 16 hex so downstream consumers
      // can treat full-UUID and slugged URLs uniformly.
      shortId: normalized.replace(/-/g, '').slice(0, 16),
      isFullUuid: true,
    }
  }

  // <slug>-<16 hex> OR <slug>-<8 hex>. The longer suffix is tried first
  // so that an URL whose slug HAPPENS to end with 8 hex chars (rare but
  // possible) doesn't get mis-parsed when the actual short id is 16.
  const slugWithLongShortId = /^(.*?)-([0-9a-f]{16})$/
  const longMatch = normalized.match(slugWithLongShortId)
  if (longMatch) {
    const [, slug, shortId] = longMatch
    return { slug: slug ?? '', shortId, isFullUuid: false }
  }

  const slugWithShortShortId = /^(.*?)-([0-9a-f]{8})$/
  const shortMatch = normalized.match(slugWithShortShortId)
  if (shortMatch) {
    const [, slug, shortId] = shortMatch
    return { slug: slug ?? '', shortId, isFullUuid: false }
  }

  // Bare hex (no slug). Match 16-hex first, then 8-hex.
  if (/^[0-9a-f]{16}$/.test(normalized)) {
    return { slug: '', shortId: normalized, isFullUuid: false }
  }
  if (/^[0-9a-f]{8}$/.test(normalized)) {
    return { slug: '', shortId: normalized, isFullUuid: false }
  }

  return null
}
