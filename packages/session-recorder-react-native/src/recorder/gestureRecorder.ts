import { GestureEvent, RecorderConfig, EventRecorder } from '../types'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { Dimensions } from 'react-native'
import { logger } from '../utils'
import { MouseInteractions, eventWithTime, EventType, IncrementalSource } from '@rrweb/types'

export class GestureRecorder implements EventRecorder {
  private config?: RecorderConfig
  private isRecording = false
  private events: GestureEvent[] = []
  private gestureHandlers: Map<string, any> = new Map()
  private screenDimensions: { width: number; height: number } | null = null
  private lastGestureTime: number = 0
  private gestureThrottleMs: number = 50 // Throttle gestures to avoid spam
  private lastTouchTime: number = 0
  private touchThrottleMs: number = 100 // Throttle touch events to max 10 per second

  // Cyclic call detection
  private isRecordingGesture = false
  private gestureCallStack: string[] = []
  private maxGestureCallDepth = 5
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
    logger.info('GestureRecorder', 'Gesture recording started')
    this.isRecording = true
    this.events = []
    // Gesture recording started
  }

  stop(): void {
    this.isRecording = false
    this._removeGestureHandlers()
    // Gesture recording stopped
  }


  private _getScreenDimensions(): void {
    try {
      this.screenDimensions = Dimensions.get('window')
    } catch (error) {
      // Failed to get screen dimensions - silently continue
      this.screenDimensions = { width: 375, height: 667 } // Default fallback
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
      const span = trace.getTracer('@opentelemetry/instrumentation-user-interaction').startSpan(`Gesture.${event.type}`, {
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
    interactionType: MouseInteractions,
    target?: string,
  ): void {
    const incrementalSnapshotEvent: eventWithTime = {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.MouseInteraction,
        type: interactionType,
        id: this.imageNodeId, // Reference to the image node
        x: x, // Preserve decimal precision like web rrweb
        y: y, // Preserve decimal precision like web rrweb
        pointerType: 2, // 2 = Touch for React Native (0=Mouse, 1=Pen, 2=Touch)
      },
      timestamp: Date.now(),
    }

    this.recordEvent(incrementalSnapshotEvent)
  }

  /**
   * Create mouse move event with positions array (like web rrweb)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   */
  private _createMouseMoveEvent(x: number, y: number, target?: string): void {
    const incrementalSnapshotEvent: eventWithTime = {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.TouchMove, // Use MouseMove instead of MouseInteraction
        positions: [
          {
            x: x, // Preserve decimal precision like web rrweb
            y: y, // Preserve decimal precision like web rrweb
            id: this.imageNodeId, // Reference to the image node
            timeOffset: 0, // No time offset for single position
          },
        ],
      },
      timestamp: Date.now(),
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
    // Throttle touch events to prevent spam
    const now = Date.now()
    if (now - this.lastTouchTime < this.touchThrottleMs) {
      logger.debug('GestureRecorder', `Touch start throttled (${now - this.lastTouchTime}ms < ${this.touchThrottleMs}ms)`)
      return
    }
    this.lastTouchTime = now

    logger.debug('GestureRecorder', 'Touch start recorded', { x, y, target, pressure })
    // Record as MouseDown (type: 1) like web rrweb
    this._createMouseInteractionEvent(x, y, MouseInteractions.TouchStart, target)
  }

  /**
   * Record touch move event as rrweb MouseMove with positions array
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure (optional)
   */
  recordTouchMove(x: number, y: number, target?: string, pressure?: number): void {
    // Throttle touch move events more aggressively
    const now = Date.now()
    if (now - this.lastTouchTime < this.touchThrottleMs * 2) { // 200ms throttle for move events
      logger.debug('GestureRecorder', `Touch move throttled (${now - this.lastTouchTime}ms < ${this.touchThrottleMs * 2}ms)`)
      return
    }
    this.lastTouchTime = now

    logger.debug('GestureRecorder', 'Touch move recorded', { x, y, target, pressure })
    // Record as MouseMove with positions array (like web rrweb)
    this._createMouseMoveEvent(x, y, target)
  }

  /**
   * Record touch end event as rrweb MouseInteraction
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   * @param pressure - Touch pressure (optional)
   */
  recordTouchEnd(x: number, y: number, target?: string, pressure?: number): void {
    // Cyclic call detection
    if (this.isRecordingGesture) {
      logger.error('GestureRecorder', 'CYCLIC CALL DETECTED! Already recording gesture', this.gestureCallStack)
      return
    }

    if (this.gestureCallStack.length >= this.maxGestureCallDepth) {
      logger.error('GestureRecorder', 'MAX GESTURE CALL DEPTH REACHED!', this.gestureCallStack)
      return
    }

    this.isRecordingGesture = true
    this.gestureCallStack.push('recordTouchEnd')

    try {
      logger.debug('GestureRecorder', 'Touch end recorded', { x, y, target, pressure })
      // Always record touch end (no throttling for completion)
      this.recordTap(x, y, target, pressure)
      // Record as MouseUp (type: 0) like web rrweb
      this._createMouseInteractionEvent(x, y, MouseInteractions.TouchEnd, target)
      // Also record Click (type: 2) like web rrweb
      // this._createMouseInteractionEvent(x, y, MouseInteractions.Click, target)

      // Only force screen capture on touch end (not on every touch event)
      logger.debug('GestureRecorder', 'Forcing screen capture after touch end')
      this.screenRecorder?.forceCapture()
    } finally {
      this.isRecordingGesture = false
      this.gestureCallStack.pop()
    }
  }

  /**
   * Record touch cancel event as rrweb MouseInteraction
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param target - Target element identifier
   */
  recordTouchCancel(x: number, y: number, target?: string): void {
    // Record as MouseUp (type: 0) like web rrweb for touch cancel
    this._createMouseInteractionEvent(x, y, MouseInteractions.TouchCancel, target)
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
