import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from '../constants/constants.base'

export interface SessionRecorderBrowserTraceExporterConfig {
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
export class SessionRecorderBrowserTraceExporter
  extends OTLPTraceExporter
  implements SpanExporter {

  private usePostMessage: boolean = false
  private readonly postMessageType: string
  private readonly postMessageTargetOrigin: string
  private readonly config: SessionRecorderBrowserTraceExporterConfig

  constructor(config: SessionRecorderBrowserTraceExporterConfig = {}) {
    const {
      url = MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
      headers = {},
      timeoutMillis = 30000,
      keepAlive = true,
      concurrencyLimit = 20,
      //   usePostMessageFallback = false,
      postMessageType = 'MULTIPLAYER_SESSION_DEBUGGER_LIB',
      postMessageTargetOrigin = '*',
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

    this.config = config
    this.postMessageType = postMessageType
    this.postMessageTargetOrigin = postMessageTargetOrigin
  }

  override export(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void): void {
    // Filter spans to only include those with Multiplayer trace prefixes
    const filteredSpans = spans.filter(span => {
      const traceId = span.spanContext().traceId
      return traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
             traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
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

    super.export(filteredSpans, (result) => {
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
          payload: spans.map(span => this._serializeSpan(span)),
        },
        this.postMessageTargetOrigin,
      )
      resultCallback({ code: 0 })
    } catch (e) {
      resultCallback({ code: 1 })
    }
  }

  private _serializeSpan(span: ReadableSpan): any {
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
      startTime: span.startTime,
      duration: span.duration,
      attributes: span.attributes,
      parentSpanId: spanContext.spanId, // Using spanId as parentSpanId is not available in newer versions
      droppedAttributesCount: span.droppedAttributesCount,
      droppedEventsCount: span.droppedEventsCount,
      droppedLinksCount: span.droppedLinksCount,
      resource: {
        attributes: span.resource.attributes,
        asyncAttributesPending: span.resource.asyncAttributesPending,
      },
    }
  }
}
