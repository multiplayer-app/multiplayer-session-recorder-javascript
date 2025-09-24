import { SessionRecorderConfigs, SessionRecorderOptions, WidgetButtonPlacement } from '../types'
import { BASE_CONFIG } from './defaults'
import { getMaskingConfig } from './masking'
import {
  isValidString,
  isValidNumber,
  isValidBoolean,
  isValidArray,
  isValidEnum,
} from './validators'

const getWidgetTextOverridesConfig = (config: any, defaultConfig: any) => {
  if (!config || typeof config !== 'object') {
    return defaultConfig
  }

  return {
    initialTitleWithContinuous: isValidString(config.initialTitleWithContinuous, defaultConfig.initialTitleWithContinuous),
    initialTitleWithoutContinuous: isValidString(config.initialTitleWithoutContinuous, defaultConfig.initialTitleWithoutContinuous),
    initialDescriptionWithContinuous: isValidString(config.initialDescriptionWithContinuous, defaultConfig.initialDescriptionWithContinuous),
    initialDescriptionWithoutContinuous: isValidString(config.initialDescriptionWithoutContinuous, defaultConfig.initialDescriptionWithoutContinuous),
    continuousRecordingLabel: isValidString(config.continuousRecordingLabel, defaultConfig.continuousRecordingLabel),
    startRecordingButtonText: isValidString(config.startRecordingButtonText, defaultConfig.startRecordingButtonText),
    finalTitle: isValidString(config.finalTitle, defaultConfig.finalTitle),
    finalDescription: isValidString(config.finalDescription, defaultConfig.finalDescription),
    commentPlaceholder: isValidString(config.commentPlaceholder, defaultConfig.commentPlaceholder),
    saveButtonText: isValidString(config.saveButtonText, defaultConfig.saveButtonText),
    cancelButtonText: isValidString(config.cancelButtonText, defaultConfig.cancelButtonText),
    continuousOverlayTitle: isValidString(config.continuousOverlayTitle, defaultConfig.continuousOverlayTitle),
    continuousOverlayDescription: isValidString(config.continuousOverlayDescription, defaultConfig.continuousOverlayDescription),
    saveLastSnapshotButtonText: isValidString(config.saveLastSnapshotButtonText, defaultConfig.saveLastSnapshotButtonText),
    submitDialogTitle: isValidString(config.submitDialogTitle, defaultConfig.submitDialogTitle),
    submitDialogSubtitle: isValidString(config.submitDialogSubtitle, defaultConfig.submitDialogSubtitle),
    submitDialogCommentLabel: isValidString(config.submitDialogCommentLabel, defaultConfig.submitDialogCommentLabel),
    submitDialogCommentPlaceholder: isValidString(config.submitDialogCommentPlaceholder, defaultConfig.submitDialogCommentPlaceholder),
    submitDialogSubmitText: isValidString(config.submitDialogSubmitText, defaultConfig.submitDialogSubmitText),
    submitDialogCancelText: isValidString(config.submitDialogCancelText, defaultConfig.submitDialogCancelText),
  }
}

export const getSessionRecorderConfig = (c: SessionRecorderOptions): SessionRecorderConfigs => {
  if (!c) {
    return BASE_CONFIG
  }

  return {
    apiKey: isValidString(c.apiKey, BASE_CONFIG.apiKey),
    version: isValidString(c.version, BASE_CONFIG.version),
    application: isValidString(c.application, BASE_CONFIG.application),
    environment: isValidString(c.environment, BASE_CONFIG.environment),

    exporterEndpoint: isValidString(c.exporterEndpoint, BASE_CONFIG.exporterEndpoint),
    apiBaseUrl: isValidString(c.apiBaseUrl, BASE_CONFIG.apiBaseUrl),
    usePostMessageFallback: isValidBoolean(c.usePostMessageFallback, BASE_CONFIG.usePostMessageFallback),

    showWidget: isValidBoolean(c.showWidget, BASE_CONFIG.showWidget),
    showContinuousRecording: isValidBoolean(c.showContinuousRecording, BASE_CONFIG.showContinuousRecording),
    recordCanvas: isValidBoolean(c.recordCanvas, BASE_CONFIG.recordCanvas),
    widgetButtonPlacement: isValidEnum<WidgetButtonPlacement>(c.widgetButtonPlacement, BASE_CONFIG.widgetButtonPlacement, Object.values(WidgetButtonPlacement) as WidgetButtonPlacement[]),
    ignoreUrls: isValidArray(c.ignoreUrls, BASE_CONFIG.ignoreUrls),
    sampleTraceRatio: isValidNumber(c.sampleTraceRatio, BASE_CONFIG.sampleTraceRatio),
    propagateTraceHeaderCorsUrls: c.propagateTraceHeaderCorsUrls || BASE_CONFIG.propagateTraceHeaderCorsUrls,
    schemifyDocSpanPayload: isValidBoolean(c.schemifyDocSpanPayload, BASE_CONFIG.schemifyDocSpanPayload),
    maxCapturingHttpPayloadSize: isValidNumber(c.maxCapturingHttpPayloadSize, BASE_CONFIG.maxCapturingHttpPayloadSize),

    captureBody: isValidBoolean(c.captureBody, BASE_CONFIG.captureBody),
    captureHeaders: isValidBoolean(c.captureHeaders, BASE_CONFIG.captureHeaders),
    masking: getMaskingConfig(c.masking),
    widgetTextOverrides: getWidgetTextOverridesConfig(c.widgetTextOverrides, BASE_CONFIG.widgetTextOverrides),

  }
}
