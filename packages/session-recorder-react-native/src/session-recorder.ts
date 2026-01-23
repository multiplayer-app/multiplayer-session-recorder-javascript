import {
  SessionType,
  type ISession,
  type IUserAttributes
} from '@multiplayer-app/session-recorder-common';
import { Observable } from 'lib0/observable';
import { type eventWithTime } from '@rrweb/types';

import { TracerReactNativeSDK } from './otel';
import { RecorderReactNativeSDK } from './recorder';
import { logger } from './utils';

import {
  SessionState,
  type ISessionRecorder,
  type SessionRecorderConfigs,
  type SessionRecorderOptions,
  type EventRecorder,
} from './types';
import {
  SESSION_STOPPED_EVENT,
  REMOTE_SESSION_RECORDING_START,
  REMOTE_SESSION_RECORDING_STOP,
  SESSION_SAVE_BUFFER_EVENT,
} from './config';
import { getFormattedDate, isSessionActive, getNavigatorInfo } from './utils';
import {
  setShouldRecordHttpData,
  setMaxCapturingHttpPayloadSize,
} from './patch';
import { BASE_CONFIG, getSessionRecorderConfig } from './config';

import { StorageService } from './services/storage.service';
import { NetworkService } from './services/network.service';
import { CrashBufferService } from './services/crashBuffer.service';
import {
  ApiService,
  type StartSessionRequest,
  type StopSessionRequest,
} from './services/api.service';
import { SocketService } from './services/socket.service';

type SessionRecorderEvents = 'state-change' | 'init';

