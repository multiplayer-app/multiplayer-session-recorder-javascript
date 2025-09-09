import { GestureRecorder } from './gestureRecorder'
import { NavigationTracker } from './navigationTracker'
import { ScreenRecorder } from './screenRecorder'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { RecorderConfig, EventRecorder, RRWebEvent } from '../types'

export class RecorderReactNativeSDK implements EventRecorder {
  private config?: RecorderConfig
  private gestureRecorder: GestureRecorder
  private navigationTracker: NavigationTracker
  private screenRecorder: ScreenRecorder
  private isRecording = false
  private eventRecorder?: EventRecorder
  private recordedEvents: RRWebEvent[] = []

  constructor() {
    this.gestureRecorder = new GestureRecorder()
    this.navigationTracker = new NavigationTracker()
    this.screenRecorder = new ScreenRecorder()
  }

  init(config: RecorderConfig, eventRecorder?: EventRecorder): void {
    this.config = config
    this.eventRecorder = eventRecorder
    this.gestureRecorder.init(config, this, this.screenRecorder)
    this.navigationTracker.init(config)
    this.screenRecorder.init(config, this)
  }

  start(sessionId: string | null, sessionType: SessionType): void {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call init() before start().')
    }

    this.isRecording = true

    if (this.config.recordGestures) {
      this.gestureRecorder.start()
    }

    if (this.config.recordNavigation) {
      this.navigationTracker.start()
    }

    if (this.config.recordScreen) {
      this.screenRecorder.start()
    }
  }

  stop(): void {
    this.isRecording = false
    this.gestureRecorder.stop()
    this.navigationTracker.stop()
    this.screenRecorder.stop()
  }

  pause(): void {
    this.gestureRecorder.pause()
    this.navigationTracker.pause()
    this.screenRecorder.pause()
  }

  resume(): void {
    if (this.isRecording) {
      this.gestureRecorder.resume()
      this.navigationTracker.resume()
      this.screenRecorder.resume()
    }
  }

  setNavigationRef(ref: any): void {
    this.navigationTracker.setNavigationRef(ref)
  }

  /**
   * Set the viewshot ref for screen capture
   * @param ref - React Native View ref for screen capture
   */
  setViewShotRef(ref: any): void {
    this.screenRecorder.setViewShotRef(ref)
  }

  /**
   * Record an rrweb event
   * @param event - The rrweb event to record
   */
  recordEvent(event: RRWebEvent): void {
    if (!this.isRecording) {
      return
    }

    // Store the event locally
    this.recordedEvents.push(event)

    // Forward to parent event recorder if available
    if (this.eventRecorder) {
      this.eventRecorder.recordEvent(event)
    }
  }

  /**
   * Record touch start event
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure
   */
  recordTouchStart(x: number, y: number, target?: string, pressure?: number): void {
    if (!this.isRecording) {
      return
    }

    this.gestureRecorder.recordTouchStart(x, y, target, pressure)
  }

  /**
   * Record touch move event
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure
   */
  recordTouchMove(x: number, y: number, target?: string, pressure?: number): void {
    if (!this.isRecording) {
      return
    }

    this.gestureRecorder.recordTouchMove(x, y, target, pressure)
  }

  /**
   * Record touch end event
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure
   */
  recordTouchEnd(x: number, y: number, target?: string, pressure?: number): void {
    if (!this.isRecording) {
      return
    }

    this.gestureRecorder.recordTouchEnd(x, y, target, pressure)
  }

  /**
   * Get all recorded events
   * @returns Array of recorded rrweb events
   */
  getRecordedEvents(): RRWebEvent[] {
    return [...this.recordedEvents]
  }

  /**
   * Clear all recorded events
   */
  clearRecordedEvents(): void {
    this.recordedEvents = []
  }

  /**
   * Get recording statistics
   * @returns Recording statistics
   */
  getRecordingStats(): { totalEvents: number; isRecording: boolean } {
    return {
      totalEvents: this.recordedEvents.length,
      isRecording: this.isRecording
    }
  }
}
