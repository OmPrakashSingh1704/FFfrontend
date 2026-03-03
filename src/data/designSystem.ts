export const designSystem = {
  identity: {
    name: 'FoundersLib',
    vibe: 'Bioluminescent Void',
    corePhilosophy: 'High-stakes networking in a futuristic, distraction-free environment. Dark mode only. Neon accents. Glass surfaces.',
    reference: 'smallest.ai'
  },
  typography: {
    fontFamily: {
      heading: 'Space Grotesk, sans-serif',
      body: 'Manrope, sans-serif',
      mono: 'JetBrains Mono, monospace'
    },
    scale: {
      h1: 'text-5xl md:text-7xl font-bold tracking-tighter leading-[0.9]',
      h2: 'text-4xl md:text-5xl font-bold tracking-tight',
      h3: 'text-2xl md:text-3xl font-semibold tracking-tight',
      bodyLg: 'text-lg leading-relaxed text-slate-300',
      bodyBase: 'text-base leading-relaxed text-slate-400',
      caption: "text-xs uppercase tracking-[0.2em] text-slate-500 font-medium"
    }
  },
  colors: {
    palette: {
      background: {
        default: '#020408',
        paper: '#0B0F17',
        subtle: '#131825'
      },
      primary: {
        DEFAULT: '#00F0FF',
        foreground: '#000000',
        glow: 'rgba(0, 240, 255, 0.5)'
      },
      secondary: {
        DEFAULT: '#7000FF',
        foreground: '#FFFFFF',
        glow: 'rgba(112, 0, 255, 0.5)'
      },
      accent: {
        DEFAULT: '#FF0055',
        foreground: '#FFFFFF'
      },
      neutral: {
        50: '#F8FAFC',
        100: '#F1F5F9',
        200: '#E2E8F0',
        300: '#CBD5E1',
        400: '#94A3B8',
        500: '#64748B',
        600: '#475569',
        700: '#334155',
        800: '#1E293B',
        900: '#0F172A',
        950: '#020617'
      }
    },
    gradients: {
      primary: 'linear-gradient(135deg, #00F0FF 0%, #7000FF 100%)',
      glass: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
      glowText: 'linear-gradient(to right, #00F0FF, #7000FF)'
    }
  },
  spacing: {
    containerPadding: 'px-6 md:px-12 lg:px-24',
    sectionGap: 'gap-16 md:gap-32',
    elementGap: 'gap-4 md:gap-8'
  },
  visualEnhancers: {
    glassmorphism: 'bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl',
    neonBorder: 'border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.3)]',
    tracingBeam:
      "relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-cyan-500/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-1000",
    noiseTexture: "bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none fixed inset-0 z-50"
  },
  layoutStrategies: {
    marketing: "Asymmetric 'Tetris' Grid. Use col-span-full for heroes, col-span-4 for features. Never symmetric.",
    dashboard: 'High-Density Bento Grid. Gap-4. Cards must fill height (h-full).',
    lists: "Clean rows with hover reveal actions. No zebra striping. Use 1px border-b border-white/5."
  }
} as const

export type DesignSystem = typeof designSystem
