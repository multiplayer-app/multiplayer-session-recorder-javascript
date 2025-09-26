import { Dimensions } from 'react-native'
import { trace, SpanStatusCode, Span } from '@opentelemetry/api'
import { logger } from '../utils'
import { GestureEvent, RecorderConfig, EventRecorder } from '../types'
import { MouseInteractions, eventWithTime, EventType, IncrementalSource } from '@rrweb/types'
// Force TypeScript recompilation
import GestureRecorderNative, { gestureEventEmitter, GestureEvent as NativeGestureEvent } from '../native/GestureRecorderNative'

export class GestureRecorder implements EventRecorder {
  private config?: RecorderConfig
  private isRecording = false
  private events: GestureEvent[] = []
  private screenDimensions: { width: number; height: number } | null = null
  private lastGestureTime: number = 0
  private gestureThrottleMs: number = 50 // Throttle gestures to avoid spam
  private lastTouchTime: number = 0
  private touchThrottleMs: number = 100 // Throttle touch events to max 10 per second
  private eventRecorder?: EventRecorder
  private imageNodeId: number = 1 // ID of the image node for touch interactions
  private screenRecorder?: any // Reference to screen recorder for force capture
  private gestureEventListener?: any // Native event listener
  private currentPanSpan?: Span // Aggregated span for pan gesture
  private panMoveCount: number = 0

  init(config: RecorderConfig, eventRecorder?: EventRecorder, screenRecorder?: any): void {
    this.config = config
    this.eventRecorder = eventRecorder
    this.screenRecorder = screenRecorder
    this._getScreenDimensions()
  }

  start(): void {
    logger.info('GestureRecorder', 'Native gesture recording started')
    this.isRecording = true
    this.events = []

    // Start native gesture recording
    GestureRecorderNative.startGestureRecording()
      .then(() => {
        logger.info('GestureRecorder', 'Native gesture recording started successfully')
        this._setupGestureEventListener()
      })
      .catch((error) => {
        logger.error('GestureRecorder', 'Failed to start native gesture recording', error)
      })
  }

  stop(): void {
    this.isRecording = false
    this._removeGestureEventListener()

    // Stop native gesture recording
    GestureRecorderNative.stopGestureRecording()
      .then(() => {
        logger.info('GestureRecorder', 'Native gesture recording stopped successfully')
      })
      .catch((error) => {
        logger.error('GestureRecorder', 'Failed to stop native gesture recording', error)
      })
  }

  private _getScreenDimensions(): void {
    try {
      this.screenDimensions = Dimensions.get('window')
    } catch (error) {
      // Failed to get screen dimensions - silently continue
      this.screenDimensions = { width: 375, height: 667 } // Default fallback
    }
  }

  private _setupGestureEventListener(): void {
    if (!gestureEventEmitter) {
      logger.warn('GestureRecorder', 'Gesture event emitter not available')
      return
    }

    this.gestureEventListener = gestureEventEmitter.addListener(
      'onGestureDetected',
      (nativeGesture: NativeGestureEvent) => {
        this._handleNativeGesture(nativeGesture)
      }
    )
  }

  private _removeGestureEventListener(): void {
    if (this.gestureEventListener) {
      this.gestureEventListener.remove()
      this.gestureEventListener = undefined
    }
  }

  private _handleNativeGesture(nativeGesture: NativeGestureEvent): void {
    if (!this.isRecording) return

    // Throttle gestures to avoid spam
    const now = Date.now()
    if (now - this.lastGestureTime < this.gestureThrottleMs) {
      return
    }
    this.lastGestureTime = now

    // Convert native gesture to our format
    const gesture: GestureEvent = {
      type: nativeGesture.type as any,
      timestamp: nativeGesture.timestamp,
      coordinates: { x: nativeGesture.x, y: nativeGesture.y },
      target: nativeGesture.target,
      targetInfo: nativeGesture.targetInfo, // Pass through targetInfo from native
      metadata: {
        ...nativeGesture.metadata,
        screenWidth: this.screenDimensions?.width,
        screenHeight: this.screenDimensions?.height,
      },
    }

    this.events.push(gesture)
    this._sendEvent(gesture)
    this._recordOpenTelemetrySpan(gesture)

    // Handle specific gesture types
    switch (nativeGesture.type) {
      case 'tap':
        this._handleTapGesture(nativeGesture)
        break
      case 'pan_start':
        this._handlePanStartGesture(nativeGesture)
        break
      case 'pan_move':
        this._handlePanMoveGesture(nativeGesture)
        break
      case 'pan_end':
        this._handlePanEndGesture(nativeGesture)
        break
      case 'long_press':
        this._handleLongPressGesture(nativeGesture)
        break
      case 'pinch':
        this._handlePinchGesture(nativeGesture)
        break
      case 'swipe':
        this._handleSwipeGesture(nativeGesture)
        break
    }
  }

