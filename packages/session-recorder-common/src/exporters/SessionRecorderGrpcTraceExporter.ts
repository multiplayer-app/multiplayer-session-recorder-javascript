import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import {
  MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_GRPC_URL,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderGrpcTraceExporterConfig {
  /** The gRPC URL to send traces to. Defaults to MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_GRPC_URL */
  url?: string
  /** Timeout for gRPC requests in milliseconds. Defaults to 30000 */
  timeoutMillis?: number
}

/**
 * Custom gRPC trace exporter for Session Recorder
 * Extends the OTLP gRPC exporter with Session Recorder-specific configuration
 * Only exports spans with trace IDs starting with Multiplayer prefixes
 */
export class SessionRecorderGrpcTraceExporter extends OTLPTraceExporter {
  constructor(config: SessionRecorderGrpcTraceExporterConfig = {}) {
    const {
      url = MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_GRPC_URL,
      timeoutMillis = 30000,
    } = config

    super({
      url,
      timeoutMillis,
    })
  }

  override export(spans: any[], resultCallback: (result: { code: number }) => void): void {
    // Filter spans to only include those with Multiplayer trace prefixes
    const filteredSpans = spans.filter(span => {
      const traceId = span.spanContext().traceId
      return traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
        traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
    })

    // Only export if there are filtered spans
    if (filteredSpans.length > 0) {
      super.export(filteredSpans, resultCallback)
    } else {
      resultCallback({ code: 0 })
    }
  }
}
