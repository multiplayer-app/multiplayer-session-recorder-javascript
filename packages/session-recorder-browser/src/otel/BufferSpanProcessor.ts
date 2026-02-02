import { Context, TraceFlags } from '@opentelemetry/api';
import {
    ReadableSpan,
    SpanProcessor,
    Span,
    BatchSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import {
    MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX,
    MULTIPLAYER_TRACE_CONTINUOUS_SESSION_CACHE_PREFIX,
} from '@multiplayer-app/session-recorder-common'
import type { CrashBuffer } from '@multiplayer-app/session-recorder-common'

/**
 * Implementation of the {@link SpanProcessor} that batches spans exported by
 * the SDK then pushes them to the exporter pipeline.
 */
export class CrashBufferSpanProcessor implements SpanProcessor {
    constructor(
        private readonly _exporter: BatchSpanProcessor,
        private readonly _crashBuffer?: CrashBuffer
    ) { }

    forceFlush(): Promise<void> {
        return Promise.resolve()
        // if (this._shutdownOnce.isCalled) {
        //   return this._shutdownOnce.promise;
        // }
        // return this._flushAll();
    }

    onStart(_span: Span, _parentContext: Context): void { }

    onEnd(span: ReadableSpan): void {
        const traceId = span.spanContext().traceId

        if ((span.spanContext().traceFlags & TraceFlags.SAMPLED) === 0) {
            return;
        }

        if (
            traceId.startsWith(MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX) ||
            traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_SESSION_CACHE_PREFIX)
        ) {
            if (this._crashBuffer) {
                this._crashBuffer.appendSpans([{
                    ts: span.startTime[0] * 1000 + span.startTime[1] / 1000000,
                    span: span
                }])
            }
            return
        }

        this._exporter.onEnd(span)

        // this._exporter.export([span], () => { })
    }

    shutdown(): Promise<void> {
        return Promise.resolve()
    }

    async exportBuffer(): Promise<void> {
        if (!this._crashBuffer) {
            return Promise.resolve()
        }

        const snapshot = await this._crashBuffer.snapshot()
        const spans = snapshot.otelSpans.map((s) => s.span)

        spans.forEach(span => {
            this._exporter.onEnd(span)
        })
        
        return Promise.resolve()
        // return this._exporter.export(this._crashBuffer.spans)
    }
}