  private _handleTapGesture(nativeGesture: NativeGestureEvent): void {
    this.recordTouchStart(nativeGesture.x, nativeGesture.y, nativeGesture.target)
    this.recordTouchEnd(nativeGesture.x, nativeGesture.y, nativeGesture.target)
  }

  private _handlePanStartGesture(nativeGesture: NativeGestureEvent): void {
    this.recordTouchStart(nativeGesture.x, nativeGesture.y, nativeGesture.target)
  }

  private _handlePanMoveGesture(nativeGesture: NativeGestureEvent): void {
    this.recordTouchMove(nativeGesture.x, nativeGesture.y, nativeGesture.target)
  }

  private _handlePanEndGesture(nativeGesture: NativeGestureEvent): void {
    this.recordTouchEnd(nativeGesture.x, nativeGesture.y, nativeGesture.target)
  }

  private _handleLongPressGesture(nativeGesture: NativeGestureEvent): void {
    this.recordTouchStart(nativeGesture.x, nativeGesture.y, nativeGesture.target)
    this.recordTouchEnd(nativeGesture.x, nativeGesture.y, nativeGesture.target)
  }

  private _handlePinchGesture(nativeGesture: NativeGestureEvent): void {
    this.recordPinch(
      nativeGesture.metadata?.scale || 1.0,
      nativeGesture.target,
      nativeGesture.metadata?.velocity || 0
    )
  }

  private _handleSwipeGesture(nativeGesture: NativeGestureEvent): void {
    this.recordSwipe(
      nativeGesture.metadata?.direction || 'unknown',
      nativeGesture.target,
      nativeGesture.metadata?.velocity || 0
    )
  }

  private _sendEvent(event: GestureEvent): void {
    // Send event to backend or store locally
    logger.debug('GestureRecorder', 'Gesture event recorded', { type: event.type, target: event.target })
  }

