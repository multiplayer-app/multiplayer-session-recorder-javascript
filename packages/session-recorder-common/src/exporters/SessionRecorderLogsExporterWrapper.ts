import { SdkLogRecord, LogRecordExporter } from '@opentelemetry/sdk-logs'
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderLogsExporterWrapperConfig {
  exporter: LogRecordExporter
}

export class SessionRecorderLogsExporterWrapper implements LogRecordExporter {
  private readonly exporter: LogRecordExporter

  constructor(config: SessionRecorderLogsExporterWrapperConfig) {
    this.exporter = config.exporter
  }

  export(logs: SdkLogRecord[], resultCallback: (result: { code: number }) => void): void {
    const filteredLogs = logs.filter(log => {
      const traceId = log.spanContext?.traceId
      return !traceId || (!traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) &&
        !traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX))
    })

    if (filteredLogs.length === 0) {
      resultCallback({ code: 0 })
      return
    }

    this.exporter.export(filteredLogs, resultCallback)
  }

  shutdown(): Promise<void> {
    return this.exporter.shutdown()
  }
}
