import { TracerBrowserSDK } from './otel'
import { RecorderBrowserSDK } from './rrweb'
import {
  getStoredItem,
  setStoredItem,
  getNavigatorInfo,
  getFormattedDate,
  getTimeDifferenceInSeconds,
  isSessionActive,
} from './helpers'
import {
  SessionState,
  IDebugSession,
  SessionDebuggerConfigs,
  SessionDebuggerOptions,
} from './types'

import {
  SESSION_RESPONSE, DEBUG_SESSION_PROP_NAME, DEBUG_SESSION_AUTO_CREATED,
  DEBUG_SESSION_ID_PROP_NAME,
  DEBUG_SESSION_STARTED_EVENT,
  DEBUG_SESSION_STOPPED_EVENT,
  DEBUG_SESSION_STATE_PROP_NAME,
  DEBUG_SESSION_SHORT_ID_PROP_NAME, DEBUG_SESSION_CONTINUE_DEBUGGING_PROP_NAME,
  BASE_CONFIG
} from './constants'

import {
  setShouldRecordHttpData,
  setMaxCapturingHttpPayloadSize,
} from './patch/xhr'
import { recorderEventBus } from './eventBus'
import { SessionWidget } from './sessionWidget'
import messagingService from './services/messaging.service'
import { ApiService, StartSessionRequest, StopSessionRequest } from './services/api.service'

import './index.scss'
import { DebugSessionType } from '@multiplayer-app/opentelemetry'
import { ContinuousDebuggingSaveButtonState } from './sessionWidget/buttonStateConfigs'
import { IDebugger } from './types'

export class Debugger implements IDebugger {
  private _isInitialized = false
  private _configs: SessionDebuggerConfigs

  private _apiService = new ApiService()
  private _tracer = new TracerBrowserSDK()
  private _recorder = new RecorderBrowserSDK()
  private _sessionWidget = new SessionWidget()
  private _startRequestController: AbortController | null = null

  // Session ID and state are stored in localStorage
  private _sessionId: string | null = null
  get sessionId(): string | null {
    return this._sessionId
  }
  set sessionId(sessionId: string | null) {
    this._sessionId = sessionId
    setStoredItem(DEBUG_SESSION_ID_PROP_NAME, sessionId)
  }

  private _shortSessionId: string | null = null
  get shortSessionId(): string | null {
    return this._shortSessionId
  }
  set shortSessionId(shortSessionId: string | null) {
    this._shortSessionId = shortSessionId
    setStoredItem(DEBUG_SESSION_SHORT_ID_PROP_NAME, shortSessionId)
  }

  private _continuesDebugging: boolean = false
  get continuesDebugging(): boolean {
    return this._continuesDebugging
  }
  set continuesDebugging(continuesDebugging: boolean) {
    this._continuesDebugging = continuesDebugging
    this._apiService.updateConfigs({ continuesDebugging })
    this._sessionWidget.updateContinuousDebuggingState(continuesDebugging)
    messagingService.sendMessage('continuous-debugging', continuesDebugging)
    setStoredItem(DEBUG_SESSION_CONTINUE_DEBUGGING_PROP_NAME, continuesDebugging)
  }

  get debugSessionType(): DebugSessionType {
    return this.continuesDebugging ? DebugSessionType.CONTINUOUS : DebugSessionType.PLAIN
  }

  private _sessionState: SessionState | null = null
  get sessionState(): SessionState | null {
    return this._sessionState || SessionState.stopped
  }
  set sessionState(state: SessionState | null) {
    this._sessionState = state
    this._sessionWidget.updateState(this._sessionState, this.continuesDebugging)
    messagingService.sendMessage('state-change', this._sessionState)
    setStoredItem(DEBUG_SESSION_STATE_PROP_NAME, state)
  }

  private _session: IDebugSession | null = null
  get session(): IDebugSession | null {
    return this._session
  }
  set session(session: IDebugSession | null) {
    this._session = session
    setStoredItem(DEBUG_SESSION_PROP_NAME, this._session)
  }

  private _sessionAttributes: Record<string, any> | null = null
  get sessionAttributes(): Record<string, any> {
    return this._sessionAttributes || {}
  }
  set sessionAttributes(attributes: Record<string, any> | null) {
    this._sessionAttributes = attributes
  }
  /**
   * Error message getter and setter to reflect on the session widget
   */
  public get error(): string {
    return this._sessionWidget.error
  }

