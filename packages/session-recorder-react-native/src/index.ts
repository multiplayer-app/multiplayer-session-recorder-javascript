import './patch'
import SessionRecorder from './session-recorder'
export * from '@multiplayer-app/session-recorder-common'
export * from './context/SessionRecorderContext'

// Export the class for type checking
export { SessionRecorder }
// Export the instance as default
export default SessionRecorder
