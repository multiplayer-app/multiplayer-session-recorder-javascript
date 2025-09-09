import { InstrumentationBase } from '@opentelemetry/instrumentation'
import { trace, SpanStatusCode } from '@opentelemetry/api'

export class GestureInstrumentation extends InstrumentationBase {
  private _isEnabled = false

  constructor() {
    super('react-native-gesture', '1.0.0', {})
  }

  init(): void {
    // Initialize the instrumentation
  }

  enable(): void {
    this._isEnabled = true
  }

  disable(): void {
    this._isEnabled = false
  }

  isEnabled(): boolean {
    return this._isEnabled
  }

  // Manual gesture tracking methods
  recordTap(x: number, y: number, target?: string) {
    if (!this._isEnabled) return

    const span = trace.getTracer('gesture').startSpan('Gesture.tap', {
      attributes: {
        'gesture.type': 'tap',
        'gesture.coordinates.x': x,
        'gesture.coordinates.y': y,
        'gesture.timestamp': Date.now(),
      },
    })

    if (target) {
      span.setAttribute('gesture.target', target)
    }

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }

  recordSwipe(direction: string, target?: string) {
    if (!this._isEnabled) return

    const span = trace.getTracer('gesture').startSpan('Gesture.swipe', {
      attributes: {
        'gesture.type': 'swipe',
        'gesture.direction': direction,
        'gesture.timestamp': Date.now(),
      },
    })

    if (target) {
      span.setAttribute('gesture.target', target)
    }

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }

  recordPinch(scale: number, target?: string) {
    if (!this._isEnabled) return

    const span = trace.getTracer('gesture').startSpan('Gesture.pinch', {
      attributes: {
        'gesture.type': 'pinch',
        'gesture.scale': scale,
        'gesture.timestamp': Date.now(),
      },
    })

    if (target) {
      span.setAttribute('gesture.target', target)
    }

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }

  recordPan(deltaX: number, deltaY: number, target?: string) {
    if (!this._isEnabled) return

    const span = trace.getTracer('gesture').startSpan('Gesture.pan', {
      attributes: {
        'gesture.type': 'pan',
        'gesture.delta_x': deltaX,
        'gesture.delta_y': deltaY,
        'gesture.timestamp': Date.now(),
      },
    })

    if (target) {
      span.setAttribute('gesture.target', target)
    }

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }

  recordLongPress(duration: number, target?: string) {
    if (!this._isEnabled) return

    const span = trace.getTracer('gesture').startSpan('Gesture.longPress', {
      attributes: {
        'gesture.type': 'longPress',
        'gesture.duration': duration,
        'gesture.timestamp': Date.now(),
      },
    })

    if (target) {
      span.setAttribute('gesture.target', target)
    }

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }

  // Error tracking for gesture failures
  recordGestureError(error: Error, gestureType: string) {
    if (!this._isEnabled) return

    const span = trace.getTracer('gesture').startSpan(`Gesture.${gestureType}.error`, {
      attributes: {
        'gesture.type': gestureType,
        'gesture.error': true,
        'gesture.timestamp': Date.now(),
      },
    })

    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    span.recordException(error)
    span.end()
  }
}