  public set error(v: string) {
    this._sessionWidget.error = v
  }

  /**
   * Returns the HTML button element for the session widget's recorder button.
   *
   * This element is used to control the start/stop recording functionality in the session widget UI.
   *
   * @returns {HTMLButtonElement} The recorder button element from the session widget.
   */
  public get sessionWidgetButtonElement(): HTMLButtonElement {
    return this._sessionWidget.recorderButton
  }
  /**
   * Initialize debugger with default or custom configurations
   */
  constructor() {
    const sessionLocal = getStoredItem(DEBUG_SESSION_PROP_NAME, true)
    const sessionIdLocal = getStoredItem(DEBUG_SESSION_ID_PROP_NAME)
    const sessionStateLocal = getStoredItem(DEBUG_SESSION_STATE_PROP_NAME)
    const shortSessionIdLocal = getStoredItem(DEBUG_SESSION_SHORT_ID_PROP_NAME)
    const continuesDebuggingLocal = getStoredItem(DEBUG_SESSION_CONTINUE_DEBUGGING_PROP_NAME, true)

    if (isSessionActive(sessionLocal, continuesDebuggingLocal)) {
      this.session = sessionLocal
      this.sessionId = sessionIdLocal
      this.sessionState = sessionStateLocal
      this.shortSessionId = shortSessionIdLocal
      this.continuesDebugging = continuesDebuggingLocal
    } else {
      this.session = null
      this.sessionId = null
      this.sessionState = null
      this.shortSessionId = null
      this.continuesDebugging = false
    }

    this._configs = {
      ...BASE_CONFIG,
      apiKey: this.session?.tempApiKey || '',
    }
  }

  /**
   * Initialize the session debugger
   * @param configs - custom configurations for session debugger
   */
  public init(configs: SessionDebuggerOptions): void {
    this._configs = {
      ...this._configs, ...configs,
      masking: { ...this._configs.masking, ...(configs.masking || {}) }
    }
    this._isInitialized = true
    this._checkOperation('init')

    setMaxCapturingHttpPayloadSize(this._configs.maxCapturingHttpPayloadSize)
    setShouldRecordHttpData(!this._configs.disableCapturingHttpPayload)

    const { apiKey, exporterApiBaseUrl, usePostMessageFallback } = this._configs

    this._tracer.init(this._configs)
    this._sessionWidget.init(this._configs)
    this._apiService.init({
      apiKey,
      exporterApiBaseUrl,
      usePostMessageFallback,
      continuesDebugging: this.continuesDebugging,
    })

    if (this._configs.apiKey) {
      this._recorder.init(this._configs)
    }

    if (this._sessionId && this.sessionState === SessionState.started) {
      if (this.session) {
        this._recorder.subscribeToSession(this.session)
      }
      this._start()
    }

    this._registerWidgetEvents()
    this._registerSessionLimitReach()
    this._registerSessionAutoCreation()
    messagingService.sendMessage('state-change', this.sessionState)
  }


  /**
   * Save the continuous debugging session
   */
  public async save(): Promise<any> {
    try {
      this._checkOperation('save')
      this._sessionWidget.updateSaveContinuousDebugSessionState(
        ContinuousDebuggingSaveButtonState.SAVING,
      )
      const res = await this._apiService.saveContinuousDebugSession(
        this._sessionId!,
        {
          attributes: this.sessionAttributes,
          resourceAttributes: getNavigatorInfo(),
          stoppedAt: this._recorder.stoppedAt,
          name: this.sessionAttributes.userName
            ? `${this.sessionAttributes.userName}'s session on ${getFormattedDate(
              Date.now(),
              { month: 'short', day: 'numeric' },
            )}`
            : `Session on ${getFormattedDate(Date.now())}`,
        },
      )

      this._sessionWidget.updateSaveContinuousDebugSessionState(
        ContinuousDebuggingSaveButtonState.SAVED,
      )

      const sessionUrl = res?.url
      this._sessionWidget.showToast(
        'Your session was saved',
        sessionUrl,
        5000,
      )

      return res
    } catch (error: any) {
      this.error = error.message
      this._sessionWidget.updateSaveContinuousDebugSessionState(
        ContinuousDebuggingSaveButtonState.ERROR,
      )
    } finally {
      setTimeout(() => {
        this._sessionWidget.updateSaveContinuousDebugSessionState(
          ContinuousDebuggingSaveButtonState.IDLE,
        )
      }, 3000)
    }
  }

