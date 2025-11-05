import SessionRecorderBrowser from '@multiplayer-app/session-recorder-browser';

export * from '@multiplayer-app/session-recorder-browser';
export * from './context/SessionRecorderContext';
export * from './context/useSessionRecorderStore';

export { useNavigationRecorder } from './navigation'
export type { UseNavigationRecorderOptions } from './navigation'

export default SessionRecorderBrowser
