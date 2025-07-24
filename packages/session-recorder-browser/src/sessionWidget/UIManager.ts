import { insertTrustedHTML } from '../utils'
import { RecordIcon } from './templates/icons'
import { finalPopoverTemplate } from './templates/finalPopover'
import { initialPopoverTemplate } from './templates/initialPopover'
import { recordingOverlayTemplate } from './templates/recordingOverlay'
import { submitSessionDialogTemplate } from './templates/submitSessionDialog'
import { toastTemplate } from './templates/toast'
import { ToastConfig } from '../types'

export class UIManager {
  private recorderButton: HTMLButtonElement
  private initialPopover: HTMLElement
  private finalPopover: HTMLElement
  private recordingOverlay: HTMLElement
  private submitSessionDialog: HTMLElement
  private toast: HTMLElement
  private toastTimeout: NodeJS.Timeout | null = null
  /**
   * Constructor initializes the UIManager with necessary DOM elements
   * @param recorderButton - The main button to start recording
   * @param initialPopover - Popover shown when starting the session
   * @param finalPopover - Popover shown when the session ends
   * @param previewModal - Modal to preview the recorded session
   * @param recordingOverlay - Overlay element for recording indication in extension
   * @param submitSessionDialog - Dialog that opens when recording is stopped from extension
   * @param toast - Toast element for showing success messages
   */
  constructor(
    recorderButton: HTMLButtonElement,
    initialPopover: HTMLElement,
    finalPopover: HTMLElement,
    recordingOverlay: HTMLElement,
    submitSessionDialog: HTMLElement,
    toast: HTMLElement,
  ) {
    this.recorderButton = recorderButton
    this.initialPopover = initialPopover
    this.finalPopover = finalPopover
    this.recordingOverlay = recordingOverlay
    this.submitSessionDialog = submitSessionDialog
    this.toast = toast
  }

  /**
   * Sets the properties for the recorder button, including its class,
   * tooltip, and inner HTML content (Record icon)
   */
  public setRecorderButtonProps() {
    this.recorderButton.className = 'mp-session-debugger-button'
    this.recorderButton.dataset.tooltip = 'Click to record a bug'
    insertTrustedHTML(this.recorderButton, `${RecordIcon}`)
  }

  /**
   * Sets the properties for the recording overlay, including its classes,
   * tooltip, and inner HTML content
   */
  public setOverlayProps() {
    this.recordingOverlay.className = 'mp-recording-overlay hidden'
    insertTrustedHTML(this.recordingOverlay, recordingOverlayTemplate)
  }

  /**
   * Sets the properties for the session submission dialog, including its classes,
   * tooltip, and inner HTML content
   */
  public setSubmitSessionDialogProps(): void {
    this.submitSessionDialog.id = 'mp-submission-dialog'
    this.submitSessionDialog.className = 'hidden'
    insertTrustedHTML(this.submitSessionDialog, submitSessionDialogTemplate)
  }

  /**
   * Sets up the initial popover with its class and inner HTML structure.
   * The popover includes a logo, heading, and start recording button.
   */
  public setInitialPopoverProps() {
    this.initialPopover.className =
      'mp-session-debugger-popover mp-initial-popover hidden'
    insertTrustedHTML(this.initialPopover, initialPopoverTemplate)
  }

  /**
   * Sets up the final popover with its class and inner HTML structure.
   * The popover allows the user to preview or send the bug report after recording.
   */
  public setFinalPopoverProps() {
    this.finalPopover.className = 'mp-session-debugger-popover hidden'
    insertTrustedHTML(this.finalPopover, finalPopoverTemplate)
  }


  /**
   * Updates the popover button to reflect a loading state.
   *
   * When `isLoading` is true, the button is disabled and shows a loading message.
   * When `isLoading` is false, the button is enabled and resets to its default label.
   *
   * @param isLoading - Whether the popover button should show a loading state.
   */
  public setPopoverLoadingState(isLoading: boolean) {
    const button = this.initialPopover.querySelector('.mp-session-debugger-popover-button')

    if (!button) {
      return
    }

    button.classList.toggle('disabled', isLoading)
    button.textContent = isLoading ? 'Starting to record...' : 'Start bug-hunting!'
  }

  public setTimerValue(time: string) {
    const timerElement = this.recordingOverlay.querySelector('.timer') as HTMLElement

    if (!timerElement) {
      return
    }
    insertTrustedHTML(timerElement, time)
  }

  /**
   * Sets the properties for the toast element, including its classes
   */
  public setToastProps(): void {
    this.toast.className = 'mp-toast hidden'
  }

  /**
   * Shows a toast message with optional session URL
   * @param message - The message to display
   * @param sessionUrl - Optional URL to open when clicking the button
   * @param duration - Duration in milliseconds to show the toast (default: 10000ms)
   */
  public showToast(config: ToastConfig, duration: number = 10000): void {
    insertTrustedHTML(this.toast, toastTemplate(config))
    this.toast.className = `mp-toast mp-toast-${config.type}`
    if (config.button?.onClick) {
      const button = this.toast.querySelector('.mp-toast-button')
      button?.addEventListener('click', config.button.onClick)
    }
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout)
    }
    this.toastTimeout = setTimeout(() => {
      this.hideToast()
    }, duration)
  }

  /**
   * Hides the toast message
   */
  public hideToast(): void {
    this.toast.classList.add('hidden')
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout)
    }
  }
}
