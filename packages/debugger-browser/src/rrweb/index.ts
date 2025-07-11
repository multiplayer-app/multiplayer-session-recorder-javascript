import { record } from 'rrweb'
import { pack } from '@rrweb/packer'
import { DebugSessionType } from '@multiplayer-app/opentelemetry'
import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record'

import { SessionDebuggerConfigs } from '../types'
import { CONTINUOUS_DEBUGGING_TIMEOUT } from '../constants'

import { RrwebEventExporter } from './exporter'
import { IndexedDBService } from './indexedDbService'


export class RecorderBrowserSDK {
  private stopFn?: () => void
  private config?: SessionDebuggerConfigs
  private exporter: RrwebEventExporter | undefined
  private indexedDBService: IndexedDBService
  private _restartTimeout: NodeJS.Timeout | null = null

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
    this.indexedDBService = new IndexedDBService()
  }

  /**
   * Initializes the recorder SDK with configuration settings.
   * @param config - Configuration settings for the session debugger.
   */
  init(config: SessionDebuggerConfigs): void {
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
    this.stopFn = record({
      maskAllInputs: true,
      sampling: { canvas: 5 },
      recordCanvas: this.config.canvasEnabled,
      dataURLOptions: { type: 'image/webp', quality: 0.1 },
      plugins: [
        getRecordConsolePlugin({ level: ['log', 'error'] }),
      ],
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
          await this.indexedDBService.saveEvent(packedEvent)

        }
      },
    })
    if (restartTimeout > 0) {
      this._restartTimeout = setTimeout(() => {
        this.restart(sessionId, debugSessionType)
      }, restartTimeout)
    }
  }

  /**
   * Restarts the recording of events.
   */
  async restart(sessionId: string | null, debugSessionType: DebugSessionType): Promise<void> {
    await this.indexedDBService.clearEvents()
    this.stopFn?.()
    this.start(sessionId, debugSessionType)
  }
  /**
   * Clears the restart timeout.
   */
  clearRestartTimeout(): void {
    if (this._restartTimeout) {
      clearTimeout(this._restartTimeout)
      this._restartTimeout = null
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

  subscribeToSession(session): void {
    this.exporter?.subscribeToSession(session)
  }



  /**
   * Clears stored events from IndexedDB and resets the replay container.
   */
  async clearStoredEvents(): Promise<void> {
    await this.indexedDBService.clearEvents()
  }
}
