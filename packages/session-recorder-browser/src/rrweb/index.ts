import { pack } from '@rrweb/packer'
import { EventType, pluginEvent } from '@rrweb/types'
import { eventWithTime, record, recordOptions } from 'rrweb'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { getRecordConsolePlugin, LogData } from '@rrweb/rrweb-plugin-console-record'

import { isConsoleEvent } from '../utils'
import { CONTINUOUS_DEBUGGING_TIMEOUT } from '../config'
import { SessionRecorderConfigs } from '../types'
import { SocketService } from '../services/socket.service'
import type { CrashBuffer } from '@multiplayer-app/session-recorder-common'

interface IntervalManager {
  restart: NodeJS.Timeout | null
  bufferSnapshot: NodeJS.Timeout | null
}

export class RecorderBrowserSDK {
  private stopFn?: () => void
  private config?: SessionRecorderConfigs
  private socketService?: SocketService
  private crashBuffer?: CrashBuffer
  private intervals: IntervalManager = {
    restart: null,
    bufferSnapshot: null
  }

  public startedAt: string = ''
  public stoppedAt: string = ''

  constructor() {}

  /**
   * Full snapshot.
   */
  takeFullSnapshot(): void {
    if (!this.stopFn) {
      return
    }
    record.takeFullSnapshot()
  }

  /**
   * Initializes the recorder SDK.
   * @param config - Configuration settings.
   * @param socketService - Optional socket service.
   */
  init(config: SessionRecorderConfigs, socketService?: SocketService): void {
    this.config = config
    this.socketService = socketService
  }

  /**
   * Starts recording.
   * @param sessionId - Session ID or null for buffer-only mode.
   * @param sessionType - Session type.
   */
  start(sessionId: string | null, sessionType: SessionType): void {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call init() before start().')
    }

    this.startedAt = new Date().toISOString()

    this.stopFn = record({
      ...this._buildRecordOptions(),
      emit: async (event: eventWithTime) => {
        const ts = event.timestamp

        if (!sessionId) {
          await this._handleBufferOnlyEvent(event, ts)
          return
        }

        this._handleLiveSessionEvent(event, ts, sessionId, sessionType)
      }
    })

    this.takeFullSnapshot()
    this._setupPeriodicSnapshots(sessionId, sessionType)
  }

  /**
   * Restarts recording. Never throws - library mode constraint.
   */
  async restart(sessionId: string | null, sessionType: SessionType): Promise<void> {
    try {
      this.stopFn?.()
      this.start(sessionId, sessionType)
    } catch (_e) {
      // Silent failure
    }
  }

  /**
   * Stops recording and cleans up resources.
   */
  stop(): void {
    this.stopFn?.()
    this.stopFn = undefined
    if (!this.config?.useWebsocket) {
      this.socketService?.close()
    }

    this._clearAllIntervals()
  }

  private _clearAllIntervals(): void {
    if (this.intervals.restart) {
      clearInterval(this.intervals.restart)
      this.intervals.restart = null
    }
    if (this.intervals.bufferSnapshot) {
      clearInterval(this.intervals.bufferSnapshot)
      this.intervals.bufferSnapshot = null
    }
  }

  /**
   * Sets the crash buffer.
   * @param crashBuffer - Crash buffer service.
   */
  setCrashBuffer(crashBuffer: CrashBuffer): void {
    this.crashBuffer = crashBuffer
  }

  /**
   * Mutates event in-place for performance.
   */
  private _applyConsoleMasking(event: eventWithTime): void {
    const maskFn = this.config?.masking?.maskConsoleEvent
    if (typeof maskFn === 'function' && isConsoleEvent(event)) {
      const pluginEvt = event as pluginEvent<LogData>
      const maskedPayload = maskFn(pluginEvt.data.payload)
      pluginEvt.data = { ...pluginEvt.data, payload: maskedPayload }
    }
  }

  /**
   * Handles buffer-only event.
   * @param event - Event.
   * @param ts - Timestamp.
   */
  private async _handleBufferOnlyEvent(event: eventWithTime, ts: number): Promise<void> {
    if (!this.crashBuffer) return

    try {
      this._applyConsoleMasking(event)
      const packedEvent = pack(event)
      this.stoppedAt = new Date(ts).toISOString()

      await this.crashBuffer.appendEvent({
        ts,
        isFullSnapshot: event.type === EventType.FullSnapshot,
        event: {
          event: packedEvent,
          eventType: event.type,
          timestamp: ts
        }
      })
    } catch (error) {
      // Silent failure - library constraint
    }
  }

  /**
   * Handles live session event.
   * @param event - Event.
   * @param ts - Timestamp.
   * @param sessionId - Session ID.
   * @param sessionType - Session type.
   */
  private _handleLiveSessionEvent(event: eventWithTime, ts: number, sessionId: string, sessionType: SessionType): void {
    if (!this.socketService) return

    this._applyConsoleMasking(event)
    const packedEvent = pack(event)
    this.stoppedAt = new Date(ts).toISOString()

    this.socketService.send({
      event: packedEvent,
      eventType: event.type,
      timestamp: ts,
      debugSessionId: sessionId,
      debugSessionType: sessionType
    })
  }

  /**
   * Builds record options.
   */
  private _buildRecordOptions(): recordOptions<eventWithTime> {
    const maskingConfig = this.config?.masking || {}

    const options: recordOptions<eventWithTime> = {
      maskAllInputs: maskingConfig.maskAllInputs ?? true,
      sampling: { canvas: 5 },
      recordCanvas: this.config?.recordCanvas,
      dataURLOptions: { type: 'image/webp', quality: 0.1 },
      plugins: [getRecordConsolePlugin({ level: ['log', 'error'] })]
    }

    if (maskingConfig.maskInputOptions) {
      options.maskInputOptions = maskingConfig.maskInputOptions
    }
    if (maskingConfig.maskTextClass) {
      options.maskTextClass = maskingConfig.maskTextClass
    }
    if (maskingConfig.maskTextSelector) {
      options.maskTextSelector = maskingConfig.maskTextSelector
    }
    if (typeof maskingConfig.maskInput === 'function') {
      options.maskInputFn = maskingConfig.maskInput
    }
    if (typeof maskingConfig.maskText === 'function') {
      options.maskTextFn = maskingConfig.maskText
    }

    return options
  }

  /**
   * Sets up periodic snapshots.
   * @param sessionId - Session ID.
   * @param sessionType - Session type.
   */
  private _setupPeriodicSnapshots(sessionId: string | null, sessionType: SessionType): void {
    this._clearAllIntervals()

    if (sessionType === SessionType.CONTINUOUS) {
      this.intervals.restart = setInterval(() => {
        this.takeFullSnapshot()
      }, CONTINUOUS_DEBUGGING_TIMEOUT)
    }

    if (!sessionId && this.config?.buffering?.enabled) {
      const interval = this.config.buffering.snapshotIntervalMs || 30000
      this.intervals.bufferSnapshot = setInterval(() => {
        this.takeFullSnapshot()
      }, interval)
    }
  }
}
