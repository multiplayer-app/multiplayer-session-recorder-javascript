import { CapturingIcon, CheckmarkIcon, CloseIcon, RecordIcon } from './templates/icons'

/**
 * ButtonState defines the possible states of the recorder button.
 * It includes IDLE, RECORDING, CANCEL, SENT and LOADING states.
 */
export enum ButtonState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  CANCEL = 'CANCEL',
  SENT = 'SENT',
  LOADING = 'LOADING',
  CONTINUOUS_DEBUGGING = 'CONTINUOUS_DEBUGGING',
}

export enum ContinuousRecordingSaveButtonState {
  IDLE = 'IDLE',
  SAVING = 'SAVING',
  SAVED = 'SAVED',
  ERROR = 'ERROR',
}

/**
 * buttonStates object provides properties for each button state:
 * IDLE, RECORDING, CANCEL, and SENT.
 */
export const buttonStates = {
  [ButtonState.IDLE]: {
    icon: RecordIcon,
    tooltip: 'Record an issue',
    classes: [],
    excludeClasses: ['animate-rotate', 'mp-button-blue'],
  },
  [ButtonState.RECORDING]: {
    icon: CapturingIcon,
    tooltip: 'The session is recording. Click to end.',
    classes: [],
    excludeClasses: ['mp-button-blue', 'animate-rotate'],
  },
  [ButtonState.CANCEL]: {
    icon: CloseIcon,
    tooltip: 'Click to cancel',
    classes: [],
    excludeClasses: ['animate-rotate', 'mp-button-blue'],
  },
  [ButtonState.SENT]: {
    icon: CheckmarkIcon,
    tooltip: 'We\'ve sent it over! Thanks!',
    classes: ['mp-button-blue'],
    excludeClasses: ['animate-rotate'],
  },
  [ButtonState.LOADING]: {
    icon: RecordIcon,
    tooltip: 'Starting to record...',
    classes: [],
    excludeClasses: ['animate-rotate', 'mp-button-blue'],
  },
  [ButtonState.CONTINUOUS_DEBUGGING]: {
    icon: CapturingIcon,
    tooltip: 'You’re continuously recording.',
    classes: [],
    excludeClasses: ['mp-button-blue', 'animate-rotate'],
  },
}

export const continuousRecordingSaveButtonStates = {
  [ContinuousRecordingSaveButtonState.IDLE]: {
    textContent: 'Save recording',
    disabled: false,
    classes: [],
  },
  [ContinuousRecordingSaveButtonState.SAVING]: {
    disabled: true,
    textContent: 'Saving recording...',
    classes: [],
  },
  [ContinuousRecordingSaveButtonState.SAVED]: {
    disabled: true,
    textContent: 'Saved',
    classes: [],
  },
  [ContinuousRecordingSaveButtonState.ERROR]: {
    disabled: true,
    textContent: 'Error saving the recording',
    classes: [],
  },
}
