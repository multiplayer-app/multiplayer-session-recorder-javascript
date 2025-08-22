import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import {
  MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_GRPC_URL,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderGrpcLogsExporterConfig {
  /** The URL to send logs to. Defaults to MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_GRPC_URL */
  url?: string
  /** API key for authentication. Required. */
  apiKey: string
  /** Timeout for gRPC requests in milliseconds. Defaults to 30000 */
  timeoutMillis?: number
}

/**
 * gRPC logs exporter for Session Recorder
 * Exports logs via gRPC to Multiplayer's OTLP endpoint
 * Only exports logs with trace IDs starting with Multiplayer prefixes
 * Note: API key authentication may need to be handled at the gRPC client level
 */
export class SessionRecorderGrpcLogsExporter extends OTLPLogExporter {
  constructor(config: SessionRecorderGrpcLogsExporterConfig) {
    const {
      url = MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_GRPC_URL,
      timeoutMillis = 30000,
    } = config

    super({
      url,
      timeoutMillis,
    })
  }

  override export(logs: any[], resultCallback: (result: { code: number }) => void): void {
    // Filter logs to only include those with Multiplayer trace prefixes
    const filteredLogs = logs.filter(log => {
      const traceId = log.spanContext?.traceId || log.traceId
      return traceId && (traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
        traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX))
    })

    // Only proceed if there are filtered logs
    if (filteredLogs.length === 0) {
      resultCallback({ code: 0 })
      return
    }

    super.export(filteredLogs, resultCallback)
  }
}
