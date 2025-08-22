import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderHttpTraceExporterConfig {
  /** The URL to send traces to. Defaults to MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL */
  url?: string
  /** Custom headers to include in requests */
  headers?: Record<string, string>
  /** Timeout for HTTP requests in milliseconds. Defaults to 30000 */
  timeoutMillis?: number
  /** Whether to keep the connection alive. Defaults to true */
  keepAlive?: boolean
  /** Maximum number of concurrent requests. Defaults to 20 */
  concurrencyLimit?: number
}

/**
 * Custom HTTP trace exporter for Session Recorder
 * Extends the OTLP HTTP exporter with Session Recorder-specific configuration
 * Only exports spans with trace IDs starting with Multiplayer prefixes
 */
export class SessionRecorderHttpTraceExporter extends OTLPTraceExporter {
  constructor(config: SessionRecorderHttpTraceExporterConfig = {}) {
    const {
      url = MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
      headers = {},
      timeoutMillis = 30000,
      keepAlive = true,
      concurrencyLimit = 20,
    } = config

    super({
      url,
      headers: {
        'Content-Type': 'application/x-protobuf',
        'User-Agent': '@multiplayer-app/session-recorder-common/1.0.0',
        ...headers,
      },
      timeoutMillis,
      keepAlive,
      concurrencyLimit,
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
