import './patch'
import { setupListeners } from './listeners'
import { recorderEventBus } from './eventBus'
import { SessionRecorder } from './sessionRecorder'
export {
  ATTR_MULTIPLAYER_SESSION_ID,
  ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
  ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
  SessionType,
  SessionRecorderIdGenerator,
  SessionRecorderHttpTraceExporterBrowser,
} from '@multiplayer-app/session-recorder-common'

const SessionRecorderInstance = new SessionRecorder()

// Attach the instance to the global object (window in browser)
if (typeof window !== 'undefined') {
  window['__SESSION_RECORDER_LOADED'] = true
  window['SessionRecorder'] = SessionRecorderInstance
  setupListeners(SessionRecorderInstance)
}

export default SessionRecorderInstance

export { recorderEventBus }
