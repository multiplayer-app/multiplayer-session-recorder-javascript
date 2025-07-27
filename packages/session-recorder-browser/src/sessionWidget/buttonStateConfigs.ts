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

export enum ContinuousDebuggingSaveButtonState {
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
    tooltip: 'Click to record',
    classes: [],
    excludeClasses: ['animate-rotate', 'mp-button-blue'],
  },
  [ButtonState.RECORDING]: {
    icon: CapturingIcon,
    tooltip: 'Click to stop your recording',
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

export const continuousDebuggingSaveButtonStates = {
  [ContinuousDebuggingSaveButtonState.IDLE]: {
    textContent: 'Save last snapshot',
    disabled: false,
    classes: [],
  },
  [ContinuousDebuggingSaveButtonState.SAVING]: {
    disabled: true,
    textContent: 'Saving last snapshot...',
    classes: [],
  },
  [ContinuousDebuggingSaveButtonState.SAVED]: {
    disabled: true,
    textContent: 'Saved',
    classes: [],
  },
  [ContinuousDebuggingSaveButtonState.ERROR]: {
    disabled: true,
    textContent: 'Error saving last snapshot',
    classes: [],
  },
}