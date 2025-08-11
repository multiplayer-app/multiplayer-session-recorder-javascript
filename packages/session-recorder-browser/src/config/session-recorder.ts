import { SessionRecorderConfigs, SessionRecorderOptions, WidgetButtonPlacement } from '../types'
import { BASE_CONFIG } from './defaults'
import { getMaskingConfig } from './masking'
import {
  isValidString,
  isValidNumber,
  isValidBoolean,
  isValidArray,
  isValidEnum
} from './validators'

export const getSessionRecorderConfig = (c: SessionRecorderOptions): SessionRecorderConfigs => {
  if (!c) {
    return BASE_CONFIG
  }

  return {
    apiKey: isValidString(c.apiKey, BASE_CONFIG.apiKey),
    version: isValidString(c.version, BASE_CONFIG.version),
    application: isValidString(c.application, BASE_CONFIG.application),
    environment: isValidString(c.environment, BASE_CONFIG.environment),

    exporterApiBaseUrl: isValidString(c.exporterApiBaseUrl, BASE_CONFIG.exporterApiBaseUrl),
    usePostMessageFallback: isValidBoolean(c.usePostMessageFallback, BASE_CONFIG.usePostMessageFallback),

    showWidget: isValidBoolean(c.showWidget, BASE_CONFIG.showWidget),
    enableContinuousDebugging: isValidBoolean(c.enableContinuousDebugging, BASE_CONFIG.enableContinuousDebugging),
    recordCanvas: isValidBoolean(c.recordCanvas, BASE_CONFIG.recordCanvas),
    widgetButtonPlacement: isValidEnum<WidgetButtonPlacement>(c.widgetButtonPlacement, BASE_CONFIG.widgetButtonPlacement, Object.values(WidgetButtonPlacement)),
    ignoreUrls: isValidArray(c.ignoreUrls, BASE_CONFIG.ignoreUrls),
    docTraceRatio: isValidNumber(c.docTraceRatio, BASE_CONFIG.docTraceRatio),
    sampleTraceRatio: isValidNumber(c.sampleTraceRatio, BASE_CONFIG.sampleTraceRatio),
    propagateTraceHeaderCorsUrls: c.propagateTraceHeaderCorsUrls || BASE_CONFIG.propagateTraceHeaderCorsUrls,
    schemifyDocSpanPayload: isValidBoolean(c.schemifyDocSpanPayload, BASE_CONFIG.schemifyDocSpanPayload),
    maxCapturingHttpPayloadSize: isValidNumber(c.maxCapturingHttpPayloadSize, BASE_CONFIG.maxCapturingHttpPayloadSize),

    captureBody: isValidBoolean(c.captureBody, BASE_CONFIG.captureBody),
    captureHeaders: isValidBoolean(c.captureHeaders, BASE_CONFIG.captureHeaders),
    masking: getMaskingConfig(c.masking),
  }
}