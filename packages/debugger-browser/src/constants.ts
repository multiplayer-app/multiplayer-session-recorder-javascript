import { DebuggerConfigs } from "./types"

export const OTEL_MP_DOC_TRACE_RATIO = 0.15

export const OTEL_MP_SAMPLE_TRACE_RATIO = 0.15

export const DEBUG_SESSION_ID_PROP_NAME = 'multiplayer-debug-session-id'

export const DEBUG_SESSION_SHORT_ID_PROP_NAME = 'multiplayer-debug-session-short-id'

export const DEBUG_SESSION_CONTINUE_DEBUGGING_PROP_NAME = 'multiplayer-debug-session-continuous-debugging'

export const DEBUG_SESSION_STATE_PROP_NAME = 'multiplayer-debug-session-state'

export const DEBUG_SESSION_PROP_NAME = 'multiplayer-debug-session-data'

export const DEBUG_SESSION_STARTED_EVENT = 'debug-session:started'

export const DEBUG_SESSION_STOPPED_EVENT = 'debug-session:stopped'

export const DEBUG_SESSION_SUBSCRIBE_EVENT = 'debug-session:subscribe'

export const DEBUG_SESSION_UNSUBSCRIBE_EVENT = 'debug-session:unsubscribe'

export const DEBUG_SESSION_AUTO_CREATED = 'debug-session:auto-created'

export const DEBUG_SESSION_ADD_EVENT = 'debug-session:rrweb:add-event'

export const DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE = 100000

export const MULTIPLAYER_BASE_API_URL = 'https://api.multiplayer.app'

export const SESSION_RESPONSE = 'multiplayer-debug-session-response'

export const CONTINUOUS_DEBUGGING_TIMEOUT = 60000 // 1 minutes

export const DEBUG_SESSION_MAX_DURATION_SECONDS = 10 * 60 + 30 // TODO: move to shared config otel core

// Package version - injected by webpack during build
declare const PACKAGE_VERSION: string
export const PACKAGE_VERSION_EXPORT = PACKAGE_VERSION || '1.0.0'

export const BASE_CONFIG: DebuggerConfigs = {
  version: '',
  application: '',
  environment: '',
  ignoreUrls: [],
  showWidget: true,
  canvasEnabled: false,
  schemifyDocSpanPayload: true,
  usePostMessageFallback: false,
  propagateTraceHeaderCorsUrls: [],
  disableCapturingHttpPayload: false,
  widgetButtonPlacement: 'bottom-right',
  docTraceRatio: OTEL_MP_DOC_TRACE_RATIO,
  exporterApiBaseUrl: MULTIPLAYER_BASE_API_URL,
  sampleTraceRatio: OTEL_MP_SAMPLE_TRACE_RATIO,
  maxCapturingHttpPayloadSize: DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE,
  apiKey: "",
  masking: {
    maskAllInputs: true,
    maskDebugSpanPayload: true,
  },
}