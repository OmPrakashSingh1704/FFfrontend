/**
 * Curated industry list for the IndustrySelect combobox.
 *
 * Tier 1 (broad sectors) first — these are the most common picks for a
 * single-string startup industry. Tier 2 (specific verticals like FinTech,
 * AI/ML) follows, so users typing "ai" still find "AI/ML" via the substring
 * pass.
 *
 * The picker still allows free typing (users can keep an industry the list
 * doesn't cover) so this list doesn't need to be exhaustive, just useful.
 */

export const INDUSTRIES: readonly string[] = [
  // ── Tier 1: broad sectors ────────────────────────────────────────────
  'Technology',
  'Financial Services',
  'Healthcare & Life Sciences',
  'Agriculture & Food',
  'Consumer & Retail',
  'Transportation & Logistics',
  'Energy & Sustainability',
  'Manufacturing & Industrial',
  'Infrastructure & Real Estate',
  'Real Estate',
  'Media & Entertainment',
  'Professional Services',
  'Education & Knowledge',
  'Education',
  'Rural & Traditional Industries',
  'Aerospace & Defense',
  'Defence & Security',
  'Telecommunications',
  'Hospitality, Tourism & Leisure',
  'Government & Public Sector',

  // ── Tier 2: specific verticals ───────────────────────────────────────
  'Artificial Intelligence',
  'AI/ML',
  'SaaS',
  'Software',
  'Data Technology',
  'Cybersecurity',
  'Blockchain',
  'IoT',
  'Robotics',
  'SpaceTech',
  'FinTech',
  'InsurTech',
  'WealthTech',
  'LendingTech',
  'RegTech',
  'HealthTech',
  'BioTech',
  'MedTech',
  'Telemedicine',
  'AgriTech',
  'FoodTech',
  'DairyTech',
  'Precision Farming',
  'E-Commerce',
  'RetailTech',
  'FashionTech',
  'Consumer Brands',
  'Logistics Tech',
  'MobilityTech',
  'AutomotiveTech',
  'CleanTech',
  'EnergyTech',
  'ClimateTech',
  'Waste Management',
  'WaterTech',
  'ManufacturingTech',
  'Electronics Manufacturing',
  'Textile',
  'Chemical Manufacturing',
  'Packaging',
  'ConstructionTech',
  'PropTech',
  'Smart Cities',
  'MediaTech',
  'AdTech',
  'Gaming',
  'EntertainmentTech',
  'HRTech',
  'LegalTech',
  'MarTech',
  'GovTech',
  'EdTech',
  'Research Platforms',
  'Skill Development',
  'Handloom',
  'Handicrafts',
  'Cottage Industries',
  'DefenseTech',
  'Satellite Systems',
  'TelecomTech',
  'Network Infrastructure',
  'HospitalityTech',
  'TravelTech',
  'LeisureTech',
]

const LOWERCASED = INDUSTRIES.map((i) => ({ value: i, lower: i.toLowerCase() }))

/**
 * Two-pass filter: prefix matches first (tier order preserved), then
 * substring matches. Returns up to `limit` results.
 */
export function filterIndustries(query: string, limit = 10): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return INDUSTRIES.slice(0, limit)
  const prefix: string[] = []
  const contains: string[] = []
  for (const entry of LOWERCASED) {
    if (entry.lower.startsWith(q)) {
      prefix.push(entry.value)
      if (prefix.length >= limit) break
    } else if (entry.lower.includes(q)) {
      contains.push(entry.value)
    }
  }
  return [...prefix, ...contains].slice(0, limit)
}
