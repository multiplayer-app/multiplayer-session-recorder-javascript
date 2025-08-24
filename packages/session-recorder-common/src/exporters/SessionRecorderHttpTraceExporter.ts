import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderHttpTraceExporterConfig {
  /** The URL to send traces to. Defaults to MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL */
  url?: string
  /** API key for authentication. Required. */
  apiKey: string
  /** Timeout for HTTP requests in milliseconds. Defaults to 30000 */
  timeoutMillis?: number
  /** Whether to keep the connection alive. Defaults to true */
  keepAlive?: boolean
  /** Maximum number of concurrent requests. Defaults to 20 */
  concurrencyLimit?: number
}

/**
 * HTTP trace exporter for Session Recorder
 * Exports traces via HTTP to Multiplayer's OTLP endpoint
 * Only exports spans with trace IDs starting with Multiplayer prefixes
 */
export class SessionRecorderHttpTraceExporter extends OTLPTraceExporter {
  constructor(config: SessionRecorderHttpTraceExporterConfig) {
    const {
      url = MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
      apiKey,
      timeoutMillis = 30000,
      keepAlive = true,
      concurrencyLimit = 20,
    } = config

    super({
      url,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '@multiplayer-app/session-recorder-common/1.0.0',
        'Authorization': apiKey,
      },
      timeoutMillis,
      keepAlive,
      concurrencyLimit,
    })
  }

  override export(
    spans: any[],
    resultCallback: (result: { code: number }) => void,
  ): void {
    const filteredSpans = spans.filter(span => {
      const traceId = span.spanContext().traceId
      return traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
        traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
    })

    if (filteredSpans.length === 0) {
      resultCallback({ code: 0 })
      return
    }

    super.export(filteredSpans, resultCallback)
  }
}
