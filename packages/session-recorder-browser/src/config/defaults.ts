import { SessionRecorderSdk } from '@multiplayer-app/session-recorder-opentelemetry'
import { MaskingConfig, SessionRecorderConfigs, WidgetButtonPlacement } from '../types'
import { MULTIPLAYER_BASE_API_URL, OTEL_MP_DOC_TRACE_RATIO, OTEL_MP_SAMPLE_TRACE_RATIO, DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE } from './constants'
const { mask, sensitiveFields, sensitiveHeaders } = SessionRecorderSdk

export const DEFAULT_MASKING_CONFIG: MaskingConfig = {
  maskAllInputs: true,
  isMaskingEnabled: true,
  maskBody: mask(sensitiveFields),
  maskHeaders: mask(sensitiveHeaders),
  maskBodyFieldsList: sensitiveFields,
  maskHeadersList: sensitiveHeaders,
  headersToInclude: [],
  headersToExclude: [],
}

export const BASE_CONFIG: Required<SessionRecorderConfigs> = {
  apiKey: '',

  version: '',
  application: '',
  environment: '',

  showWidget: true,
  widgetButtonPlacement: WidgetButtonPlacement.bottomRight,

  usePostMessageFallback: false,
  exporterApiBaseUrl: MULTIPLAYER_BASE_API_URL,

  recordCanvas: false,
  schemifyDocSpanPayload: true,

  ignoreUrls: [],
  propagateTraceHeaderCorsUrls: [],

  docTraceRatio: OTEL_MP_DOC_TRACE_RATIO,
  sampleTraceRatio: OTEL_MP_SAMPLE_TRACE_RATIO,
  maxCapturingHttpPayloadSize: DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE,

  captureBody: true,
  captureHeaders: true,
  masking: DEFAULT_MASKING_CONFIG
}