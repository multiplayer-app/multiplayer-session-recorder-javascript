import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import {
  MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_HTTP_URL,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderHttpLogsExporterConfig {
  /** The URL to send logs to. Defaults to MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_HTTP_URL */
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

export class SessionRecorderHttpLogsExporter extends OTLPLogExporter {
  constructor(config: SessionRecorderHttpLogsExporterConfig) {
    const {
      url = MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_HTTP_URL,
      apiKey,
      timeoutMillis = 30000,
      keepAlive = true,
      concurrencyLimit = 20,
    } = config

    super({
      url,
      headers: {
        'Content-Type': 'application/x-protobuf',
        'User-Agent': '@multiplayer-app/session-recorder-common/1.0.0',
        'authorization': apiKey,
      },
      timeoutMillis,
      keepAlive,
      concurrencyLimit,
    })
  }

  override export(logs: any[], resultCallback: (result: { code: number }) => void): void {
    const filteredLogs = logs.filter(log => {
      const traceId = log.spanContext?.traceId || log.traceId
      return traceId && (traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
        traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX))
    })

    if (filteredLogs.length === 0) {
      resultCallback({ code: 0 })
      return
    }

    super.export(filteredLogs, resultCallback)
  }
}
