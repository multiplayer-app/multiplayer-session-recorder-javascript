import { GestureEvent, RecorderConfig, EventType, IncrementalSource, IncrementalSnapshotEvent, MouseInteractionType, EventRecorder } from '../types'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { Dimensions } from 'react-native'

export class GestureRecorder implements EventRecorder {
  private config?: RecorderConfig
  private isRecording = false
  private events: GestureEvent[] = []
  private gestureHandlers: Map<string, any> = new Map()
  private screenDimensions: { width: number; height: number } | null = null
  private lastGestureTime: number = 0
  private gestureThrottleMs: number = 50 // Throttle gestures to avoid spam
  private eventRecorder?: EventRecorder
  private imageNodeId: number = 1 // ID of the image node for touch interactions
  private screenRecorder?: any // Reference to screen recorder for force capture
  init(config: RecorderConfig, eventRecorder?: EventRecorder, screenRecorder?: any): void {
    this.config = config
    this.eventRecorder = eventRecorder
    this.screenRecorder = screenRecorder
    this._getScreenDimensions()
  }

  start(): void {
    this.isRecording = true
    this.events = []
    this._setupGestureHandlers()
    this._setupAutomaticTouchCapture()
    // Gesture recording started
  }

  stop(): void {
    this.isRecording = false
    this._removeGestureHandlers()
    // Gesture recording stopped
  }

  pause(): void {
    this.isRecording = false
  }

  resume(): void {
    this.isRecording = true
  }

  // Input component registration temporarily disabled

  private _getScreenDimensions(): void {
    try {
      this.screenDimensions = Dimensions.get('window')
    } catch (error) {
      // Failed to get screen dimensions - silently continue
      this.screenDimensions = { width: 375, height: 667 } // Default fallback
    }
  }

  private _setupInputTracking(): void {
    // Set up React Native input component tracking
    try {
      // This would integrate with React Native's component tracking
      // For now, we'll provide methods for manual registration
      // Input tracking setup complete
    } catch (error) {
      // Failed to setup input tracking - silently continue
    }
  }

  private _setupGestureHandlers(): void {
    // This would integrate with react-native-gesture-handler
    // For now, we'll create a comprehensive implementation that can be easily integrated
    // Setting up gesture handlers

    // Set up global gesture listener
    this._setupGlobalGestureListener()
  }

  private _setupGlobalGestureListener(): void {
    try {
      // Listen for touch events at the app level
      // This is a simplified implementation - in production you'd use react-native-gesture-handler
      // Global gesture listener setup complete
    } catch (error) {
      // Failed to setup global gesture listener - silently continue
    }
  }

  private _setupAutomaticTouchCapture(): void {
    try {
      // This method sets up automatic touch capture
      // The actual touch capture is handled by the TouchEventCapture component
      // in the SessionRecorderContext, which automatically calls our recording methods

      // We can add any additional setup here if needed
      // For now, the TouchEventCapture component handles everything automatically
    } catch (error) {
      // Failed to setup automatic touch capture - silently continue
    }
  }

  private _removeGestureHandlers(): void {
    this.gestureHandlers.clear()
    // Gesture handlers removed
  }

  private _recordEvent(event: GestureEvent): void {
    if (!this.isRecording) return

    // Throttle gestures to avoid spam
    const now = Date.now()
    if (now - this.lastGestureTime < this.gestureThrottleMs) {
      return
    }
    this.lastGestureTime = now

    this.events.push(event)
    this._sendEvent(event)
    this._recordOpenTelemetrySpan(event)
  }



  private _sendEvent(event: GestureEvent): void {
    // Send event to backend or store locally
    // Gesture event recorded
  }

