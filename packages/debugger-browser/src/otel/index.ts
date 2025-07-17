import { Resource } from '@opentelemetry/resources'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import * as SemanticAttributes from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import {
  MultiplayerHelpers,
  MultiplayerIdGenerator,
  MultiplayerHttpTraceExporterBrowser,
  MultiplayerTraceIdRatioBasedSampler,
  MULTIPLAYER_TRACE_DOC_PREFIX,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
  ATTR_MULTIPLAYER_DEBUG_SESSION,
  ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
  ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
  DebugSessionType,
} from '@multiplayer-app/opentelemetry'
import { TracerBrowserConfig } from '../types'
import { OTEL_MP_DOC_TRACE_RATIO } from '../constants'

export class TracerBrowserSDK {
  private tracerProvider?: WebTracerProvider
  private config?: TracerBrowserConfig
  private allowedElements = new Set<string>(['A', 'BUTTON'])
  private sessionId = ''
  private idGenerator

  constructor() { }

  private setSessionId(
    sessionId: string,
    sessionType: DebugSessionType = DebugSessionType.PLAIN,
  ) {
    this.sessionId = sessionId
    this.idGenerator.setSessionId(sessionId, sessionType)
  }

  init(options: TracerBrowserConfig): void {
    this.config = options
    const { application, version, environment } = this.config

    this.idGenerator = new MultiplayerIdGenerator({
      autoDocTracesRatio: options.docTraceRatio || OTEL_MP_DOC_TRACE_RATIO
    })

    this.tracerProvider = new WebTracerProvider({
      resource: new Resource({
        [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
        [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
        [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      }),
      idGenerator: this.idGenerator,
      sampler: new MultiplayerTraceIdRatioBasedSampler(this.config.sampleTraceRatio),
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
              /\/v1\/traces/,
              /\/v0\/radar\/debug-sessions/,
              ...(this.config.ignoreUrls || []),
            ],
            propagateTraceHeaderCorsUrls: options.propagateTraceHeaderCorsUrls,
            applyCustomAttributesOnSpan: (span, xhr) => {
              try {
                if (options.disableCapturingHttpPayload) {
                  return
                }

                const traceId = span.spanContext().traceId

                if (
                  !traceId.startsWith(MULTIPLAYER_TRACE_DOC_PREFIX)
                  && !traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
                  && !traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
                ) {
                  return
                }
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                let requestBody = xhr.networkRequest.requestBody

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                let responseBody = xhr.networkRequest.responseBody
                const masking = this.config?.masking || {}
                if (
                  traceId.startsWith(MULTIPLAYER_TRACE_DOC_PREFIX)
                  && this.config?.schemifyDocSpanPayload
                ) {
                  requestBody = requestBody && MultiplayerHelpers.schemify(requestBody)
                  responseBody = responseBody && MultiplayerHelpers.schemify(responseBody)
                } else if (
                  traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
                  && masking?.maskDebugSpanPayload
                ) {
                  const maskFn = typeof masking?.maskDebugSpanPayloadFn === 'function' ? masking.maskDebugSpanPayloadFn : MultiplayerHelpers.mask
                  requestBody = requestBody && maskFn(requestBody)
                  responseBody = responseBody && maskFn(responseBody)
                } else {
                  if (typeof requestBody !== 'string') {
                    requestBody = JSON.stringify(requestBody)
                  }

                  if (typeof responseBody !== 'string') {
                    responseBody = JSON.stringify(responseBody)
                  }
                }

                if (requestBody?.length) {
                  span.setAttribute(
                    ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
                    requestBody,
                  )
                }

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                if (xhr?.networkRequest?.requestHeaders) {
                  span.setAttribute(
                    ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    xhr.networkRequest.requestHeaders,
                  )
                }

                if (responseBody?.length) {
                  span.setAttribute(
                    ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
                    responseBody,
                  )
                }

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                if (xhr?.networkRequest?.responseHeaders) {
                  span.setAttribute(
                    ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    xhr.networkRequest.responseHeaders,
                  )
                }
              } catch (error) {
                // eslint-disable-next-line
                console.error('[DEBUGGER_LIB] Failed to capture xml-http payload', error)
              }
            },
          },
          '@opentelemetry/instrumentation-fetch': {
            clearTimingResources: true,
            ignoreUrls: [
              /\/v1\/traces/,
              /\/v0\/radar\/debug-sessions/,
              ...(this.config.ignoreUrls || []),
            ],
            propagateTraceHeaderCorsUrls: options.propagateTraceHeaderCorsUrls,
            applyCustomAttributesOnSpan: async (span, request, result) => {
              try {
                if (options.disableCapturingHttpPayload) {
                  return
                }

                const traceId = span.spanContext().traceId

                if (!traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)) {
                  return
                }
                if (request.body) {
                  span.setAttribute(
                    ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
                    JSON.stringify(request.body, null, 4),
                  )
                }

                if (request.headers) {
                  span.setAttribute(
                    ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
                    JSON.stringify(request.headers, null, 4),
                  )
                }

                if (result instanceof Response && result.body) {
                  let body = JSON.stringify(result.body, null, 4)
                  if (result.body instanceof ReadableStream) {
                    const responseClone = result.clone()
                    body = await responseClone.text()
                  }
                  span.setAttribute(
                    ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
                    body,
                  )
                }

                if (result instanceof Response && result.headers) {
                  span.setAttribute(
                    ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
                    JSON.stringify(result.headers, null, 4),
                  )
                }
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
    sessionType: DebugSessionType,
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
      new MultiplayerHttpTraceExporterBrowser({
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
          span.setAttribute(ATTR_MULTIPLAYER_DEBUG_SESSION, this.sessionId)
        }
      },
    }
  }
}