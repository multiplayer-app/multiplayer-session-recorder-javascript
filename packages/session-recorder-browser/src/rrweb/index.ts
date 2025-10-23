import { pack } from '@rrweb/packer'
import { pluginEvent } from '@rrweb/types'
import { eventWithTime, record, recordOptions } from 'rrweb'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { getRecordConsolePlugin, LogData } from '@rrweb/rrweb-plugin-console-record'



import { isConsoleEvent } from '../utils'
import { CONTINUOUS_DEBUGGING_TIMEOUT } from '../config'
import { ISession, RecorderConfig } from '../types'


import { RrwebEventExporter } from './exporter'


export class RecorderBrowserSDK {
  private stopFn?: () => void
  private config?: RecorderConfig
  private exporter: RrwebEventExporter | undefined
  private restartInterval: NodeJS.Timeout | null = null

  private _startedAt: string = ''
  public get startedAt(): string {
    return this._startedAt
  }
  public set startedAt(v: string) {
    this._startedAt = v
  }

  private _stoppedAt: string = ''
  public get stoppedAt(): string {
    return this._stoppedAt
  }

  public set stoppedAt(v: string) {
    this._stoppedAt = v
  }

  constructor() {
  }

  /**
   * Initializes the recorder SDK with configuration settings.
   * @param config - Configuration settings for the session debugger.
   */
  init(config: RecorderConfig): void {
    this.config = config
    this.exporter = new RrwebEventExporter({
      apiKey: config.apiKey,
      socketUrl: config.apiBaseUrl || '',
      usePostMessageFallback: Boolean(config.usePostMessageFallback),
    })
  }

  /**
   * Starts recording events for a given session ID.
   * @param sessionId - The ID of the session to record events for.
   */
  start(sessionId: string | null, sessionType: SessionType): void {
    if (!this.config) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }
    const restartInterval = sessionType === SessionType.CONTINUOUS ? CONTINUOUS_DEBUGGING_TIMEOUT : 0
    this.startedAt = new Date().toISOString()

    // Build masking configuration
    const maskingConfig = this.config.masking || {}
    const options: recordOptions<any> = {
      maskAllInputs: maskingConfig.maskAllInputs ?? true,
      sampling: { canvas: 5 },
      recordCanvas: this.config.recordCanvas,
      dataURLOptions: { type: 'image/webp', quality: 0.1 },
      plugins: [
        getRecordConsolePlugin({ level: ['log', 'error'] }),
      ],
    }

    // Add mask input options if provided
    if (maskingConfig.maskInputOptions) {
      options.maskInputOptions = maskingConfig.maskInputOptions
    }

    // Add mask text class if provided
    if (maskingConfig.maskTextClass) {
      options.maskTextClass = maskingConfig.maskTextClass
    }

    // Add mask text selector if provided
    if (maskingConfig.maskTextSelector) {
      options.maskTextSelector = maskingConfig.maskTextSelector
    }

    // Add custom masking functions if provided
    if (typeof maskingConfig.maskInput === 'function') {
      options.maskInputFn = maskingConfig.maskInput
    }

    if (typeof maskingConfig.maskText === 'function') {
      options.maskTextFn = maskingConfig.maskText
    }

    this.stopFn = record({
      ...options,
      emit: async (event: eventWithTime) => {
        if (this.exporter) {

          if (typeof maskingConfig.maskConsoleEvent === 'function' && isConsoleEvent(event)) {
            const { data } = event as pluginEvent<LogData>
            const maskedPayload = maskingConfig.maskConsoleEvent(data.payload)
            event.data = { ...data, payload: maskedPayload }
          }

          const packedEvent = pack(event)
          this.stoppedAt = new Date(event.timestamp).toISOString()
          this.exporter.send({
            event: packedEvent,
            eventType: event.type,
            timestamp: event.timestamp,
            debugSessionId: sessionId,
            debugSessionType: sessionType,
          })

        }
      },
    })

    // It will sent full snapshot again but it will fix missing first snapshot issue
    record.takeFullSnapshot()
    if (restartInterval > 0) {
      this.restartInterval = setInterval(() => {
        record.takeFullSnapshot()
      }, restartInterval)
    }
  }

  /**
   * Restarts the recording of events.
   */
  async restart(sessionId: string | null, sessionType: SessionType): Promise<void> {
    this.stopFn?.()
    this.start(sessionId, sessionType)
  }
  /**
   * Clears the restart timeout.
   */
  clearRestartInterval(): void {
    if (this.restartInterval) {
      clearInterval(this.restartInterval)
      this.restartInterval = null
    }
  }

  /**
   * Stops the recording of events.
   */
  stop(): void {
    this.stopFn?.()
    this.exporter?.close()
    this.clearRestartInterval()
  }

  subscribeToSession(session: ISession): void {
    this.exporter?.subscribeToSession(session)
  }
}
