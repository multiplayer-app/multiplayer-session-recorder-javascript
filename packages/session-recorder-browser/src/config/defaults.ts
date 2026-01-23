import {
  SessionRecorderSdk,
  MULTIPLAYER_BASE_API_URL,
  MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,
} from '@multiplayer-app/session-recorder-common'
import {
  MaskingConfig,
  SessionRecorderConfigs,
  WidgetButtonPlacement,
  WidgetTextOverridesConfig,
} from '../types'
import {
  OTEL_MP_SAMPLE_TRACE_RATIO,
  DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE,
} from './constants'
const { mask, sensitiveFields, sensitiveHeaders } = SessionRecorderSdk

export const DEFAULT_MASKING_CONFIG: MaskingConfig = {
  maskAllInputs: true,
  isContentMaskingEnabled: true,
  maskBody: mask(sensitiveFields),
  maskHeaders: mask(sensitiveHeaders),
  maskBodyFieldsList: sensitiveFields,
  maskHeadersList: sensitiveHeaders,
  headersToInclude: [],
  headersToExclude: [],
}

export const DEFAULT_WIDGET_TEXT_CONFIG: WidgetTextOverridesConfig = {
  initialTitleWithContinuous: 'Encountered an issue?',
  initialTitleWithoutContinuous: 'Encountered an issue?',
  initialDescriptionWithContinuous: 'Record your session so we can see the problem and fix it faster.',
  initialDescriptionWithoutContinuous: 'Record your session so we can see the problem and fix it faster.',
  continuousRecordingLabel: 'Continuous recording',
  startRecordingButtonText: 'Start recording',
  finalTitle: 'Done recording?',
  finalDescription: 'You can also add a quick note with extra context, expectations, or questions. Thank you!',
  commentPlaceholder: 'Add a message...',
  saveButtonText: 'Submit recording',
  cancelButtonText: 'Cancel recording',
  continuousOverlayTitle: 'Save time, skip the reproductions',
  continuousOverlayDescription: 'We keep a rolling record of your recent activity. If something doesn’t work as expected, just save the recording and continue working. No need to worry about exceptions and errors - we automatically save recordings for those!',
  saveLastSnapshotButtonText: 'Save recording',
  submitDialogTitle: 'Save recording',
  submitDialogSubtitle: 'This full-stack session recording will be saved directly to your selected Multiplayer project. All data is automatically correlated end-to-end.',
  submitDialogCommentLabel: 'You can also add context, comments, or notes.',
  submitDialogCommentPlaceholder: 'Add a message...',
  submitDialogSubmitText: 'Save',
  submitDialogCancelText: 'Cancel',
}

export const BASE_CONFIG: Required<SessionRecorderConfigs> = {
  apiKey: '',

  version: '',
  application: '',
  environment: '',

  showWidget: true,
  showContinuousRecording: true,
  widgetButtonPlacement: WidgetButtonPlacement.bottomRight,

  usePostMessageFallback: false,
  apiBaseUrl: MULTIPLAYER_BASE_API_URL,
  exporterEndpoint: MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL,

  recordCanvas: false,
  recordNavigation: true,
  schemifyDocSpanPayload: true,

  ignoreUrls: [],
  propagateTraceHeaderCorsUrls: [],

  sampleTraceRatio: OTEL_MP_SAMPLE_TRACE_RATIO,
  maxCapturingHttpPayloadSize: DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE,

  captureBody: true,
  captureHeaders: true,
  masking: DEFAULT_MASKING_CONFIG,
  widgetTextOverrides: DEFAULT_WIDGET_TEXT_CONFIG,

  useWebsocket: true,

  buffering: {
    enabled: true,
    windowMinutes: 1,
    snapshotIntervalMs: 30000,
  },
}
