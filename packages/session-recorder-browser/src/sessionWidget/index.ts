import { Observable } from 'lib0/observable'
import { insertTrustedHTML } from '../utils'
import { formatTimeForSessionTimer } from '../utils'
import { SessionWidgetConfig, SessionState, ToastConfig, WidgetTextOverridesConfig } from '../types'
import { DragManager } from './dragManager'
import {
  POPOVER_WIDTH,
  POPOVER_DISTANCE_FROM_BUTTON,
  NON_DRAGGABLE_OFFSET,
} from './constants'
import { DEFAULT_WIDGET_TEXT_CONFIG } from '../config'
import { isBrowser, isBrowserExtension } from '../global'
import { UIManager } from './UIManager'
import {
  ButtonState,
  buttonStates,
  ContinuousRecordingSaveButtonState,
  continuousRecordingSaveButtonStates,
} from './buttonStateConfigs'

type SessionWidgetEvents =
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'continuous-debugging'
  | 'save';

export class SessionWidget extends Observable<SessionWidgetEvents> {
  public readonly recorderButton: HTMLButtonElement
  private readonly initialPopover: HTMLElement
  private readonly finalPopover: HTMLElement

  private readonly overlay: HTMLElement
  private readonly submitSessionDialog: HTMLElement
  private readonly toast: HTMLElement
  private _isStarted: boolean = false
  private _isPaused: boolean = false
  private _isInitialized: boolean = false

  private _error: string = ''
  private _recorderPlacement: string = ''
  private _showWidget: boolean = false
  private _initialPopoverVisible: boolean = false
  private _finalPopoverVisible: boolean = false
  private _buttonState: ButtonState = ButtonState.IDLE
  private _continuousRecording: boolean = false
  private _showContinuousRecording: boolean = true
  private _widgetTextOverrides: WidgetTextOverridesConfig = DEFAULT_WIDGET_TEXT_CONFIG
  private uiManager: UIManager
  private readonly commentTextarea: HTMLTextAreaElement | null = null
  private buttonDraggabilityObserver!: MutationObserver
  private dragManager: DragManager | null = null
  public buttonClickExternalHandler: (() => boolean | void) | null = null

  public seconds = 0
  public timerInterval: any

  private readonly isBrowser: boolean
  private readonly isBrowserExtension: boolean