class SessionRecorder
  extends Observable<SessionRecorderEvents>
  implements ISessionRecorder, EventRecorder {
  private _configs: SessionRecorderConfigs;
  private _apiService = new ApiService();
  private _socketService = new SocketService();
  private _tracer = new TracerReactNativeSDK();
  private _recorder = new RecorderReactNativeSDK();
  private _storageService = StorageService.getInstance();
  private _networkService = NetworkService.getInstance();
  private _crashBuffer = CrashBufferService.getInstance();
  private _isFlushingBuffer: boolean = false;
  private _startRequestController: AbortController | null = null;

  // Whether the session recorder is initialized
  private _isInitialized = false;
  get isInitialized(): boolean {
    return this._isInitialized;
  }
  set isInitialized(isInitialized: boolean) {
    this._isInitialized = isInitialized;
  }

  // Session ID and state are stored in AsyncStorage
  private _sessionId: string | null = null;
  get sessionId(): string | null {
    return this._sessionId;
  }
  set sessionId(sessionId: string | null) {
    this._sessionId = sessionId;
    if (sessionId) {
      this._storageService.saveSessionId(sessionId);
    }
  }

  private _sessionType: SessionType = SessionType.MANUAL;
  get sessionType(): SessionType {
    return this._sessionType;
  }
  set sessionType(sessionType: SessionType) {
    this._sessionType = sessionType;
    this._storageService.saveSessionType(sessionType);
  }

  get continuousRecording(): boolean {
    return this.sessionType === SessionType.CONTINUOUS;
  }

  private _sessionState: SessionState | null = null;
  get sessionState(): SessionState | null {
    return this._sessionState || SessionState.stopped;
  }
  set sessionState(state: SessionState | null) {
    this._sessionState = state;
    this.emit('state-change', [
      state || SessionState.stopped,
      this.sessionType,
    ]);
    if (state) {
      this._storageService.saveSessionState(state);
    }
  }

  private _session: ISession | null = null;
  get session(): ISession | null {
    return this._session;
  }
  set session(session: ISession | null) {
    this._session = session;
    if (session) {
      this._storageService.saveSessionObject(session);
    }
  }

  private _sessionAttributes: Record<string, any> | null = null;
  get sessionAttributes(): Record<string, any> {
    return this._sessionAttributes || {};
  }
  set sessionAttributes(attributes: Record<string, any> | null) {
    this._sessionAttributes = attributes;
    // Keep crash buffer attributes updated (best-effort)
    if (this._configs?.buffering?.enabled) {
      const windowMs = Math.max(10_000, (this._configs.buffering.windowMinutes || 2) * 60 * 1000);
      void this._crashBuffer.setAttrs({
        sessionAttributes: this.sessionAttributes,
      });
      void this._crashBuffer.pruneOlderThan(Date.now() - windowMs);
    }
  }

  private _userAttributes: IUserAttributes | null = null;
  get userAttributes(): IUserAttributes | null {
    return this._userAttributes;
  }
  set userAttributes(userAttributes: IUserAttributes | null) {
    this._userAttributes = userAttributes;
    // Keep crash buffer attributes updated (best-effort)
    if (this._configs?.buffering?.enabled) {
      const windowMs = Math.max(10_000, (this._configs.buffering.windowMinutes || 2) * 60 * 1000);
      void this._crashBuffer.setAttrs({
        userAttributes: this._userAttributes,
      });
      void this._crashBuffer.pruneOlderThan(Date.now() - windowMs);
    }
  }
  /**
   * Error message getter and setter
   */
  public get error(): string {
    return this._error || '';
  }

  public set error(v: string) {
    this._error = v;
  }
  private _error: string = '';

  /**
   * React Native doesn't have HTML elements, so we return null
   */
  public get sessionWidgetButtonElement(): any {
    return null;
  }

  public get config(): SessionRecorderConfigs {
    return this._configs;
  }
  /**
   * Initialize debugger with default or custom configurations
   */
  constructor() {
    super();
    this._configs = BASE_CONFIG;
    // Initialize with stored session data if available
    StorageService.initialize();
  }

  /**
   * Capture an exception manually and send it as an error trace.
   */
  public captureException(error: unknown, errorInfo?: Record<string, any>): void {
    try {
      const normalizedError = this._normalizeError(error);
      const normalizedErrorInfo = this._normalizeErrorInfo(errorInfo);
      this._tracer.captureException(normalizedError, normalizedErrorInfo);
      if (this.sessionState === SessionState.stopped && !this.sessionId) {
        void this.flushBuffer({ reason: 'exception' });
      }
    } catch (e: any) {
      this.error = e?.message || 'Failed to capture exception';
    }
  }

  public async flushBuffer(payload?: { reason?: string }): Promise<any> {
    if (!this._configs?.buffering?.enabled) return null;
    if (this._isFlushingBuffer) return null;
    if (this.sessionState !== SessionState.stopped || this.sessionId) return null;

    const windowMs = Math.max(
      10_000,
      (this._configs.buffering.windowMinutes || 2) * 60 * 1000
    );

    this._isFlushingBuffer = true;
    try {
      const reason = payload?.reason || 'manual';
      await this._crashBuffer.setAttrs({
        sessionAttributes: this.sessionAttributes,
        resourceAttributes: getNavigatorInfo(),
        userAttributes: this._userAttributes,
      });

      const snapshot = await this._crashBuffer.snapshot(windowMs);
      if (snapshot.rrwebEvents.length === 0 && snapshot.otelSpans.length === 0) {
        return null;
      }

      const request: StartSessionRequest = {
        name: `${this._configs.application} ${getFormattedDate(new Date())}`,
        stoppedAt: new Date().toISOString(),
        sessionAttributes: this.sessionAttributes,
        resourceAttributes: getNavigatorInfo(),
        ...(this._userAttributes ? { userAttributes: this._userAttributes } : {}),
        debugSessionData: {
          meta: {
            reason,
            windowMs: snapshot.windowMs,
            fromTs: snapshot.fromTs,
            toTs: snapshot.toTs,
          },
          events: snapshot.rrwebEvents,
          spans: snapshot.otelSpans.map((s) => s.span),
          attrs: snapshot.attrs,
        },
      };

      try {
        const res = await this._apiService.startSession(request);
        await this._crashBuffer.clear();
        return res;
      } catch (_e) {
        // swallow: flush is best-effort; never throw into app code
        return null;
      }
    } finally {
      this._isFlushingBuffer = false;
    }
  }

  private async _loadStoredSessionData(): Promise<void> {
    try {
      await StorageService.initialize();
      const storedData = await this._storageService.getAllSessionData();
      if (isSessionActive(storedData.sessionObject, storedData.sessionType)) {
        this.session = storedData.sessionObject;
        this.sessionId = storedData.sessionId;
        this.sessionType = storedData.sessionType || SessionType.MANUAL;
        this.sessionState = storedData.sessionState;
      } else {
        this.session = null;
        this.sessionId = null;
        this.sessionState = null;
        this.sessionType = SessionType.MANUAL;
      }
    } catch (error) {
      logger.error(
        'SessionRecorder',
        'Failed to load stored session data',
        error
      );
      this.session = null;
      this.sessionId = null;
      this.sessionState = null;
      this.sessionType = SessionType.MANUAL;
    }
  }

  /**
   * Initialize the session debugger
   * @param configs - custom configurations for session debugger
   */
  public async init(configs: SessionRecorderOptions): Promise<void> {
    if (this._isInitialized) return;
    this._isInitialized = true;
    this._configs = getSessionRecorderConfig({ ...this._configs, ...configs });
    logger.configure(this._configs.logger);
    await this._loadStoredSessionData();
    setMaxCapturingHttpPayloadSize(this._configs.maxCapturingHttpPayloadSize);
    setShouldRecordHttpData(
      this._configs.captureBody,
      this._configs.captureHeaders
    );

    this._tracer.init(this._configs);
    this._apiService.init(this._configs);
    this._socketService.init({
      apiKey: this._configs.apiKey,
      socketUrl: this._configs.apiBaseUrl,
      keepAlive: this._configs.useWebsocket
    });

    // Crash buffer wiring (RN): used only when sessionId is null.
    const bufferEnabled = Boolean(this._configs.buffering?.enabled);
    const windowMs = Math.max(10_000, (this._configs.buffering?.windowMinutes || 2) * 60 * 1000);
    this._tracer.setCrashBuffer(bufferEnabled ? this._crashBuffer : undefined, windowMs);
    this._recorder.init(
      this._configs,
      this._socketService,
      bufferEnabled ? this._crashBuffer : undefined,
      { enabled: bufferEnabled, windowMs },
    );

    await this._networkService.init();
    this._setupNetworkCallbacks();
    this._registerSocketServiceListeners();

    if (
      this.sessionId &&
      (this.sessionState === SessionState.started ||
        this.sessionState === SessionState.paused)
    ) {
      this._start();
    } else {
      this._startBufferOnlyRecording();
    }
    this.emit('init', []);
  }

  private _startBufferOnlyRecording(): void {
    if (!this._configs?.buffering?.enabled) return;
    if (this.sessionState !== SessionState.stopped || this.sessionId) return;

    const windowMs = Math.max(10_000, (this._configs.buffering.windowMinutes || 2) * 60 * 1000);

    // Best-effort: persist current attrs so flush has context.
    this._crashBuffer.setAttrs({
      sessionAttributes: this.sessionAttributes,
      resourceAttributes: getNavigatorInfo(),
      userAttributes: this._userAttributes,
    });

    // Wire buffer into tracer + recorder (only used when sessionId is null).
    this._tracer.setCrashBuffer(this._crashBuffer, windowMs);
    this._recorder.init(this._configs, this._socketService, this._crashBuffer, { enabled: true, windowMs });

    // Start capturing events without an active debug session id.
    try {
      this._recorder.stop();
    } catch (_e) { }
    this._recorder.start(null, SessionType.MANUAL);
  }

  /**
   * Register socket service event listeners
   */
  private _registerSocketServiceListeners(): void {
    this._socketService.on(SESSION_STOPPED_EVENT, () => {
      this._stop();
      this._clearSession();
    });

    this._socketService.on(REMOTE_SESSION_RECORDING_START, (payload: any) => {
      logger.info('SessionRecorder', 'Remote session recording started', payload);
      if (this.sessionState === SessionState.stopped) {
        this.start();
      }
    });

    this._socketService.on(REMOTE_SESSION_RECORDING_STOP, (payload: any) => {
      logger.info('SessionRecorder', 'Remote session recording stopped', payload);
      if (this.sessionState !== SessionState.stopped) {
        this.stop();
      }
    });

    this._socketService.on(SESSION_SAVE_BUFFER_EVENT, (payload: any) => {
      const reason = payload?.reason || 'remote';
      void this.flushBuffer({ reason });
    });
  }

  /**
   * Setup network state change callbacks
   */
  private _setupNetworkCallbacks(): void {
    this._networkService.addCallback((state) => {
      if (!state.isConnected && this.sessionState === SessionState.started) {
        logger.info(
          'SessionRecorder',
          'Network went offline - pausing session recording'
        );
        this.pause();
      } else if (
        state.isConnected &&
        this.sessionState === SessionState.paused
      ) {
        logger.info(
          'SessionRecorder',
          'Network came back online - resuming session recording'
        );
        this.resume();
      }
    });
  }

  /**
   * Start a new session
   * @param type - the type of session to start
   * @param session - the session to start
   */
  public async start(
    type: SessionType = SessionType.MANUAL,
    session?: ISession
  ): Promise<void> {
    this._checkOperation('start');

    // Check if offline - don't start recording if offline
    if (!this._networkService.isOnline()) {
      logger.warn(
        'SessionRecorder',
        'Cannot start session recording - device is offline'
      );
      throw new Error('Cannot start session recording while offline');
    }

    // If continuous recording is disabled, force plain mode
    if (
      type === SessionType.CONTINUOUS &&
      !this._configs?.showContinuousRecording
    ) {
      type = SessionType.MANUAL;
    }
    logger.info('SessionRecorder', 'Starting session with type:', type);
    this.sessionType = type;
    this._startRequestController = new AbortController();
    if (session) {
      this._setupSessionAndStart(session, true);
    } else {
      await this._createSessionAndStart();
    }
  }

  /**
   * Stop the current session with an optional comment
   * @param comment - user-provided comment to include in session session attributes
   */
  public async stop(comment?: string): Promise<void> {
    try {
      this._checkOperation('stop');
      this._stop();
      if (this.continuousRecording) {
        await this._apiService.stopContinuousDebugSession(this.sessionId!);
        this.sessionType = SessionType.MANUAL;
      } else {
        const request: StopSessionRequest = {
          sessionAttributes: { comment },
          stoppedAt: Date.now(),
        };
        await this._apiService.stopSession(this.sessionId!, request);
      }
      this._clearSession();
    } catch (error: any) {
      this.error = error.message;
    }
  }

  /**
   * Pause the current session
   */
  public async pause(): Promise<void> {
    try {
      this._checkOperation('pause');
      this._pause();
    } catch (error: any) {
      this.error = error.message;
    }
  }

  /**
   * Resume the current session
   */
  public async resume(): Promise<void> {
    try {
      this._checkOperation('resume');
      this._resume();
    } catch (error: any) {
      this.error = error.message;
    }
  }

  /**
   * Cancel the current session
   */
  public async cancel(): Promise<void> {
    try {
      this._checkOperation('cancel');
      this._stop();
      if (this.continuousRecording) {
        await this._apiService.stopContinuousDebugSession(this.sessionId!);
        this.sessionType = SessionType.MANUAL;
      } else {
        await this._apiService.cancelSession(this.sessionId!);
      }
      this._clearSession();
    } catch (error: any) {
      this.error = error.message;
    }
  }

  /**
   * Save the continuous recording session
   */
  public async save(): Promise<any> {
    try {
      this._checkOperation('save');
      if (
        !this.continuousRecording ||
        !this._configs?.showContinuousRecording
      ) {
        return;
      }

      const res = await this._apiService.saveContinuousDebugSession(
        this.sessionId!,
        {
          sessionAttributes: this.sessionAttributes,
          resourceAttributes: getNavigatorInfo(),
          stoppedAt: Date.now(),
          name: this._getSessionName()
        }
      );

      return res;
    } catch (error: any) {
      this.error = error.message;
    }
  }

  /**
   * Set the session attributes
   * @param attributes - the attributes to set
   */
  public setSessionAttributes(attributes: Record<string, any>): void {
    this._sessionAttributes = attributes;
  }

  /**
   * Set the user attributes
   * @param userAttributes - the user attributes to set
   */
  public setUserAttributes(userAttributes: IUserAttributes | null): void {
    if (!this._userAttributes && !userAttributes) {
      return;
    }
    this._userAttributes = userAttributes;
    this._socketService.setUser(this._userAttributes);
  }

  /**
   * @description Check if session should be started/stopped automatically
   * @param {ISession} [sessionPayload]
   * @returns {Promise<void>}
   */
  public async checkRemoteContinuousSession(
    sessionPayload?: Omit<ISession, '_id' | 'shortId'>
  ): Promise<void> {
    this._checkOperation('autoStartRemoteContinuousSession');
    if (!this._configs?.showContinuousRecording) {
      return;
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
      ...(this._userAttributes ? { userAttributes: this._userAttributes } : {}),
    };

    const { state } = await this._apiService.checkRemoteSession(payload);

    if (state == 'START') {
      if (this.sessionState !== SessionState.started) {
        await this.start(SessionType.CONTINUOUS);
      }
    } else if (state == 'STOP') {
      if (this.sessionState !== SessionState.stopped) {
        await this.stop();
      }
    }
  }

  /**
   * Create a new session and start it
   */
  private async _createSessionAndStart(): Promise<void> {
    const signal = this._startRequestController?.signal;
    try {
      const payload = {
        sessionAttributes: this.sessionAttributes,
        resourceAttributes: getNavigatorInfo(),
        name: this._getSessionName(),
        ...(this._userAttributes ? { userAttributes: this._userAttributes } : {}),
      };
      const request: StartSessionRequest = !this.continuousRecording
        ? payload
        : { debugSessionData: payload };

      const session = this.continuousRecording
        ? await this._apiService.startContinuousDebugSession(request, signal)
        : await this._apiService.startSession(request, signal);

      if (session) {
        session.sessionType = this.continuousRecording
          ? SessionType.CONTINUOUS
          : SessionType.MANUAL;
        this._setupSessionAndStart(session, false);
      }
    } catch (error: any) {
      this.error = error.message;
      logger.error('SessionRecorder', 'Error creating session:', error.message);
      if (this.continuousRecording) {
        this.sessionType = SessionType.MANUAL;
      }
    }
  }

  /**
   * Start tracing and recording for the session
   */
  private _start(): void {
    this.sessionState = SessionState.started;
    this.sessionType = this.sessionType;

    if (this.sessionId) {
      // Switch from buffer-only recording to session recording cleanly.
      try {
        this._recorder.stop();
      } catch (_e) { }
      this._tracer.start(this.sessionId, this.sessionType);
      this._recorder.start(this.sessionId, this.sessionType);
      if (this.session) {
        this._socketService.subscribeToSession(this.session);
      }
    }
  }

  /**
   * Stop tracing and recording for the session
   */
  private _stop(): void {
    this.sessionState = SessionState.stopped;
    this._socketService.unsubscribeFromSession(true);
    this._tracer.stop();
    this._recorder.stop();
    this._startBufferOnlyRecording();
  }

  /**
   * Pause the session tracing and recording
   */
  private _pause(): void {
    this._tracer.stop();
    this._recorder.stop();
    this.sessionState = SessionState.paused;
  }

  /**
   * Resume the session tracing and recording
   */
  private _resume(): void {
    if (this.sessionId) {
      this._tracer.start(this.sessionId, this.sessionType);
      try {
        this._recorder.stop();
      } catch (_e) { }
      this._recorder.start(this.sessionId, this.sessionType);
    }
    this.sessionState = SessionState.started;
  }

  private _setupSessionAndStart(
    session: ISession,
    configureExporters: boolean = true
  ): void {
    if (configureExporters && session.tempApiKey) {
      this._configs.apiKey = session.tempApiKey;
      this._tracer.setApiKey(session.tempApiKey);
      this._apiService.setApiKey(session.tempApiKey);
      this._socketService.updateConfigs({ apiKey: session.tempApiKey });
    }

    this._setSession(session);
    this._start();
  }

  /**
   * Set the session ID in storage
   * @param sessionId - the session ID to set or clear
   */
  private _setSession(session: ISession): void {
    this.session = {
      ...session,
      createdAt: session.createdAt || new Date().toISOString(),
    };
    this.sessionId = session?.shortId || session?._id;
  }

  private _clearSession(): void {
    this.session = null;
    this.sessionId = null;
    this.sessionState = SessionState.stopped;
    this._storageService.clearSessionData();
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
    _payload?: any
  ): void {
    if (!this._isInitialized) {
      throw new Error(
        'Configuration not initialized. Call init() before performing any actions.'
      );
    }
    switch (action) {
      case 'start':
        if (this.sessionState === SessionState.started) {
          throw new Error('Session is already started.');
        }
        break;
      case 'stop':
        if (
          this.sessionState !== SessionState.paused &&
          this.sessionState !== SessionState.started
        ) {
          throw new Error('Cannot stop. Session is not currently started.');
        }
        break;
      case 'cancel':
        if (this.sessionState === SessionState.stopped) {
          throw new Error('Cannot cancel. Session has already been stopped.');
        }
        break;
      case 'pause':
        if (this.sessionState !== SessionState.started) {
          throw new Error('Cannot pause. Session is not running.');
        }
        break;
      case 'resume':
        if (this.sessionState !== SessionState.paused) {
          throw new Error('Cannot resume. Session is not paused.');
        }
        break;
      case 'save':
        if (!this.continuousRecording) {
          throw new Error(
            'Cannot save continuous recording session. Continuous recording is not enabled.'
          );
        }
        if (this.sessionState !== SessionState.started) {
          throw new Error(
            'Cannot save continuous recording session. Session is not started.'
          );
        }
        break;
      case 'autoStartRemoteContinuousSession':
        if (this.sessionState !== SessionState.stopped) {
          throw new Error(
            'Cannot start remote continuous session. Session is not stopped.'
          );
        }
        break;
    }
  }
  // Session attributes
  setSessionAttribute(key: string, value: any): void {
    if (this._session) {
      if (!this._session.sessionAttributes) {
        this._session.sessionAttributes = {};
      }
      this._session.sessionAttributes[key] = value;
      this._session.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Record a custom rrweb event
   * Note: Screen capture and touch events are recorded automatically when session is started
   * @param event - The rrweb event to record
   */
  recordEvent(event: eventWithTime): void {
    if (!this._isInitialized || this.sessionState !== SessionState.started) {
      return;
    }

    // Forward the event to the recorder SDK
    this._recorder.recordEvent(event);
  }

  /**
   * Set the viewshot ref for screen capture
   * @param ref - React Native View ref for screen capture
   */
  setViewShotRef(ref: any): void {
    if (this._recorder) {
      this._recorder.setViewShotRef(ref);
    }
  }

  /**
   * Set the navigation ref for navigation tracking
   * @param ref - React Native Navigation ref for navigation tracking
   */
  setNavigationRef(ref: any): void {
    if (this._recorder) {
      this._recorder.setNavigationRef(ref);
    }
  }

  /**
   * Cleanup resources and unsubscribe from network monitoring
   */
  cleanup(): void {
    this._networkService.cleanup();
  }

  /**
   * Normalize an error to an Error object
   * @param error - the error to normalize
   * @returns the normalized error
   */
  private _normalizeError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    try {
      return new Error(JSON.stringify(error));
    } catch (_e) {
      return new Error(String(error));
    }
  }


  /**
   * Normalize an error info object to a Record<string, any>
   * @param errorInfo - the error info to normalize
   * @returns the normalized error info
   */
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
    const userName = this.sessionAttributes?.userName || this._userAttributes?.userName || this._userAttributes?.name || '';
    return userName
      ? `${userName}'s session on ${getFormattedDate(date, { month: 'short', day: 'numeric' })}`
      : `Session on ${getFormattedDate(date)}`;
  }
}

export default new SessionRecorder();
