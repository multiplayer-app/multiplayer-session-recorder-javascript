import { SessionRecorderSdk } from '@multiplayer-app/session-recorder-common'
import { MaskingConfig, SessionRecorderConfigs, WidgetButtonPlacement, WidgetTextOverridesConfig } from '../types'
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
  submitDialogTitle: 'Submit Recording',
  submitDialogSubtitle: 'Report this issue with your debug logs and session replay.' +
    ' Optionally, enter some additional information below.',
  submitDialogCommentLabel: 'Comment (optional)',
  submitDialogCommentPlaceholder: 'Add any notes about this recording...',
  submitDialogSubmitText: 'Submit recording',
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
  masking: DEFAULT_MASKING_CONFIG,
  widgetTextOverrides: DEFAULT_WIDGET_TEXT_CONFIG
}
