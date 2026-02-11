import { Observable } from 'lib0/observable'

import { SessionType, type ISession, type IUserAttributes } from '@multiplayer-app/session-recorder-common'

import { TracerBrowserSDK } from './otel'
import { RecorderBrowserSDK } from './rrweb'
import {
  getStoredItem,
  setStoredItem,
  getNavigatorInfo,
  getFormattedDate,
  getTimeDifferenceInSeconds,
  isSessionActive,
  getOrCreateTabId
} from './utils'

import { SessionState, SessionRecorderOptions, SessionRecorderConfigs, SessionRecorderEvents } from './types'

import {
  BASE_CONFIG,
  SESSION_RESPONSE,
  SESSION_PROP_NAME,
  SESSION_ID_PROP_NAME,
  SESSION_TYPE_PROP_NAME,
  SESSION_STATE_PROP_NAME,
  DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE,
  getSessionRecorderConfig,
  SESSION_AUTO_CREATED,
  SESSION_STOPPED_EVENT,
  SESSION_STARTED_EVENT,
  REMOTE_SESSION_RECORDING_START,
  REMOTE_SESSION_RECORDING_STOP,
  SESSION_SAVE_BUFFER_EVENT
} from './config'

import { setShouldRecordHttpData, setMaxCapturingHttpPayloadSize } from './patch'
import { recorderEventBus } from './eventBus'
import { SessionWidget } from './sessionWidget'
import messagingService from './services/messaging.service'
import { ApiService, StartSessionRequest, StopSessionRequest } from './services/api.service'
import { SocketService } from './services/socket.service'
import { IndexedDBService } from './services/indexedDb.service'
import { CrashBufferService } from './services/crashBuffer.service'

import { ContinuousRecordingSaveButtonState } from './sessionWidget/buttonStateConfigs'
import { ISessionRecorder } from './types'
import { NavigationRecorder, NavigationRecorderPublicApi } from './navigation'

export class SessionRecorder extends Observable<SessionRecorderEvents> implements ISessionRecorder {
  private _configs: SessionRecorderConfigs
  private _apiService = new ApiService()
  private _socketService = new SocketService()
  private _tracer = new TracerBrowserSDK()
  private _recorder = new RecorderBrowserSDK()
  private _sessionWidget = new SessionWidget()
  private _navigationRecorder = new NavigationRecorder()
  private _startRequestController: AbortController | null = null
  private _tabId: string = getOrCreateTabId()
  private _bufferDb = new IndexedDBService()
  private _crashBuffer: CrashBufferService | null = null
  private _isFlushingBuffer: boolean = false
  private _bufferLifecycleHandlersRegistered = false

  public get navigation(): NavigationRecorderPublicApi {
    return this._navigationRecorder.api
  }

  private _isInitialized = false
  get isInitialized(): boolean {
    return this._isInitialized
  }
  // Session ID and state are stored in sessionStorage (with fallback) to avoid multi-tab conflicts
  private _sessionId: string | null = null
  get sessionId(): string | null {
    return this._sessionId
  }
  set sessionId(sessionId: string | null) {
    this._sessionId = sessionId
    setStoredItem(SESSION_ID_PROP_NAME, sessionId)
  }

  private _sessionType: SessionType = SessionType.MANUAL
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

  private _userAttributes: IUserAttributes | null = null
  get userAttributes(): IUserAttributes | null {
    return this._userAttributes
  }
  set userAttributes(userAttributes: IUserAttributes | null) {
    this._userAttributes = userAttributes
  }
  /**
   * Error message getter and setter
   */
  private _error: string = ''
  public get error(): string {
    return this._error
  }

  public set error(v: string) {
    this._error = v
    this._sessionWidget.error = v
    this.emit('error', [v])
  }

  /**
   * Returns the HTML button element for the session widget's recorder button.
   *
   * This element is used to control the start/stop recording functionality in the session widget UI.
   *
   * @returns {HTMLButtonElement | null} The recorder button element from the session widget.
   */
  public get sessionWidgetButtonElement(): HTMLButtonElement | null {
    return this._sessionWidget.recorderButton
  }

