import { type Span } from '@opentelemetry/api';
import {
  type ISession,
  type SessionType,
  type IUserAttributes,
} from '@multiplayer-app/session-recorder-common';
import { type PropagateTraceHeaderCorsUrls } from '@opentelemetry/sdk-trace-web';

// WidgetButtonPlacement moved to configs.ts

export enum SessionState {
  started = '2',
  paused = '1',
  stopped = '0',
}

/**
 * Enumeration for widget button placement positions
 */
export enum WidgetButtonPlacement {
  topLeft = 'top-left',
  topRight = 'top-right',
  bottomLeft = 'bottom-left',
  bottomRight = 'bottom-right',
}

/**
 * Enumeration for log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Main configuration interface for the Session Recorder
 * Contains all configurable options for session recording, tracing, and UI
 */
export interface SessionRecorderOptions {
  /**
   * The API key used to authenticate with the session debugger service.
   */
  apiKey: string;

  /**
   * The version of the application using the session debugger.
   */
  version: string;

  /**
   * The name of the application being debugged.
   */
  application: string;

  /**
   * The environment where the application is running (e.g., 'production', 'staging').
   */
  environment: string;

  /**
   * (Optional) OTLP collector endpoint.
   */
  exporterEndpoint?: string;

  /**
   * (Optional) Base URL for the API calls.
   * This allows customization of the API endpoint for sending session data.
   */
  apiBaseUrl?: string;

  /**
   * (Optional) An array of URLs or regular expressions that should be ignored by the session debugger.
   * Any URL that partially matches any regex in this array will not be traced.
   * Additionally, URLs that exactly match any string in the array will also be ignored.
   */
  ignoreUrls?: Array<string | RegExp>;

  /**
   * (Optional) Enables the continuous recording feature and UI.
   * If false, the UI toggle is hidden and attempts to start a continuous
   * session are ignored.
   * @default true
   */
  showContinuousRecording?: boolean;

  /**
   * Optional widget configuration
   */
  widget?: {
    /** Enables/disables the widget entirely
     * @default true
     */
    enabled?: boolean;
    /** Floating button config
     * @default visible: true, placement: 'bottom-right'
     */
    button?: {
      visible?: boolean;
      placement?: WidgetButtonPlacement;
    };

    /**
     * (Optional) Configuration for customizable UI text and labels
     * @default See PopoverTextConfig defaults
     */
    textOverrides?: TextOverridesOptions;
  };

  /**
   * (Optional) Trace ID Ratio for sampling
   * @default 0.15
   */
  sampleTraceRatio?: number;

  /**
   * (Optional) URLs or regex patterns for CORS trace header propagation
   */
  propagateTraceHeaderCorsUrls?: PropagateTraceHeaderCorsUrls;

  /**
   * (Optional) If true, schematizes document span payload
   * @default true
   */
  schemifyDocSpanPayload?: boolean;

  /**
   * (Optional) Maximum size for capturing HTTP payload
   * @default 100000
   */
  maxCapturingHttpPayloadSize?: number;

  /** If true, captures body in traces
   *  @default true
   */
  captureBody?: boolean;
  /** If true, captures headers in traces
   *  @default true
   */
  captureHeaders?: boolean;
  /**
   * (Optional) Configuration for masking sensitive data in session recordings
   * @default { maskAllInputs: true, isContentMaskingEnabled: true }
   */
  masking?: MaskingOptions;
  /** Whether to record gestures */
  recordGestures?: boolean;
  /** Whether to record navigation */
  recordNavigation?: boolean;
  /** Whether to record screen */
  recordScreen?: boolean;
  /**
   * (Optional) Logger configuration overrides
   * Allows setting log level, console enabling, and prefix customizations
   */
  logger?: {
    level?: number;
    enabled?: boolean;
  };

  /**
   * @description
   * If true, webSocket will be used to manage remote recording sessions.
   * @default true
   */
  useWebsocket?: boolean;

  /**
   * (Optional) Client-side crash buffer configuration.
   * When enabled, the SDK keeps a rolling window of recent events + traces
   * even if the user did not start a manual/continuous recording.
   */
  buffering?: {
    /** Enable/disable buffering. @default false */
    enabled?: boolean;
    /** Rolling window size (minutes). @default 0.5 */
    windowMinutes?: number;
  };
}

/**
 * Interface for customizable widget text configuration
 * Allows overriding default text labels and messages in the UI
 */