  /**
   * Start a new session
   * @param type - the type of session to start
   * @param session - the session to start
   */
  public start(type: DebugSessionType, session?: IDebugSession): void {
    this._checkOperation('start')
    this.continuesDebugging = type === DebugSessionType.CONTINUOUS
    this._startRequestController = new AbortController()
    if (session) {
      this._setupSessionAndStart(session, true)
    } else {
      this._createSessionAndStart()
    }
  }
  /**
   * Stop the current session with an optional comment
   * @param comment - user-provided comment to include in session feedback metadata
   */
  public async stop(comment?: string): Promise<void> {
    try {
      this._checkOperation('stop')
      this._stop()
      if (this.continuesDebugging) {
        await this._apiService.stopContinuousDebugSession(this._sessionId!)
        this.continuesDebugging = false
      } else {
        const request: StopSessionRequest = {
          feedbackMetadata: comment ? { comment } : undefined,
          stoppedAt: this._recorder.stoppedAt,
        }
        const response = await this._apiService.stopSession(this._sessionId!, request)
        recorderEventBus.emit(SESSION_RESPONSE, response)
      }
      this._clearSession()
    } catch (error: any) {
      this.error = error.message
    }
  }

  /**
   * Cancel the current session
   */
  public async cancel(): Promise<void> {
    try {
      this._checkOperation('cancel')
      this._stop()
      if (this.continuesDebugging) {
        await this._apiService.stopContinuousDebugSession(this._sessionId!)
        this.continuesDebugging = false
      } else {
        await this._apiService.cancelSession(this._sessionId!)
      }
      this._clearSession()
    } catch (error: any) {
      this.error = error.message
    }
  }

  /**
   * Pause the current session
   */
  public async pause(): Promise<void> {
    try {
      this._checkOperation('pause')
      this._pause()
    } catch (error: any) {
      this.error = error.message
    }
  }

  /**
   * Set the session attributes
   * @param attributes - the attributes to set
   */
  public setSessionAttributes(attributes: Record<string, any>): void {
    this._sessionAttributes = attributes
  }

  /**
   * Updates the button click handler in the library.
   * @param handler - A function that will be invoked when the button is clicked.
   *                  The function receives the click event as its parameter and
   *                  should return `false` to prevent the default button action,
   *                  or `true` (or nothing) to allow it.
   */
  public set recordingButtonClickHandler(handler: () => boolean | void) {
    this._sessionWidget.buttonClickExternalHandler = handler
  }

  /**
   * Register session widget event listeners for controlling session actions
   */
  private _registerWidgetEvents(): void {
    this._sessionWidget.on('toggle', (state: boolean, comment?: string) => {
      this.error = ''
      if (state) {
        this.start(DebugSessionType.PLAIN)
      } else {
        this.stop(comment?.trim())
      }
    })

    this._sessionWidget.on('pause', () => {
      this.error = ''
      this.pause()
    })

    this._sessionWidget.on('cancel', () => {
      this.error = ''
      this.cancel()
    })

    this._sessionWidget.on('continuous-debugging', (enabled: boolean) => {
      this.error = ''
      if (enabled) {
        this.start(DebugSessionType.CONTINUOUS)
      } else {
        this.stop()
      }
    })

    this._sessionWidget.on('save', () => {
      this.error = ''
      this.save()
    })
  }

  /**
   * Register session limit reaching listeners for controlling session end
   */
  private _registerSessionLimitReach() {
    recorderEventBus.on(DEBUG_SESSION_STOPPED_EVENT, () => {
      this._stop()
      this._clearSession()
      this._sessionWidget.handleUIReseting()
    })
  }

  /**
   * Register session auto creation listeners during continuous debugging
   */
  private _registerSessionAutoCreation() {
    recorderEventBus.on(DEBUG_SESSION_AUTO_CREATED, (payload) => {
      this._sessionWidget.showToast(
        'Your session was auto-saved due to an error',
        payload?.data?.url,
        10000,
      )
    })
  }

