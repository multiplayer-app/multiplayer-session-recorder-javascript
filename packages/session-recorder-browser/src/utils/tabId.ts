const TAB_ID_KEY = 'multiplayer-tab-id'

const randomId = (): string => {
  // Avoid crypto dependency for older browsers; good enough for per-tab isolation
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const getOrCreateTabId = (): string => {
  if (typeof window === 'undefined') return 'ssr'

  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY)
    if (existing) return existing
    const id = randomId()
    window.sessionStorage.setItem(TAB_ID_KEY, id)
    return id
  } catch (_e) {
    // If sessionStorage is blocked, fall back to a runtime-only id.
    return randomId()
  }
}
