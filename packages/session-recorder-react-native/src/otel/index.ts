import { resourceFromAttributes } from '@opentelemetry/resources'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import * as SemanticAttributes from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import {
  SessionType,
  ATTR_MULTIPLAYER_SESSION_ID,
  SessionRecorderIdGenerator,
  SessionRecorderTraceIdRatioBasedSampler,
  SessionRecorderBrowserTraceExporter,
} from '@multiplayer-app/session-recorder-common'
import { type TracerReactNativeConfig } from '../types'
import { getInstrumentations } from './instrumentations'
import { getExporterEndpoint } from './helpers'

import { getPlatformAttributes } from '../utils/platform'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'




export class TracerReactNativeSDK {
  private tracerProvider?: WebTracerProvider
  private config?: TracerReactNativeConfig

  private sessionId = ''
  private idGenerator?: SessionRecorderIdGenerator
  private exporter?: any


  constructor() { }

  private _setSessionId(
    sessionId: string,
    sessionType: SessionType = SessionType.PLAIN,
  ) {
    this.sessionId = sessionId
    this.idGenerator?.setSessionId(sessionId, sessionType)
  }

  init(options: TracerReactNativeConfig): void {
    this.config = options

    const { application, version, environment } = this.config

    this.idGenerator = new SessionRecorderIdGenerator()

    this.exporter = new SessionRecorderBrowserTraceExporter({
      apiKey: options.apiKey,
      url: getExporterEndpoint(options.exporterEndpoint),
    })

    this.tracerProvider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
        [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
        [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
        ...getPlatformAttributes(),
      }),
      idGenerator: this.idGenerator,
      sampler: new SessionRecorderTraceIdRatioBasedSampler(this.config.sampleTraceRatio || 0.15),
      spanProcessors: [
        this._getSpanSessionIdProcessor(),
        new BatchSpanProcessor(this.exporter),
      ],
    })

    this.tracerProvider.register({
      propagator: new W3CTraceContextPropagator(),
    })

    // Register instrumentations
    registerInstrumentations({
      tracerProvider: this.tracerProvider,
      instrumentations: getInstrumentations(this.config),
    })

  }

  private _getSpanSessionIdProcessor() {
    return {
      onStart: (span: any) => {
        if (this.sessionId) {
          span.setAttribute(ATTR_MULTIPLAYER_SESSION_ID, this.sessionId)
        }
        // Add React Native specific attributes
        span.setAttribute('platform', 'react-native')
        span.setAttribute('timestamp', Date.now())
      },
      onEnd: () => { },
      shutdown: () => Promise.resolve(),
      forceFlush: () => Promise.resolve(),
    }
  }

  start(sessionId: string, sessionType: SessionType): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }

    this._setSessionId(sessionId, sessionType)
  }

  stop(): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }

    this._setSessionId('')
  }

  setApiKey(apiKey: string): void {
    if (!this.exporter) {
      throw new Error(
        'Configuration not initialized. Call init() before setApiKey().',
      )
    }

    this.exporter.setApiKey?.(apiKey)
  }

  setSessionId(sessionId: string, sessionType: SessionType): void {
    this._setSessionId(sessionId, sessionType)
  }

  // Shutdown (React Native specific)
  shutdown(): Promise<void> {
    return Promise.resolve()
  }
}
