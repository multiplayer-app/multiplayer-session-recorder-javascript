import './patch'
import SessionRecorder from './session-recorder'
export * from '@multiplayer-app/session-recorder-common'
export * from './context/SessionRecorderContext'
export * from './context/useSessionRecorderStore'

// Export the class for type checking
export { SessionRecorder }
// Export the instance as default
export default SessionRecorder