  private _recordOpenTelemetrySpan(event: GestureEvent): void {
    try {
      logger.debug('GestureRecorder', 'Creating OTEL span for native gesture', {
        type: event.type,
        target: event.target,
        targetInfo: event.targetInfo,
        hasTargetInfo: !!event.targetInfo
      })
      // Special handling to aggregate pan gestures into a single span
      if (event.type === 'pan_start') {
        // End any previously dangling pan span defensively
        if (this.currentPanSpan) {
          this.currentPanSpan.setStatus({ code: SpanStatusCode.OK })
          this.currentPanSpan.end()
        }
        this.panMoveCount = 0
        const panSpan = trace
          .getTracer('@opentelemetry/instrumentation-user-interaction')
          .startSpan('NativeGesture.pan', {
            startTime: event.timestamp,
          })

        panSpan.setAttribute('gesture.type', 'pan')
        panSpan.setAttribute('gesture.timestamp', event.timestamp)
        panSpan.setAttribute('gesture.platform', 'react-native')
        panSpan.setAttribute('gesture.source', 'native-module')

        if (event.coordinates) {
          panSpan.setAttribute('gesture.start.x', event.coordinates.x)
          panSpan.setAttribute('gesture.start.y', event.coordinates.y)
        }
        if (event.target) {
          panSpan.setAttribute('gesture.target', this._truncateText(event.target, 50))
        }
        // Enrich with target info if provided
        const info = event.targetInfo
        if (info) {
          if (info.label) {
            const truncatedLabel = this._truncateText(String(info.label), 50)
            panSpan.setAttribute('gesture.target.label', truncatedLabel)
          }
          if (info.role) {
            panSpan.setAttribute('gesture.target.role', String(info.role))
          }
          if (info.testId) {
            panSpan.setAttribute('gesture.target.test_id', String(info.testId))
          }
          if (info.text) {
            const truncatedText = this._truncateText(String(info.text), 50)
            panSpan.setAttribute('gesture.target.text', truncatedText)
          }
        }
        // Save the span for subsequent move/end events
        this.currentPanSpan = panSpan
        return
      }

      if (event.type === 'pan_move') {
        if (this.currentPanSpan) {
          this.panMoveCount += 1
          this.currentPanSpan.setAttribute('gesture.pan.move_count', this.panMoveCount)
          if (event.coordinates) {
            this.currentPanSpan.setAttribute('gesture.last.x', event.coordinates.x)
            this.currentPanSpan.setAttribute('gesture.last.y', event.coordinates.y)
          }
          // Don't end the span here; just update it
          return
        }
        // If we received a move without a start, fall through to single-shot span below
      }

      if (event.type === 'pan_end') {
        if (this.currentPanSpan) {
          if (event.coordinates) {
            this.currentPanSpan.setAttribute('gesture.end.x', event.coordinates.x)
            this.currentPanSpan.setAttribute('gesture.end.y', event.coordinates.y)
          }
          this.currentPanSpan.setStatus({ code: SpanStatusCode.OK })
          this.currentPanSpan.end()
          this.currentPanSpan = undefined
          this.panMoveCount = 0
          return
        }
        // If no current span, fall through and create a single-shot span for the end event
      }

      // Default behavior: create a short-lived span per non-pan event
      const span = trace
        .getTracer('@opentelemetry/instrumentation-user-interaction')
        .startSpan(`NativeGesture.${event.type}`, {
          startTime: event.timestamp,
          attributes: {
            'gesture.type': event.type,
            'gesture.timestamp': event.timestamp,
            'gesture.platform': 'react-native',
            'gesture.source': 'native-module',
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
        span.setAttribute('gesture.target', this._truncateText(event.target, 100))
      }

      // Enrich with target info if provided
      const info = event.targetInfo
      if (info) {
        if (info.label) {
          const truncatedLabel = this._truncateText(String(info.label), 100)
          span.setAttribute('gesture.target.label', truncatedLabel)
        }
        if (info.role) {
          span.setAttribute('gesture.target.role', String(info.role))
        }
        if (info.testId) {
          span.setAttribute('gesture.target.test_id', String(info.testId))
        }
        if (info.text) {
          const truncatedText = this._truncateText(String(info.text), 200)
          span.setAttribute('gesture.target.text', truncatedText)
        }
      }

      if (event.metadata) {
        Object.entries(event.metadata).forEach(([key, value]) => {
          span.setAttribute(`gesture.metadata.${key}`, String(value))
        })
      }

      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
      logger.debug('GestureRecorder', 'OTEL span created and ended successfully')
    } catch (error) {
      logger.error('GestureRecorder', 'Failed to record OpenTelemetry span for native gesture', error)
    }
  }

  // Public methods for manual event recording (same as before)
  recordTap(x: number, y: number, target?: string, pressure?: number, timestamp?: number): void {
    const event: GestureEvent = {
      type: 'tap',
      timestamp: timestamp || Date.now(),
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

  // Touch event methods (same as before)
  recordTouchStart(x: number, y: number, target?: string, pressure?: number): void {
    // Throttle touch events to prevent spam
    const now = Date.now()
    if (now - this.lastTouchTime < this.touchThrottleMs) {
      logger.debug('GestureRecorder', `Touch start throttled (${now - this.lastTouchTime}ms < ${this.touchThrottleMs}ms)`)
      return
    }
    this.lastTouchTime = now

    logger.debug('GestureRecorder', 'Touch start recorded', { x, y, target, pressure })
    this._createMouseInteractionEvent(x, y, MouseInteractions.TouchStart, now)
  }

  recordTouchMove(x: number, y: number, target?: string, pressure?: number): void {
    // Throttle touch move events more aggressively
    const now = Date.now()
    if (now - this.lastTouchTime < this.touchThrottleMs * 2) { // 200ms throttle for move events
      logger.debug('GestureRecorder', `Touch move throttled (${now - this.lastTouchTime}ms < ${this.touchThrottleMs * 2}ms)`)
      return
    }
    this.lastTouchTime = now

    logger.debug('GestureRecorder', 'Touch move recorded', { x, y, target, pressure })
    this._createMouseMoveEvent(x, y, target)
  }

  recordTouchEnd(x: number, y: number, target?: string, pressure?: number): void {
    const timestamp = Date.now()

    logger.debug('GestureRecorder', 'Touch end recorded', { x, y, target, pressure, timestamp })

    this.recordTap(x, y, target, pressure, timestamp)
    this._createMouseInteractionEvent(x, y, MouseInteractions.TouchEnd, timestamp)

    // Only force screen capture on touch end (not on every touch event)
    this.screenRecorder?.forceCapture(timestamp)
  }

  recordTouchCancel(x: number, y: number, target?: string): void {
    this._createMouseInteractionEvent(x, y, MouseInteractions.TouchCancel)
  }

  setImageNodeId(nodeId: number): void {
    this.imageNodeId = nodeId
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

  private _createMouseInteractionEvent(
    x: number,
    y: number,
    interactionType: MouseInteractions,
    timestamp?: number,
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
      timestamp: timestamp || Date.now(),
    }

    this.recordEvent(incrementalSnapshotEvent)
  }

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

  recordEvent(event: any): void {
    if (this.eventRecorder) {
      this.eventRecorder.recordEvent(event)
    }
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
   * Truncate text to prevent large span attributes
   * @param text - Text to truncate
   * @param maxLength - Maximum length (default: 100)
   * @returns Truncated text with ellipsis if needed
   */
  private _truncateText(text: string, maxLength: number = 100): string {
    if (!text || text.length <= maxLength) {
      return text
    }
    return text.substring(0, maxLength - 3) + '...'
  }
}