  /**
   * Create a new session and start it
   */
  private async _createSessionAndStart(): Promise<void> {
    const resourceAttributes = getNavigatorInfo()
    const attributes = this.sessionAttributes
    const signal = this._startRequestController?.signal
    try {
      const payload = {
        attributes,
        // TODO: add lib version here
        resourceAttributes,
        name: attributes.userName
          ? `${attributes.userName}'s session on ${getFormattedDate(Date.now(), { month: 'short', day: 'numeric' })}`
          : `Session on ${getFormattedDate(Date.now())}`,
      }
      const request: StartSessionRequest = !this.continuesDebugging ?
        payload : { debugSessionData: payload }

      const session = this.continuesDebugging
        ? await this._apiService.startContinuousDebugSession(request, signal)
        : await this._apiService.startSession(request, signal)

      if (session) {
        session.debugSessionType = this.continuesDebugging
          ? DebugSessionType.CONTINUOUS
          : DebugSessionType.PLAIN
        this._setupSessionAndStart(session, false)
      }
    } catch (error: any) {
      this.error = error.message
      if (this.continuesDebugging) {
        this.continuesDebugging = false
      }
    }
  }

  /**
   * Start tracing and recording for the session
   */
  private _start(): void {
    const debugSessionType = this.continuesDebugging
      ? DebugSessionType.CONTINUOUS
      : DebugSessionType.PLAIN
    this._tracer.start(this._shortSessionId, debugSessionType)
    this._recorder.start(this._sessionId, debugSessionType)
    this.sessionState = SessionState.started
    if (this.session) {
      recorderEventBus.emit(DEBUG_SESSION_STARTED_EVENT, this.session)
      this._sessionWidget.seconds = getTimeDifferenceInSeconds(this.session?.startedAt)
    }
  }

  /**
   * Stop tracing and recording for the session
   */
  private _stop(): void {
    this._tracer.stop()
    this._recorder.stop()
    this._recorder.clearStoredEvents()
    this.sessionState = SessionState.stopped
  }

  /**
   * Pause the session tracing and recording
   */
  private _pause(): void {
    this._tracer.stop()
    this._recorder.stop()
    this.sessionState = SessionState.paused
  }

  private _setupSessionAndStart(session: IDebugSession, configureExporters: boolean = true): void {
    if (configureExporters && session.tempApiKey) {
      this._configs.apiKey = session.tempApiKey
      this._recorder.init(this._configs)
      this._tracer.addBatchSpanExporter(session.tempApiKey)
      this._apiService.updateConfigs({ apiKey: this._configs.apiKey })
    }

    this._recorder.subscribeToSession(session)
    this._setSession(session)
    this._start()
  }

  /**
   * Set the session ID in localStorage
   * @param sessionId - the session ID to set or clear
   * @param shortSessionId - the short session ID to set or clear
   */
  private _setSession(
    session: IDebugSession,
  ): void {
    this.session = { ...session, startedAt: session.startedAt || new Date().toISOString() }
    this.sessionId = session?._id
    this.shortSessionId = session?.shortId || session?._id
  }

  private _clearSession(): void {
    this.session = null
    this.sessionId = null
    this.shortSessionId = null
    this.sessionState = SessionState.stopped
  }

  /**
   * Check the operation validity based on the session state and action
   * @param action - action being checked ('init', 'start', 'stop', 'cancel', 'pause')
   */
  private _checkOperation(
    action:
      | 'init'
      | 'start'
      | 'stop'
      | 'cancel'
      | 'pause'
      | 'save',
    payload?: any,
  ): void {
    if (!this._isInitialized) {
      throw new Error(
        'Configuration not initialized. Call init() before performing any actions.',
      )
    }
    switch (action) {
      case 'start':
        if (this.sessionState === SessionState.started) {
          throw new Error('Session is already started.')
        }
        break
      case 'stop':
        if (this.sessionState !== SessionState.paused) {
          throw new Error('Cannot stop. Session is not currently started.')
        }
        break
      case 'cancel':
        if (this.sessionState === SessionState.stopped) {
          throw new Error('Cannot cancel. Session has already been stopped.')
        }
        break
      case 'pause':
        if (this.sessionState !== SessionState.started) {
          throw new Error('Cannot pause. Session is not running.')
        }
        break
      case 'save':
        if (!this.continuesDebugging) {
          throw new Error('Cannot save continuous debugging session. Continuous debugging is not enabled.')
        }
        if (this.sessionState !== SessionState.started) {
          throw new Error('Cannot save continuous debugging session. Session is not started.')
        }
        break
    }
  }
}