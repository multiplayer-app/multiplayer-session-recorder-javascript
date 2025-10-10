import './patch';
import SessionRecorder from './session-recorder';
export * from '@multiplayer-app/session-recorder-common';
export * from './context/SessionRecorderContext';
export * from './context/useSessionRecorderStore';

// Export TurboModule spec for codegen
export * from './SessionRecorderNativeSpec';

// Export the class for type checking
export { SessionRecorder };
// Export the instance as default
export default SessionRecorder;
