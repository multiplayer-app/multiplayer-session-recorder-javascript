import { MaskingConfig } from '../types'
import { DEFAULT_MASKING_CONFIG } from './defaults'
import { isValidArray, isValidBoolean, isValidFunction } from './validators'
import { MultiplayerHelpers } from '@multiplayer-app/session-recorder-opentelemetry'

const { mask, sensitiveFields, sensitiveHeaders } = MultiplayerHelpers

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
    maskInputFunction: isValidFunction(masking.maskInputFunction, undefined),
    maskTextFunction: isValidFunction(masking.maskTextFunction, undefined),
    maskConsoleEventFunction: isValidFunction(masking.maskConsoleEventFunction, undefined),

    maskHeadersList,
    maskBodyFieldsList,
    headersToInclude: isValidArray(masking.headersToInclude, baseMasking.headersToInclude ?? []),
    headersToExclude: isValidArray(masking.headersToExclude, baseMasking.headersToExclude ?? []),
    maskDebugSpanPayload: isValidBoolean(masking.maskDebugSpanPayload, baseMasking.maskDebugSpanPayload ?? true),
    maskBodyFunction: isValidFunction(masking.maskBodyFunction, mask(maskBodyFieldsList)),
    maskHeadersFunction: isValidFunction(masking.maskHeadersFunction, mask(maskHeadersList)),
  }
}