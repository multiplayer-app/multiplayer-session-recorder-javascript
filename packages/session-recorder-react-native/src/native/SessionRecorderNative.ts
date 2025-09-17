import { NativeModules } from 'react-native'

export interface MaskingOptions {
  /** Quality of the captured image (0.1 to 1.0) */
  quality?: number
  /** Whether to mask all input fields automatically */
  inputMasking?: boolean
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
}

// Get the native module
const { SessionRecorderNative } = NativeModules

// Validate that the native module is available
if (!SessionRecorderNative) {
  console.warn('SessionRecorderNative module is not available. Auto-linking may not have completed yet.')
}

export default SessionRecorderNative as SessionRecorderNativeModule
