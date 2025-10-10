import { type MaskingOptions, type SessionRecorderConfigs } from '../types';
import { DEFAULT_MASKING_CONFIG } from './defaults';
import { isValidArray, isValidBoolean, isValidFunction } from './validators';
import { SessionRecorderSdk } from '@multiplayer-app/session-recorder-common';

const { mask, sensitiveFields, sensitiveHeaders } = SessionRecorderSdk;

export const getMaskingConfig = (
  masking?: MaskingOptions
): SessionRecorderConfigs['masking'] => {
  const baseMasking = DEFAULT_MASKING_CONFIG;

  if (typeof masking !== 'object') {
    return baseMasking;
  }

  const maskHeadersList = isValidArray(
    masking.maskHeadersList,
    sensitiveHeaders
  );
  const maskBodyFieldsList = isValidArray(
    masking.maskBodyFieldsList,
    sensitiveFields
  );

  return {
    maskHeadersList,
    maskBodyFieldsList,
    headersToInclude: isValidArray(
      masking.headersToInclude,
      baseMasking.headersToInclude
    ),
    headersToExclude: isValidArray(
      masking.headersToExclude,
      baseMasking.headersToExclude
    ),
    isContentMaskingEnabled: isValidBoolean(
      masking.isContentMaskingEnabled,
      baseMasking.isContentMaskingEnabled
    ),
    maskBody: isValidFunction(masking.maskBody, mask(maskBodyFieldsList)),
    maskHeaders: isValidFunction(masking.maskHeaders, mask(maskHeadersList)),
    // Screen masking options
    maskTextInputs: isValidBoolean(
      masking.maskTextInputs,
      baseMasking.maskTextInputs
    ),
    maskImages: isValidBoolean(masking.maskImages, baseMasking.maskImages),
    maskButtons: isValidBoolean(masking.maskButtons, baseMasking.maskButtons),
    maskLabels: isValidBoolean(masking.maskLabels, baseMasking.maskLabels),
    maskWebViews: isValidBoolean(
      masking.maskWebViews,
      baseMasking.maskWebViews
    ),
    maskSandboxedViews: isValidBoolean(
      masking.maskSandboxedViews,
      baseMasking.maskSandboxedViews
    ),
  };
};
