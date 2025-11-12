
export const SESSION_RECORDER_LOADED = '__SESSION_RECORDER_LOADED'
export const SESSION_RECORDER_INJECTED = '__SESSION_RECORDER_INJECTED'
export const SESSION_RECORDER_LISTENERS_SETUP = '__SESSION_RECORDER_LISTENERS_SETUP'

export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
export const globalObj: Record<string, unknown> = typeof globalThis !== 'undefined'
  ? (globalThis as unknown as Record<string, unknown>)
  : (isBrowser ? (window as unknown as Record<string, unknown>) : {})

export const isBrowserExtension = isBrowser && SESSION_RECORDER_INJECTED in globalObj