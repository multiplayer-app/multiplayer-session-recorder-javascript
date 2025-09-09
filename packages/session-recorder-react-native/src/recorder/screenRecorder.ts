import { ScreenEvent, RecorderConfig, EventType, FullSnapshotEvent, SerializedNodeWithId, EventRecorder } from '../types'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { Dimensions } from 'react-native'
import { captureRef } from 'react-native-view-shot'

export class ScreenRecorder implements EventRecorder {
  private config?: RecorderConfig
  private isRecording = false
  private events: ScreenEvent[] = []
  private captureInterval?: NodeJS.Timeout
  private captureCount: number = 0
  private maxCaptures: number = 100 // Limit captures to prevent memory issues
  private captureQuality: number = 0.3
  private captureFormat: 'png' | 'jpg' = 'jpg'
  private screenDimensions: { width: number; height: number } | null = null
  private currentScreen: string | null = null
  private eventRecorder?: EventRecorder
  private nodeIdCounter: number = 1
  private viewShotRef: any = null
  private lastScreenCapture: string | null = null
  private lastScreenHash: string | null = null
  private enableChangeDetection: boolean = true
  private hashSampleSize: number = 100

  init(config: RecorderConfig, eventRecorder?: EventRecorder): void {
    this.config = config
    this.eventRecorder = eventRecorder
    this._getScreenDimensions()
  }

  start(): void {
    this.isRecording = true
    this.events = []
    this.captureCount = 0
    this.lastScreenCapture = null
    this.lastScreenHash = null
    this._startPeriodicCapture()

    // Capture initial screen immediately
    this._captureScreen()

    // Screen recording started
  }

  stop(): void {
    this.isRecording = false
    this._stopPeriodicCapture()
    // Screen recording stopped
  }

  pause(): void {
    this.isRecording = false
    this._stopPeriodicCapture()
  }

  resume(): void {
    this.isRecording = true
    // this._startPeriodicCapture()
  }

  private _getScreenDimensions(): void {
    try {
      this.screenDimensions = Dimensions.get('window')
    } catch (error) {
      // Failed to get screen dimensions - silently continue
      this.screenDimensions = { width: 375, height: 667 } // Default fallback
    }
  }

