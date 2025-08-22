import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderTraceExporterWrapperConfig {
  exporter: SpanExporter
}

export class SessionRecorderTraceExporterWrapper implements SpanExporter {
  private readonly exporter: SpanExporter

  constructor(config: SessionRecorderTraceExporterWrapperConfig) {
    this.exporter = config.exporter
  }

  export(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void): void {
    const filteredSpans = spans.filter(span => {
      const traceId = span.spanContext().traceId
      return !traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) &&
        !traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
    })

    if (filteredSpans.length === 0) {
      resultCallback({ code: 0 })
      return
    }

    this.exporter.export(filteredSpans, resultCallback)
  }

  shutdown(): Promise<void> {
    return this.exporter.shutdown()
  }
}
