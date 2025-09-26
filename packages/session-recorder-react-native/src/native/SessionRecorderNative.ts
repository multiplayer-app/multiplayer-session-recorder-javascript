import { NativeModules } from 'react-native'

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
}

// Get the native module
const { SessionRecorderNative } = NativeModules

// Validate that the native module is available
if (!SessionRecorderNative) {
  console.warn('SessionRecorderNative module is not available. Auto-linking may not have completed yet.')
}

export default SessionRecorderNative as SessionRecorderNativeModule
