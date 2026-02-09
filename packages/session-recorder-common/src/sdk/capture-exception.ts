import { context, trace, SpanStatusCode } from '@opentelemetry/api'
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions'
import { getResourceAttributes } from './set-resource-attributes'

/**
 * @description Add error to current span
 * @param {Error} error
 * @returns {void}
 */
export const captureException = (
  error: Error,
  errorInfo?: Record<string, any>,
) => {
  if (!error) {
    return
  }

  const activeContext = context.active()

  let span = trace.getSpan(activeContext)
  let isNewSpan = false

  if (!span || !span.isRecording()) {
    span = trace.getTracer('exception').startSpan(
      error.name || 'Error',
      {
        attributes: {
          [ATTR_EXCEPTION_MESSAGE]: error.message,
          [ATTR_EXCEPTION_STACKTRACE]: error.stack,
          [ATTR_EXCEPTION_TYPE]: error.name,
          ...getResourceAttributes(),
        },
      },
    )
    trace.setSpan(activeContext, span)
    isNewSpan = true
  } else {
    span.setAttributes({
      [ATTR_EXCEPTION_MESSAGE]: error.message,
      [ATTR_EXCEPTION_STACKTRACE]: error.stack,
      [ATTR_EXCEPTION_TYPE]: error.name,
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
    message: error.message,
  })

  if (isNewSpan) {
    span.end()
  }
}
