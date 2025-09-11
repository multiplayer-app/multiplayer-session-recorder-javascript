import './patch'
import SessionRecorder from './session-recorder'
export * from '@multiplayer-app/session-recorder-common'
export * from './context/SessionRecorderContext'

// Export platform utilities including app metadata configuration
export {
  detectPlatform,
  isExpoEnvironment,
  configureAppMetadata,
  getPlatformAttributes,
  getConfiguredAppMetadata,
} from './utils/platform'

export { SessionRecorder }
// Export the instance as default
export default SessionRecorder
