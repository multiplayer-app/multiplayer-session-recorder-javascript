import './patch'
import { setupListeners } from './listeners'
import { recorderEventBus } from './eventBus'
import { SessionRecorder } from './session-recorder'
import { isBrowser, globalObj, SESSION_RECORDER_LOADED, SESSION_RECORDER_LISTENERS_SETUP } from './global'

export * from './types'
export * from './navigation'
export * from '@multiplayer-app/session-recorder-common'

// Create or reuse a single global instance, but be safe in non-browser environments

let SessionRecorderInstance: SessionRecorder
if (isBrowser) {
  // Reuse existing instance if already injected (e.g., by an extension)
  const existing = globalObj['SessionRecorder'] as SessionRecorder | undefined
  SessionRecorderInstance = existing ?? new SessionRecorder()

  // Attach to the global object for reuse across bundles/loads
  globalObj['SessionRecorder'] = SessionRecorderInstance
  globalObj[SESSION_RECORDER_LOADED] = true

  // Ensure listeners are set up only once
  if (!globalObj[SESSION_RECORDER_LISTENERS_SETUP]) {
    setupListeners(SessionRecorderInstance)
    globalObj[SESSION_RECORDER_LISTENERS_SETUP] = true
  }
} else {
  // SSR / non-DOM environments: create an instance but don't touch globals or listeners
  SessionRecorderInstance = new SessionRecorder()
}

export { recorderEventBus }

export default SessionRecorderInstance
