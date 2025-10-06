import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
  CompositePropagator
} from '@opentelemetry/core'
import { 
  WebTracerProvider,
 } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import * as SemanticAttributes from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import { propagation, Context, TextMapSetter } from '@opentelemetry/api'
import {
  SessionType,
  ATTR_MULTIPLAYER_SESSION_ID,
  SessionRecorderIdGenerator,
  SessionRecorderBrowserTraceExporter,
  SessionRecorderTraceIdRatioBasedSampler,
} from '@multiplayer-app/session-recorder-common'
import { TracerBrowserConfig } from '../types'
import { OTEL_IGNORE_URLS } from '../config'
import {
  processHttpPayload,
  headersToObject,
  extractResponseBody,
  getExporterEndpoint,
} from './helpers'


class MultiplayerBaggagePropagator extends W3CBaggagePropagator {

  inject(context: Context, carrier: unknown, setter: TextMapSetter): void {
    let baggage = propagation.createBaggage({
      'session.id': { value: '12312312312312' },
      'session.type': { value: "MANUAL" }
    })

    super.inject(propagation.setBaggage(context, baggage), carrier, setter)
    // setter(carrier, 'session.id', newBaggage.getEntry('session.id')?.value)
    // setter(carrier, 'session.type', newBaggage.getEntry('session.type')?.value)
  }

}


export class TracerBrowserSDK {
  private tracerProvider?: WebTracerProvider
  private config?: TracerBrowserConfig
  private allowedElements = new Set<string>(['A', 'BUTTON'])
  private sessionId = ''
  private idGenerator
  private exporter?: SessionRecorderBrowserTraceExporter

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

    this.idGenerator = new SessionRecorderIdGenerator()

    this.exporter = new SessionRecorderBrowserTraceExporter({
      apiKey: options.apiKey,
      url: getExporterEndpoint(options.exporterEndpoint),
      usePostMessageFallback: options.usePostMessageFallback,
    })

    this.tracerProvider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
        [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
        [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      }),
      idGenerator: this.idGenerator,
      sampler: new SessionRecorderTraceIdRatioBasedSampler(this.config.sampleTraceRatio),
      spanProcessors: [
        this._getSpanSessionIdProcessor(),
        new BatchSpanProcessor(this.exporter),
      ],
    })

    this.tracerProvider.register({
      propagator: new CompositePropagator({
        propagators: [
          new W3CTraceContextPropagator(),
          new MultiplayerBaggagePropagator(),
        ],
      }),
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
              if (span['parentSpanContext']) {
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

  setApiKey(apiKey: string): void {
    if (!this.exporter) {
      throw new Error(
        'Configuration not initialized. Call init() before setApiKey().',
      )
    }

    this.exporter.setApiKey(apiKey)
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
