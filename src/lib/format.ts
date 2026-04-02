/**
 * Convert snake_case / lowercase strings to Title Case for display.
 * e.g. "pre_seed" → "Pre Seed", "series_c" → "Series C", "saas" → "Saas"
 */
export function formatLabel(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
