import {
  SessionType,
  SessionRecorderIdGenerator,
  SessionRecorderSdk,
  MULTIPLAYER_TRACE_DEBUG_SESSION_SHORT_ID_LENGTH,
  ATTR_MULTIPLAYER_SESSION_RECORDER_VERSION
} from '@multiplayer-app/common'
import { ApiService } from './services/api.service'
import { ISession } from './types'
import { getFormattedDate } from './helper'
import { SESSION_RECORDER_VERSION } from './config'

export class SessionRecorder {
  private _isInitialized = false

  private _shortSessionId: string | boolean = false

  private _traceIdGenerator: SessionRecorderIdGenerator | undefined
  private _sessionType: SessionType = SessionType.PLAIN
  private _sessionState: 'STARTED' | 'STOPPED' | 'PAUSED' = 'STOPPED'
  private _apiService = new ApiService()
  private _sessionShortIdGenerator = SessionRecorderSdk.getIdGenerator(MULTIPLAYER_TRACE_DEBUG_SESSION_SHORT_ID_LENGTH)

  private _resourceAttributes: object = {}

  /**
   * Initialize session recorder with default or custom configurations
   */
  constructor() { }

  /**
   * @description Initialize the session recorder
   * @param apiKey - multiplayer otlp key
   * @param traceIdGenerator - multiplayer compatible trace id generator
   */
  public init(config: {
    apiKey: string,
    traceIdGenerator: SessionRecorderIdGenerator,
    resourceAttributes?: object,
    generateSessionShortIdLocally?: boolean | (() => string)
  }): void {
    this._resourceAttributes = config.resourceAttributes || {
      [ATTR_MULTIPLAYER_SESSION_RECORDER_VERSION]: SESSION_RECORDER_VERSION
    }
    this._isInitialized = true

    if (typeof config.generateSessionShortIdLocally === 'function') {
      this._sessionShortIdGenerator = config.generateSessionShortIdLocally
    }

    if (!config?.apiKey?.length) {
      throw new Error('Api key not provided')
    }

    if (!config?.traceIdGenerator?.setSessionId) {
      throw new Error('Incompatible trace id generator')
    }

    this._traceIdGenerator = config.traceIdGenerator
    this._apiService.init({ apiKey: config.apiKey })
  }

  /**
   * @description Start a new session
   * @param {SessionType} SessionType - the type of session to start
   * @param {ISession} [sessionPayload] - session metadata
   * @returns {Promise<void>}
   */
  public async start(
    sessionType: SessionType,
    sessionPayload?: Omit<ISession, '_id'>
  ): Promise<void> {
    if (!this._isInitialized) {
      throw new Error(
        'Configuration not initialized. Call init() before performing any actions.',
      )
    }

    if (
      sessionPayload?.shortId
      && sessionPayload?.shortId?.length !== MULTIPLAYER_TRACE_DEBUG_SESSION_SHORT_ID_LENGTH
    ) {
      throw new Error('Invalid short session id')
    }

    sessionPayload = sessionPayload || {}

    if (this._sessionState !== 'STOPPED') {
      throw new Error('Session should be ended before starting new one.')
    }

    this._sessionType = sessionType

    let session: ISession

    sessionPayload.name = sessionPayload.name
      ? sessionPayload.name
      : `Session on ${getFormattedDate(Date.now())}`

    sessionPayload.resourceAttributes = {
      ...this._resourceAttributes,
      ...sessionPayload.resourceAttributes
    }

    if (this._sessionType === SessionType.CONTINUOUS) {
      session = await this._apiService.startContinuousSession(sessionPayload)
    } else {
      session = await this._apiService.startSession(sessionPayload)
    }

    this._shortSessionId = session.shortId as string

    (this._traceIdGenerator as SessionRecorderIdGenerator).setSessionId(
      this._shortSessionId,
      this._sessionType
    )

    this._sessionState = 'STARTED'
  }

