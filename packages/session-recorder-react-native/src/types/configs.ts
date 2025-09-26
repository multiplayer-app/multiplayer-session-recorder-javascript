import { PropagateTraceHeaderCorsUrls } from '@opentelemetry/instrumentation-xml-http-request/build/src/types';
import { MaskingOptions, SessionRecorderOptions } from './session-recorder';


/**
 * Utility type that makes all properties required recursively
 * Removes optional modifiers and undefined types from nested objects
 */
export type DeepRequired<T> =
  T extends Function ? T :
  T extends ReadonlyArray<infer U> ? Array<DeepRequired<NonNullable<U>>> :
  T extends Array<infer U> ? Array<DeepRequired<NonNullable<U>>> :
  T extends object ? { -readonly [K in keyof T]-?: DeepRequired<NonNullable<T[K]>> } :
  NonNullable<T>;

/**
 * Fully resolved configuration interface
 * All optional properties from SessionRecorderOptions are now required
 */
export interface SessionRecorderConfigs extends DeepRequired<SessionRecorderOptions> { }


/**
 * Base configuration interface with common properties
 * Shared by all service configuration interfaces
 */
export interface BaseConfig {
  /** API key for authentication */
  apiKey: string
  /** Base URL for the API calls */
  apiBaseUrl: string
  /** OTLP collector endpoint for traces */
  exporterEndpoint: string
}

/**
 * Type for masking configuration used by the Tracer
 * Contains only trace-related masking options
 */
export type TracerReactNativeMasking = Pick<MaskingOptions, 'isContentMaskingEnabled' | 'maskBody' | 'maskHeaders' | 'maskBodyFieldsList' | 'maskHeadersList' | 'headersToInclude' | 'headersToExclude'>

/**
 * Configuration interface for the Tracer class
 * Contains all settings needed for OpenTelemetry tracing
 */
export interface TracerReactNativeConfig extends BaseConfig {
  /** Application name */
  application: string
  /** Application version */
  version: string
  /** Environment (e.g., 'production', 'staging') */
  environment: string
  /** URLs to ignore during tracing */
  ignoreUrls: Array<string | RegExp>
  /** Trace ID ratio for sampling */
  sampleTraceRatio: number
  /** URLs for CORS trace header propagation */
  propagateTraceHeaderCorsUrls: PropagateTraceHeaderCorsUrls
  /** Whether to schematize document span payload */
  schemifyDocSpanPayload: boolean
  /** Maximum size for capturing HTTP payload */
  maxCapturingHttpPayloadSize: number
  /** If true, captures body in traces */
  captureBody: boolean
  /** If true, captures headers in traces */
  captureHeaders: boolean
  /** Configuration for masking sensitive data in session recordings */
  masking: TracerReactNativeMasking
}

/**
 * Type for masking configuration used by the Recorder
 * Contains only screen recording masking options
 */
export type RecorderMaskingConfig = Pick<MaskingOptions, 'maskTextInputs' | 'maskImages' | 'maskButtons' | 'maskLabels' | 'maskWebViews' | 'maskSandboxedViews'>

/**
 * Configuration interface for the Recorder class
 * Contains settings for screen recording and gesture capture
 */
export interface RecorderConfig extends BaseConfig {
  /** Whether to record gestures */
  recordGestures?: boolean
  /** Whether to record navigation */
  recordNavigation?: boolean
  /** Whether to record screen */
  recordScreen?: boolean
  /** Configuration for masking sensitive data in screen recordings */
  masking?: RecorderMaskingConfig
}

/**
 * Configuration interface for the ApiService class
 * Contains settings for API communication
 */
export interface ApiServiceConfig extends BaseConfig { }
