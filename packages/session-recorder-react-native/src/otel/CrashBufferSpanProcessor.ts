import { type Context, TraceFlags, SpanStatusCode } from '@opentelemetry/api';
import {
  type ReadableSpan,
  type SpanProcessor,
  type Span,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX } from '@multiplayer-app/session-recorder-common';
import type { CrashBuffer } from '@multiplayer-app/session-recorder-common';

/**
 * Implementation of the {@link SpanProcessor} that batches spans exported by
 * the SDK then pushes them to the exporter pipeline.
 */
export class CrashBufferSpanProcessor implements SpanProcessor {
  constructor(
    private readonly _exporter: BatchSpanProcessor,
    private readonly _crashBuffer: CrashBuffer | undefined,
    private readonly _serializeSpan: (span: ReadableSpan) => any
  ) {}

  forceFlush(): Promise<void> {
    return this._exporter.forceFlush();
  }

  onStart(_span: Span, _parentContext: Context): void {
    return this._exporter.onStart(_span, _parentContext);
  }

  onEnd(span: ReadableSpan): void {
    const _spanContext = span.spanContext();

    const traceId = _spanContext.traceId;

    // Never buffer/export unsampled spans.
    if ((_spanContext.traceFlags & TraceFlags.SAMPLED) === 0) {
      return;
    }

    if (
      traceId.startsWith(MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX) ||
      span.status?.code === SpanStatusCode.ERROR
    ) {
      if (this._crashBuffer) {
        this._crashBuffer.appendSpans([
          {
            ts: span.startTime[0] * 1000 + span.startTime[1] / 1000000,
            span: this._serializeSpan(span),
          },
        ]);
      }
      return;
    }

    this._exporter.onEnd(span);
  }

  shutdown(): Promise<void> {
    return this._exporter.shutdown();
  }
}