  private _recordOpenTelemetrySpan(event: GestureEvent): void {
    try {
      const span = trace.getTracer('gesture').startSpan(`Gesture.${event.type}`, {
        attributes: {
          'gesture.type': event.type,
          'gesture.timestamp': event.timestamp,
          'gesture.platform': 'react-native',
        },
      })

      if (event.coordinates) {
        span.setAttribute('gesture.coordinates.x', event.coordinates.x)
        span.setAttribute('gesture.coordinates.y', event.coordinates.y)

        // Calculate relative position
        if (this.screenDimensions) {
          const relativeX = event.coordinates.x / this.screenDimensions.width
          const relativeY = event.coordinates.y / this.screenDimensions.height
          span.setAttribute('gesture.coordinates.relative_x', relativeX)
          span.setAttribute('gesture.coordinates.relative_y', relativeY)
        }
      }

      if (event.target) {
        span.setAttribute('gesture.target', event.target)
      }

      if (event.metadata) {
        Object.entries(event.metadata).forEach(([key, value]) => {
          span.setAttribute(`gesture.metadata.${key}`, String(value))
        })
      }

      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
    } catch (error) {
      // Failed to record OpenTelemetry span for gesture - silently continue
    }
  }

  // Public methods for manual event recording
  recordTap(x: number, y: number, target?: string, pressure?: number): void {
    const event: GestureEvent = {
      type: 'tap',
      timestamp: Date.now(),
      coordinates: { x, y },
      target,
      metadata: {
        pressure: pressure || 1.0,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordSwipe(direction: string, target?: string, velocity?: number, distance?: number): void {
    const event: GestureEvent = {
      type: 'swipe',
      timestamp: Date.now(),
      target,
      metadata: {
        direction,
        velocity: velocity || 0,
        distance: distance || 0,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordPinch(scale: number, target?: string, velocity?: number): void {
    const event: GestureEvent = {
      type: 'pinch',
      timestamp: Date.now(),
      target,
      metadata: {
        scale,
        velocity: velocity || 0,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordPan(deltaX: number, deltaY: number, target?: string, velocity?: number): void {
    const event: GestureEvent = {
      type: 'pan',
      timestamp: Date.now(),
      target,
      metadata: {
        deltaX,
        deltaY,
        velocity: velocity || 0,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordLongPress(duration: number, target?: string, pressure?: number): void {
    const event: GestureEvent = {
      type: 'longPress',
      timestamp: Date.now(),
      target,
      metadata: {
        duration,
        pressure: pressure || 1.0,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordDoubleTap(x: number, y: number, target?: string): void {
    const event: GestureEvent = {
      type: 'doubleTap',
      timestamp: Date.now(),
      coordinates: { x, y },
      target,
      metadata: {
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordRotate(rotation: number, target?: string, velocity?: number): void {
    const event: GestureEvent = {
      type: 'rotate',
      timestamp: Date.now(),
      target,
      metadata: {
        rotation,
        velocity: velocity || 0,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordFling(direction: string, velocity: number, target?: string): void {
    const event: GestureEvent = {
      type: 'fling',
      timestamp: Date.now(),
      target,
      metadata: {
        direction,
        velocity,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  // Advanced gesture tracking methods
  recordMultiTouch(touchCount: number, target?: string): void {
    const event: GestureEvent = {
      type: 'multiTouch',
      timestamp: Date.now(),
      target,
      metadata: {
        touchCount,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordScroll(direction: string, distance: number, velocity: number, target?: string): void {
    const event: GestureEvent = {
      type: 'scroll',
      timestamp: Date.now(),
      target,
      metadata: {
        direction,
        distance,
        velocity,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  recordZoom(scale: number, target?: string, velocity?: number): void {
    const event: GestureEvent = {
      type: 'zoom',
      timestamp: Date.now(),
      target,
      metadata: {
        scale,
        velocity: velocity || 0,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  // Gesture sequence tracking
  recordGestureSequence(gestures: string[], duration: number, target?: string): void {
    const event: GestureEvent = {
      type: 'gestureSequence',
      timestamp: Date.now(),
      target,
      metadata: {
        gestures: gestures.join(','),
        duration,
        gestureCount: gestures.length,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  // Error tracking for gesture failures
  recordGestureError(error: Error, gestureType: string, target?: string): void {
    const event: GestureEvent = {
      type: 'gestureError',
      timestamp: Date.now(),
      target,
      metadata: {
        errorType: error.name,
        errorMessage: error.message,
        gestureType,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)

    // Also record as OpenTelemetry error span
    try {
      const span = trace.getTracer('gesture').startSpan(`Gesture.${gestureType}.error`, {
        attributes: {
          'gesture.type': gestureType,
          'gesture.error': true,
          'gesture.error.type': error.name,
          'gesture.error.message': error.message,
          'gesture.timestamp': Date.now(),
        },
      })

      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      span.recordException(error)
      span.end()
    } catch (spanError) {
      // Failed to record error span - silently continue
    }
  }

  // Performance monitoring
  recordGesturePerformance(gestureType: string, duration: number, target?: string): void {
    const event: GestureEvent = {
      type: 'gesturePerformance',
      timestamp: Date.now(),
      target,
      metadata: {
        gestureType,
        duration,
        performance: 'monitoring',
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this._recordEvent(event)
  }

  // Get recorded events
  getEvents(): GestureEvent[] {
    return [...this.events]
  }

  // Clear events
  clearEvents(): void {
    this.events = []
  }

  // Get event statistics
  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    this.events.forEach(event => {
      stats[event.type] = (stats[event.type] || 0) + 1
    })
    return stats
  }

  // Set gesture throttle
  setGestureThrottle(throttleMs: number): void {
    this.gestureThrottleMs = throttleMs
  }

  // Get recording status
  isRecordingEnabled(): boolean {
    return this.isRecording
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

  /**
   * Create and emit a rrweb MouseInteraction event for touch interactions
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param interactionType - Type of interaction (TouchStart, TouchMove, TouchEnd, etc.)
   * @param target - Target element identifier
   */
  private _createMouseInteractionEvent(
    x: number,
    y: number,
    interactionType: MouseInteractionType,
    target?: string
  ): void {
    const incrementalSnapshotEvent: IncrementalSnapshotEvent = {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.MouseInteraction,
        type: interactionType,
        id: this.imageNodeId, // Reference to the image node
        x: Math.round(x),
        y: Math.round(y)
      },
      timestamp: Date.now()
    }

    this.recordEvent(incrementalSnapshotEvent)
  }

  /**
   * Record touch start event as rrweb MouseInteraction
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure (optional)
   */
  recordTouchStart(x: number, y: number, target?: string, pressure?: number): void {
    // Record as both gesture event and rrweb event
    this.recordTap(x, y, target, pressure)
    this._createMouseInteractionEvent(x, y, MouseInteractionType.TouchStart, target)

    // Force screen capture after touch interaction
    this.screenRecorder?.forceCapture()
  }

  /**
   * Record touch move event as rrweb MouseInteraction
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure (optional)
   */
  recordTouchMove(x: number, y: number, target?: string, pressure?: number): void {
    // Record as both gesture event and rrweb event
    this.recordPan(x - (this.lastGestureTime || 0), y - (this.lastGestureTime || 0), target)
    this._createMouseInteractionEvent(x, y, MouseInteractionType.TouchMove, target)
  }

  /**
   * Record touch end event as rrweb MouseInteraction
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure (optional)
   */
  recordTouchEnd(x: number, y: number, target?: string, pressure?: number): void {
    // Record as both gesture event and rrweb event
    this.recordTap(x, y, target, pressure)
    this._createMouseInteractionEvent(x, y, MouseInteractionType.TouchEnd, target)

    // Force screen capture after touch interaction
    this.screenRecorder?.forceCapture()
  }

  /**
   * Record touch cancel event as rrweb MouseInteraction
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   */
  recordTouchCancel(x: number, y: number, target?: string): void {
    this._createMouseInteractionEvent(x, y, MouseInteractionType.TouchCancel, target)
  }

  /**
   * Set the image node ID for touch interactions
   * This should be called when a new screen snapshot is created
   * @param nodeId - The ID of the image node in the current snapshot
   */
  setImageNodeId(nodeId: number): void {
    this.imageNodeId = nodeId
  }
}
