import './patch'
import { setupListeners } from './listeners'
import { recorderEventBus } from './eventBus'
import { SessionRecorder } from './sessionRecorder'

export * from './types'
export * from './navigation'
export * from '@multiplayer-app/session-recorder-common'

const SessionRecorderInstance = new SessionRecorder()

// Attach the instance to the global object (window in browser)
if (typeof window !== 'undefined') {
  window['__SESSION_RECORDER_LOADED'] = true
  window['SessionRecorder'] = SessionRecorderInstance
  setupListeners(SessionRecorderInstance)
}

export { recorderEventBus }

export default SessionRecorderInstance