export interface TextOverridesOptions {
  /** Title for the initial popover when continuous recording is enabled */
  initialTitleWithContinuous?: string;
  /** Title for the initial popover when continuous recording is disabled */
  initialTitleWithoutContinuous?: string;
  /** Description for the initial popover when continuous recording is enabled */
  initialDescriptionWithContinuous?: string;
  /** Description for the initial popover when continuous recording is disabled */
  initialDescriptionWithoutContinuous?: string;
  /** Label for the continuous recording toggle */
  continuousRecordingLabel?: string;
  /** Text for the start recording button */
  startRecordingButtonText?: string;
  /** Title for the final popover */
  finalTitle?: string;
  /** Description for the final popover */
  finalDescription?: string;
  /** Placeholder text for the comment textarea */
  commentPlaceholder?: string;
  /** Text for the save button in final popover */
  saveButtonText?: string;
  /** Text for the cancel button in final popover */
  cancelButtonText?: string;
  /** Title for the continuous recording overlay */
  continuousOverlayTitle?: string;
  /** Description for the continuous recording overlay */
  continuousOverlayDescription?: string;
  /** Text for the save last snapshot button */
  saveLastSnapshotButtonText?: string;
  /** Title for the submit session dialog */
  submitDialogTitle?: string;
  /** Subtitle for the submit session dialog */
  submitDialogSubtitle?: string;
  /** Label for the comment field in submit dialog */
  submitDialogCommentLabel?: string;
  /** Placeholder for the comment field in submit dialog */
  submitDialogCommentPlaceholder?: string;
  /** Text for the submit button in dialog */
  submitDialogSubmitText?: string;
  /** Text for the cancel button in dialog */
  submitDialogCancelText?: string;
}

/**
 * Interface for masking configuration options
 * Controls what data is masked in both traces and screen recordings
 */
export interface MaskingOptions {
  // Span masking
  /** If true, enables masking for debug span payload in traces */
  isContentMaskingEnabled?: boolean;
  /** Custom function for masking body in traces */
  maskBody?: (payload: any, span: Span) => any;
  /** Custom function for masking headers in traces */
  maskHeaders?: (headers: any, span: any) => any;

  /** List of body fields to mask in traces */
  maskBodyFieldsList?: string[];
  /** List of headers to mask in traces */
  maskHeadersList?: string[];

  /** List of headers to include in traces (if specified, only these headers will be captured) */
  headersToInclude?: string[];
  /** List of headers to exclude from traces */
  headersToExclude?: string[];

  // Screen masking options
  /** Whether to mask text inputs (UITextField, UITextView, React Native text components) */
  maskTextInputs?: boolean;
  /** Whether to mask images (UIImageView, React Native Image components) */
  maskImages?: boolean;
  /** Whether to mask buttons (UIButton) */
  maskButtons?: boolean;
  /** Whether to mask labels (UILabel) */
  maskLabels?: boolean;
  /** Whether to mask web views (WKWebView) */
  maskWebViews?: boolean;
  /** Whether to mask sandboxed views (system views that don't belong to current process) */
  maskSandboxedViews?: boolean;
}
/**
 * Main interface for the Session Recorder
 * Defines the public API for session recording functionality
 */
export interface ISessionRecorder {
  /**
   * The current session ID
   */
  readonly sessionId: string | null;

  /**
   * Whether continuous recording is enabled
   */
  readonly continuousRecording: boolean;

  /**
   * The current debug session object
   */
  readonly session: ISession | null;

  /**
   * The type of session (plain or continuous)
   */
  readonly sessionType: SessionType;

  /**
   * The current state of the session
   */
  readonly sessionState: SessionState | null;

  /**
   * Session attributes for additional context
   */
  readonly sessionAttributes: Record<string, any>;

  /**
   * Current error message
   */
  error: string;

  /**
   * The HTML button element for the session widget's recorder button
   */
  readonly sessionWidgetButtonElement: HTMLButtonElement;

  /**
   * Initialize the session debugger with custom configurations
   * @param configs - custom configurations for session debugger
   */
  init(configs: SessionRecorderOptions): void;

  /**
   * Save the continuous recording session
   * @returns Promise that resolves to the save response
   */
  save(): Promise<any>;

  /**
   * Start a new session
   * @param type - the type of session to start
   * @param session - optional existing session to start
   */
  start(type?: SessionType, session?: ISession): void;

  /**
   * Stop the current session with an optional comment
   * @param comment - user-provided comment to include in session feedback metadata
   */
  stop(comment?: string): Promise<void>;

  /**
   * Cancel the current session
   */
  cancel(): Promise<void>;

  /**
   * Pause the current session
   */
  pause(): Promise<void>;

  /**
   * Resume the current session
   */
  resume(): Promise<void>;

  /**
   * Set the session metadata
   * @param attributes - the attributes to set
   */
  setSessionAttributes(attributes: Record<string, any>): void;

  /**
   * Set the user attributes
   * @param userAttributes - the user attributes to set
   */
  setUserAttributes(userAttributes: IUserAttributes | null): void;

  /**
   * Capture an exception and send it as an error trace
   */
  captureException(error: unknown, errorInfo?: Record<string, any>): void;
}

/**
 * Interface representing screen capture events
 * Contains metadata about screen recordings
 */
export interface ScreenEvent {
  screenName: string;
  timestamp: number;
  params?: Record<string, any>;
  type?: string;
  metadata?: Record<string, any>;
  dataUrl?: string;
}

/**
 * Interface representing gesture/touch events
 * Contains information about user interactions with the screen
 */
export interface GestureEvent {
  type: string;
  timestamp: number;
  x?: number;
  y?: number;
  direction?: string;
  target?: string;
  coordinates?: { x: number; y: number };
  targetInfo?: {
    identifier: string;
    label?: string;
    role?: string;
    testId?: string;
    text?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Interface representing navigation events
 * Contains information about screen/route changes
 */
export interface NavigationEvent {
  type: string;
  timestamp: number;
  routeName?: string;
  params?: Record<string, any>;
  metadata?: Record<string, any>;
}
