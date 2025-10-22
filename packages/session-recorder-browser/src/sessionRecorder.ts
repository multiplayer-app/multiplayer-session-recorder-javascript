import { TracerBrowserSDK } from './otel'
import { RecorderBrowserSDK } from './rrweb'
import {
  getStoredItem,
  setStoredItem,
  getNavigatorInfo,
  getFormattedDate,
  getTimeDifferenceInSeconds,
  isSessionActive,
} from './utils'
import {
  SessionState,
  ISession,
  SessionRecorderOptions,
  SessionRecorderConfigs,
  SessionRecorderEvents,
} from './types'

import {
  BASE_CONFIG,
  SESSION_RESPONSE,
  SESSION_PROP_NAME,
  SESSION_ID_PROP_NAME,
  SESSION_TYPE_PROP_NAME,
  SESSION_STATE_PROP_NAME,
  SESSION_CONTINUOUS_DEBUGGING_PROP_NAME,
  DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE,
  getSessionRecorderConfig,
  SESSION_AUTO_CREATED,
  SESSION_STOPPED_EVENT,
  SESSION_STARTED_EVENT,
} from './config'

import {
  setShouldRecordHttpData,
  setMaxCapturingHttpPayloadSize,
} from './patch/xhr'
import { recorderEventBus } from './eventBus'
import { SessionWidget } from './sessionWidget'
import messagingService from './services/messaging.service'
import { ApiService, StartSessionRequest, StopSessionRequest } from './services/api.service'

import './index.scss'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { ContinuousRecordingSaveButtonState } from './sessionWidget/buttonStateConfigs'
import { ISessionRecorder } from './types'
import { Observable } from 'lib0/observable'



export class SessionRecorder extends Observable<SessionRecorderEvents> implements ISessionRecorder {

  private _configs: SessionRecorderConfigs
  private _apiService = new ApiService()
  private _tracer = new TracerBrowserSDK()
  private _recorder = new RecorderBrowserSDK()
  private _sessionWidget = new SessionWidget()
  private _startRequestController: AbortController | null = null

  private _isInitialized = false
  get isInitialized(): boolean {
    return this._isInitialized
  }
  // Session ID and state are stored in localStorage
  private _sessionId: string | null = null
  get sessionId(): string | null {
    return this._sessionId
  }
  set sessionId(sessionId: string | null) {
    this._sessionId = sessionId
    setStoredItem(SESSION_ID_PROP_NAME, sessionId)
  }

  private _sessionType: SessionType = SessionType.PLAIN
  get sessionType(): SessionType {
    return this._sessionType
  }
  set sessionType(sessionType: SessionType) {
    this._sessionType = sessionType
    const continuousRecording = sessionType === SessionType.CONTINUOUS
    this._sessionWidget.updateContinuousRecordingState(continuousRecording)
    messagingService.sendMessage('continuous-debugging', continuousRecording)
    setStoredItem(SESSION_TYPE_PROP_NAME, sessionType)
  }


  get continuousRecording(): boolean {
    return this.sessionType === SessionType.CONTINUOUS
  }

  private _sessionState: SessionState | null = null
  get sessionState(): SessionState | null {
    return this._sessionState || SessionState.stopped
  }
  set sessionState(state: SessionState | null) {
    this._sessionState = state
    this._sessionWidget.updateState(this._sessionState, this.continuousRecording)
    messagingService.sendMessage('state-change', this._sessionState)
    setStoredItem(SESSION_STATE_PROP_NAME, state)
    // Emit observable event to support React wrapper
    this.emit('state-change', [this._sessionState || SessionState.stopped, this.sessionType])
  }

