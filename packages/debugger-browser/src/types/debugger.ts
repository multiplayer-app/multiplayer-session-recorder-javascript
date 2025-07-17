
import { DebugSessionType } from '@multiplayer-app/opentelemetry';
import type {
  MaskTextFn,
  MaskInputFn,
  MaskInputOptions,
} from 'rrweb-snapshot';
import type { maskTextClass } from '@rrweb/types';
import type { IDebugSession } from './session';



export interface DebuggerOptions {
  /**
   * The API key used to authenticate with the session debugger service.
   */
  apiKey: string

  /**
   * The version of the application using the session debugger.
   */
  version: string

  /**
   * The name of the application being debugged.
   */
  application: string

  /**
   * The environment where the application is running (e.g., 'production', 'staging').
   */
  environment: string

  /**
   * (Optional) Base URL for the session debugger's exporter API.
   * This allows customization of the API endpoint for sending session data.
   */
  exporterApiBaseUrl?: string

  /**
   * (Optional) An array of URLs or regular expressions that should be ignored by the session debugger.
   * Any URL that partially matches any regex in this array will not be traced.
   * Additionally, URLs that exactly match any string in the array will also be ignored.
   */
  ignoreUrls?: Array<string | RegExp>

  /**
   * (Optional) Determines where the record button should be placed on the screen.
   * Possible values:
   *  - 'top-left'
   *  - 'top-right'
   *  - 'bottom-left'
   *  - 'bottom-right'
   */
  widgetButtonPlacement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

  /**
   * (Optional) If false, the session recording widget will be hidden from the UI.
   * Use this option if you want to enable session recording without a visible UI element.
   * @default showWidget = true
   */
  showWidget?: boolean

  /**
   * (Optional) If true, enables the recording and replaying of canvas elements.
   * Pass `true` to capture canvas interactions in the session recording.
   * @default canvasEnabled = false
   */
  canvasEnabled?: any

  /**
   * (Optional) Trace ID Ratio for document traces
   * @default 0.15
   */
  docTraceRatio?: number

  /**
   * (Optional) Trace ID Ratio for sampling
   * @default 0.15
   */
  sampleTraceRatio?: number

  /**
   * (Optional) URLs or regex patterns for CORS trace header propagation
   */
  propagateTraceHeaderCorsUrls?: string | RegExp | string[] | RegExp[]

  /**
   * (Optional) If true, schematizes document span payload
   * @default true
   */
  schemifyDocSpanPayload?: boolean

  /**
   * (Optional) If true, disables capturing HTTP payload
   * @default false
   */
  disableCapturingHttpPayload?: boolean

  /**
   * (Optional) Maximum size for capturing HTTP payload
   * @default 100000
   */
  maxCapturingHttpPayloadSize?: number

  /**
   * (Optional) If true, uses post message fallback
   * @default false
   */
  usePostMessageFallback?: boolean

  /**
   * (Optional) Configuration for masking sensitive data in session recordings
   * @default { maskAllInputs: true, maskTextInputs: true, maskInputOptions: { password: true } }
   */
  masking?: MaskingConfig
}

/**
 * Interface for masking configuration
 */
export interface MaskingConfig {
  // Recorder masking
  /** If true, masks all input fields in the recording */
  maskAllInputs?: boolean;
  /** Class-based masking configuration - can be string or RegExp */
  maskTextClass?: maskTextClass;
  /** CSS selector for elements that should be masked */
  maskTextSelector?: string;
  /** Specific options for masking different types of inputs */
  maskInputOptions?: MaskInputOptions;
  /** Custom function for input masking */
  maskInputFn?: MaskInputFn;
  /** Custom function for text masking */
  maskTextFn?: MaskTextFn;

  // Span masking
  /** If true, masks debug span payload in traces
   *  @default true
  */
  maskDebugSpanPayload?: boolean;
  /** Custom function for masking debug span payload in traces */
  maskDebugSpanPayloadFn?: (payload: any) => any;
}

/**
 * Base configuration interface with common properties
 */
export interface BaseConfig {
  /** API key for authentication */
  apiKey: string
  /** Base URL for the exporter API */
  exporterApiBaseUrl: string
  /** Whether to use post message fallback */
  usePostMessageFallback?: boolean
}

