const ACTIVE_CALLS_KEY = 'ff_active_call_ids'

export function getActiveCallIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ACTIVE_CALLS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value) => typeof value === 'string')
  } catch {
    return []
  }
}

export function setActiveCallIds(ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_CALLS_KEY, JSON.stringify(ids))
}

export function addActiveCallId(callId: string) {
  const ids = getActiveCallIds()
  if (ids.includes(callId)) return
  setActiveCallIds([...ids, callId])
}

export function removeActiveCallId(callId: string) {
  const ids = getActiveCallIds().filter((id) => id !== callId)
  setActiveCallIds(ids)
}

export function clearActiveCallIds() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACTIVE_CALLS_KEY)
}
