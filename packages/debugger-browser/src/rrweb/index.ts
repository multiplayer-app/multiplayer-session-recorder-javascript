import { record, recordOptions } from 'rrweb'
import { pack } from '@rrweb/packer'
import { DebugSessionType } from '@multiplayer-app/opentelemetry'
import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record'

import { IDebugSession, RecorderConfig } from '../types'
import { CONTINUOUS_DEBUGGING_TIMEOUT } from '../constants'

import { RrwebEventExporter } from './exporter'


export class RecorderBrowserSDK {
  private stopFn?: () => void
  private config?: RecorderConfig
  private exporter: RrwebEventExporter | undefined
  private restartTimeout: NodeJS.Timeout | null = null

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
    this.exporter = new RrwebEventExporter(
      {
        apiKey: config.apiKey,
        socketUrl: config.exporterApiBaseUrl || '',
        usePostMessageFallback: Boolean(config.usePostMessageFallback),
      },
    )
  }

  /**
   * Starts recording events for a given session ID.
   * @param sessionId - The ID of the session to record events for.
   */
  start(sessionId: string | null, debugSessionType: DebugSessionType): void {
    if (!this.config) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }
    const restartTimeout = debugSessionType === DebugSessionType.CONTINUOUS ? CONTINUOUS_DEBUGGING_TIMEOUT : 0
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
    if (typeof maskingConfig.maskInputFn === 'function') {
      options.maskInputFn = maskingConfig.maskInputFn
    }

    if (typeof maskingConfig.maskTextFn === 'function') {
      options.maskTextFn = maskingConfig.maskTextFn
    }

    this.stopFn = record({
      ...options,
      emit: async (event) => {
        if (this.exporter) {
          const packedEvent = pack(event)
          this.stoppedAt = new Date(event.timestamp).toISOString()
          this.exporter.send({
            debugSessionType,
            event: packedEvent,
            eventType: event.type,
            debugSessionId: sessionId,
            timestamp: event.timestamp,
          })

        }
      },
    })
    if (restartTimeout > 0) {
      this.restartTimeout = setTimeout(() => {
        this.restart(sessionId, debugSessionType)
      }, restartTimeout)
    }
  }

  /**
   * Restarts the recording of events.
   */
  async restart(sessionId: string | null, debugSessionType: DebugSessionType): Promise<void> {
    this.stopFn?.()
    this.start(sessionId, debugSessionType)
  }
  /**
   * Clears the restart timeout.
   */
  clearRestartTimeout(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout)
      this.restartTimeout = null
    }
  }

  /**
   * Stops the recording of events.
   */
  stop(): void {
    this.stopFn?.()
    this.exporter?.close()
    this.clearRestartTimeout()
  }

  subscribeToSession(session: IDebugSession): void {
    this.exporter?.subscribeToSession(session)
  }
}
