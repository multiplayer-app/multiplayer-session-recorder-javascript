import 'rrweb-player/dist/style.css'
import { Observable } from 'lib0/observable'
import { insertTrustedHTML } from '../utils'
import { formatTimeForSessionTimer } from '../helpers'
import { SessionWidgetConfig, SessionState } from '../types'
import { DragManager } from './dragManager'
import {
  POPOVER_WIDTH,
  POPOVER_DISTANCE_FROM_BUTTON,
  NON_DRAGGABLE_OFFSET,
} from './constants'

import { UIManager } from './UIManager'
import {
  ButtonState,
  buttonStates,
  ContinuousDebuggingSaveButtonState,
  continuousDebuggingSaveButtonStates,
} from './buttonStateConfigs'

type SessionWidgetEvents =
  | 'toggle'
  | 'pause'
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

  private _recorderPlacement: string = ''
  private _error: string = ''
  private _initialPopoverVisible: boolean = false
  private _finalPopoverVisible: boolean = false
  private _buttonState: ButtonState = ButtonState.IDLE
  private _continuousDebugging: boolean = false
  private uiManager: UIManager
  private readonly commentTextarea: HTMLTextAreaElement | null = null
  private buttonDraggabilityObserver!: MutationObserver
  private dragManager: DragManager | null = null
  public buttonClickExternalHandler: (() => boolean | void) | null = null

  public showRecorderButton: boolean = false
  public timerInterval: any
  public seconds = 0

  public set buttonState(newState: ButtonState) {
    this._buttonState = newState
    const { icon, tooltip, classes, excludeClasses } = buttonStates[newState]
    if (newState === ButtonState.CANCEL) {
      this.buttonDraggabilityObserver.observe(this.recorderButton, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class'],
      })
    } else {
      this.buttonDraggabilityObserver.disconnect()
    }
    this.updateButton(icon, tooltip, excludeClasses, classes)
  }

  private set initialPopoverVisible(v: boolean) {
    this._initialPopoverVisible = v
    this.initialPopover?.classList.toggle('hidden', !v)
  }

  private set finalPopoverVisible(v: boolean) {
    this._finalPopoverVisible = v
    this.finalPopover?.classList.toggle('hidden', !v)
  }

  public get error(): string {
    return this._error
  }

  public set error(v: string) {
    this._error = v
    this.updateTooltip()
  }

  public set isStarted(v: boolean) {
    this._isStarted = v
    if (!this.showRecorderButton && v && !this._continuousDebugging) {
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
      if (!this._continuousDebugging) {
        this.initialPopoverVisible = false
        this.buttonState = ButtonState.RECORDING
      } else {
        this.buttonState = ButtonState.CONTINUOUS_DEBUGGING
      }
      this.uiManager.setPopoverLoadingState(false)
    } else {
      this.buttonState = ButtonState.IDLE
    }
  }

  public set isPaused(v: boolean) {
    this._isPaused = v
    if (!this.showRecorderButton && v && !this._continuousDebugging) {
      this.overlay.classList.add('hidden')
      this.submitSessionDialog.classList.remove('hidden')
      this.stopTimer()
    }
  }

  constructor() {
    super()

    this.recorderButton = document.createElement('button')
    this.initialPopover = document.createElement('div')
    this.finalPopover = document.createElement('div')
    this.overlay = document.createElement('div')
    this.toast = document.createElement('div')
    this.submitSessionDialog = document.createElement('div')

    this.uiManager = new UIManager(
      this.recorderButton,
      this.initialPopover,
      this.finalPopover,
      this.overlay,
      this.submitSessionDialog,
      this.toast,
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

  public updateState(state: SessionState | null, continuousDebugging: boolean) {
    this._continuousDebugging = continuousDebugging
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

  public updateContinuousDebuggingState(
    checked: boolean,
    disabled: boolean = false,
  ) {
    const toggleCheckbox = this.initialPopover.querySelector(
      '#mp-session-debugger-continuous-debugging-checkbox',
    ) as HTMLInputElement
    if (toggleCheckbox) {
      toggleCheckbox.checked = checked
      toggleCheckbox.disabled = disabled
    }
  }

  public updateSaveContinuousDebugSessionState(
    state: ContinuousDebuggingSaveButtonState,
  ) {
    const saveButton = this.initialPopover.querySelector(
      '#mp-save-continuous-debug-session',
    ) as HTMLButtonElement
    if (saveButton) {
      const { textContent, disabled } =
        continuousDebuggingSaveButtonStates[state]
      saveButton.disabled = disabled
      saveButton.textContent = textContent
    }
  }

  /**
   * Shows a toast message with optional session URL
   * @param message - The message to display
   * @param sessionUrl - Optional URL to open when clicking the button
   * @param duration - Duration in milliseconds to show the toast (default: 10000ms)
   */
  public showToast(message: string, sessionUrl?: string, duration: number = 10000): void {
    this.uiManager.showToast(message, sessionUrl, duration)
  }

  private handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement

    if (
      this._initialPopoverVisible &&
      target &&
      !this.initialPopover?.contains(target) &&
      !this.recorderButton?.contains(target) &&
      target !== this.recorderButton &&
      target !== this.initialPopover
    ) {
      this.handleCloseInitialPopover()
    }
  }

  private observeButtonDraggableMode() {
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
    this.showRecorderButton = options.showWidget
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
    if (options.showWidget && options.widgetButtonPlacement) {
      this.recorderButton.classList.add(options.widgetButtonPlacement)
      this._recorderPlacement = options.widgetButtonPlacement
      this.addRecorderDragFunctionality()
    }
    this.addEventListeners()
  }

  private appendElements(elements: HTMLElement[]) {
    const rootWrapper = document.createElement('mp-root')
    rootWrapper.classList.add('mp-root-wrapper')
    rootWrapper.setAttribute('data-rr-ignore', 'true')
    elements.forEach((element) => rootWrapper.appendChild(element))
    document.body.appendChild(rootWrapper)
  }

  private updateTooltip() {
    if (this._error) {
      this.recorderButton.dataset['tooltip'] = this._error
    }
  }

  private addRecorderDragFunctionality() {
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
    const events: any[] = []

    if (this.showRecorderButton) {
      events.push(
        {
          target: this.initialPopover,
          selector: '.mp-start-recording',
          handler: this.startRecording.bind(this),
        },
        {
          event: 'change',
          target: this.initialPopover,
          selector: '#mp-session-debugger-continuous-debugging-checkbox',
          handler: this.handleContinuousDebuggingChange.bind(this),
        },
        {
          target: this.initialPopover,
          selector: '#mp-save-continuous-debug-session',
          handler: this.handleSaveContinuousDebugSession.bind(this),
        },
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
      )
    } else {
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

    events.forEach(({ target, selector, handler, event = 'click' }) => {
      this.addListener(target, selector, handler, event)
    })
  }

  private handleStopRecording() {
    this.onStop()
    this.handleUIReseting()
  }

  public handleUIReseting() {
    this.finalPopoverVisible = false
    this.resetRecordingButton()
  }

  private handleCloseInitialPopover() {
    if (this._buttonState === ButtonState.LOADING) {
      this.onCancel()
      this.uiManager.setPopoverLoadingState(false)
    }
    this.initialPopoverVisible = false
    this.buttonState = this._continuousDebugging
      ? ButtonState.CONTINUOUS_DEBUGGING
      : ButtonState.IDLE
    document.removeEventListener('click', this.handleClickOutside)
  }

  public onRequestError() {
    this.initialPopoverVisible = false
    this.finalPopoverVisible = false
    this.buttonState = ButtonState.IDLE
    document.removeEventListener('click', this.handleClickOutside)
  }


  private handleDismissRecording() {
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
      this.onCancel()
      this.finalPopoverVisible = false
      this.buttonState = ButtonState.IDLE
      return
    }

    if (this._isStarted) {
      this.buttonState = ButtonState.CANCEL
      if (this._continuousDebugging) {
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
    if (this._initialPopoverVisible) {
      document.addEventListener('click', this.handleClickOutside)
    } else {
      document.removeEventListener('click', this.handleClickOutside)
    }
  }

  private updateButton(
    innerHTML: string,
    tooltip: string,
    excludeClasses?: string[],
    classes?: string[],
  ) {
    if (!this.recorderButton) return
    insertTrustedHTML(this.recorderButton, `${innerHTML}`)
    this.recorderButton.dataset['tooltip'] = tooltip
    if (excludeClasses) {
      this.recorderButton.classList.remove(...excludeClasses)
    }
    if (classes) {
      this.recorderButton.classList.add(...classes)
    }
  }

  private handleContinuousDebuggingChange(e: InputEvent) {
    const checkbox = e.target as HTMLInputElement
    this.emit('continuous-debugging', [checkbox.checked])
  }

  private handleSaveContinuousDebugSession() {
    this.emit('save', [])
  }

  private startRecording() {
    this.buttonState = ButtonState.LOADING
    this.uiManager.setPopoverLoadingState(true)
    this.onStart()
  }

  private onStart() {
    if (!this.recorderButton) return
    this.emit('toggle', [true])
  }

  private onStop() {
    if (this.showRecorderButton && !this.recorderButton) return

    this.submitSessionDialog.classList.add('hidden')
    const commentElement = this.showRecorderButton
      ? this.commentTextarea
      : (this.submitSessionDialog.querySelector(
        '#mp-recording-comment',
      ) as HTMLTextAreaElement)

    if (commentElement) {
      this.emit('toggle', [false, commentElement.value])
      commentElement.value = ''
      return
    }

    this.emit('toggle', [false, ''])
  }

  private onPause() {
    this.emit('pause', [])
  }

  private onCancel() {
    this.submitSessionDialog.classList.add('hidden')
    this.emit('cancel', [])
  }

  enable() {
    if (!this.recorderButton) return
    this.recorderButton.disabled = false
    this.recorderButton.style.opacity = '1'
  }

  disable() {
    if (!this.recorderButton) return
    this.recorderButton.disabled = true
    this.recorderButton.style.opacity = '0.5'
  }

  destroy() {
    if (!this.recorderButton) return
    document.body.removeChild(this.recorderButton)
    document.removeEventListener('click', this.handleClickOutside)
  }

  public startTimer() {
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
