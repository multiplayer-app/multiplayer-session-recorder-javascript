import { Context } from '@opentelemetry/api'
import { ReadableSpan, SpanProcessor, Span } from '@opentelemetry/sdk-trace-base'
import { MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX } from '@multiplayer-app/session-recorder-common'
import type { CrashBuffer } from '@multiplayer-app/session-recorder-common'

/**
 * Implementation of the {@link SpanProcessor} that batches spans exported by
 * the SDK then pushes them to the exporter pipeline.
 */
export class CrashBufferSpanProcessor implements SpanProcessor {
  constructor(
    private readonly _crashBuffer: CrashBuffer | undefined,
    private readonly _serializeSpan: (span: ReadableSpan) => any
  ) {}

  forceFlush(): Promise<void> {
    return Promise.resolve()
  }

  onStart(_span: Span, _parentContext: Context): void {
    return
  }

  onEnd(span: ReadableSpan): void {
    const _spanContext = span.spanContext()

    const traceId = _spanContext.traceId

    // // Never buffer/export unsampled spans.
    // if ((_spanContext.traceFlags & TraceFlags.SAMPLED) === 0) {
    //   return
    // }

    if (traceId.startsWith(MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX)) {
      if (this._crashBuffer) {
        this._crashBuffer.appendSpans([
          {
            ts: span.startTime[0] * 1000 + span.startTime[1] / 1000000,
            span: this._serializeSpan(span)
          }
        ])
      }
      return
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve()
  }
}
