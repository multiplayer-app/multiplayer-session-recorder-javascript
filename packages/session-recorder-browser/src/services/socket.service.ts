import io, { Socket } from 'socket.io-client'
import { Observable } from 'lib0/observable'

import {
  ISession,
  IUserAttributes,
} from '../types'
import { recorderEventBus } from '../eventBus'
import messagingService from '../services/messaging.service'
import {
  SESSION_ADD_EVENT,
  SESSION_AUTO_CREATED,
  SESSION_STOPPED_EVENT,
  SESSION_SUBSCRIBE_EVENT,
  SESSION_UNSUBSCRIBE_EVENT,
  SOCKET_SET_USER_EVENT,
  REMOTE_SESSION_RECORDING_START,
  REMOTE_SESSION_RECORDING_STOP,
} from '../config'

const MAX_RECONNECTION_ATTEMPTS = 2

export type SocketServiceEvents =
  | typeof SESSION_STOPPED_EVENT
  | typeof SESSION_AUTO_CREATED
  | typeof REMOTE_SESSION_RECORDING_START
  | typeof REMOTE_SESSION_RECORDING_STOP

export interface SocketServiceOptions {
  socketUrl: string
  apiKey: string
  usePostMessageFallback?: boolean
  keepAlive?: boolean
}

export class SocketService extends Observable<SocketServiceEvents> {
  private socket: Socket | null = null
  private queue: any[] = []
  private isConnecting: boolean = false
  private isConnected: boolean = false
  private usePostMessage: boolean = false
  private attempts: number = 0
  private sessionId: string | null = null
  private options: SocketServiceOptions

  constructor() {
    super()
    this.options = {
      socketUrl: '',
      apiKey: '',
      usePostMessageFallback: false,
      keepAlive: false,
    }
  }

  /**
   * Initialize the socket service
   * @param config - Socket service configuration
   */
  public init(config: SocketServiceOptions): void {
    this.options = {
      ...this.options,
      ...config,
    }
    if (
      this.options.keepAlive
      && this.options.socketUrl
      && this.options.apiKey
    ) {
      this._initConnection()
    }
  }

  /**
   * Update the socket service configuration
   * @param config - Partial configuration to update
   */
  public updateConfigs(config: Partial<SocketServiceOptions>): void {
    // If any config changed, reconnect if connected
    if (Object.keys(config).some(key => config[key] !== undefined && config[key] !== this.options[key])) {
      this.options = { ...this.options, ...config }
      if (this.socket?.connected) {
        this.close()
        if (this.options.keepAlive && this.options.socketUrl && this.options.apiKey) {
          this._initConnection()
        }
      }
    }
  }


  private _initConnection(): void {
    if (this.isConnecting || this.isConnected) return
    this.attempts++
    this.isConnecting = true
    this.usePostMessage = false
    this.socket = io(this.options.socketUrl, {
      path: '/v0/radar/ws',
      auth: {
        'x-api-key': this.options.apiKey,
      },
      reconnectionAttempts: 2,
      transports: ['websocket'],
    })

    // this.socket.on('connect', () => {
    //   this.isConnecting = false
    //   this.isConnected = true
    //   this.usePostMessage = false
    //   this.flushQueue()
    // })

    this.socket.on('ready', () => {
      this.isConnecting = false
      this.isConnected = true
      this.usePostMessage = false
      this.flushQueue()
    })

    this.socket.on('disconnect', (err: any) => {
      this.isConnecting = false
      this.isConnected = false
    })

    this.socket.on('connect_error', (err: any) => {
      this.isConnecting = false
      this.isConnected = false
      this.checkReconnectionAttempts()
    })

    this.socket.on(SESSION_STOPPED_EVENT, (data: any) => {
      this.emit(SESSION_STOPPED_EVENT, [data])
      this.unsubscribeFromSession()
    })

    this.socket.on(SESSION_AUTO_CREATED, (data: any) => {
      this.emit(SESSION_AUTO_CREATED, [data])
      // Also emit via eventBus for backward compatibility
      recorderEventBus.emit(SESSION_AUTO_CREATED, data)
    })

    this.socket.on(REMOTE_SESSION_RECORDING_START, (data: any) => {
      this.emit(REMOTE_SESSION_RECORDING_START, [data])
    })

    this.socket.on(REMOTE_SESSION_RECORDING_STOP, (data: any) => {
      this.emit(REMOTE_SESSION_RECORDING_STOP, [data])
    })
  }

  private checkReconnectionAttempts(): void {
    if (this.attempts >= MAX_RECONNECTION_ATTEMPTS) {
      this.usePostMessage = !!this.options.usePostMessageFallback
      this.flushQueue()
    }
  }

  private sendViaPostMessage(event: any): void {
    messagingService.sendMessage('rrweb-event', event)
  }

  private flushQueue(): void {
    while (this.queue.length > 0 && (this.usePostMessage || this.socket?.connected)) {
      const event = this.queue.shift()
      if (!event) continue

      if (this.usePostMessage) {
        this.sendViaPostMessage(event.data)
      } else if (this.socket?.connected) {
        this.socket.emit(event.name, event.data)
      }
    }
  }

  private unsubscribeFromSession() {
    const payload = {
      debugSessionId: this.sessionId,
    }
    if (this.usePostMessage) {
      messagingService.sendMessage('socket-emit', { event: SESSION_UNSUBSCRIBE_EVENT, data: payload })
    } else if (this.socket?.connected) {
      this.socket.emit(SESSION_UNSUBSCRIBE_EVENT, payload)
    }
  }

  public send(event: any): void {
    if (this.usePostMessage) {
      this.sendViaPostMessage(event)
    } else if (this.socket?.connected) {
      this.socket.emit(SESSION_ADD_EVENT, event)
    } else {
      this.queue.push({ data: event, name: SESSION_ADD_EVENT })
      this._initConnection()
    }
  }

  public subscribeToSession(session: ISession): void {
    this.sessionId = session.shortId || session._id
    const payload = {
      projectId: session.project,
      workspaceId: session.workspace,
      debugSessionId: this.sessionId,
      sessionType: session.creationType,
    }
    if (this.usePostMessage) {
      this.sendViaPostMessage({
        type: SESSION_SUBSCRIBE_EVENT,
        ...payload,
      })
    } else if (this.socket?.connected) {
      this.socket.emit(SESSION_SUBSCRIBE_EVENT, payload)
    } else {
      this.queue.push({
        data: payload,
        name: SESSION_SUBSCRIBE_EVENT,
      })
      this._initConnection()
    }
  }

  public setUser(userAttributes: IUserAttributes | undefined): void {
    if (this.usePostMessage) {
      this.sendViaPostMessage({
        type: SOCKET_SET_USER_EVENT,
        data: userAttributes,
      })
    } else if (this.socket?.connected) {
      this.socket.emit(
        SOCKET_SET_USER_EVENT,
        userAttributes,
      )
    }
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.usePostMessage) {
        this.sendViaPostMessage({ type: 'close' })
      }
      if (this.socket?.connected) {
        setTimeout(() => {
          this.unsubscribeFromSession()
          this.attempts = 0
          this.isConnected = false
          this.isConnecting = false
          this.socket?.disconnect()
          this.socket = null
          resolve()
        }, 500)
      } else {
        resolve()
      }
    })
  }
}
