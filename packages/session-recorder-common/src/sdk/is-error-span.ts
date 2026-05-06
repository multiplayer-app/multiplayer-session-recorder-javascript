import { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { SpanStatusCode } from '@opentelemetry/api'
import {
  ATTR_EXCEPTION_TYPE,
  ATTR_EXCEPTION_MESSAGE,
} from '@opentelemetry/semantic-conventions'

export const isErrorSpan = (span: ReadableSpan): boolean => {
  return span.status.code === SpanStatusCode.ERROR
    || (
      !!span.attributes[ATTR_EXCEPTION_TYPE]
        && !!span.attributes[ATTR_EXCEPTION_MESSAGE]
    )
}
