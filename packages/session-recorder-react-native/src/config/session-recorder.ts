import { SessionRecorderConfigs, SessionRecorderOptions } from '../types'
import { LogLevel } from '../utils'
import { BASE_CONFIG } from './defaults'
import { getMaskingConfig } from './masking'
import {
  isValidString,
  isValidNumber,
  isValidBoolean,
  isValidArray
} from './validators'
import { getWidgetConfig } from './widget'


const getLoggerConfig = (config: any) => {
  if (!config || typeof config !== 'object') {
    return BASE_CONFIG.logger
  }
  return {
    level: isValidNumber(config.level, LogLevel.INFO),
    enabled: isValidBoolean(config.enabled, false),
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

    showContinuousRecording: isValidBoolean(c.showContinuousRecording, BASE_CONFIG.showContinuousRecording),
    ignoreUrls: isValidArray(c.ignoreUrls, BASE_CONFIG.ignoreUrls),
    sampleTraceRatio: isValidNumber(c.sampleTraceRatio, BASE_CONFIG.sampleTraceRatio),
    propagateTraceHeaderCorsUrls: c.propagateTraceHeaderCorsUrls || BASE_CONFIG.propagateTraceHeaderCorsUrls,
    schemifyDocSpanPayload: isValidBoolean(c.schemifyDocSpanPayload, BASE_CONFIG.schemifyDocSpanPayload),
    maxCapturingHttpPayloadSize: isValidNumber(c.maxCapturingHttpPayloadSize, BASE_CONFIG.maxCapturingHttpPayloadSize),


    captureBody: isValidBoolean(c.captureBody, BASE_CONFIG.captureBody),
    captureHeaders: isValidBoolean(c.captureHeaders, BASE_CONFIG.captureHeaders),


    recordScreen: isValidBoolean(c.recordScreen, BASE_CONFIG.recordScreen),
    recordGestures: isValidBoolean(c.recordGestures, BASE_CONFIG.recordGestures),
    recordNavigation: isValidBoolean(c.recordNavigation, BASE_CONFIG.recordNavigation),

    masking: getMaskingConfig(c.masking),
    widget: getWidgetConfig(c.widget),
    logger: getLoggerConfig(c.logger),
  }
}
