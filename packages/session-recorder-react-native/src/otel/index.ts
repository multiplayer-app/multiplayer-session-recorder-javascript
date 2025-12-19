import { resourceFromAttributes } from '@opentelemetry/resources';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import * as SemanticAttributes from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  SessionType,
  ATTR_MULTIPLAYER_SESSION_ID,
  SessionRecorderIdGenerator,
  SessionRecorderTraceIdRatioBasedSampler,
  SessionRecorderBrowserTraceExporter,
} from '@multiplayer-app/session-recorder-common';
import { type TracerReactNativeConfig } from '../types';
import { getInstrumentations } from './instrumentations';
import { getExporterEndpoint } from './helpers';
import { trace, SpanStatusCode, context, type Span } from '@opentelemetry/api';

import { getPlatformAttributes } from '../utils/platform';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';

export class TracerReactNativeSDK {
  private tracerProvider?: WebTracerProvider;
  private config?: TracerReactNativeConfig;

  private sessionId = '';
  private idGenerator?: SessionRecorderIdGenerator;
  private exporter?: any;
  private globalErrorHandlerRegistered = false;

  constructor() { }

  private _setSessionId(
    sessionId: string,
    sessionType: SessionType = SessionType.MANUAL
  ) {
    this.sessionId = sessionId;
    this.idGenerator?.setSessionId(sessionId, sessionType);
  }

  init(options: TracerReactNativeConfig): void {
    this.config = options;

    const { application, version, environment } = this.config;

    this.idGenerator = new SessionRecorderIdGenerator();

    this.exporter = new SessionRecorderBrowserTraceExporter({
      apiKey: options.apiKey,
      url: getExporterEndpoint(options.exporterEndpoint),
    });

    this.tracerProvider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
        [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
        [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
        ...getPlatformAttributes(),
      }),
      idGenerator: this.idGenerator,
      sampler: new SessionRecorderTraceIdRatioBasedSampler(
        this.config.sampleTraceRatio || 0.15
      ),
      spanProcessors: [
        this._getSpanSessionIdProcessor(),
        new BatchSpanProcessor(this.exporter),
      ],
    });

    this.tracerProvider.register({
      propagator: new W3CTraceContextPropagator(),
    });

    // Register instrumentations
    registerInstrumentations({
      tracerProvider: this.tracerProvider,
      instrumentations: getInstrumentations(this.config),
    });

    this._registerGlobalErrorHandlers();
  }

  private _getSpanSessionIdProcessor() {
    return {
      onStart: (span: any) => {
        if (this.sessionId) {
          span.setAttribute(ATTR_MULTIPLAYER_SESSION_ID, this.sessionId);
        }
        // Add React Native specific attributes
        span.setAttribute('platform', 'react-native');
        span.setAttribute('timestamp', Date.now());
      },
      onEnd: () => { },
      shutdown: () => Promise.resolve(),
      forceFlush: () => Promise.resolve(),
    };
  }

  start(sessionId: string, sessionType: SessionType): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().'
      );
    }

    this._setSessionId(sessionId, sessionType);
  }

  stop(): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().'
      );
    }

    this._setSessionId('');
  }

  setApiKey(apiKey: string): void {
    if (!this.exporter) {
      throw new Error(
        'Configuration not initialized. Call init() before setApiKey().'
      );
    }

    this.exporter.setApiKey?.(apiKey);
  }

  setSessionId(sessionId: string, sessionType: SessionType): void {
    this._setSessionId(sessionId, sessionType);
  }

  // Shutdown (React Native specific)
  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Capture an exception as an error span/event.
   * If there is an active span, the exception will be recorded on it.
   * Otherwise, a short-lived span will be created to hold the exception event.
   */
  captureException(error: Error, errorInfo?: Record<string, any>): void {
    if (!error) return;
    // Prefer attaching to the active span to keep correlation intact
    try {
      const activeSpan = trace.getSpan(context.active())
      if (activeSpan) {
        this._recordException(activeSpan, error, errorInfo)
        return
      }
    } catch (_ignored) { }

    // Fallback: create a short-lived span to hold the exception details
    try {
      const tracer = trace.getTracer('exception')
      const span = tracer.startSpan(error.name || 'Error')
      this._recordException(span, error, errorInfo)
      span.end()
    } catch (_ignored) { }
  }

  private _recordException(span: Span, error: Error, errorInfo?: Record<string, any>): void {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    span.setAttribute('exception.type', error.name || 'Error')
    span.setAttribute('exception.message', error.message)
    span.setAttribute('exception.stacktrace', error.stack || '')
    if (errorInfo) {
      Object.entries(errorInfo).forEach(([key, value]) => {
        span.setAttribute(`error_info.${key}`, value)
      })
    }
  }

  private _registerGlobalErrorHandlers(): void {
    if (this.globalErrorHandlerRegistered) return;

    // React Native global error handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ErrorUtilsRef: any = (global as any).ErrorUtils;
    if (ErrorUtilsRef && typeof ErrorUtilsRef.setGlobalHandler === 'function') {
      const previous = ErrorUtilsRef.getGlobalHandler?.();
      ErrorUtilsRef.setGlobalHandler((error: any, isFatal?: boolean) => {
        try {
          const err = error instanceof Error ? error : new Error(String(error?.message || error));
          this.captureException(err);
        } finally {
          if (typeof previous === 'function') {
            try { previous(error, isFatal); } catch (_e) { /* ignore */ }
          }
        }
      });
      this.globalErrorHandlerRegistered = true;
    }
  }
}