  public set buttonState(newState: ButtonState) {
    this._buttonState = newState
    if (!this.isBrowser) return
    const { icon, tooltip, classes, excludeClasses } = buttonStates[newState]
    if (newState === ButtonState.CANCEL) {
      this.buttonDraggabilityObserver?.observe(this.recorderButton, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class'],
      })
    } else {
      this.buttonDraggabilityObserver?.disconnect()
    }
    this.uiManager.setPopoverLoadingState(newState === ButtonState.LOADING)
    this.updateButton(icon, tooltip, excludeClasses, classes)
  }

  private set initialPopoverVisible(v: boolean) {
    this._initialPopoverVisible = v
    if (this.isBrowser) {
      this.initialPopover?.classList.toggle('hidden', !v)
    }
  }

  private set finalPopoverVisible(v: boolean) {
    this._finalPopoverVisible = v
    if (this.isBrowser) {
      this.finalPopover?.classList.toggle('hidden', !v)
    }
  }

  public get error(): string {
    return this._error
  }

  public set error(v: string) {
    this._error = v
    if (this._error) {
      this.showToast({
        type: 'error',
        message: this._error,
        button: {
          text: 'Close', onClick: () => this.hideToast(),
        },
      })
    }
  }

  public set isStarted(v: boolean) {
    this._isStarted = v
    if (!this.isBrowser) return

    if (this.isBrowserExtension && v && !this._continuousRecording) {
      this.overlay.classList.remove('hidden')
      this.makeOverlayDraggable()

      if (!this.seconds) {
        this.startTimer()
      }
    } else {
      this.overlay.classList.add('hidden')
    }

    this.recorderButton.classList.toggle('is-started', this._isStarted)
    if (this._isStarted) {
      if (!this._continuousRecording) {
        this.initialPopoverVisible = false
        this.buttonState = ButtonState.RECORDING
      } else {
        this.buttonState = ButtonState.CONTINUOUS_DEBUGGING
      }
    } else {
      this.buttonState = ButtonState.IDLE
    }
  }

  public set isPaused(v: boolean) {
    this._isPaused = v
    if (!this.isBrowser) return
    if (this._isInitialized && this.isBrowserExtension && v && !this._continuousRecording) {
      this.overlay.classList.add('hidden')
      this.submitSessionDialog.classList.remove('hidden')
      this.stopTimer()
    }
  }

  constructor() {
    super()

    this.isBrowser = isBrowser
    this.isBrowserExtension = isBrowserExtension

    if (!this.isBrowser) {
      // Create dummy elements for SSR to prevent crashes
      this.uiManager = {} as UIManager
      this.toast = {} as HTMLElement
      this.overlay = {} as HTMLElement
      this.finalPopover = {} as HTMLElement
      this.initialPopover = {} as HTMLElement
      this.submitSessionDialog = {} as HTMLElement
      this.recorderButton = {} as HTMLButtonElement
      return
    }

    this.toast = document.createElement('div')
    this.overlay = document.createElement('div')
    this.finalPopover = document.createElement('div')
    this.initialPopover = document.createElement('div')
    this.recorderButton = document.createElement('button')
    this.submitSessionDialog = document.createElement('div')

    this.uiManager = new UIManager(
      this.recorderButton,
      this.initialPopover,
      this.finalPopover,
      this.overlay,
      this.submitSessionDialog,
      this.toast,
      DEFAULT_WIDGET_TEXT_CONFIG,
      true, // showContinuousRecording default
    )
    this.uiManager.setRecorderButtonProps()
    this.uiManager.setInitialPopoverProps()
    this.uiManager.setFinalPopoverProps()
    this.uiManager.setOverlayProps()
    this.uiManager.setSubmitSessionDialogProps()
    this.uiManager.setToastProps()

    this.commentTextarea = this.finalPopover.querySelector(
      '.mp-session-debugger-popover-textarea',
    )
    this.observeButtonDraggableMode()
  }

  public updateState(state: SessionState | null, continuousRecording: boolean) {
    this._continuousRecording = continuousRecording
    switch (state) {
      case SessionState.started:
        this.isPaused = false
        this.isStarted = true
        break
      case SessionState.stopped:
        this.isPaused = false
        this.isStarted = false
        break
      case SessionState.paused:
        this.isPaused = true
        this.isStarted = false
        break
      default:
        this.isPaused = false
        this.isStarted = false
        break
    }
  }

  public updateContinuousRecordingState(
    checked: boolean,
    disabled: boolean = false,
  ) {
    if (!this.isBrowser) return
    const toggleCheckbox = this.initialPopover.querySelector(
      '#mp-session-debugger-continuous-debugging-checkbox',
    ) as HTMLInputElement
    if (toggleCheckbox) {
      toggleCheckbox.checked = checked
      toggleCheckbox.disabled = disabled
    }
  }

  public updateSaveContinuousDebugSessionState(
    state: ContinuousRecordingSaveButtonState,
  ) {
    if (!this.isBrowser) return
    const saveButton = this.initialPopover.querySelector(
      '#mp-save-continuous-debug-session',
    ) as HTMLButtonElement
    if (saveButton) {
      const { textContent, disabled } =
        continuousRecordingSaveButtonStates[state]
      saveButton.disabled = disabled
      saveButton.textContent = textContent
    }
  }

  /**
   * Shows a toast message with optional action button
   * @param config - The toast configuration including message, type, and optional button
   * @param duration - Duration in milliseconds to show the toast (default: 10000ms)
   */
  public showToast(config: ToastConfig, duration: number = 10000): void {
    if (!this.isBrowser) return
    this.uiManager.showToast(config, duration)
  }

  /**
   * Hides the currently displayed toast message
   */
  public hideToast(): void {
    if (!this.isBrowser) return
    this.uiManager.hideToast()
  }

  private handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const isPopoverVisible = this._initialPopoverVisible || this._finalPopoverVisible
    const popover = this._initialPopoverVisible ? this.initialPopover : this.finalPopover
    if (
      isPopoverVisible &&
      target &&
      !popover?.contains(target) &&
      !this.recorderButton?.contains(target) &&
      target !== this.recorderButton &&
      target !== popover
    ) {
      if (this._initialPopoverVisible) {
        this.handleCloseInitialPopover()
      } else {
        this.handleCloseFinalPopover()
      }
    }
  }

  private observeButtonDraggableMode() {
    if (!this.isBrowser) return
    this.buttonDraggabilityObserver = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          const oldClassName = mutation.oldValue
          const newClassName = mutation.target['className']
          if (
            (oldClassName?.includes('no-draggable') &&
              !newClassName.includes('no-draggable')) ||
            (newClassName?.includes('no-draggable') &&
              !oldClassName?.includes('no-draggable'))
          ) {
            // draggable mode was changed
            this.initialPopoverVisible = false
            this.finalPopoverVisible = false

          }
        }
      }
    })
  }

  init(options: SessionWidgetConfig) {
    if (this._isInitialized) return
    if (!this.isBrowser) return
    this._isInitialized = true
    this._showWidget = options.showWidget
    this._showContinuousRecording = options.showContinuousRecording
    this._widgetTextOverrides = {
      ...this._widgetTextOverrides,
      ...options.widgetTextOverrides,
    }

    // Recreate UIManager with proper config
    this.uiManager = new UIManager(
      this.recorderButton,
      this.initialPopover,
      this.finalPopover,
      this.overlay,
      this.submitSessionDialog,
      this.toast,
      this._widgetTextOverrides,
      this._showContinuousRecording,
    )

    // Re-initialize templates with new config
    this.uiManager.setRecorderButtonProps()
    this.uiManager.setInitialPopoverProps()
    this.uiManager.setFinalPopoverProps()
    this.uiManager.setOverlayProps()
    this.uiManager.setSubmitSessionDialogProps()
    this.uiManager.setToastProps()

    const elements = [this.toast]

    if (options.showWidget) {
      elements.push(
        this.recorderButton,
        this.initialPopover,
        this.finalPopover,
        this.submitSessionDialog,
      )
    } else {
      elements.push(this.overlay, this.submitSessionDialog)
    }

    this.appendElements(elements)
    // Hide continuous recording UI when feature is disabled
    if (!this._showContinuousRecording) {
      const cont = this.initialPopover.querySelector('.mp-session-debugger-continuous-debugging') as HTMLElement
      cont && cont.classList.add('hidden')
      const overlay = this.initialPopover.querySelector('.mp-session-debugger-continuous-debugging-overlay') as HTMLElement
      overlay && overlay.classList.add('hidden')
    }
    if (options.showWidget && options.widgetButtonPlacement) {
      this.recorderButton.classList.add(options.widgetButtonPlacement)
      this._recorderPlacement = options.widgetButtonPlacement
      this.addRecorderDragFunctionality()
    }
    this.addEventListeners()
  }

  private appendElements(elements: HTMLElement[]) {
    if (!this.isBrowser || typeof document === 'undefined') return
    const rootWrapper = document.createElement('mp-root')
    rootWrapper.classList.add('mp-root-wrapper')
    rootWrapper.setAttribute('data-rr-ignore', 'true')
    elements.forEach((element) => rootWrapper.appendChild(element))
    document.body.appendChild(rootWrapper)
  }


  private addRecorderDragFunctionality() {
    if (!this.isBrowser) return
    this.dragManager = new DragManager(
      this.recorderButton,
      this._recorderPlacement,
      () => {
        if (this._isPaused) {
          this.finalPopoverVisible = true
        }
      },
      () => this.updatePopoverPosition(),
      (e) => this.onRecordingButtonClick(e),
    )
    this.dragManager.init()
  }

  private updatePopoverPosition() {
    if (!this.isBrowser || typeof window === 'undefined') return
    const { top, right, bottom, left } =
      this.recorderButton.getBoundingClientRect()
    const isDraggable = !this.recorderButton.classList.contains('no-draggable')

    const POPOVER_HEIGHT = this._isStarted ? 400 : 300
    const VIEWPORT_WIDTH = window.innerWidth
    const VIEWPORT_HEIGHT = window.innerHeight

    let popoverBottom: number
    let popoverRight: number

    popoverBottom = VIEWPORT_HEIGHT - top + POPOVER_DISTANCE_FROM_BUTTON + (isDraggable ? 0 : NON_DRAGGABLE_OFFSET)
    popoverRight = VIEWPORT_WIDTH - right

    if (popoverBottom + POPOVER_HEIGHT > VIEWPORT_HEIGHT) {
      popoverBottom = VIEWPORT_HEIGHT - bottom - POPOVER_HEIGHT - POPOVER_DISTANCE_FROM_BUTTON - (isDraggable ? 0 : NON_DRAGGABLE_OFFSET)
    }

    if (popoverRight + POPOVER_WIDTH > VIEWPORT_WIDTH) {
      popoverRight = VIEWPORT_WIDTH - left - POPOVER_WIDTH
    }

    const MIN_MARGIN = 10
    popoverBottom = Math.max(popoverBottom, MIN_MARGIN)
    popoverRight = Math.max(popoverRight, MIN_MARGIN)

    if (popoverRight + POPOVER_WIDTH > VIEWPORT_WIDTH - MIN_MARGIN) {
      popoverRight = VIEWPORT_WIDTH - POPOVER_WIDTH - MIN_MARGIN
    }

    if (popoverBottom + POPOVER_HEIGHT > VIEWPORT_HEIGHT - MIN_MARGIN) {
      popoverBottom = VIEWPORT_HEIGHT - POPOVER_HEIGHT - MIN_MARGIN
    }

    const updatePopoverStyles = (popover: HTMLElement) => {
      popover.style.right = `${popoverRight}px`
      popover.style.bottom = `${popoverBottom}px`
      popover.style.left = 'unset'
      popover.style.top = 'unset'
    }

    requestAnimationFrame(() => {
      this.initialPopover && updatePopoverStyles(this.initialPopover)
      this.finalPopover && updatePopoverStyles(this.finalPopover)
    })
  }

  private addEventListeners() {
    if (!this.isBrowser) return
    const events: any[] = []

    if (this.isBrowserExtension) {
      events.push(
        {
          target: this.overlay,
          selector: '.mp-stop-btn',
          handler: this.onPause.bind(this), // change to submit dialog
        },
        {
          target: this.submitSessionDialog,
          selector: '#mp-submit-recording',
          handler: this.onStop.bind(this),
        },
        {
          target: this.submitSessionDialog,
          selector: '#mp-cancel-submission',
          handler: this.onCancel.bind(this),
        },
      )
    }

    if (this._showWidget) {
      events.push(
        {
          target: this.initialPopover,
          selector: '.mp-start-recording',
          handler: this.startRecording.bind(this),
        },
      )
      if (this._showContinuousRecording) {
        events.push(
          {
            event: 'change',
            target: this.initialPopover,
            selector: '#mp-session-debugger-continuous-debugging-checkbox',
            handler: this.handleContinuousRecordingChange.bind(this),
          },
          {
            target: this.initialPopover,
            selector: '#mp-save-continuous-debug-session',
            handler: this.handleSaveContinuousDebugSession.bind(this),
          },
        )
      }
      events.push(
        {
          target: this.initialPopover,
          selector: '.mp-session-debugger-modal-close',
          handler: this.handleCloseInitialPopover.bind(this),
        },
        {
          target: this.finalPopover,
          selector: '.mp-stop-recording',
          handler: this.handleStopRecording.bind(this),
        },
        {
          target: this.finalPopover,
          selector: '.mp-session-debugger-dismiss-button',
          handler: this.handleDismissRecording.bind(this),
        },
        {
          target: this.finalPopover,
          selector: '.mp-session-debugger-modal-close',
          handler: this.handleCloseFinalPopover.bind(this),
        },
      )
    }

    events.forEach(({ target, selector, handler, event = 'click' }) => {
      this.addListener(target, selector, handler, event)
    })
  }

  private handleStopRecording() {
    if (!this.isBrowser) return
    this.onStop()
    this.handleUIReseting()
  }

  public handleUIReseting() {
    if (!this.isBrowser) return
    this.finalPopoverVisible = false
    this.resetRecordingButton()
  }

  private handleCloseInitialPopover() {
    if (!this.isBrowser) return
    if (this._buttonState === ButtonState.LOADING) {
      this.onCancel()
    }
    this.initialPopoverVisible = false
    this.buttonState = this._continuousRecording
      ? ButtonState.CONTINUOUS_DEBUGGING
      : ButtonState.IDLE
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.handleClickOutside)
    }
  }

  private handleCloseFinalPopover() {
    this.onResume()
  }

  public onRequestError() {
    if (!this.isBrowser) return
    this.initialPopoverVisible = false
    this.finalPopoverVisible = false
    this.buttonState = ButtonState.IDLE
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.handleClickOutside)
    }
  }


  private handleDismissRecording() {
    if (!this.isBrowser) return
    this.onCancel()
    this.finalPopoverVisible = !this._finalPopoverVisible
    this.buttonState = ButtonState.IDLE
    this.overlay.classList.add('hidden')
    if (this.commentTextarea) {
      this.commentTextarea.value = ''
    }
  }


  private resetRecordingButton() {
    setTimeout(() => {
      this.buttonState = ButtonState.IDLE
    }, 1500)
  }

  private addListener(
    element: HTMLElement | null,
    selector: string,
    handler: EventListener,
    event: string = 'click',
  ) {
    element?.querySelector(selector)?.addEventListener(event, handler)
  }

  private onRecordingButtonClick(e) {
    if (!this.isBrowser) return
    if (this.buttonClickExternalHandler) {
      const shouldPropagate = this.buttonClickExternalHandler()
      if (shouldPropagate === false) {
        e.preventDefault()
        return
      }
    }

    if (this._initialPopoverVisible) {
      this.handleCloseInitialPopover()
      return
    }

    if (this._isPaused) {
      this.onResume()
      return
    }

    if (this._isStarted) {
      this.buttonState = ButtonState.CANCEL
      if (this._continuousRecording) {
        this.initialPopoverVisible = !this.initialPopoverVisible
      } else {
        this.finalPopoverVisible = !this._finalPopoverVisible
        this.onPause()
      }
    } else {
      this.buttonState = this._initialPopoverVisible
        ? ButtonState.IDLE
        : ButtonState.CANCEL
      this.initialPopoverVisible = !this._initialPopoverVisible
    }

    if (typeof document !== 'undefined') {
      if (this._initialPopoverVisible || this._finalPopoverVisible) {
        document.addEventListener('click', this.handleClickOutside)
      } else {
        document.removeEventListener('click', this.handleClickOutside)
      }
    }
  }

  private updateButton(
    innerHTML: string,
    tooltip: string,
    excludeClasses?: string[],
    classes?: string[],
  ) {
    if (!this.isBrowser || !this.recorderButton) return
    insertTrustedHTML(this.recorderButton, `${innerHTML}`)
    this.recorderButton.dataset['tooltip'] = tooltip
    if (excludeClasses) {
      this.recorderButton.classList.remove(...excludeClasses)
    }
    if (classes) {
      this.recorderButton.classList.add(...classes)
    }
  }

  private handleContinuousRecordingChange(e: InputEvent) {
    if (!this._showContinuousRecording) return
    const checkbox = e.target as HTMLInputElement
    this.emit('continuous-debugging', [checkbox.checked])
  }

  private handleSaveContinuousDebugSession() {
    this.emit('save', [])
  }

  private startRecording() {
    this.buttonState = ButtonState.LOADING
    this.onStart()
  }

  private onStart() {
    if (!this.recorderButton) return
    this.emit('start', [])
  }

  private onStop() {
    if (!this.isBrowser) return
    if (this._showWidget && !this.recorderButton) return

    let commentElement: HTMLTextAreaElement | null = null

    if (this.isBrowserExtension) {
      this.submitSessionDialog.classList.add('hidden')
      commentElement = this.submitSessionDialog.querySelector('#mp-recording-comment')
    } else {
      commentElement = this.commentTextarea
    }

    if (commentElement) {
      this.emit('stop', [commentElement.value])
      commentElement.value = ''
    } else {
      this.emit('stop', [])
    }
  }

  private onPause() {
    this.emit('pause', [])
  }

  private onResume() {
    if (!this.isBrowser) return

    this.finalPopoverVisible = false
    if (!this._continuousRecording) {
      this.buttonState = ButtonState.RECORDING
      this.emit('resume', [])
    } else {
      this.buttonState = ButtonState.CONTINUOUS_DEBUGGING
    }
  }

  private onCancel() {
    if (!this.isBrowser) return
    this.submitSessionDialog.classList.add('hidden')
    this.emit('cancel', [])
  }

  enable() {
    if (!this.isBrowser || !this.recorderButton) return
    this.recorderButton.disabled = false
    this.recorderButton.style.opacity = '1'
  }

  disable() {
    if (!this.isBrowser || !this.recorderButton) return
    this.recorderButton.disabled = true
    this.recorderButton.style.opacity = '0.5'
  }

  destroy() {
    if (!this.isBrowser || !this.recorderButton || typeof document === 'undefined') return
    const rootWrapper = document.querySelector('.mp-root-wrapper')
    if (rootWrapper && rootWrapper.contains(this.recorderButton)) {
      document.body.removeChild(rootWrapper)
    }
    document.removeEventListener('click', this.handleClickOutside)
  }

  public startTimer() {
    if (!this.isBrowser) return
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    this.uiManager.setTimerValue(formatTimeForSessionTimer(this.seconds))

    this.timerInterval = setInterval(() => {
      this.seconds++
      this.uiManager.setTimerValue(formatTimeForSessionTimer(this.seconds))
    }, 1000)
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
      this.seconds = 0
    }
  }

  makeOverlayDraggable(): void {
    if (!this.isBrowser || typeof document === 'undefined') return
    const element = this.overlay
    const dragHandle = element.querySelector('.mp-drag-handle') as HTMLElement
    if (!dragHandle) return

    let offsetX = 0,
      offsetY = 0

    dragHandle.onmousedown = function (e: MouseEvent) {
      e.preventDefault()
      offsetX = e.clientX - element.offsetLeft
      offsetY = e.clientY - element.offsetTop

      document.onmousemove = function (e: MouseEvent) {
        element.style.left = `${e.clientX - offsetX}px`
        element.style.top = `${e.clientY - offsetY}px`
        element.style.bottom = 'auto'
        element.style.transform = 'none'
      }

      document.onmouseup = function () {
        document.onmousemove = null
        document.onmouseup = null
      }
    }
  }
}
