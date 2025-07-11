
import { DebugSessionType } from '@multiplayer-app/opentelemetry'

export interface SessionDebuggerOptions {
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
  recordButtonPlacement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

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
   * (Optional) URLs which should include trace headers when origin doesn't match
   * @default []
   */
  propagateTraceHeaderCorsUrls: string | RegExp | string[] | RegExp[]

  /**
   * (Optional) Schemify http request/response payload for document traces.
   * @default true
   */
  schemifyDocSpanPayload?: boolean

  /**
   * (Optional) Mask payload for debug traces.
   * @default true
   */
  maskDebugSpanPayload?: boolean

  /**
   * (Optional) Disable capturing of http request/response payload.
   * @default false
   */
  disableCapturingHttpPayload?: boolean

  /**
   * (Optional) Max capturing http request/response payload size.
   * @default 100000
   */
  maxCapturingHttpPayloadSize?: number

  /**
   * (Optional) Use postMessage fallback for exporters.
   * @default false
   */
  usePostMessageFallback?: boolean
}

export interface IDebugSession {
  _id: string
  shortId: string
  workspace: string
  project: string
  name: string
  startedAt: string | Date
  stoppedAt: string | Date
  durationInSeconds?: number
  createdAt: string | Date
  updatedAt: string | Date
  metadata: {
    userName?: string,
    userId?: string,
    accountName?: string,
    accountId?: string,
  } & object
  tags: any[]
  userMetadata: {
    email?: string
    notifyOnUpdates?: boolean
    comment?: string
  },
  clientMetadata: object
  views: IDebugSessionView[]
  starred: string[]
  url: string
  s3Files: {
    _id?: string
    bucket: string
    key: string
    dataType: DebugSessionDataType
    url?: string
  }[]
  finishedS3Transfer?: boolean
  tempApiKey?: string
}

export interface IDebugSessionView {
  _id: string
  name: string
  components?: string[]
}

export enum DebugSessionDataType {
  OTLP_TRACES = 'OTLP_TRACES',
  OTLP_LOGS = 'OTLP_LOGS',
  RRWEB_EVENTS = 'RRWEB_EVENTS',
}


export interface SessionDebuggerConfigs {
  apiKey: string
  version: string
  application: string
  environment: string
  exporterApiBaseUrl: string
  ignoreUrls: Array<string | RegExp>
  recordButtonPlacement: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  showWidget: boolean
  canvasEnabled: boolean
  docTraceRatio: number
  sampleTraceRatio: number
  propagateTraceHeaderCorsUrls: string | RegExp | string[] | RegExp[]
  schemifyDocSpanPayload?: boolean
  maskDebugSpanPayload?: boolean
  disableCapturingHttpPayload?: boolean
  maxCapturingHttpPayloadSize: number
  usePostMessageFallback?: boolean
}

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
   * The short session ID for display purposes
   */
  readonly shortSessionId: string | null

  /**
   * Whether continuous debugging is enabled
   */
  readonly continuesDebugging: boolean

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
   * Session metadata for additional context
   */
  readonly sessionMetadata: Record<string, any>

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
  init(configs: SessionDebuggerOptions): void

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
   * @param comment - user-provided comment to include in session metadata
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
   * @param metadata - the metadata to set
   */
  setSessionMetadata(metadata: Record<string, any>): void

  /**
   * Set a custom click handler for the recording button
   * @param handler - function that will be invoked when the button is clicked
   */
  set recordingButtonClickHandler(handler: () => boolean | void)
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type Breaker = {}
