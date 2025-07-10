import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import {
  OTLPExporterConfigBase,
  OTLPExporterBase,
} from '@opentelemetry/otlp-exporter-base'
import { createLegacyOtlpBrowserExportDelegate } from '@opentelemetry/otlp-exporter-base/browser-http'
import { MultiplayerJsonTraceSerializer } from './MultiplayerJsonTraceSerializer'
import { MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_URL } from './constants.base'

interface MultiplayerExporterBrowserConfig
  extends OTLPExporterConfigBase {
  apiKey?: string
  usePostMessageFallback?: boolean
  postMessageType?: string
  postMessageTargetOrigin?: string
}

/**
 * Trace Exporters for Web with postMessage fallback
 */
export class MultiplayerHttpTraceExporterBrowser
  extends OTLPExporterBase<ReadableSpan[]>
  implements SpanExporter {

  private usePostMessage: boolean = false
  private readonly postMessageType: string
  private readonly postMessageTargetOrigin: string
  private readonly config: MultiplayerExporterBrowserConfig

  constructor(config: MultiplayerExporterBrowserConfig = {}) {
    const _config = {
      ...config,
      url: config.url || MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_URL,
      headers: {
        ...(config.headers || {}),
        ...config.apiKey
          ? { Authorization: config.apiKey }
          : {},
      },
    }

    super(
      createLegacyOtlpBrowserExportDelegate(
        _config,
        MultiplayerJsonTraceSerializer,
        'v1/traces',
        { 'Content-Type': 'application/json' },
      ),
    )

    this.config = config
    this.postMessageType = config.postMessageType || 'MULTIPLAYER_SESSION_DEBUGGER_LIB'
    this.postMessageTargetOrigin = config.postMessageTargetOrigin || '*'
  }

  override export(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void): void {
    if (this.usePostMessage) {
      this.exportViaPostMessage(spans, resultCallback)
      return
    }

    super.export(spans, (result) => {
      if (result.code === 0) {
        resultCallback(result)
      } else if (this.config.usePostMessageFallback) {
        this.usePostMessage = true
        this.exportViaPostMessage(spans, resultCallback)
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
    return {
      _spanContext: span.spanContext(),
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
      parentSpanId: span.parentSpanId,
      instrumentationLibrary: span.instrumentationLibrary,
      droppedAttributesCount: span.droppedAttributesCount,
      droppedEventsCount: span.droppedEventsCount,
      droppedLinksCount: span.droppedLinksCount,
      resource: {
        attributes: span.resource.attributes,
        asyncAttributesPending: span.resource.asyncAttributesPending,
      },
    }
  }

  getDefaultUrl(config: OTLPExporterConfigBase): string {
    return config.url || MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_URL
  }
}