/**
 * Configuration interface for the Tracer class
 */
type TracerBrowserMasking = Pick<MaskingConfig, 'maskDebugSpanPayload' | 'maskDebugSpanPayloadFn'>;

export interface TracerBrowserConfig extends BaseConfig {
  /** Application name */
  application: string
  /** Application version */
  version: string
  /** Environment (e.g., 'production', 'staging') */
  environment: string
  /** URLs to ignore during tracing */
  ignoreUrls: Array<string | RegExp>
  /** Trace ID ratio for document traces */
  docTraceRatio: number
  /** Trace ID ratio for sampling */
  sampleTraceRatio: number
  /** URLs for CORS trace header propagation */
  propagateTraceHeaderCorsUrls: string | RegExp | string[] | RegExp[]
  /** Whether to schematize document span payload */
  schemifyDocSpanPayload: boolean
  /** Whether to disable capturing HTTP payload */
  disableCapturingHttpPayload: boolean
  /** Maximum size for capturing HTTP payload */
  maxCapturingHttpPayloadSize: number,
  /** Configuration for masking sensitive data in session recordings */
  masking?: TracerBrowserMasking
}

/**
 * Configuration interface for the Recorder class
 */

type RecorderMasking = Pick<MaskingConfig, 'maskAllInputs' | 'maskTextClass' | 'maskTextSelector' | 'maskInputOptions' | 'maskInputFn' | 'maskTextFn'>;
export interface RecorderConfig extends BaseConfig {
  /** Whether to enable canvas recording */
  canvasEnabled: boolean
  /** Configuration for masking sensitive data in session recordings */
  masking?: RecorderMasking
}

/**
 * Configuration interface for the SessionWidget class
 */
export interface SessionWidgetConfig {
  /** Whether to show the widget */
  showWidget: boolean
  /** Placement of the widget button */
  widgetButtonPlacement: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

/**
 * Configuration interface for the ApiService class
 */
export interface ApiServiceConfig extends BaseConfig {
  /** Whether continuous debugging is enabled */
  continuousDebugging?: boolean
}

export interface DebuggerConfigs extends Required<DebuggerOptions> { }

export enum SessionState {
  started = '2',
  paused = '1',
  stopped = '0',
}

export interface IDebugger {
  /**
   * The current session ID
   */
  readonly sessionId: string | null

  /**
   * Whether continuous debugging is enabled
   */
  readonly continuousDebugging: boolean

  /**
   * The type of debug session (plain or continuous)
   */
  readonly debugSessionType: DebugSessionType

  /**
   * The current state of the session
   */
  readonly sessionState: SessionState | null

  /**
   * The current debug session object
   */
  readonly session: IDebugSession | null

  /**
   * Session attributes for additional context
   */
  readonly sessionAttributes: Record<string, any>

  /**
   * Current error message
   */
  error: string

  /**
   * The HTML button element for the session widget's recorder button
   */
  readonly sessionWidgetButtonElement: HTMLButtonElement

  /**
   * Initialize the session debugger with custom configurations
   * @param configs - custom configurations for session debugger
   */
  init(configs: DebuggerOptions): void

  /**
   * Save the continuous debugging session
   * @returns Promise that resolves to the save response
   */
  save(): Promise<any>

  /**
   * Start a new session
   * @param type - the type of session to start
   * @param session - optional existing session to start
   */
  start(type: DebugSessionType, session?: IDebugSession): void

  /**
   * Stop the current session with an optional comment
   * @param comment - user-provided comment to include in session feedback metadata
   */
  stop(comment?: string): Promise<void>

  /**
   * Cancel the current session
   */
  cancel(): Promise<void>

  /**
   * Pause the current session
   */
  pause(): Promise<void>

  /**
   * Set the session metadata
   * @param attributes - the attributes to set
   */
  setSessionAttributes(attributes: Record<string, any>): void

  /**
   * Set a custom click handler for the recording button
   * @param handler - function that will be invoked when the button is clicked
   */
  set recordingButtonClickHandler(handler: () => boolean | void)
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type Breaker = {}
