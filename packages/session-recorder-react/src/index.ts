import SessionRecorderBrowser, { recorderEventBus } from '@multiplayer-app/session-recorder-browser'
export * from '@multiplayer-app/session-recorder-common'

export { recorderEventBus }
export { SessionRecorderProvider, useSessionRecorder } from './react/SessionRecorderContext'
export { useSessionRecorderStore, sessionRecorderStore } from './react/useSessionRecorderStore'
export { useNavigationRecorder } from './react/navigation'

export default SessionRecorderBrowser