  /**
   * Initialize debugger with default or custom configurations
   */
  constructor() {
    super()
    // Safety: avoid accessing storage in SSR/non-browser environments
    const isBrowser = typeof window !== 'undefined'
    const sessionLocal = isBrowser ? getStoredItem(SESSION_PROP_NAME, true) : null
    const sessionIdLocal = isBrowser ? getStoredItem(SESSION_ID_PROP_NAME) : null
    const sessionStateLocal = isBrowser ? getStoredItem(SESSION_STATE_PROP_NAME) : null
    const sessionTypeLocal = isBrowser ? getStoredItem(SESSION_TYPE_PROP_NAME) : null

    if (isSessionActive(sessionLocal, sessionTypeLocal)) {
      this.session = sessionLocal
      this.sessionId = sessionIdLocal
      this.sessionType = sessionTypeLocal
      this.sessionState = sessionStateLocal
    } else {
      this.session = null
      this.sessionId = null
      this.sessionState = null
      this.sessionType = SessionType.MANUAL
    }

    this._configs = {
      ...BASE_CONFIG,
      apiKey: this.session?.tempApiKey || ''
    }
  }

  /**
   * Initialize the session debugger
   * @param configs - custom configurations for session debugger
   */
  public init(configs: SessionRecorderOptions): void {
    if (typeof window === 'undefined') {
      return
    }
    this._configs = getSessionRecorderConfig({ ...this._configs, ...configs })

    this._isInitialized = true
    this._checkOperation('init')

    // GC: remove orphaned crash buffers from old tabs.
    // Keep TTL large to avoid any accidental data loss.
    void this._bufferDb.sweepStaleTabs(24 * 60 * 60 * 1000)

    setMaxCapturingHttpPayloadSize(this._configs.maxCapturingHttpPayloadSize || DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE)
    setShouldRecordHttpData(this._configs.captureBody, this._configs.captureHeaders)

    this._setupCrashBuffer()
    this._tracer.init(this._configs)

    this._apiService.init(this._configs)
    this._sessionWidget.init(this._configs)
    this._socketService.init({
      apiKey: this._configs.apiKey,
      clientId: this._tracer.clientId,
      socketUrl: this._configs.apiBaseUrl || '',
      keepAlive: Boolean(this._configs.useWebsocket),
      usePostMessageFallback: Boolean(this._configs.usePostMessageFallback)
    })

    this._navigationRecorder.init({
      version: this._configs.version,
      application: this._configs.application,
      environment: this._configs.environment,
      enabled: this._configs.recordNavigation
    })

    if (this._configs.apiKey) {
      this._recorder.init(this._configs, this._socketService)
    }

    if (this.sessionId && (this.sessionState === SessionState.started || this.sessionState === SessionState.paused)) {
      this._start()
    } else {
      // Buffer-only recording when there is no active debug session.
      this._startBufferOnlyRecording()
    }

    this._registerWidgetEvents()
    this._registerSocketServiceListeners()
    messagingService.sendMessage('state-change', this.sessionState)
    // Emit init observable event
    this.emit('init', [this])
  }

  private _setupCrashBuffer(): void {
    if (this._configs.buffering?.enabled) {
      const windowMinutes = this._configs.buffering.windowMinutes || 0.5
      const windowMs = Math.max(10_000, windowMinutes * 60 * 1000)
      this._crashBuffer = new CrashBufferService(this._bufferDb, this._tabId, windowMs)
      this._recorder.setCrashBuffer(this._crashBuffer)
      this._tracer.setCrashBuffer(this._crashBuffer)

      this._crashBuffer.on('error-span-appended', (payload) => {
        if (this.sessionState !== SessionState.stopped || this.sessionId) return
        if (!payload.span) return
        this._createExceptionSession(payload.span)
      })
      this._registerCrashBufferLifecycleHandlers()
    }
  }

  private _registerCrashBufferLifecycleHandlers(): void {
    if (this._bufferLifecycleHandlersRegistered) return
    if (typeof window === 'undefined') return
    if (typeof document === 'undefined') return
    if (!this._crashBuffer) return

    this._bufferLifecycleHandlersRegistered = true

    const update = () => this._updateCrashBufferActiveState()
    window.addEventListener('focus', update, { passive: true })
    window.addEventListener('blur', update, { passive: true })
    document.addEventListener('visibilitychange', update, { passive: true })

    // Set initial state.
    update()
  }

