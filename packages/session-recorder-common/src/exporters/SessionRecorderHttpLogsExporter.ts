import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import {
  MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_HTTP_URL,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderHttpLogsExporterConfig {
  /** The URL to send logs to. Defaults to MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_HTTP_URL */
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
 * Custom HTTP logs exporter for Session Recorder
 * Extends the OTLP HTTP exporter with Session Recorder-specific configuration for logs
 * Only exports logs with trace IDs starting with Multiplayer prefixes
 */
export class SessionRecorderHttpLogsExporter extends OTLPLogExporter {
  constructor(config: SessionRecorderHttpLogsExporterConfig = {}) {
    const {
      url = MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_HTTP_URL,
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

  override export(logs: any[], resultCallback: (result: { code: number }) => void): void {
    // Filter logs to only include those with Multiplayer trace prefixes
    const filteredLogs = logs.filter(log => {
      const traceId = log.spanContext?.traceId || log.traceId
      return traceId && (traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
        traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX))
    })

    // Only export if there are filtered logs
    if (filteredLogs.length > 0) {
      super.export(filteredLogs, resultCallback)
    } else {
      resultCallback({ code: 0 })
    }
  }
}
