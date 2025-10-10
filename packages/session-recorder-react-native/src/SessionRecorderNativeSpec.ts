import { NativeModules } from 'react-native';

export interface Spec {
  /**
   * Capture the current screen and apply masking to sensitive elements
   * @returns Promise that resolves to base64 encoded image
   */
  captureAndMask(): Promise<string>;

  /**
   * Capture the current screen and apply masking with custom options
   * @param options Custom masking options
   * @returns Promise that resolves to base64 encoded image
   */
  captureAndMaskWithOptions(options: MaskingOptions): Promise<string>;

  // Gesture recording APIs
  startGestureRecording(): Promise<void>;
  stopGestureRecording(): Promise<void>;
  isGestureRecordingActive(): Promise<boolean>;
  setGestureCallback(callback: (event: any) => void): void;
  recordGesture(
    gestureType: string,
    x: number,
    y: number,
    target?: string,
    metadata?: any
  ): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export interface MaskingOptions {
  /** Quality of the captured image (0.1 to 1.0, default: 0.3 for smaller file size) */
  quality?: number;
  /** Scale of the captured image (0.1 to 1.0, default: 1.0) */
  scale?: number;
  /** Whether to mask text inputs (UITextField, UITextView, React Native text components) */
  maskTextInputs?: boolean;
  /** Whether to mask images (UIImageView, React Native Image components) */
  maskImages?: boolean;
  /** Whether to mask buttons (UIButton) */
  maskButtons?: boolean;
  /** Whether to mask labels (UILabel) */
  maskLabels?: boolean;
  /** Whether to mask web views (WKWebView) */
  maskWebViews?: boolean;
  /** Whether to mask sandboxed views (system views that don't belong to current process) */
  maskSandboxedViews?: boolean;
}

export default NativeModules.SessionRecorderNative as Spec;