  private _startPeriodicCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval)
    }

    // Capture screen every 5 seconds
    this.captureInterval = setInterval(() => {
      this._captureScreen()
    }, 5000)
  }

  private _stopPeriodicCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval)
      this.captureInterval = undefined
    }
  }

  private async _captureScreen(): Promise<void> {
    if (!this.isRecording || this.captureCount >= this.maxCaptures) return

    try {
      const base64Image = await this._captureScreenBase64()

      if (base64Image) {
        // Check if screen has changed by comparing with previous capture
        const hasChanged = this.enableChangeDetection ? this._hasScreenChanged(base64Image) : true

        if (hasChanged) {
          this._createAndEmitFullSnapshotEvent(base64Image)
          this.lastScreenCapture = base64Image
          this.lastScreenHash = this._generateScreenHash(base64Image)
          this.captureCount++
        } else {
          console.log('Screen unchanged, skipping capture')
        }
      }
    } catch (error) {
      this._recordScreenCaptureError(error as Error)
    }
  }

  private async _captureScreenBase64(): Promise<string | null> {
    try {
      if (!this.viewShotRef) {
        console.warn('ViewShot ref not available for screen capture')
        return null
      }

      // Capture the screen using react-native-view-shot
      const result = await captureRef(this.viewShotRef, {
        format: this.captureFormat,
        quality: this.captureQuality,
        result: 'base64'
      })

      return result
    } catch (error) {
      console.error('Failed to capture screen:', error)
      return null
    }
  }

  private _createAndEmitFullSnapshotEvent(base64Image: string): void {
    if (!this.screenDimensions) return

    const { width, height } = this.screenDimensions

    // Create a virtual DOM node representing the screen as an image
    const imageNode: SerializedNodeWithId = {
      type: 1, // Element node
      id: this.nodeIdCounter++,
      tagName: 'img',
      attributes: {
        src: `data:image/${this.captureFormat};base64,${base64Image}`,
        width: width.toString(),
        height: height.toString(),
        style: `width: ${width}px; height: ${height}px;`
      }
    }

    // Create the root container
    const rootNode: SerializedNodeWithId = {
      type: 1, // Element node
      id: this.nodeIdCounter++,
      tagName: 'div',
      attributes: {
        style: `width: ${width}px; height: ${height}px; position: relative;`
      },
      childNodes: [imageNode]
    }

    const fullSnapshotEvent: FullSnapshotEvent = {
      type: EventType.FullSnapshot,
      data: {
        node: rootNode,
        initialOffset: {
          left: 0,
          top: 0
        }
      },
      timestamp: Date.now()
    }

    this.recordEvent(fullSnapshotEvent)
  }

  /**
   * Check if the screen has changed by comparing with the previous capture
   * @param currentBase64 - Current screen capture as base64
   * @returns true if screen has changed, false otherwise
   */
  private _hasScreenChanged(currentBase64: string): boolean {
    // If this is the first capture, consider it changed
    if (!this.lastScreenCapture) {
      return true
    }

    // Generate hash for current capture
    const currentHash = this._generateScreenHash(currentBase64)

    // Compare with previous hash
    return currentHash !== this.lastScreenHash
  }

  /**
   * Generate a simple hash for screen comparison
   * This is a lightweight hash that focuses on the beginning and end of the base64 string
   * to detect changes without doing a full comparison
   * @param base64Image - Base64 encoded image
   * @returns Hash string for comparison
   */
  private _generateScreenHash(base64Image: string): string {
    // Use a simple hash that samples the beginning, middle, and end of the base64 string
    // This is much faster than comparing the entire string
    const sampleSize = this.hashSampleSize
    const start = base64Image.substring(0, sampleSize)
    const middle = base64Image.substring(
      Math.floor(base64Image.length / 2) - sampleSize / 2,
      Math.floor(base64Image.length / 2) + sampleSize / 2
    )
    const end = base64Image.substring(base64Image.length - sampleSize)

    // Combine samples and create a simple hash
    const combined = start + middle + end
    return this._simpleHash(combined)
  }

  /**
   * Simple hash function for string comparison
   * @param str - String to hash
   * @returns Hash value as string
   */
  private _simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }



  private _sendEvent(event: ScreenEvent): void {
    // Screen event recorded
    // Send event to backend or store locally
  }

  private _recordOpenTelemetrySpan(event: ScreenEvent): void {
    try {
      const span = trace.getTracer('screen').startSpan(`Screen.${event.type}`, {
        attributes: {
          'screen.type': event.type,
          'screen.timestamp': event.timestamp,
          'screen.platform': 'react-native',
        },
      })

      if (event.metadata) {
        Object.entries(event.metadata).forEach(([key, value]) => {
          span.setAttribute(`screen.metadata.${key}`, String(value))
        })
      }

      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
    } catch (error) {
      // Failed to record OpenTelemetry span for screen - silently continue
    }
  }

  private _recordScreenCaptureError(error: Error): void {
    try {
      const span = trace.getTracer('screen').startSpan('Screen.capture.error', {
        attributes: {
          'screen.error': true,
          'screen.error.type': error.name,
          'screen.error.message': error.message,
          'screen.timestamp': Date.now(),
        },
      })

      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      span.recordException(error)
      span.end()
    } catch (spanError) {
      // Failed to record error span - silently continue
    }
  }


  async captureSpecificElement(elementRef: any, options?: {
    format?: 'png' | 'jpg' | 'webp'
    quality?: number
  }): Promise<string | null> {
    try {


      return await captureRef(elementRef)
    } catch (error) {
      // Failed to capture specific element - silently continue
      return null
    }
  }

  // Configuration methods
  setCaptureInterval(intervalMs: number): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval)
    }

    if (this.isRecording) {
      this.captureInterval = setInterval(() => {
        this._captureScreen()
      }, intervalMs)
    }
  }

  setCaptureQuality(quality: number): void {
    this.captureQuality = Math.max(0.1, Math.min(1.0, quality))
  }

  setCaptureFormat(format: 'png' | 'jpg'): void {
    this.captureFormat = format
  }

  setMaxCaptures(max: number): void {
    this.maxCaptures = Math.max(1, max)
  }

  /**
   * Enable or disable change detection
   * @param enabled - Whether to enable change detection
   */
  setChangeDetection(enabled: boolean): void {
    this.enableChangeDetection = enabled
  }

  /**
   * Set the hash sample size for change detection
   * @param size - Number of characters to sample from each part of the image
   */
  setHashSampleSize(size: number): void {
    this.hashSampleSize = Math.max(10, Math.min(1000, size))
  }

  // Performance monitoring
  recordScreenPerformance(screenName: string, loadTime: number): void {
    const event: ScreenEvent = {
      screenName,
      type: 'screenCapture',
      timestamp: Date.now(),
      metadata: {
        screenName,
        loadTime,
        performance: 'monitoring',
        captureCount: this.captureCount,
      },
    }

    this.events.push(event); this._sendEvent(event); this._recordOpenTelemetrySpan(event)
    this.events.push(event)
    this._sendEvent(event)
    this._recordOpenTelemetrySpan(event)
  }

  // Error tracking
  recordScreenError(error: Error, screenName?: string): void {
    const event: ScreenEvent = {
      screenName: screenName || 'unknown',
      type: 'screenCapture',
      timestamp: Date.now(),
      metadata: {
        error: true,
        errorType: error.name,
        errorMessage: error.message,
        screenName,
        captureCount: this.captureCount,
      },
    }

    this.events.push(event); this._sendEvent(event); this._recordOpenTelemetrySpan(event)
    this.events.push(event)
    this._sendEvent(event)
    this._recordScreenCaptureError(error)
  }

  // Get recorded events
  getEvents(): ScreenEvent[] {
    return [...this.events]
  }

  // Clear events
  clearEvents(): void {
    this.events = []
    this.captureCount = 0
  }

  // Get screen capture statistics
  getScreenStats(): Record<string, any> {
    const stats = {
      totalCaptures: this.captureCount,
      totalEvents: this.events.length,
      averageCaptureTime: 0,
      successRate: 0,
    }

    if (this.events.length > 0) {
      const captureTimes = this.events
        .map(event => event.metadata?.captureTime || 0)
        .filter(time => time > 0)

      if (captureTimes.length > 0) {
        stats.averageCaptureTime = captureTimes.reduce((a, b) => a + b, 0) / captureTimes.length
      }

      const successfulCaptures = this.events.filter(event => event.dataUrl).length
      stats.successRate = (successfulCaptures / this.events.length) * 100
    }

    return stats
  }

  // Get recording status
  isRecordingEnabled(): boolean {
    return this.isRecording
  }

  // Get current configuration
  getConfiguration(): Record<string, any> {
    return {
      captureInterval: this.captureInterval ? 5000 : 0, // Default 5 seconds
      captureQuality: this.captureQuality,
      captureFormat: this.captureFormat,
      maxCaptures: this.maxCaptures,
      screenDimensions: this.screenDimensions,
    }
  }

  // Shutdown
  shutdown(): void {
    this.stop()
    this.clearEvents()
    // Screen recorder shutdown
  }

  /**
   * Set the viewshot ref for screen capture
   * @param ref - React Native View ref for screen capture
   */
  setViewShotRef(ref: any): void {
    this.viewShotRef = ref
  }

  /**
   * Force capture screen (useful after touch interactions)
   * This bypasses the change detection and always captures
   */
  forceCapture(): void {
    if (!this.isRecording) return

    this._captureScreen()
  }

  /**
   * Record an rrweb event
   * @param event - The rrweb event to record
   */
  recordEvent(event: any): void {
    if (this.eventRecorder) {
      this.eventRecorder.recordEvent(event)
    }
  }
}
