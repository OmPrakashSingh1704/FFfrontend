export const universalGuidelines = [
  "Do not use 'Inter' for headings. Use 'Space Grotesk'.",
  "Do not use gradients for text unless it's a very large hero title.",
  "Always use 'lucide-react' for icons.",
  'Ensure all interactive elements have hover states (brightness-110 or scale-105).',
  "Use 'data-testid' for all interactive elements.",
  "For the 'FoundersLib' brand, think 'Cyberpunk meets Wall Street'.",
  'Use the provided image URLs for placeholders. Do not use generic placeholders.'
] as const

export type UniversalGuideline = (typeof universalGuidelines)[number]
