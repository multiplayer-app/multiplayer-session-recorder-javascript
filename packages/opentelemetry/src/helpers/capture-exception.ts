import { context, trace, SpanStatusCode } from '@opentelemetry/api'

/**
 * @description Add error to current span
 * @param {Error} error 
 * @returns {void}
 */
export const captureException = (error: Error) => {
  if (!error) return;

  const span = trace.getSpan(context.active())
  if (!span) return;

  span.recordException(error)
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  })
}
