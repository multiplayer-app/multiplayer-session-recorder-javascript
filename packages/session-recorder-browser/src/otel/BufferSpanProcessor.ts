import { Context, TraceFlags } from '@opentelemetry/api';
import {
    SamplingDecision,
    ReadableSpan,
    SpanProcessor,
    Span
} from '@opentelemetry/sdk-trace-base'
import {
    MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX,
    MULTIPLAYER_TRACE_CONTINUOUS_SESSION_CACHE_PREFIX,
    SessionRecorderTraceIdRatioBasedSampler,
    SessionRecorderBrowserTraceExporter
} from '@multiplayer-app/session-recorder-common'
import type { CrashBuffer } from '@multiplayer-app/session-recorder-common'

/**
 * Implementation of the {@link SpanProcessor} that batches spans exported by
 * the SDK then pushes them to the exporter pipeline.
 */
export abstract class BufferSpanProcessorBase implements SpanProcessor {
    constructor(
        private readonly _exporter: SessionRecorderBrowserTraceExporter,
        private readonly _sampler: SessionRecorderTraceIdRatioBasedSampler,
        private readonly _crashBuffer: CrashBuffer
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
            this._crashBuffer.appendSpans([this._exporter?.serializeSpan(span)])
        }


        const shouldSample = this._sampler.shouldSample(undefined, traceId)

        if (shouldSample.decision === SamplingDecision.RECORD_AND_SAMPLED) {
            this._exporter.export([span], () => {})
        }
    }

    shutdown(): Promise<void> {
        return Promise.resolve()
    }

    exportBuffer(): Promise<void> {
        return this._exporter.export(this._crashBuffer.spans)
    }
}
