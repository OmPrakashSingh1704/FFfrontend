/**
 * Curated location list for LocationInput.
 *
 * Strategy: this list is the *primary* source for the location combobox.
 * The Photon geocoder is only consulted when a user query has zero local
 * matches, which makes typical lookups (cities the user already knows)
 * instant and offline.
 *
 * Coverage goal: every country in the world + the top ~200 cities by
 * startup density. Total bundle weight is small (~25KB before gzip,
 * ~6-8KB after).
 *
 * Order matters for ties: India-first city ordering, then global hubs,
 * then alphabetical country fallbacks. The component filters by prefix
 * first, substring second, so order only matters within a tier.
 */

export const LOCATIONS: readonly string[] = [
  // ── India (primary market) ───────────────────────────────────────────
  'Bangalore, India', 'Mumbai, India', 'Delhi, India', 'Delhi-NCR, India',
  'New Delhi, India', 'Gurgaon, India', 'Noida, India', 'Hyderabad, India',
  'Pune, India', 'Chennai, India', 'Kolkata, India', 'Ahmedabad, India',
  'Jaipur, India', 'Chandigarh, India', 'Indore, India', 'Kochi, India',
  'Coimbatore, India', 'Bhubaneswar, India', 'Surat, India', 'Lucknow, India',
  'Kanpur, India', 'Nagpur, India', 'Visakhapatnam, India', 'Bhopal, India',
  'Patna, India', 'Vadodara, India', 'Thiruvananthapuram, India',
  'Mysore, India', 'Goa, India', 'Mangalore, India', 'Nashik, India',
  'Faridabad, India', 'Ghaziabad, India', 'Ludhiana, India',
  'Vijayawada, India', 'Guwahati, India',

  // ── United States ────────────────────────────────────────────────────
  'San Francisco, USA', 'New York, USA', 'Los Angeles, USA',
  'Boston, USA', 'Seattle, USA', 'Austin, USA', 'Chicago, USA',
  'Miami, USA', 'San Jose, USA', 'Palo Alto, USA', 'Mountain View, USA',
  'Sunnyvale, USA', 'Oakland, USA', 'Berkeley, USA', 'Cambridge, USA',
  'Washington DC, USA', 'Denver, USA', 'Atlanta, USA', 'Dallas, USA',
  'Houston, USA', 'Phoenix, USA', 'Portland, USA', 'San Diego, USA',
  'Philadelphia, USA', 'Pittsburgh, USA', 'Minneapolis, USA',
  'Raleigh, USA', 'Nashville, USA', 'Charlotte, USA', 'Salt Lake City, USA',
  'Brooklyn, USA', 'Manhattan, USA',

  // ── Europe ───────────────────────────────────────────────────────────
  'London, United Kingdom', 'Manchester, United Kingdom',
  'Edinburgh, United Kingdom', 'Cambridge, United Kingdom',
  'Oxford, United Kingdom', 'Bristol, United Kingdom',
  'Berlin, Germany', 'Munich, Germany', 'Hamburg, Germany',
  'Frankfurt, Germany', 'Cologne, Germany',
  'Paris, France', 'Lyon, France', 'Marseille, France', 'Toulouse, France',
  'Amsterdam, Netherlands', 'Rotterdam, Netherlands', 'Utrecht, Netherlands',
  'Stockholm, Sweden', 'Gothenburg, Sweden', 'Malmö, Sweden',
  'Copenhagen, Denmark', 'Helsinki, Finland', 'Oslo, Norway',
  'Zurich, Switzerland', 'Geneva, Switzerland', 'Bern, Switzerland',
  'Dublin, Ireland', 'Cork, Ireland',
  'Lisbon, Portugal', 'Porto, Portugal',
  'Madrid, Spain', 'Barcelona, Spain', 'Valencia, Spain', 'Seville, Spain',
  'Milan, Italy', 'Rome, Italy', 'Turin, Italy', 'Naples, Italy',
  'Vienna, Austria', 'Brussels, Belgium', 'Antwerp, Belgium',
  'Warsaw, Poland', 'Krakow, Poland', 'Prague, Czech Republic',
  'Budapest, Hungary', 'Bucharest, Romania', 'Athens, Greece',
  'Sofia, Bulgaria', 'Tallinn, Estonia', 'Riga, Latvia', 'Vilnius, Lithuania',
  'Reykjavík, Iceland', 'Luxembourg, Luxembourg',

  // ── Middle East & North Africa ───────────────────────────────────────
  'Tel Aviv, Israel', 'Jerusalem, Israel', 'Haifa, Israel',
  'Dubai, UAE', 'Abu Dhabi, UAE',
  'Doha, Qatar', 'Riyadh, Saudi Arabia', 'Jeddah, Saudi Arabia',
  'Manama, Bahrain', 'Kuwait City, Kuwait', 'Muscat, Oman', 'Amman, Jordan',
  'Beirut, Lebanon', 'Istanbul, Turkey', 'Ankara, Turkey', 'Izmir, Turkey',
  'Cairo, Egypt', 'Alexandria, Egypt', 'Casablanca, Morocco', 'Tunis, Tunisia',

  // ── Asia-Pacific ─────────────────────────────────────────────────────
  'Singapore', 'Hong Kong',
  'Tokyo, Japan', 'Osaka, Japan', 'Kyoto, Japan', 'Fukuoka, Japan',
  'Seoul, South Korea', 'Busan, South Korea',
  'Shanghai, China', 'Beijing, China', 'Shenzhen, China', 'Guangzhou, China',
  'Hangzhou, China', 'Chengdu, China', 'Suzhou, China',
  'Taipei, Taiwan', 'Hsinchu, Taiwan',
  'Bangkok, Thailand', 'Chiang Mai, Thailand', 'Phuket, Thailand',
  'Jakarta, Indonesia', 'Bandung, Indonesia', 'Surabaya, Indonesia', 'Bali, Indonesia',
  'Kuala Lumpur, Malaysia', 'Penang, Malaysia',
  'Manila, Philippines', 'Cebu, Philippines',
  'Ho Chi Minh City, Vietnam', 'Hanoi, Vietnam',
  'Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia',
  'Perth, Australia', 'Adelaide, Australia', 'Canberra, Australia',
  'Auckland, New Zealand', 'Wellington, New Zealand',
  'Karachi, Pakistan', 'Lahore, Pakistan', 'Islamabad, Pakistan',
  'Dhaka, Bangladesh', 'Colombo, Sri Lanka', 'Kathmandu, Nepal',

  // ── Americas (non-US) ────────────────────────────────────────────────
  'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada',
  'Calgary, Canada', 'Ottawa, Canada', 'Waterloo, Canada',
  'Mexico City, Mexico', 'Monterrey, Mexico', 'Guadalajara, Mexico',
  'São Paulo, Brazil', 'Rio de Janeiro, Brazil', 'Brasília, Brazil',
  'Buenos Aires, Argentina', 'Córdoba, Argentina',
  'Santiago, Chile', 'Lima, Peru', 'Bogotá, Colombia', 'Medellín, Colombia',
  'Caracas, Venezuela', 'Quito, Ecuador', 'Montevideo, Uruguay',
  'San José, Costa Rica', 'Panama City, Panama',

  // ── Africa ───────────────────────────────────────────────────────────
  'Lagos, Nigeria', 'Abuja, Nigeria', 'Nairobi, Kenya', 'Mombasa, Kenya',
  'Cape Town, South Africa', 'Johannesburg, South Africa', 'Pretoria, South Africa',
  'Accra, Ghana', 'Kigali, Rwanda', 'Kampala, Uganda', 'Dar es Salaam, Tanzania',
  'Addis Ababa, Ethiopia', 'Algiers, Algeria',

  // ── Country-only fallbacks (alphabetical, deduped against city list) ─
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belarus', 'Belgium',
  'Bolivia', 'Brazil', 'Bulgaria', 'Cambodia', 'Cameroon', 'Canada',
  'Chile', 'China', 'Colombia', 'Costa Rica', 'Croatia', 'Cyprus',
  'Czech Republic', 'Denmark', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Estonia', 'Ethiopia', 'Finland', 'France', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Guatemala', 'Honduras', 'Hong Kong',
  'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya',
  'Kuwait', 'Latvia', 'Lebanon', 'Lithuania', 'Luxembourg', 'Malaysia',
  'Maldives', 'Malta', 'Mexico', 'Moldova', 'Mongolia', 'Morocco',
  'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway',
  'Oman', 'Pakistan', 'Panama', 'Paraguay', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia',
  'Serbia', 'Singapore', 'Slovakia', 'Slovenia', 'South Africa',
  'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey', 'UAE', 'Uganda',
  'Ukraine', 'United Kingdom', 'Uruguay', 'USA', 'Uzbekistan', 'Venezuela',
  'Vietnam', 'Yemen', 'Zimbabwe',
]

const LOWERCASED = LOCATIONS.map((l) => ({ value: l, lower: l.toLowerCase() }))

/**
 * Synchronous filter against the bundled list.
 *
 * Two-pass to favor prefix matches:
 *   1. Entries whose lowercase starts with the query.
 *   2. Entries whose lowercase contains the query (but doesn't start).
 *
 * Returns up to `limit` matches in tier order.
 */
export function filterLocations(query: string, limit = 10): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const prefixMatches: string[] = []
  const containsMatches: string[] = []
  for (const entry of LOWERCASED) {
    if (entry.lower.startsWith(q)) {
      prefixMatches.push(entry.value)
      if (prefixMatches.length >= limit) break
    } else if (entry.lower.includes(q)) {
      containsMatches.push(entry.value)
    }
  }
  return [...prefixMatches, ...containsMatches].slice(0, limit)
}
