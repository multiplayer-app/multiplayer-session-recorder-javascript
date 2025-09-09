import { MaskingConfig } from '../types'
import { DEFAULT_MASKING_CONFIG } from './defaults'
import { isValidArray, isValidBoolean, isValidFunction } from './validators'
import { SessionRecorderSdk } from '@multiplayer-app/session-recorder-common'

const { mask, sensitiveFields, sensitiveHeaders } = SessionRecorderSdk

export const getMaskingConfig = (masking?: MaskingConfig): MaskingConfig => {
  const baseMasking = DEFAULT_MASKING_CONFIG

  if (typeof masking !== 'object') {
    return baseMasking
  }

  const maskHeadersList = isValidArray(masking.maskHeadersList, sensitiveHeaders)
  const maskBodyFieldsList = isValidArray(masking.maskBodyFieldsList, sensitiveFields)

  return {
    maskHeadersList,
    maskBodyFieldsList,
    headersToInclude: isValidArray(masking.headersToInclude, baseMasking.headersToInclude ?? []),
    headersToExclude: isValidArray(masking.headersToExclude, baseMasking.headersToExclude ?? []),
    isContentMaskingEnabled: isValidBoolean(masking.isContentMaskingEnabled, baseMasking.isContentMaskingEnabled ?? true),
    maskBody: isValidFunction(masking.maskBody, mask(maskBodyFieldsList)),
    maskHeaders: isValidFunction(masking.maskHeaders, mask(maskHeadersList)),
  }
}