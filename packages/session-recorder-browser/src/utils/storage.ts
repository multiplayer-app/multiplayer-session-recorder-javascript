/**
 * LocalStorage utility functions
 */

export const getStoredItem = (key: string, parse?: boolean): any => {
  const item = localStorage?.getItem(key)
  return parse ? (item ? JSON.parse(item) : null) : item
}

export const setStoredItem = (key: string, value: any) => {
  if (value === null || value === undefined) {
    localStorage?.removeItem(key)
  } else {
    localStorage?.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
}

export const removeStoredItem = (key: string) => {
  localStorage?.removeItem(key)
}