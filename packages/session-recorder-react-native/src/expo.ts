import './patch'
import SessionRecorder from './session-recorder'
export * from '@multiplayer-app/session-recorder-common'
export * from './context/SessionRecorderContext'

export { SessionRecorder }
// Export the instance as default
export default SessionRecorder

// Export Expo-specific utilities
export { isExpoEnvironment, getPlatformAttributes } from './utils/platform'
