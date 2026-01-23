/**
 * Storage utility functions.
 *
 * Session state must be isolated per-tab to avoid conflicts across multiple tabs.
 * We therefore prefer `sessionStorage` and fall back to `localStorage` if needed.
 */

const hasWindow = typeof window !== 'undefined'

const getStorage = (): Storage | null => {
  if (!hasWindow) return null
  try {
    if (window.sessionStorage) return window.sessionStorage
  } catch (_e) {
    // sessionStorage can throw (e.g. blocked in some environments)
  }
  try {
    if (window.localStorage) return window.localStorage
  } catch (_e) {
    // localStorage can throw (e.g. blocked in some environments)
  }
  return null
}

export const getStoredItem = (key: string, parse?: boolean): any => {
  const storage = getStorage()
  if (!storage) return null
  const item = storage.getItem(key)
  return parse ? (item ? JSON.parse(item) : null) : item
}

export const setStoredItem = (key: string, value: any) => {
  const storage = getStorage()
  if (!storage) return
  if (value === null || value === undefined) {
    storage.removeItem(key)
  } else {
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
}

export const removeStoredItem = (key: string) => {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(key)
}