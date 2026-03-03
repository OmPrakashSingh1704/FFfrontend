export const componentInstructions = {
  buttons: {
    primary: 'rounded-full bg-cyan-400 text-black font-bold hover:shadow-[0_0_20px_rgba(0,240,255,0.6)] transition-all duration-300 hover:scale-105',
    secondary: 'rounded-full border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/40 transition-all',
    ghost: 'text-slate-400 hover:text-cyan-400 transition-colors'
  },
  cards: {
    default: 'bg-[#0B0F17] border border-white/5 rounded-2xl p-6 hover:border-cyan-500/30 transition-colors group',
    glass: 'bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6'
  },
  inputs: {
    default: 'bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all outline-none'
  }
} as const

export type ComponentInstructions = typeof componentInstructions
