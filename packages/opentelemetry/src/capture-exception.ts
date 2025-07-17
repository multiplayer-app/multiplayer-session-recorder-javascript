import { context, trace, SpanStatusCode } from '@opentelemetry/api'

export const captureException = (error: Error) => {
  if (!error) return;

  const span = trace.getSpan(context.active());
  if (!span) return;

  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
}
