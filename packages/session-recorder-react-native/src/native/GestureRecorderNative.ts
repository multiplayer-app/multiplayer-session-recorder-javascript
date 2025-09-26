import { NativeModules, NativeEventEmitter, Platform } from 'react-native'

export interface GestureEvent {
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

export interface GestureRecorderNativeModule {
  /**
   * Start gesture recording
   * @returns Promise that resolves when recording starts
   */
  startGestureRecording(): Promise<void>

  /**
   * Stop gesture recording
   * @returns Promise that resolves when recording stops
   */
  stopGestureRecording(): Promise<void>

  /**
   * Check if gesture recording is currently active
   * @returns Promise that resolves to boolean indicating recording status
   */
  isGestureRecordingActive(): Promise<boolean>

  /**
   * Set gesture callback to receive gesture events
   * @param callback Function to call when gestures are detected
   */
  setGestureCallback(callback: (gesture: GestureEvent) => void): void

  /**
   * Manually record a gesture event (for testing or manual recording)
   * @param gestureType Type of gesture
   * @param x X coordinate
   * @param y Y coordinate
   * @param target Target element identifier
   * @param metadata Additional gesture metadata
   */
  recordGesture(
    gestureType: string,
    x: number,
    y: number,
    target?: string,
    metadata?: Record<string, any>
  ): void
}

// Check if we're on web platform
const isWeb = Platform.OS === 'web'

// Get the native module only if not on web
let GestureRecorderNative: GestureRecorderNativeModule | null = null

if (!isWeb) {
  try {
    const { GestureRecorderNative: NativeModule } = NativeModules
    GestureRecorderNative = NativeModule
  } catch (error) {
    console.warn('Failed to access GestureRecorderNative module:', error)
  }
}

// Validate that the native module is available
if (!GestureRecorderNative && !isWeb) {
  console.warn('GestureRecorderNative module is not available. Auto-linking may not have completed yet.')
} else if (isWeb) {
  console.info('GestureRecorderNative: Running on web platform, native module disabled')
}

// Create event emitter for gesture events only if not on web
const gestureEventEmitter = (!isWeb && GestureRecorderNative) ? new NativeEventEmitter(GestureRecorderNative as any) : null

// Create a safe wrapper that handles web platform
const SafeGestureRecorderNative: GestureRecorderNativeModule = {
  async startGestureRecording(): Promise<void> {
    if (isWeb || !GestureRecorderNative) {
      throw new Error('GestureRecorderNative is not available on web platform')
    }
    return GestureRecorderNative.startGestureRecording()
  },

  async stopGestureRecording(): Promise<void> {
    if (isWeb || !GestureRecorderNative) {
      throw new Error('GestureRecorderNative is not available on web platform')
    }
    return GestureRecorderNative.stopGestureRecording()
  },

  async isGestureRecordingActive(): Promise<boolean> {
    if (isWeb || !GestureRecorderNative) {
      return false
    }
    return GestureRecorderNative.isGestureRecordingActive()
  },

  setGestureCallback(callback: (gesture: GestureEvent) => void): void {
    if (isWeb || !GestureRecorderNative) {
      console.warn('GestureRecorderNative is not available on web platform')
      return
    }
    GestureRecorderNative.setGestureCallback(callback)
  },

  recordGesture(
    gestureType: string,
    x: number,
    y: number,
    target?: string,
    metadata?: Record<string, any>
  ): void {
    if (isWeb || !GestureRecorderNative) {
      console.warn('GestureRecorderNative is not available on web platform')
      return
    }
    GestureRecorderNative.recordGesture(gestureType, x, y, target, metadata)
  }
}

export default SafeGestureRecorderNative

// Export event emitter for gesture events
export { gestureEventEmitter }
