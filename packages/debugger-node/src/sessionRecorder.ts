import {
  DebugSessionType,
  MultiplayerIdGenerator,
  MultiplayerHelpers,
  MULTIPLAYER_TRACE_DEBUG_SESSION_SHORT_ID_LENGTH
} from '@multiplayer-app/opentelemetry'
import { ApiService } from './services/api.service'
import { IDebugSession } from './types'
import { getFormattedDate } from './helper'

export class SessionRecorder {
  private _isInitialized = false

  private _shortDebugSessionId: string | boolean = false

  private _traceIdGenerator: MultiplayerIdGenerator | undefined
  private _debugSessionType: DebugSessionType = DebugSessionType.PLAIN
  private _debugSessionState: 'STARTED' | 'STOPPED' | 'PAUSED' = 'STOPPED'
  private _apiService = new ApiService()
  private _debugSessionShortIdGenerator = MultiplayerHelpers.getIdGenerator(MULTIPLAYER_TRACE_DEBUG_SESSION_SHORT_ID_LENGTH)

  private _resourceAttributes: object = {}

  /**
   * Initialize debugger with default or custom configurations
   */
  constructor() { }

  /**
   * @description Initialize the session debugger
   * @param apiKey - multiplayer otlp key
   * @param traceIdGenerator - multiplayer compatible trace id generator
   */
  public init(config: {
    apiKey: string,
    traceIdGenerator: MultiplayerIdGenerator,
    resourceAttributes?: object,
    generateDebugSessionShortIdLocally?: boolean | (() => string)
  }): void {
    this._resourceAttributes = config.resourceAttributes || {}
    this._isInitialized = true

    if (typeof config.generateDebugSessionShortIdLocally === 'function') {
      this._debugSessionShortIdGenerator = config.generateDebugSessionShortIdLocally
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
   * @param {DebugSessionType} debugSessionType - the type of session to start
   * @param {IDebugSession} [debugSessionPayload] - debug session metadata
   * @returns {Promise<void>}
   */
  public async start(
    debugSessionType: DebugSessionType,
    debugSessionPayload?: Omit<IDebugSession, '_id'>
  ): Promise<void> {
    if (!this._isInitialized) {
      throw new Error(
        'Configuration not initialized. Call init() before performing any actions.',
      )
    }

    if (
      debugSessionPayload?.shortId
      && debugSessionPayload?.shortId?.length !== MULTIPLAYER_TRACE_DEBUG_SESSION_SHORT_ID_LENGTH
    ) {
      throw new Error('Invalid short debug-session id')
    }

    debugSessionPayload = debugSessionPayload || {}

    if (this._debugSessionState !== 'STOPPED') {
      throw new Error('Debug session should be ended before starting new one.')
    }

    this._debugSessionType = debugSessionType

    let debugSession: IDebugSession

    debugSessionPayload.name = debugSessionPayload.name
      ? debugSessionPayload.name
      : `Session on ${getFormattedDate(Date.now())}`

    debugSessionPayload.resourceAttributes = {
      ...this._resourceAttributes,
      ...debugSessionPayload.resourceAttributes
    }

    if (debugSessionType === DebugSessionType.CONTINUOUS) {
      debugSession = await this._apiService.startContinuousDebugSession(debugSessionPayload)
    } else {
      debugSession = await this._apiService.startDebugSession(debugSessionPayload)
    }

    this._shortDebugSessionId = debugSession.shortId as string

    (this._traceIdGenerator as MultiplayerIdGenerator).setSessionId(
      this._shortDebugSessionId,
      debugSessionType
    )

    this._debugSessionState = 'STARTED'
  }

  /**
   * @description Save the continuous debugging session
   * @param {IDebugSession} [debugSessionData]
   * @returns {Promise<void>}
   */
  public async save(
    debugSessionData?: IDebugSession
  ): Promise<void> {
    try {
      if (!this._isInitialized) {
        throw new Error(
          'Configuration not initialized. Call init() before performing any actions.',
        )
      }

      if (
        this._debugSessionState === 'STOPPED'
        || typeof this._shortDebugSessionId !== 'string'
      ) {
        throw new Error('Debug session should be active or paused')
      }

      if (this._debugSessionType !== DebugSessionType.CONTINUOUS) {
        throw new Error('Invalid debug session type')
      }

      await this._apiService.saveContinuousDebugSession(
        this._shortDebugSessionId,
        {
          ...(debugSessionData || {}),
          name: debugSessionData?.name
            ? debugSessionData.name
            : `Session on ${getFormattedDate(Date.now())}`
        },
      )
    } catch (e) {
      throw e
    }
  }

  /**
   * @description Stop the current session with an optional comment
   * @param {IDebugSession} [debugSessionData] - user-provided comment to include in session metadata
   * @returns {Promise<void>}
   */
  public async stop(
    debugSessionData?: IDebugSession
  ): Promise<void> {
    try {
      if (!this._isInitialized) {
        throw new Error(
          'Configuration not initialized. Call init() before performing any actions.',
        )
      }

      if (
        this._debugSessionState === 'STOPPED'
        || typeof this._shortDebugSessionId !== 'string'
      ) {
        throw new Error('Debug session should be active or paused')
      }

      if (this._debugSessionType !== DebugSessionType.PLAIN) {
        throw new Error('Invalid debug-session type')
      }

      await this._apiService.stopSession(
        this._shortDebugSessionId, // use short debug session id
        debugSessionData || {},
      )
    } catch (e) {
      throw e
    } finally {
      (this._traceIdGenerator as MultiplayerIdGenerator).setSessionId('')

      this._shortDebugSessionId = false
      this._debugSessionState = 'STOPPED'
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
        this._debugSessionState === 'STOPPED'
        || typeof this._shortDebugSessionId !== 'string'
      ) {
        throw new Error('Debug session should be active or paused')
      }

      if (this._debugSessionType === DebugSessionType.CONTINUOUS) {
        await this._apiService.stopContinuousDebugSession(this._shortDebugSessionId)
      } else if (this._debugSessionType === DebugSessionType.PLAIN) {
        await this._apiService.cancelSession(this._shortDebugSessionId)
      }
    } catch (e) {
      throw e
    } finally {
      (this._traceIdGenerator as MultiplayerIdGenerator).setSessionId('')

      this._shortDebugSessionId = false
      this._debugSessionState = 'STOPPED'
    }
  }

  /**
   * @description Check if debug-session should be started/stopped automatically
   * @param {IDebugSession} [debugSessionPayload]
   * @returns {Promise<void>}
   */
  public async autoStartRemoteContinuousDebugSession(
    debugSessionPayload?: Omit<IDebugSession, '_id' | 'shortId'>
  ): Promise<void> {
    if (!this._isInitialized) {
      throw new Error(
        'Configuration not initialized. Call init() before performing any actions.',
      )
    }

    debugSessionPayload = debugSessionPayload || {}

    debugSessionPayload.resourceAttributes = {
      ...(debugSessionPayload.resourceAttributes || {}),
      ...this._resourceAttributes,
    }

    const { shouldStart } = await this._apiService.checkRemoteDebugSession(debugSessionPayload)

    if (this._debugSessionState !== 'STOPPED') {
      throw new Error('Debug session should be ended before starting new one.')
    }

    if (!shouldStart) {
      return
    }

    this._debugSessionType = DebugSessionType.CONTINUOUS
    this._shortDebugSessionId = this._debugSessionShortIdGenerator()

    debugSessionPayload.name = debugSessionPayload.name
      ? debugSessionPayload.name
      : `Session on ${getFormattedDate(Date.now())}`

    debugSessionPayload.resourceAttributes = {
      ...this._resourceAttributes,
      ...debugSessionPayload.resourceAttributes
    }

    const debugSession = await this._apiService.startContinuousDebugSession(debugSessionPayload)
    this._shortDebugSessionId = debugSession.shortId as string

    (this._traceIdGenerator as MultiplayerIdGenerator).setSessionId(
      this._shortDebugSessionId,
      this._debugSessionType
    )

    this._debugSessionState = 'STARTED'
  }
}
