import { Resource } from '@opentelemetry/resources'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import * as SemanticAttributes from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import {
  SessionType,
  ATTR_MULTIPLAYER_SESSION_ID,
  SessionRecorderIdGenerator,
  SessionRecorderHttpTraceExporterBrowser,
  SessionRecorderTraceIdRatioBasedSampler,
} from '@multiplayer-app/common'
import { TracerBrowserConfig } from '../types'
import { OTEL_IGNORE_URLS, OTEL_MP_DOC_TRACE_RATIO } from '../config'
import { processHttpPayload, headersToObject, extractResponseBody } from './helpers'

export class TracerBrowserSDK {
  private tracerProvider?: WebTracerProvider
  private config?: TracerBrowserConfig
  private allowedElements = new Set<string>(['A', 'BUTTON'])
  private sessionId = ''
  private idGenerator

  constructor() { }

  private setSessionId(
    sessionId: string,
    sessionType: SessionType = SessionType.PLAIN,
  ) {
    this.sessionId = sessionId
    this.idGenerator.setSessionId(sessionId, sessionType)
  }

  init(options: TracerBrowserConfig): void {
    this.config = options
    const { application, version, environment } = this.config

    this.idGenerator = new SessionRecorderIdGenerator({
      autoDocTracesRatio: options.docTraceRatio || OTEL_MP_DOC_TRACE_RATIO,
    })

    this.tracerProvider = new WebTracerProvider({
      resource: new Resource({
        [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
        [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
        [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      }),
      idGenerator: this.idGenerator,
      sampler: new SessionRecorderTraceIdRatioBasedSampler(this.config.sampleTraceRatio),
      spanProcessors: [
        this._getSpanSessionIdProcessor(),
      ],
    })

    if (this.config.apiKey) {
      this.addBatchSpanExporter(this.config.apiKey)
    }

    this.tracerProvider.register({
      // contextManager: new ZoneContextManager(),
      propagator: new W3CTraceContextPropagator(),
    })

    registerInstrumentations({
      tracerProvider: this.tracerProvider,
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-xml-http-request': {
            clearTimingResources: true,
            ignoreUrls: [
              ...OTEL_IGNORE_URLS,
              ...(this.config.ignoreUrls || []),
            ],
            propagateTraceHeaderCorsUrls: options.propagateTraceHeaderCorsUrls,
            applyCustomAttributesOnSpan: (span, xhr) => {
              if (!this.config) return

              const { captureBody, captureHeaders } = this.config

              try {
                if (!captureBody && !captureHeaders) {
                  return
                }

                // @ts-ignore
                const requestBody = xhr.networkRequest.requestBody
                // @ts-ignore
                const responseBody = xhr.networkRequest.responseBody
                // @ts-ignore
                const requestHeaders = xhr.networkRequest.requestHeaders || {}
                // @ts-ignore
                const responseHeaders = xhr.networkRequest.responseHeaders || {}

                const payload = {
                  requestBody,
                  responseBody,
                  requestHeaders,
                  responseHeaders,
                }
                processHttpPayload(payload, this.config, span)
              } catch (error) {
                // eslint-disable-next-line
                console.error('[DEBUGGER_LIB] Failed to capture xml-http payload', error)
              }
            },
          },
          '@opentelemetry/instrumentation-fetch': {
            clearTimingResources: true,
            ignoreUrls: [
              ...OTEL_IGNORE_URLS,
              ...(this.config.ignoreUrls || []),
            ],
            propagateTraceHeaderCorsUrls: options.propagateTraceHeaderCorsUrls,
            applyCustomAttributesOnSpan: async (span, request, response) => {
              if (!this.config) return

              const { captureBody, captureHeaders } = this.config

              try {
                if (!captureBody && !captureHeaders) {
                  return
                }

                const requestBody = request.body
                const requestHeaders = headersToObject(request.headers)
                const responseHeaders = headersToObject(response instanceof Response ? response.headers : undefined)

                let responseBody: string | null = null
                if (response instanceof Response && response.body) {
                  responseBody = await extractResponseBody(response)
                }

                const payload = {
                  requestBody,
                  responseBody,
                  requestHeaders,
                  responseHeaders,
                }
                processHttpPayload(payload, this.config, span)
              } catch (error) {
                // eslint-disable-next-line
                console.error('[DEBUGGER_LIB] Failed to capture fetch payload', error)
              }
            },
          },
          '@opentelemetry/instrumentation-user-interaction': {
            shouldPreventSpanCreation: (_event, element: HTMLElement, span) => {
              if (span['parentSpanId']) {
                return true
              }
              let textContent = ''
              if (this.allowedElements.has(element.tagName)) {
                textContent = String(
                  element.textContent || element.ariaLabel || '',
                ).trim()
              }
              span.setAttribute('target.innerText', textContent)
              return false
            },
          },
        }),
      ],
    })
  }

  start(
    sessionId,
    sessionType: SessionType,
  ): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }

    this.setSessionId(sessionId, sessionType)
  }

  stop(): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }

    this.setSessionId('')
  }


  addBatchSpanExporter(apiKey: string): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }

    this.tracerProvider.addSpanProcessor(new BatchSpanProcessor(
      new SessionRecorderHttpTraceExporterBrowser({
        apiKey,
        url: `${this.config?.exporterApiBaseUrl}/v1/traces`,
        usePostMessageFallback: this.config?.usePostMessageFallback,
      }),
    ))
  }

  private _getSpanSessionIdProcessor(): SpanProcessor {
    return {
      forceFlush: () => Promise.resolve(),
      onEnd: () => { },
      shutdown: () => Promise.resolve(),
      onStart: (span) => {
        if (this.sessionId?.length) {
          span.setAttribute(ATTR_MULTIPLAYER_SESSION_ID, this.sessionId)
        }
      },
    }
  }
}
