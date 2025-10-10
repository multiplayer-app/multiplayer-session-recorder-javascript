
import { NativeEventEmitter, Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Capture the current screen and apply masking to sensitive elements
   * @returns Promise that resolves to base64 encoded image
   */
  captureAndMask(): Promise<string>

  /**
   * Capture the current screen and apply masking with custom options
   * @param options Custom masking options
   * @returns Promise that resolves to base64 encoded image
   */
  captureAndMaskWithOptions(options: MaskingOptions): Promise<string>

  // Gesture recording APIs
  startGestureRecording(): Promise<void>
  stopGestureRecording(): Promise<void>
  isGestureRecordingActive(): Promise<boolean>
  setGestureCallback(callback: (event: any) => void): void
}

export interface MaskingOptions {
  /** Quality of the captured image (0.1 to 1.0, default: 0.3 for smaller file size) */
  quality?: number
  /** Scale of the captured image (0.1 to 1.0, default: 1.0) */
  scale?: number
  /** Whether to mask text inputs (UITextField, UITextView, React Native text components) */
  maskTextInputs?: boolean
  /** Whether to mask images (UIImageView, React Native Image components) */
  maskImages?: boolean
  /** Whether to mask buttons (UIButton) */
  maskButtons?: boolean
  /** Whether to mask labels (UILabel) */
  maskLabels?: boolean
  /** Whether to mask web views (WKWebView) */
  maskWebViews?: boolean
  /** Whether to mask sandboxed views (system views that don't belong to current process) */
  maskSandboxedViews?: boolean
}


export interface SessionRecorderNativeModule {
  /**
   * Capture the current screen and apply masking to sensitive elements
   * @returns Promise that resolves to base64 encoded image
   */
  captureAndMask(): Promise<string>

  /**
   * Capture the current screen and apply masking with custom options
   * @param options Custom masking options
   * @returns Promise that resolves to base64 encoded image
   */
  captureAndMaskWithOptions(options: MaskingOptions): Promise<string>

  // Gesture recording APIs
  startGestureRecording(): Promise<void>
  stopGestureRecording(): Promise<void>
  isGestureRecordingActive(): Promise<boolean>
  setGestureCallback(callback: (event: any) => void): void
}

// Check if we're on web platform
const isWeb = Platform.OS === 'web'

// Get the Turbo Module
let SessionRecorderNative: Spec | null = null
let eventEmitter: NativeEventEmitter | null = null

if (!isWeb) {
  try {
    SessionRecorderNative = TurboModuleRegistry.getEnforcing<Spec>('SessionRecorderNative')
    eventEmitter = new NativeEventEmitter(SessionRecorderNative as any)
  } catch (error) {
    console.warn('Failed to access SessionRecorderNative Turbo Module:', error)
  }
}

// Validate that the native module is available
if (!SessionRecorderNative && !isWeb) {
  console.warn('SessionRecorderNative Turbo Module is not available. Auto-linking may not have completed yet.')
} else if (isWeb) {
  console.info('SessionRecorderNative: Running on web platform, native module disabled')
}

// Create a safe wrapper that handles web platform
const SafeSessionRecorderNative: Spec = {
  async captureAndMask(): Promise<string> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform')
    }
    return SessionRecorderNative.captureAndMask()
  },

  async captureAndMaskWithOptions(options: MaskingOptions): Promise<string> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform')
    }
    return SessionRecorderNative.captureAndMaskWithOptions(options)
  },

  async startGestureRecording(): Promise<void> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform')
    }
    return SessionRecorderNative.startGestureRecording()
  },

  async stopGestureRecording(): Promise<void> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform')
    }
    return SessionRecorderNative.stopGestureRecording()
  },

  async isGestureRecordingActive(): Promise<boolean> {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform')
    }
    return SessionRecorderNative.isGestureRecordingActive()
  },

  setGestureCallback(callback: (event: any) => void): void {
    if (isWeb || !SessionRecorderNative) {
      throw new Error('SessionRecorderNative is not available on web platform')
    }
    // Native side will also invoke callback if provided; also subscribe to events here
    try {
      SessionRecorderNative.setGestureCallback(callback as any)
    } catch { }
    eventEmitter?.removeAllListeners('onGestureDetected')
    eventEmitter?.addListener('onGestureDetected', callback)
  }
}

export interface NativeGestureEvent {
  type: 'tap' | 'pan_start' | 'pan_move' | 'pan_end' | 'long_press' | 'pinch' | 'swipe'
  timestamp: number
  x: number
  y: number
  target?: string
  targetInfo?: {
    identifier: string
    label?: string
    role?: string
    testId?: string
    text?: string
  }
  metadata?: {
    pressure?: number
    velocity?: number
    scale?: number
    direction?: string
    distance?: number
  }
}

export default SafeSessionRecorderNative

// Export event emitter for gesture events to maintain previous API
export const gestureEventEmitter = eventEmitter
