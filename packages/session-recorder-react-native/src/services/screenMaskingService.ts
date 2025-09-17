import SessionRecorderNative, { MaskingOptions } from '../native/SessionRecorderNative'
import { logger } from '../utils'


export interface ScreenMaskingConfig {
  /** Whether screen masking is enabled */
  enabled: boolean
  /** Whether to mask all input fields automatically */
  inputMasking: boolean
  /** Default masking options */
  defaultOptions?: MaskingOptions
}

export class ScreenMaskingService {
  private config: ScreenMaskingConfig
  private isAvailable: boolean = false

  constructor(config: ScreenMaskingConfig = { enabled: true, inputMasking: true }) {
    this.config = config
    this.checkAvailability()
  }

  /**
   * Check if the native masking module is available
   */
  private checkAvailability(): void {
    try {
      // Try to access the native module to check if it's available
      if (SessionRecorderNative && typeof SessionRecorderNative.captureAndMask === 'function') {
        this.isAvailable = true
        logger.info('ScreenMaskingService', 'Screen masking native module is available')
      } else {
        this.isAvailable = false
        logger.warn('ScreenMaskingService', 'Screen masking native module is not available - auto-linking may still be in progress')

      }
    } catch (error) {
      this.isAvailable = false
      logger.error('ScreenMaskingService', 'Error checking screen masking availability:', error)
    }
  }

  /**
   * Capture screen with masking applied
   */
  async captureMaskedScreen(options?: MaskingOptions): Promise<string | null> {
    if (!this.isAvailable || !this.config.enabled) {
      logger.warn('ScreenMaskingService', 'Screen masking is not available or disabled')
      return null
    }

    try {
      const maskingOptions: MaskingOptions = {
        ...this.config.defaultOptions,
        ...options,
        inputMasking: this.config.inputMasking,
      }

      const maskedImageBase64 = await SessionRecorderNative.captureAndMaskWithOptions(maskingOptions)
      logger.info('ScreenMaskingService', 'Successfully captured masked screen')
      return maskedImageBase64
    } catch (error) {
      logger.error('ScreenMaskingService', 'Failed to capture masked screen:', error)
      return null
    }
  }

  /**
   * Capture screen with basic masking (no custom options)
   */
  async captureMaskedScreenBasic(): Promise<string | null> {
    if (!this.isAvailable || !this.config.enabled) {
      logger.warn('ScreenMaskingService', 'Screen masking is not available or disabled')
      return null
    }

    try {
      const maskedImageBase64 = await SessionRecorderNative.captureAndMask()
      logger.info('ScreenMaskingService', 'Successfully captured masked screen (basic)')
      return maskedImageBase64
    } catch (error) {
      logger.error('ScreenMaskingService', 'Failed to capture masked screen (basic):', error)
      return null
    }
  }

  /**
   * Update the masking configuration
   */
  updateConfig(config: Partial<ScreenMaskingConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('ScreenMaskingService', 'Screen masking configuration updated')
  }

  /**
   * Check if screen masking is available
   */
  isScreenMaskingAvailable(): boolean {
    return this.isAvailable && this.config.enabled
  }

  /**
   * Get the current configuration
   */
  getConfig(): ScreenMaskingConfig {
    return { ...this.config }
  }
}

// Create a singleton instance
export const screenMaskingService = new ScreenMaskingService()
