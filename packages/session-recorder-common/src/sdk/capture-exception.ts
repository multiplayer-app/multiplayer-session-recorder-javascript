import { context, trace, SpanStatusCode } from '@opentelemetry/api'
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE
} from '@opentelemetry/semantic-conventions'
import { getResourceAttributes } from './set-resource-attributes'

/**
 * @description Add error to current span
 * @param {Error} error
 * @returns {void}
 */
export const captureException = (error: Error, errorInfo?: Record<string, any>) => {
  if (!error || !shouldCaptureException(error)) {
    return
  }

  const activeContext = context.active()

  let span = trace.getSpan(activeContext)
  let isNewSpan = false

  if (!span || !span.isRecording()) {
    span = trace.getTracer('exception').startSpan(error.name || 'Error', {
      attributes: {
        [ATTR_EXCEPTION_MESSAGE]: error.message,
        [ATTR_EXCEPTION_STACKTRACE]: error.stack,
        [ATTR_EXCEPTION_TYPE]: error.name,
        ...getResourceAttributes()
      }
    })
    trace.setSpan(activeContext, span)
    isNewSpan = true
  } else {
    span.setAttributes({
      [ATTR_EXCEPTION_MESSAGE]: error.message,
      [ATTR_EXCEPTION_STACKTRACE]: error.stack,
      [ATTR_EXCEPTION_TYPE]: error.name
    })
  }

  if (errorInfo) {
    Object.entries(errorInfo).forEach(([key, value]) => {
      span.setAttribute(`error_info.${key}`, value)
    })
  }

  span.recordException(error)
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message
  })

  if (isNewSpan) {
    span.end()
  }
}

/**
 * Best-effort deduplication of exceptions that fire multiple times
 * (e.g. framework handler + global handlers) within a short time window.
 */

const exceptionDedupeWindowMs = 2000
const recentExceptionFingerprints = new Map<string, number>()

export const shouldCaptureException = (error: Error, _errorInfo?: Record<string, any>): boolean => {
  if (!error) return false

  const now = Date.now()

  // Build a fingerprint that is stable enough across repeated emissions
  // but not so broad that different errors collapse into one.
  const keyParts: string[] = []
  keyParts.push(error.name || 'Error')
  keyParts.push(error.message || '')

  // First stack line tends to include file/line where it originated.
  if (typeof error.stack === 'string') {
    const firstFrame = error.stack.split('\n')[1] || ''
    keyParts.push(firstFrame.trim())
  }

  const fingerprint = keyParts.join('|').slice(0, 500)

  const lastSeen = recentExceptionFingerprints.get(fingerprint)
  if (lastSeen && now - lastSeen < exceptionDedupeWindowMs) {
    return false
  }

  recentExceptionFingerprints.set(fingerprint, now)

  // Cheap cleanup of old entries to avoid unbounded growth.
  for (const [key, ts] of recentExceptionFingerprints) {
    if (now - ts > exceptionDedupeWindowMs * 5) {
      recentExceptionFingerprints.delete(key)
    }
  }

  return true
}
