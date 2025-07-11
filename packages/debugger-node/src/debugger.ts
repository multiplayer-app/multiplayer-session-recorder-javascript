import {
  DebugSessionType,
  MultiplayerIdGenerator
} from '@multiplayer-app/opentelemetry'
import { ApiService } from './services/api.service'
import { IDebugSession } from './types'
import { getFormattedDate } from './helper'

export class Debugger {
  private _isInitialized = false

  private _debugSessionId: string | boolean = false
  private _shortDebugSessionId: string | boolean = false

  private _traceIdGenerator: MultiplayerIdGenerator | undefined
  private _debugSessionType: DebugSessionType = DebugSessionType.PLAIN
  private _debugSessionState: 'STARTED' | 'STOPPED' | 'PAUSED' = 'STOPPED'
  private _apiService = new ApiService()

  /**
   * Initialize debugger with default or custom configurations
   */
  constructor() { }

  /**
   * Initialize the session debugger
   * @param apiKey - multiplayer otlp key
   * @param traceIdGenerator - multiplayer compatible trace id generator
   */
  public init(
    apiKey: string,
    traceIdGenerator: MultiplayerIdGenerator,
    debugSessionMetadata?: Omit<IDebugSession, '_id' | 'shortId'>
  ): void {
    this._isInitialized = true

    if (!apiKey?.length) {
      throw new Error('Api key not provided')
    }

    if (!traceIdGenerator.setSessionId) {
      throw new Error('Incompatible trace id generator')
    }

    this._traceIdGenerator = traceIdGenerator
    this._apiService.init({ apiKey })
  }

  /**
   * Start a new session
   * @param debugSessionType - the type of session to start
   * @param debugSessionData - debug session metadata
   */
  public async start(
    debugSessionType: DebugSessionType,
    debugSessionData: IDebugSession = {}
  ): Promise<void> {
    if (!this._isInitialized) {
      throw new Error(
        'Configuration not initialized. Call init() before performing any actions.',
      )
    }

    if (this._debugSessionState !== 'STOPPED') {
      throw new Error('Debug session should be ended before starting new one.')
    }

    this._debugSessionType = debugSessionType

    let debugSession: IDebugSession

    if (debugSessionType === DebugSessionType.CONTINUOUS) {
      debugSession = await this._apiService.startContinuousDebugSession(debugSessionData)
    } else {
      debugSession = await this._apiService.startDebugSession(debugSessionData)
    }

    this._shortDebugSessionId = debugSession.shortId as string
    this._debugSessionId = debugSession._id as string

    (this._traceIdGenerator as MultiplayerIdGenerator).setSessionId(
      this._shortDebugSessionId,
      debugSessionType
    )

    this._debugSessionState = 'STARTED'
  }

  /**
   * Save the continuous debugging session
   */
  public async save(
    debugSessionData: IDebugSession = {}
  ): Promise<any> {
    try {
      if (!this._isInitialized) {
        throw new Error(
          'Configuration not initialized. Call init() before performing any actions.',
        )
      }

      if (
        this._debugSessionState === 'STOPPED'
        || typeof this._debugSessionId !== 'string'
      ) {
        throw new Error('Debug session should be active or paused')
      }

      if (this._debugSessionType !== DebugSessionType.CONTINUOUS) {
        throw new Error('Invalid debug session type')
      }

      await this._apiService.saveContinuousDebugSession(
        this._debugSessionId,
        {
          ...(debugSessionData || {}),
          name: debugSessionData.name
            ? debugSessionData.name
            : `Session on ${getFormattedDate(Date.now())}`
        },
      )
    } catch (e) {
      throw e
    }
  }

  /**
   * Stop the current session with an optional comment
   * @param comment - user-provided comment to include in session metadata
   */
  public async stop(
    debugSessionData: IDebugSession = {}
  ): Promise<void> {
    try {
      if (!this._isInitialized) {
        throw new Error(
          'Configuration not initialized. Call init() before performing any actions.',
        )
      }

      if (
        this._debugSessionState === 'STOPPED'
        || typeof this._debugSessionId !== 'string'
      ) {
        throw new Error('Debug session should be active or paused')
      }

      if (this._debugSessionType === DebugSessionType.PLAIN) {
        await this._apiService.stopSession(
          this._debugSessionId,
          debugSessionData,
        )
      } if (this._debugSessionType === DebugSessionType.CONTINUOUS) {
        await this._apiService.cancelContinuousDebugSession(this._debugSessionId)
      }

    } catch (e) {
      throw e
    } finally {
      (this._traceIdGenerator as MultiplayerIdGenerator).setSessionId('')

      this._debugSessionId = false
      this._shortDebugSessionId = false
      this._debugSessionState = 'STOPPED'
    }
  }

  /**
   * Cancel the current session
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
        || typeof this._debugSessionId !== 'string'
      ) {
        throw new Error('Debug session should be active or paused')
      }


      if (this._debugSessionType === DebugSessionType.CONTINUOUS) {
        await this._apiService.cancelContinuousDebugSession(this._debugSessionId)
      } else if (this._debugSessionType === DebugSessionType.PLAIN) {
        await this._apiService.cancelSession(this._debugSessionId)
      }
    } catch (e) {
      throw e
    } finally {
      (this._traceIdGenerator as MultiplayerIdGenerator).setSessionId('')

      this._debugSessionId = false
      this._shortDebugSessionId = false
      this._debugSessionState = 'STOPPED'
    }
  }

  /**
   * Check if remote debug session should be started
   */
  public async checkRemoteDebugSession(): Promise<boolean> {
    try {
      if (!this._isInitialized) {
        throw new Error(
          'Configuration not initialized. Call init() before performing any actions.',
        )
      }

      const { shouldStart } = await this._apiService.checkRemoteDebugSession(
        {},
      )

      return shouldStart
    } catch (e) {
      throw e
    }
  }
}