  /**
   * @description Save the continuous session
   * @param {String} [reason]
   * @returns {Promise<void>}
   */
  static async save(reason?: string) {
    SessionRecorderSdk.saveContinuousSession(reason)
  }

  /**
   * @description Save the continuous session
   * @param {ISession} [sessionData]
   * @returns {Promise<void>}
   */
  public async save(
    sessionData?: ISession
  ): Promise<void> {
    try {
      if (!this._isInitialized) {
        throw new Error(
          'Configuration not initialized. Call init() before performing any actions.',
        )
      }

      if (
        this._sessionState === 'STOPPED'
        || typeof this._shortSessionId !== 'string'
      ) {
        throw new Error('Session should be active or paused')
      }

      if (this._sessionType !== SessionType.CONTINUOUS) {
        throw new Error('Invalid session type')
      }

      await this._apiService.saveContinuousSession(
        this._shortSessionId,
        {
          ...(sessionData || {}),
          name: sessionData?.name
            ? sessionData.name
            : `Session on ${getFormattedDate(Date.now())}`
        },
      )
    } catch (e) {
      throw e
    }
  }

  /**
   * @description Stop the current session with an optional comment
   * @param {ISession} [sessionData] - user-provided comment to include in session metadata
   * @returns {Promise<void>}
   */
  public async stop(
    sessionData?: ISession
  ): Promise<void> {
    try {
      if (!this._isInitialized) {
        throw new Error(
          'Configuration not initialized. Call init() before performing any actions.',
        )
      }

      if (
        this._sessionState === 'STOPPED'
        || typeof this._shortSessionId !== 'string'
      ) {
        throw new Error('Session should be active or paused')
      }

      if (this._sessionType !== SessionType.PLAIN) {
        throw new Error('Invalid session type')
      }

      await this._apiService.stopSession(
        this._shortSessionId,
        sessionData || {},
      )
    } catch (e) {
      throw e
    } finally {
      (this._traceIdGenerator as SessionRecorderIdGenerator).setSessionId('')

      this._shortSessionId = false
      this._sessionState = 'STOPPED'
    }
  }

  /**
   * @description Cancel the current session
   * @returns {Promise<void>}
   */
  public async cancel(): Promise<void> {
    try {
      if (!this._isInitialized) {
        throw new Error(
          'Configuration not initialized. Call init() before performing any actions.',
        )
      }

      if (
        this._sessionState === 'STOPPED'
        || typeof this._shortSessionId !== 'string'
      ) {
        throw new Error('Session should be active or paused')
      }

      if (this._sessionType === SessionType.CONTINUOUS) {
        await this._apiService.stopContinuousSession(this._shortSessionId)
      } else if (this._sessionType === SessionType.PLAIN) {
        await this._apiService.cancelSession(this._shortSessionId)
      }
    } catch (e) {
      throw e
    } finally {
      (this._traceIdGenerator as SessionRecorderIdGenerator).setSessionId('')

      this._shortSessionId = false
      this._sessionState = 'STOPPED'
    }
  }

  /**
   * @description Check if continuous session should be started/stopped automatically
   * @param {ISession} [sessionPayload]
   * @returns {Promise<void>}
   */
  public async checkRemoteContinuousSession(
    sessionPayload?: Omit<ISession, '_id' | 'shortId'>
  ): Promise<void> {
    if (!this._isInitialized) {
      throw new Error(
        'Configuration not initialized. Call init() before performing any actions.',
      )
    }

    sessionPayload = sessionPayload || {}

    sessionPayload.resourceAttributes = {
      ...(sessionPayload.resourceAttributes || {}),
      ...this._resourceAttributes,
    }

    const { state } = await this._apiService.checkRemoteSession(sessionPayload)

    if (state == 'START' && this._sessionState !== 'STARTED') {
      await this.start(SessionType.CONTINUOUS, sessionPayload)
    } else if (state == 'STOP' && this._sessionState !== 'STOPPED') {
      await this.stop()
    }
  }
}
