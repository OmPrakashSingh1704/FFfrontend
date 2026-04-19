import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'

export type FeatureFlags = {
  credits: boolean
  leagues: boolean
  respects: boolean
  connections: boolean
}

const defaults: FeatureFlags = { credits: true, leagues: true, respects: true, connections: true }

const FeatureFlagsContext = createContext<FeatureFlags>(defaults)

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaults)

  useEffect(() => {
    apiRequest<{ features: FeatureFlags }>('/config/', { auth: false })
      .then((data) => setFlags({ ...defaults, ...data.features }))
      .catch(() => {
        // network error or config unavailable — keep defaults (all enabled)
      })
  }, [])

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext)
}