  private _updateCrashBufferActiveState(): void {
    if (!this._crashBuffer) return
    if (typeof document === 'undefined') return

    let hasFocus = true
    try {
      hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true
    } catch (_e) {
      hasFocus = true
    }

    const isVisible = document.visibilityState === 'visible' && !document.hidden
    const active = isVisible && hasFocus

    this._crashBuffer.setActive(active)
    if (active && this._crashBuffer.needsFullSnapshot()) {
      // If the buffer was cleared while inactive, the next stored rrweb event must be a FullSnapshot.
      this._recorder.takeFullSnapshot()
    }
  }

  private _startBufferOnlyRecording(): void {
    if (
      this.sessionId ||
      !this._crashBuffer ||
      !this._configs?.buffering?.enabled ||
      this.sessionState !== SessionState.stopped
    ) {
      return
    }
    void this._recorder.restart(null, SessionType.MANUAL)
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
      this._sessionWidget.updateSaveContinuousDebugSessionState(ContinuousRecordingSaveButtonState.SAVING)
      const res = await this._apiService.saveContinuousDebugSession(this.sessionId!, {
        sessionAttributes: this.sessionAttributes,
        resourceAttributes: getNavigatorInfo(),
        stoppedAt: this._recorder.stoppedAt,
        name: this._getSessionName()
      })

      this._sessionWidget.updateSaveContinuousDebugSessionState(ContinuousRecordingSaveButtonState.SAVED)

      const sessionUrl = res?.url
      this._sessionWidget.showToast(
        {
          type: 'success',
          message: 'Your session was saved',
          button: {
            text: 'Open session',
            url: sessionUrl
          }
        },
        5000
      )

      return res
    } catch (error: any) {
      this.error = error.message
      this._sessionWidget.updateSaveContinuousDebugSessionState(ContinuousRecordingSaveButtonState.ERROR)
    } finally {
      setTimeout(() => {
        this._sessionWidget.updateSaveContinuousDebugSessionState(ContinuousRecordingSaveButtonState.IDLE)
      }, 3000)
    }
  }

  /**
   * Start a new session
   * @param type - the type of session to start
   * @param session - the session to start
   */
  public start(type: SessionType = SessionType.MANUAL, session?: ISession): void {
    this._checkOperation('start')
    // If continuous recording is disabled, force plain mode
    if (type === SessionType.CONTINUOUS && !this._configs.showContinuousRecording) {
      type = SessionType.MANUAL
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
        this.sessionType = SessionType.MANUAL
      } else {
        const request: StopSessionRequest = {
          sessionAttributes: { comment },
          stoppedAt: this._recorder.stoppedAt
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
        this.sessionType = SessionType.MANUAL
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
   * Set the user attributes
   * @param userAttributes - the user attributes to set
   */
  public setUserAttributes(userAttributes: IUserAttributes | null): void {
    if (!this._userAttributes && !userAttributes) {
      return
    }
    this._userAttributes = userAttributes

    const data = {
      userAttributes: this._userAttributes,
      clientId: this._tracer.clientId
    }

    this._socketService.setUser(data)
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
   * Capture an exception manually and send it as an error trace.
   */
  public captureException(error: unknown, errorInfo?: Record<string, any>): void {
    try {
      const normalizedError = this._normalizeError(error)
      const normalizedErrorInfo = this._normalizeErrorInfo(errorInfo)
      this._tracer.captureException(normalizedError, normalizedErrorInfo)
    } catch (e: any) {
      this.error = e?.message || 'Failed to capture exception'
    }
  }

  private async _flushBuffer(sessionId: string): Promise<any> {
    if (
      !sessionId ||
      !this._crashBuffer ||
      this._isFlushingBuffer ||
      !this._configs?.buffering?.enabled ||
      this.sessionState !== SessionState.stopped
    ) {
      return null
    }

    this._isFlushingBuffer = true
    try {
      const { events, spans, startedAt, stoppedAt } = await this._crashBuffer.snapshot()
      if (events.length === 0 && spans.length === 0) {
        return null
      }
      await Promise.all([
        this._tracer.exportTraces(spans.map((s) => s.span)),
        this._apiService.exportEvents(sessionId, { events: events.map((e) => e.event) }),
        this._apiService.updateSessionAttributes(sessionId, {
          startedAt: new Date(startedAt).toISOString(),
          stoppedAt: new Date(stoppedAt).toISOString(),
          sessionAttributes: this.sessionAttributes,
          resourceAttributes: getNavigatorInfo(),
          userAttributes: this._userAttributes || undefined
        })
      ])
    } catch (_e) {
      // swallow: flush is best-effort; never throw into app code
    } finally {
      await this._crashBuffer.clear()
      this._isFlushingBuffer = false
    }
  }

  /**
   * @description Check if session should be started/stopped automatically
   * @param {ISession} [sessionPayload]
   * @returns {Promise<void>}
   */
  public async checkRemoteContinuousSession(sessionPayload?: Omit<ISession, '_id' | 'shortId'>): Promise<void> {
    this._checkOperation('autoStartRemoteContinuousSession')
    if (!this._configs.showContinuousRecording) {
      return
    }
    const payload = {
      sessionAttributes: {
        ...this.sessionAttributes,
        ...(sessionPayload?.sessionAttributes || {})
      },
      resourceAttributes: {
        ...getNavigatorInfo(),
        ...(sessionPayload?.resourceAttributes || {})
      },
      userAttributes: this._userAttributes
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
    this._sessionWidget.on('start', () => {
      this.error = ''
      this._handleStart()
    })

    this._sessionWidget.on('stop', (comment?: string) => {
      this.error = ''
      this._handleStop(comment)
    })

    this._sessionWidget.on('pause', () => {
      this.error = ''
      this._handlePause()
    })

    this._sessionWidget.on('resume', () => {
      this.error = ''
      this._handleResume()
    })

    this._sessionWidget.on('cancel', () => {
      this.error = ''
      this._handleCancel()
    })

    this._sessionWidget.on('continuous-debugging', (enabled: boolean) => {
      this.error = ''
      if (enabled) {
        this._handleContinuousDebugging()
      } else {
        this._handleStop()
      }
    })

    this._sessionWidget.on('save', () => {
      this.error = ''
      this._handleSave()
    })
  }

  /**
   * Handle the safe start event
   */
  private _handleStart(): void {
    if (this.sessionState === SessionState.stopped) {
      this.start(SessionType.MANUAL)
    }
  }
  /**
   * Handle the safe stop event
   */
  private _handleStop(comment?: string): void {
    if (this.sessionState === SessionState.started || this.sessionState === SessionState.paused) {
      this.stop(comment)
    }
  }
  /**
   * Handle the safe pause event
   */
  private _handlePause(): void {
    if (this.sessionState === SessionState.started) {
      this.pause()
    }
  }
  /**
   * Handle the safe resume event
   */
  private _handleResume(): void {
    if (this.sessionState === SessionState.paused) {
      this.resume()
    }
  }

  /**
   * Handle the safe cancel event
   */
  private _handleCancel(): void {
    if (this.sessionState === SessionState.started || this.sessionState === SessionState.paused) {
      this.cancel()
    }
  }

  /**
   * Handle the safe save event
   */
  private _handleSave(): void {
    if (this.sessionState === SessionState.started && this.continuousRecording) {
      this.save()
    }
  }

  /**
   * Handle the safe continuous debugging event
   */
  private _handleContinuousDebugging(): void {
    if (this.sessionState === SessionState.stopped) {
      this.start(SessionType.CONTINUOUS)
    }
  }

  /**
   * Register socket service event listeners
   */
  private _registerSocketServiceListeners() {
    this._socketService.on(SESSION_STOPPED_EVENT, () => {
      this._stop()
      this._clearSession()
      this._sessionWidget.handleUIReseting()
    })

    this._socketService.on(SESSION_AUTO_CREATED, (payload: any) => {
      if (!payload?.data) return
      this._sessionWidget.showToast(
        {
          type: 'success',
          message: 'Your session was auto-saved due to an error',
          button: {
            text: 'Open session',
            url: payload?.data?.url
          }
        },
        5000
      )
    })

    this._socketService.on(REMOTE_SESSION_RECORDING_START, (payload: any) => {
      if (this.sessionState === SessionState.stopped) {
        this.start()
      }
    })

    this._socketService.on(REMOTE_SESSION_RECORDING_STOP, (payload: any) => {
      if (this.sessionState !== SessionState.stopped) {
        this.stop()
      }
    })

    this._socketService.on(SESSION_SAVE_BUFFER_EVENT, (payload: any) => {
      this._flushBuffer(payload?.debugSession?._id)
    })
  }

  private async _createExceptionSession(span: any): Promise<void> {
    try {
      const session = await this._apiService.createErrorSession({ span })
      if (session?._id) {
        this._flushBuffer(session._id)
      }
    } catch (_ignored) {}
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
        name: this._getSessionName(),
        ...(this._userAttributes ? { userAttributes: this._userAttributes } : {})
      }
      const request: StartSessionRequest = !this.continuousRecording ? payload : { debugSessionData: payload }

      const session = this.continuousRecording
        ? await this._apiService.startContinuousDebugSession(request, signal)
        : await this._apiService.startSession(request, signal)

      if (session) {
        session.sessionType = this.continuousRecording ? SessionType.CONTINUOUS : SessionType.MANUAL
        this._setupSessionAndStart(session, false)
      }
    } catch (error: any) {
      this.error = error.message
      this.sessionState = SessionState.stopped
      if (this.continuousRecording) {
        this.sessionType = SessionType.MANUAL
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
    // Ensure we switch from buffer-only recording to session recording cleanly.
    void this._recorder.restart(this.sessionId, this.sessionType)
    this._navigationRecorder.start({ sessionId: this.sessionId, sessionType: this.sessionType })

    if (this.session) {
      recorderEventBus.emit(SESSION_STARTED_EVENT, this.session)
      this._socketService.subscribeToSession(this.session)
      this._sessionWidget.seconds = getTimeDifferenceInSeconds(this.session?.startedAt)
    }
  }

  /**
   * Stop tracing and recording for the session
   */
  private _stop(): void {
    this.sessionState = SessionState.stopped
    this._socketService.unsubscribeFromSession(true)
    this._tracer.stop()
    this._recorder.stop()
    this._navigationRecorder.stop()
    this._startBufferOnlyRecording()
  }

  /**
   * Pause the session tracing and recording
   */
  private _pause(): void {
    this._tracer.stop()
    this._recorder.stop()
    this._navigationRecorder.pause()
    this.sessionState = SessionState.paused
  }

  /**
   * Resume the session tracing and recording
   */
  private _resume(): void {
    this._tracer.start(this.sessionId, this.sessionType)
    void this._recorder.restart(this.sessionId, this.sessionType)
    this._navigationRecorder.resume()
    this.sessionState = SessionState.started
  }

  private _setupSessionAndStart(session: ISession, configureExporters: boolean = true): void {
    if (configureExporters && session.tempApiKey) {
      this._configs.apiKey = session.tempApiKey
      this._socketService.updateConfigs({ apiKey: this._configs.apiKey })
      this._recorder.init(this._configs, this._socketService)
      this._tracer.setApiKey(session.tempApiKey)
      this._apiService.updateConfigs({ apiKey: this._configs.apiKey })
    }

    this._setSession(session)
    this._start()
  }

  /**
   * Set the session ID in sessionStorage (with fallback)
   * @param sessionId - the session ID to set or clear
   */
  private _setSession(session: ISession): void {
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
    action: 'init' | 'start' | 'stop' | 'cancel' | 'pause' | 'resume' | 'save' | 'autoStartRemoteContinuousSession',
    payload?: any
  ): void {
    if (!this._isInitialized) {
      throw new Error('Configuration not initialized. Call init() before performing any actions.')
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

  private _normalizeError(error: unknown): Error {
    if (error instanceof Error) return error
    if (typeof error === 'string') return new Error(error)
    try {
      return new Error(JSON.stringify(error))
    } catch (_e) {
      return new Error(String(error))
    }
  }

  private _normalizeErrorInfo(errorInfo?: Record<string, any>): Record<string, any> {
    if (!errorInfo) return {}
    try {
      return JSON.parse(JSON.stringify(errorInfo))
    } catch (_e) {
      return { errorInfo: String(errorInfo) }
    }
  }

  /**
   * Get the session name
   * @returns the session name
   */
  private _getSessionName(date: Date = new Date()): string {
    const userName =
      this.sessionAttributes?.userName || this._userAttributes?.userName || this._userAttributes?.name || ''
    return userName
      ? `${userName}'s session on ${getFormattedDate(date, { month: 'short', day: 'numeric' })}`
      : `Session on ${getFormattedDate(date)}`
  }
}
