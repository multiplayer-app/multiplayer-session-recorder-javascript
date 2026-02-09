import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  W3CTraceContextPropagator,
  type ExportResult,
} from '@opentelemetry/core';
import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import * as SemanticAttributes from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  SessionType,
  SessionRecorderSdk,
  SessionRecorderIdGenerator,
  SessionRecorderBrowserTraceExporter,
  ATTR_MULTIPLAYER_SESSION_ID,
  MULTIPLAYER_TRACE_CLIENT_ID_LENGTH,
} from '@multiplayer-app/session-recorder-common';
import { type TracerReactNativeConfig } from '../types';
import { getInstrumentations } from './instrumentations';
import { getExporterEndpoint } from './helpers';

import { getPlatformAttributes } from '../utils/platform';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { CrashBufferService } from '../services/crashBuffer.service';
import { CrashBufferSpanProcessor } from './CrashBufferSpanProcessor';

const clientIdGenerator = SessionRecorderSdk.getIdGenerator(
  MULTIPLAYER_TRACE_CLIENT_ID_LENGTH
);

export class TracerReactNativeSDK {
  clientId = '';
  private tracerProvider?: WebTracerProvider;
  private config?: TracerReactNativeConfig;

  private sessionId = '';
  private idGenerator?: SessionRecorderIdGenerator;
  private exporter?: SessionRecorderBrowserTraceExporter;
  private batchSpanProcessor?: BatchSpanProcessor;
  private globalErrorHandlerRegistered = false;
  private crashBuffer?: CrashBufferService;

  constructor() {}

  private _setSessionId(
    sessionId: string,
    sessionType: SessionType = SessionType.MANUAL
  ) {
    this.sessionId = sessionId;

    if (!this.idGenerator) {
      throw new Error('Id generator not initialized');
    }

    this.idGenerator.setSessionId(sessionId, sessionType, this.clientId);
  }

  init(options: TracerReactNativeConfig): void {
    this.config = options;
    this.clientId = clientIdGenerator();

    const { application, version, environment } = this.config;

    this.idGenerator = new SessionRecorderIdGenerator();

    this._setSessionId('', SessionType.SESSION_CACHE);

    this.exporter = new SessionRecorderBrowserTraceExporter({
      apiKey: options.apiKey,
      url: getExporterEndpoint(options.exporterEndpoint),
    });

    this.batchSpanProcessor = new BatchSpanProcessor(this.exporter);

    this.tracerProvider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
        [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
        [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
        ...getPlatformAttributes(),
      }),
      idGenerator: this.idGenerator,
      sampler: new AlwaysOnSampler(),
      spanProcessors: [
        this._getSpanSessionIdProcessor(),
        new CrashBufferSpanProcessor(
          this.batchSpanProcessor,
          this.crashBuffer,
          this.exporter.serializeSpan
        ),
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

  setCrashBuffer(
    crashBuffer: CrashBufferService | undefined,
    windowMs?: number
  ): void {
    this.crashBuffer = crashBuffer;
    if (
      crashBuffer &&
      typeof windowMs === 'number' &&
      Number.isFinite(windowMs)
    ) {
      crashBuffer.setDefaultWindowMs(windowMs);
    }
  }

  async exportTraces(
    spans: ReadableSpan[]
  ): Promise<ExportResult | undefined | void> {
    if (!this.exporter) {
      throw new Error('Trace exporter not initialized');
    }
    if (!spans || spans.length === 0) {
      return Promise.resolve();
    }

    const toReadableSpanLike = (span: any): ReadableSpan => {
      if (
        span &&
        typeof span.spanContext === 'function' &&
        span.instrumentationScope
      ) {
        return span as ReadableSpan;
      }
      const spanContext =
        typeof span?.spanContext === 'function'
          ? span.spanContext()
          : span?._spanContext;
      const normalizedCtx =
        spanContext ||
        ({
          traceId: span?.traceId,
          spanId: span?.spanId,
          traceFlags: span?.traceFlags,
          traceState: span?.traceState,
        } as any);

      const instrumentationScope =
        span?.instrumentationScope ||
        span?.instrumentationLibrary ||
        ({
          name: 'multiplayer-buffer',
          version: undefined,
          schemaUrl: undefined,
        } as any);

      const normalizedScope = {
        name: instrumentationScope?.name || 'multiplayer-buffer',
        version: instrumentationScope?.version,
        schemaUrl: instrumentationScope?.schemaUrl,
      };

      const resource = span?.resource || {
        attributes: {},
        asyncAttributesPending: false,
      };
      const parentSpanId = span?.parentSpanId;

      return {
        name: span?.name || '',
        kind: span?.kind,
        spanContext: () => normalizedCtx,
        parentSpanContext: parentSpanId
          ? ({
              traceId: normalizedCtx?.traceId,
              spanId: parentSpanId,
              traceFlags: normalizedCtx?.traceFlags,
              traceState: normalizedCtx?.traceState,
            } as any)
          : undefined,
        startTime: span?.startTime,
        endTime: span?.endTime ?? span?.startTime,
        duration: span?.duration,
        status: span?.status,
        attributes: span?.attributes || {},
        links: span?.links || [],
        events: span?.events || [],
        ended: typeof span?.ended === 'boolean' ? span.ended : true,
        droppedAttributesCount: span?.droppedAttributesCount || 0,
        droppedEventsCount: span?.droppedEventsCount || 0,
        droppedLinksCount: span?.droppedLinksCount || 0,
        resource,
        instrumentationScope: normalizedScope as any,
      } as any;
    };

    const readableSpans = spans.map((s: any) => toReadableSpanLike(s));

    const CHUNK_SIZE = 50;
    let result: ExportResult | undefined;
    for (let i = 0; i < readableSpans.length; i += CHUNK_SIZE) {
      result = await this.exporter.exportBuffer(
        readableSpans.slice(i, i + CHUNK_SIZE)
      );
    }
    return result;
  }

  private _getSpanSessionIdProcessor() {
    return {
      onStart: (span: any) => {
        if (this.sessionId) {
          span.setAttribute(ATTR_MULTIPLAYER_SESSION_ID, this.sessionId);
        }
      },
      onEnd: () => {},
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

    this._setSessionId('', SessionType.SESSION_CACHE);
  }

  setApiKey(apiKey: string): void {
    if (!this.exporter) {
      throw new Error(
        'Configuration not initialized. Call init() before setApiKey().'
      );
    }

    this.exporter.setApiKey(apiKey);
  }

  /**
   * Capture an exception as an error span/event.
   * If there is an active span, the exception will be recorded on it.
   * Otherwise, a short-lived span will be created to hold the exception event.
   */
  captureException(error: Error, errorInfo?: Record<string, any>): void {
    if (!error) return;
    SessionRecorderSdk.captureException(error, errorInfo);
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
          const err =
            error instanceof Error
              ? error
              : new Error(String(error?.message || error));
          this.captureException(err);
        } finally {
          if (typeof previous === 'function') {
            try {
              previous(error, isFatal);
            } catch (_e) {
              /* ignore */
            }
          }
        }
      });
      this.globalErrorHandlerRegistered = true;
    }
  }
}
