import { MaskingConfig } from '../types'
import { DEFAULT_MASKING_CONFIG } from './defaults'
import { isValidArray, isValidBoolean, isValidFunction } from './validators'
import { SessionRecorderHelpers } from '@multiplayer-app/session-recorder-opentelemetry'

const { mask, sensitiveFields, sensitiveHeaders } = SessionRecorderHelpers

export const getMaskingConfig = (masking?: MaskingConfig): MaskingConfig => {
  const baseMasking = DEFAULT_MASKING_CONFIG

  if (typeof masking !== 'object') {
    return baseMasking
  }

  const maskHeadersList = isValidArray(masking.maskHeadersList, sensitiveHeaders)
  const maskBodyFieldsList = isValidArray(masking.maskBodyFieldsList, sensitiveFields)

  return {
    maskAllInputs: isValidBoolean(masking.maskAllInputs, baseMasking.maskAllInputs ?? true),
    maskTextClass: masking.maskTextClass,
    maskTextSelector: masking.maskTextSelector,
    maskInputOptions: masking.maskInputOptions && typeof masking.maskInputOptions === 'object' ? masking.maskInputOptions : undefined,
    maskInput: isValidFunction(masking.maskInput, undefined),
    maskText: isValidFunction(masking.maskText, undefined),
    maskConsoleEvent: isValidFunction(masking.maskConsoleEvent, undefined),

    maskHeadersList,
    maskBodyFieldsList,
    headersToInclude: isValidArray(masking.headersToInclude, baseMasking.headersToInclude ?? []),
    headersToExclude: isValidArray(masking.headersToExclude, baseMasking.headersToExclude ?? []),
    isMaskingEnabled: isValidBoolean(masking.isMaskingEnabled, baseMasking.isMaskingEnabled ?? true),
    maskBody: isValidFunction(masking.maskBody, mask(maskBodyFieldsList)),
    maskHeaders: isValidFunction(masking.maskHeaders, mask(maskHeadersList)),
  }
}