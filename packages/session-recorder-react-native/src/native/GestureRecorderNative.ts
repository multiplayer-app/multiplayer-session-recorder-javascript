import { NativeModules, NativeEventEmitter } from 'react-native'

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

// Get the native module
const { GestureRecorderNative } = NativeModules

// Validate that the native module is available
if (!GestureRecorderNative) {
  console.warn('GestureRecorderNative module is not available. Auto-linking may not have completed yet.')
}

// Create event emitter for gesture events
const gestureEventEmitter = GestureRecorderNative ? new NativeEventEmitter(GestureRecorderNative) : null

export default GestureRecorderNative as GestureRecorderNativeModule

// Export event emitter for gesture events
export { gestureEventEmitter }
