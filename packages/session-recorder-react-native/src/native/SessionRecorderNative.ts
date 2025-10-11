import { Platform, NativeEventEmitter } from 'react-native';
import SessionRecorderNative, { type MaskingOptions, type Spec } from '../NativeSessionRecorderModule';


// Check if we're on web platform
const isWeb = Platform.OS === 'web';

// Get the Turbo Module
let eventEmitter = new NativeEventEmitter(SessionRecorderNative as any);


// Validate that the native module is available
if (!SessionRecorderNative && !isWeb) {
  console.warn(
    'SessionRecorderNative Turbo Module is not available. Auto-linking may not have completed yet.'
  );
} else if (isWeb) {
  console.info(
    'SessionRecorderNative: Running on web platform, native module disabled'
  );
}

// Create a safe wrapper that handles web platform
const SafeSessionRecorderNative: Spec = {
  async captureAndMask(): Promise<string> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform');
    }
    return SessionRecorderNative.captureAndMask();
  },

  async captureAndMaskWithOptions(options: MaskingOptions): Promise<string> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform');
    }
    return SessionRecorderNative.captureAndMaskWithOptions(options);
  },

  async startGestureRecording(): Promise<void> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform');
    }
    return SessionRecorderNative.startGestureRecording();
  },

  async stopGestureRecording(): Promise<void> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform');
    }
    return SessionRecorderNative.stopGestureRecording();
  },

  async isGestureRecordingActive(): Promise<boolean> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform');
    }
    return SessionRecorderNative.isGestureRecordingActive();
  },

  recordGesture(gestureType: string, x: number, y: number, target?: string, metadata?: any): void {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform');
    }
    SessionRecorderNative.recordGesture(gestureType, x, y, target, metadata);
  },

  addListener(_eventName: string): void {
    // Required for RN event emitter contracts
  },

  removeListeners(_count: number): void {
    // Required for RN event emitter contracts
  },
};

export interface NativeGestureEvent {
  type:
  | 'tap'
  | 'pan_start'
  | 'pan_move'
  | 'pan_end'
  | 'long_press'
  | 'pinch'
  | 'swipe';
  timestamp: number;
  x: number;
  y: number;
  target?: string;
  targetInfo?: {
    identifier: string;
    label?: string;
    role?: string;
    testId?: string;
    text?: string;
  };
  metadata?: {
    pressure?: number;
    velocity?: number;
    scale?: number;
    direction?: string;
    distance?: number;
  };
}

// Helper function to set gesture callback using event emitter pattern
export function setGestureCallback(callback: (event: NativeGestureEvent) => void): void {
  if (isWeb || !SessionRecorderNative) {
    throw new Error('SessionRecorderNative is not available on web platform');
  }
  eventEmitter?.removeAllListeners('onGestureDetected');
  eventEmitter?.addListener('onGestureDetected', callback as any);
}

export default SafeSessionRecorderNative;

// Export event emitter for gesture events to maintain previous API
export const gestureEventEmitter = eventEmitter;
export type { MaskingOptions };