  private _session: ISession | null = null
  get session(): ISession | null {
    return this._session
  }
  set session(session: ISession | null) {
    this._session = session
    setStoredItem(SESSION_PROP_NAME, this._session)
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
    super()
    const sessionLocal = getStoredItem(SESSION_PROP_NAME, true)
    const sessionIdLocal = getStoredItem(SESSION_ID_PROP_NAME)
    const sessionStateLocal = getStoredItem(SESSION_STATE_PROP_NAME)
    const sessionTypeLocal = getStoredItem(SESSION_TYPE_PROP_NAME)
    const continuousRecordingLocal = getStoredItem(SESSION_CONTINUOUS_DEBUGGING_PROP_NAME, true)

    if (isSessionActive(sessionLocal, continuousRecordingLocal)) {
      this.session = sessionLocal
      this.sessionId = sessionIdLocal
      this.sessionType = sessionTypeLocal
      this.sessionState = sessionStateLocal
    } else {
      this.session = null
      this.sessionId = null
      this.sessionState = null
      this.sessionType = SessionType.PLAIN
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
  public init(configs: SessionRecorderOptions): void {
    this._configs = getSessionRecorderConfig({ ...this._configs, ...configs })

    this._isInitialized = true
    this._checkOperation('init')

    setMaxCapturingHttpPayloadSize(this._configs.maxCapturingHttpPayloadSize || DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE)
    setShouldRecordHttpData(!this._configs.captureBody, this._configs.captureHeaders)


    this._tracer.init(this._configs)
    this._apiService.init(this._configs)
    this._sessionWidget.init(this._configs)

    if (this._configs.apiKey) {
      this._recorder.init(this._configs)
    }

    if (this.sessionId && (this.sessionState === SessionState.started || this.sessionState === SessionState.paused)) {
      this._start()
    }

    this._registerWidgetEvents()
    this._registerSessionLimitReach()
    this._registerSessionAutoCreation()
    messagingService.sendMessage('state-change', this.sessionState)
    // Emit init observable event
    this.emit('init', [])
  }


  /**
   * Save the continuous recording session
   */
  public async save(): Promise<any> {
    try {
      this._checkOperation('save')
      if (!this.continuousRecording || !this._configs.showContinuousRecording) {
        return
      }
      this._sessionWidget.updateSaveContinuousDebugSessionState(
        ContinuousRecordingSaveButtonState.SAVING,
      )
      const res = await this._apiService.saveContinuousDebugSession(
        this.sessionId!,
        {
          sessionAttributes: this.sessionAttributes,
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
        ContinuousRecordingSaveButtonState.SAVED,
      )

      const sessionUrl = res?.url
      this._sessionWidget.showToast(
        {
          type: 'success',
          message: 'Your session was saved',
          button: {
            text: 'Open session', url: sessionUrl,
          },
        },
        5000,
      )

      return res
    } catch (error: any) {
      this.error = error.message
      this._sessionWidget.updateSaveContinuousDebugSessionState(
        ContinuousRecordingSaveButtonState.ERROR,
      )
    } finally {
      setTimeout(() => {
        this._sessionWidget.updateSaveContinuousDebugSessionState(
          ContinuousRecordingSaveButtonState.IDLE,
        )
      }, 3000)
    }
  }

  /**
   * Start a new session
   * @param type - the type of session to start
   * @param session - the session to start
   */
  public start(type: SessionType = SessionType.PLAIN, session?: ISession): void {
    this._checkOperation('start')
    // If continuous recording is disabled, force plain mode
    if (type === SessionType.CONTINUOUS && !this._configs.showContinuousRecording) {
      type = SessionType.PLAIN
    }
    this.sessionType = type
    this._startRequestController = new AbortController()
    if (session) {
      this._setupSessionAndStart(session, true)
    } else {
      this._createSessionAndStart()
    }
  }
  /**
   * Stop the current session with an optional comment
   * @param comment - user-provided comment to include in session session attributes
   */
  public async stop(comment?: string): Promise<void> {
    try {
      this._checkOperation('stop')
      this._stop()
      if (this.continuousRecording) {
        await this._apiService.stopContinuousDebugSession(this.sessionId!)
        this.sessionType = SessionType.PLAIN
      } else {
        const request: StopSessionRequest = {
          sessionAttributes: { comment },
          stoppedAt: this._recorder.stoppedAt,
        }
        const response = await this._apiService.stopSession(this.sessionId!, request)
        recorderEventBus.emit(SESSION_RESPONSE, response)
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
   * Resume the current session
   */
  public async resume(): Promise<void> {
    try {
      this._checkOperation('resume')
      this._resume()
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
      if (this.continuousRecording) {
        await this._apiService.stopContinuousDebugSession(this.sessionId!)
        this.sessionType = SessionType.PLAIN
      } else {
        await this._apiService.cancelSession(this.sessionId!)
      }
      this._clearSession()
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
   * @description Check if session should be started/stopped automatically
   * @param {ISession} [sessionPayload]
   * @returns {Promise<void>}
   */
  public async checkRemoteContinuousSession(
    sessionPayload?: Omit<ISession, '_id' | 'shortId'>,
  ): Promise<void> {
    this._checkOperation('autoStartRemoteContinuousSession')
    if (!this._configs.showContinuousRecording) {
      return
    }
    const payload = {
      sessionAttributes: {
        ...this.sessionAttributes,
        ...(sessionPayload?.sessionAttributes || {}),
      },
      resourceAttributes: {
        ...getNavigatorInfo(),
        ...(sessionPayload?.resourceAttributes || {}),
      },
    }

    const { state } = await this._apiService.checkRemoteSession(payload)

    if (state == 'START') {
      if (this.sessionState !== SessionState.started) {
        await this.start(SessionType.CONTINUOUS)
      }
    } else if (state == 'STOP') {
      if (this.sessionState !== SessionState.stopped) {
        await this.stop()
      }
    }
  }


  /**
   * Register session widget event listeners for controlling session actions
   */
  private _registerWidgetEvents(): void {
    this._sessionWidget.on('toggle', (state: boolean, comment?: string) => {
      this.error = ''
      if (state) {
        this.start(SessionType.PLAIN)
      } else {
        this.stop(comment?.trim())
      }
    })

    this._sessionWidget.on('pause', () => {
      this.error = ''
      this.pause()
    })

    this._sessionWidget.on('resume', () => {
      this.error = ''
      this.resume()
    })

    this._sessionWidget.on('cancel', () => {
      this.error = ''
      this.cancel()
    })

    this._sessionWidget.on('continuous-debugging', (enabled: boolean) => {
      this.error = ''
      if (enabled) {
        this.start(SessionType.CONTINUOUS)
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
    recorderEventBus.on(SESSION_STOPPED_EVENT, () => {
      this._stop()
      this._clearSession()
      this._sessionWidget.handleUIReseting()
    })
  }

  /**
   * Register session auto creation listeners during continuous recording
   */
  private _registerSessionAutoCreation() {
    recorderEventBus.on(SESSION_AUTO_CREATED, (payload) => {
      if (!payload?.data) return
      this._sessionWidget.showToast(
        {
          type: 'success',
          message: 'Your session was auto-saved due to an error',
          button: {
            text: 'Open session',
            url: payload?.data?.url,
          },
        },
        5000,
      )
    })
  }

  /**
   * Create a new session and start it
   */
  private async _createSessionAndStart(): Promise<void> {
    const signal = this._startRequestController?.signal
    try {
      const payload = {
        sessionAttributes: this.sessionAttributes,
        resourceAttributes: getNavigatorInfo(),
        name: this.sessionAttributes.userName
          ? `${this.sessionAttributes.userName}'s session on ${getFormattedDate(Date.now(), { month: 'short', day: 'numeric' })}`
          : `Session on ${getFormattedDate(Date.now())}`,
      }
      const request: StartSessionRequest = !this.continuousRecording ?
        payload : { debugSessionData: payload }

      const session = this.continuousRecording
        ? await this._apiService.startContinuousDebugSession(request, signal)
        : await this._apiService.startSession(request, signal)

      if (session) {
        session.sessionType = this.continuousRecording
          ? SessionType.CONTINUOUS
          : SessionType.PLAIN
        this._setupSessionAndStart(session, false)
      }
    } catch (error: any) {
      this.error = error.message
      if (this.continuousRecording) {
        this.sessionType = SessionType.PLAIN
      }
    }
  }

  /**
   * Start tracing and recording for the session
   */
  private _start(): void {
    this.sessionState = SessionState.started
    this.sessionType = this.sessionType

    this._tracer.start(this.sessionId, this.sessionType)
    this._recorder.start(this.sessionId, this.sessionType)
    if (this.session) {
      recorderEventBus.emit(SESSION_STARTED_EVENT, this.session)
      this._recorder.subscribeToSession(this.session)
      this._sessionWidget.seconds = getTimeDifferenceInSeconds(this.session?.startedAt)
    }
  }

  /**
   * Stop tracing and recording for the session
   */
  private _stop(): void {
    this.sessionState = SessionState.stopped
    this._tracer.stop()
    this._recorder.stop()
  }

  /**
   * Pause the session tracing and recording
   */
  private _pause(): void {
    this._tracer.stop()
    this._recorder.stop()
    this.sessionState = SessionState.paused
  }

  /**
   * Resume the session tracing and recording
   */
  private _resume(): void {
    this._tracer.start(this.sessionId, this.sessionType)
    this._recorder.start(this.sessionId, this.sessionType)
    this.sessionState = SessionState.started
  }

  private _setupSessionAndStart(session: ISession, configureExporters: boolean = true): void {
    if (configureExporters && session.tempApiKey) {
      this._configs.apiKey = session.tempApiKey
      this._recorder.init(this._configs)
      this._tracer.setApiKey(session.tempApiKey)
      this._apiService.updateConfigs({ apiKey: this._configs.apiKey })
    }

    this._setSession(session)
    this._start()
  }

  /**
   * Set the session ID in localStorage
   * @param sessionId - the session ID to set or clear
   */
  private _setSession(
    session: ISession,
  ): void {
    this.session = { ...session, startedAt: session.startedAt || new Date().toISOString() }
    this.sessionId = session?.shortId || session?._id
  }

  private _clearSession(): void {
    this.session = null
    this.sessionId = null
    this.sessionState = SessionState.stopped
  }

  /**
   * Check the operation validity based on the session state and action
   * @param action - action being checked ('init', 'start', 'stop', 'cancel', 'pause', 'resume')
   */
  private _checkOperation(
    action:
      | 'init'
      | 'start'
      | 'stop'
      | 'cancel'
      | 'pause'
      | 'resume'
      | 'save'
      | 'autoStartRemoteContinuousSession',
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
        if (this.sessionState !== SessionState.paused && this.sessionState !== SessionState.started) {
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
      case 'resume':
        if (this.sessionState !== SessionState.paused) {
          throw new Error('Cannot resume. Session is not paused.')
        }
        break
      case 'save':
        if (!this.continuousRecording) {
          throw new Error('Cannot save continuous recording session. Continuous recording is not enabled.')
        }
        if (this.sessionState !== SessionState.started) {
          throw new Error('Cannot save continuous recording session. Session is not started.')
        }
        break
      case 'autoStartRemoteContinuousSession':
        if (this.sessionState !== SessionState.stopped) {
          throw new Error('Cannot start remote continuous session. Session is not stopped.')
        }
        break
    }
  }
}
