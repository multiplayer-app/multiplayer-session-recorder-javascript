/**
 * LocalStorage utility functions
 */

const hasLocalStorage = typeof window !== 'undefined' && !!window.localStorage

export const getStoredItem = (key: string, parse?: boolean): any => {
  if (!hasLocalStorage) {
    return parse ? null : null
  }
  const item = window.localStorage.getItem(key)
  return parse ? (item ? JSON.parse(item) : null) : item
}

export const setStoredItem = (key: string, value: any) => {
  if (!hasLocalStorage) {
    return
  }
  if (value === null || value === undefined) {
    window.localStorage.removeItem(key)
  } else {
    window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
}

export const removeStoredItem = (key: string) => {
  if (!hasLocalStorage) {
    return
  }
  window.localStorage.removeItem(key)
}