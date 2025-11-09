import './patch'
import { setupListeners } from './listeners'
import { recorderEventBus } from './eventBus'
import { SessionRecorder } from './sessionRecorder'

export * from './types'
export * from './navigation'
export * from '@multiplayer-app/session-recorder-common'

// Create or reuse a single global instance, but be safe in non-browser environments
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
// Prefer globalThis when available; fall back to window in browsers
const globalObj: Record<string, unknown> = typeof globalThis !== 'undefined'
  ? (globalThis as unknown as Record<string, unknown>)
  : (isBrowser ? (window as unknown as Record<string, unknown>) : {})

let SessionRecorderInstance: SessionRecorder
if (isBrowser) {
  // Reuse existing instance if already injected (e.g., by an extension)
  const existing = globalObj['SessionRecorder'] as SessionRecorder | undefined
  SessionRecorderInstance = existing ?? new SessionRecorder()

  // Attach to the global object for reuse across bundles/loads
  globalObj['SessionRecorder'] = SessionRecorderInstance
  globalObj['__SESSION_RECORDER_LOADED'] = true

  // Ensure listeners are set up only once
  if (!globalObj['__SESSION_RECORDER_LISTENERS_SETUP__']) {
    setupListeners(SessionRecorderInstance)
    globalObj['__SESSION_RECORDER_LISTENERS_SETUP__'] = true
  }
} else {
  // SSR / non-DOM environments: create an instance but don't touch globals or listeners
  SessionRecorderInstance = new SessionRecorder()
}

export { recorderEventBus }

export default SessionRecorderInstance
