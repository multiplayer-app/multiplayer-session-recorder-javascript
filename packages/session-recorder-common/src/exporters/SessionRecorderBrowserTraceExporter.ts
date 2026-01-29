import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import { ExportResult } from '@opentelemetry/core'

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX
} from '../constants/constants.base'

export interface SessionRecorderBrowserTraceExporterConfig {
  /** URL for the OTLP endpoint. Defaults to Multiplayer's default traces endpoint. */
  url?: string
  /** API key for authentication. Required. */
  apiKey?: string
  /** Additional headers to include in requests */
  headers?: Record<string, string>
  /** Request timeout in milliseconds */
  timeoutMillis?: number
  /** Whether to use keep-alive connections */
  keepAlive?: boolean
  /** Maximum number of concurrent requests */
  concurrencyLimit?: number
  /** Whether to use postMessage fallback for cross-origin requests */
  usePostMessageFallback?: boolean
  /** PostMessage type identifier */
  postMessageType?: string
  /** PostMessage target origin */
  postMessageTargetOrigin?: string
}

/**
 * Browser-specific trace exporter for Session Recorder
 * Exports traces via HTTP to Multiplayer's OTLP endpoint with browser-specific optimizations
 * Only exports spans with trace IDs starting with Multiplayer prefixes
 */
export class SessionRecorderBrowserTraceExporter implements SpanExporter {
  private exporter: OTLPTraceExporter
  private usePostMessage: boolean = false
  private readonly postMessageType: string
  private readonly postMessageTargetOrigin: string
  private readonly config: SessionRecorderBrowserTraceExporterConfig

  constructor(config: SessionRecorderBrowserTraceExporterConfig = {}) {
    const {
      url = MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
      apiKey,
      headers = {},
      timeoutMillis = 30000,
      keepAlive = true,
      concurrencyLimit = 20,
      postMessageType = 'MULTIPLAYER_SESSION_DEBUGGER_LIB',
      postMessageTargetOrigin = '*'
    } = config

    this.config = {
      ...config,
      url,
      apiKey,
      headers,
      keepAlive,
      timeoutMillis,
      concurrencyLimit
    }
    this.postMessageType = postMessageType
    this.postMessageTargetOrigin = postMessageTargetOrigin

    this.exporter = this._createExporter()
  }

  export(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void): void {
    // Filter spans to only include those with Multiplayer trace prefixes
    const filteredSpans = spans.filter((span) => {
      const traceId = span.spanContext().traceId
      return (
        traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
        traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
      )
    })

    // Only proceed if there are filtered spans
    if (filteredSpans.length === 0) {
      resultCallback({ code: 0 })
      return
    }

    if (this.usePostMessage) {
      this.exportViaPostMessage(filteredSpans, resultCallback)
      return
    }

    this.exporter.export(filteredSpans, (result) => {
      if (result.code === 0) {
        resultCallback(result)
      } else if (this.config.usePostMessageFallback) {
        this.usePostMessage = true
        this.exportViaPostMessage(filteredSpans, resultCallback)
      } else {
        resultCallback(result)
      }
    })
  }

  shutdown(): Promise<void> {
    return this.exporter.shutdown()
  }

  exportBuffer(spans: ReadableSpan[]): Promise<ExportResult | undefined> {
    return new Promise((resolve) => {
      this.exporter.export(spans, (result) => {
        resolve(result)
      })
    })
  }

  private exportViaPostMessage(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void): void {
    if (typeof window === 'undefined') {
      resultCallback({ code: 1 })
      return
    }

    try {
      window.postMessage(
        {
          action: 'traces',
          type: this.postMessageType,
          payload: spans.map((span) => this.serializeSpan(span))
        },
        this.postMessageTargetOrigin
      )
      resultCallback({ code: 0 })
    } catch (e) {
      resultCallback({ code: 1 })
    }
  }

  serializeSpan(span: ReadableSpan): any {
    const spanContext = span.spanContext()
    return {
      _spanContext: spanContext,
      name: span.name,
      kind: span.kind,
      links: span.links,
      ended: span.ended,
      events: span.events,
      status: span.status,
      endTime: span.endTime,
      resource: span.resource,
      duration: span.duration,
      startTime: span.startTime,
      attributes: span.attributes,
      droppedLinksCount: span.droppedLinksCount,
      parentSpanContext: span.parentSpanContext,
      droppedEventsCount: span.droppedEventsCount,
      instrumentationScope: span.instrumentationScope,
      droppedAttributesCount: span.droppedAttributesCount
    }
  }

  private _createExporter(): OTLPTraceExporter {
    return new OTLPTraceExporter({
      url: this.config.url,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: this.config.apiKey } : {}),
        ...(this.config.headers || {})
      },
      timeoutMillis: this.config.timeoutMillis,
      keepAlive: this.config.keepAlive,
      concurrencyLimit: this.config.concurrencyLimit
    })
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey
    this.exporter = this._createExporter()
  }
}
