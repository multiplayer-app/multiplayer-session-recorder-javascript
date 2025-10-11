import SessionRecorderNative, { type MaskingOptions } from '../native/SessionRecorderNative';
import { logger } from '../utils';

export interface ScreenMaskingConfig {
  /** Whether screen masking is enabled */
  enabled: boolean;
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

export class ScreenMaskingService {
  private config: ScreenMaskingConfig;
  private isAvailable: boolean = false;

  constructor(
    config: ScreenMaskingConfig = {
      enabled: true,
      maskTextInputs: true,
      maskImages: false,
      maskButtons: false,
      maskLabels: false,
      maskWebViews: false,
      maskSandboxedViews: false,
    }
  ) {
    this.config = config;
    this.checkAvailability();
  }

  /**
   * Check if the native masking module is available
   */
  private checkAvailability(): void {
    try {
      // Try to access the native module to check if it's available
      if (
        SessionRecorderNative &&
        typeof SessionRecorderNative.captureAndMask === 'function'
      ) {
        this.isAvailable = true;
        logger.info(
          'ScreenMaskingService',
          'Screen masking native module is available'
        );
      } else {
        this.isAvailable = false;
        logger.warn(
          'ScreenMaskingService',
          'Screen masking native module is not available - auto-linking may still be in progress'
        );
      }
    } catch (error) {
      this.isAvailable = false;
      logger.error(
        'ScreenMaskingService',
        'Error checking screen masking availability:',
        error
      );
    }
  }

  /**
   * Capture screen with masking applied
   */
  async captureMaskedScreen(options: MaskingOptions): Promise<string | null> {
    if (!this.isAvailable || !this.config.enabled) {
      logger.warn(
        'ScreenMaskingService',
        'Screen masking is not available or disabled'
      );
      return null;
    }

    try {
      const maskingOptions: MaskingOptions = {
        ...this.config,
        ...options,
      };
      const maskedImageBase64 =
        await SessionRecorderNative.captureAndMaskWithOptions(maskingOptions);
      return maskedImageBase64;
    } catch (error) {
      logger.error(
        'ScreenMaskingService',
        'Failed to capture masked screen:',
        error
      );
      return null;
    }
  }

  /**
   * Capture screen with basic masking (no custom options)
   */
  async captureMaskedScreenBasic(): Promise<string | null> {
    if (!this.isAvailable || !this.config.enabled) {
      logger.warn(
        'ScreenMaskingService',
        'Screen masking is not available or disabled'
      );
      return null;
    }

    try {
      const maskedImageBase64 = await SessionRecorderNative.captureAndMask();
      return maskedImageBase64;
    } catch (error) {
      logger.error(
        'ScreenMaskingService',
        'Failed to capture masked screen (basic):',
        error
      );
      return null;
    }
  }

  /**
   * Update the masking configuration
   */
  updateConfig(config: Partial<ScreenMaskingConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('ScreenMaskingService', 'Screen masking configuration updated');
  }

  /**
   * Check if screen masking is available
   */
  isScreenMaskingAvailable(): boolean {
    return this.isAvailable && this.config.enabled;
  }

  /**
   * Get the current configuration
   */
  getConfig(): ScreenMaskingConfig {
    return { ...this.config };
  }
}

// Create a singleton instance
export const screenMaskingService = new ScreenMaskingService();
