import io, { Socket } from 'socket.io-client'

import { ISession } from '../types'
import { logger } from '../utils'

import {
  SESSION_ADD_EVENT,
  SESSION_AUTO_CREATED,
  SESSION_STOPPED_EVENT,
  SESSION_SUBSCRIBE_EVENT,
  SESSION_UNSUBSCRIBE_EVENT,
} from '../config'

const MAX_RECONNECTION_ATTEMPTS = 2

export class EventExporter {
  private socket: Socket | null = null
  private queue: any[] = []
  private isConnecting: boolean = false
  private isConnected: boolean = false
  private attempts: number = 0
  private sessionId: string | null = null

  private socketUrl: string
  private apiKey: string

  constructor(options: { socketUrl: string, apiKey: string }) {
    this.socketUrl = options.socketUrl
    this.apiKey = options.apiKey
  }

  private init(): void {
    if (this.isConnecting || this.isConnected) return
    this.attempts++
    this.isConnecting = true
    this.socket = io(this.socketUrl, {
      path: '/v0/radar/ws',
      auth: {
        'x-api-key': this.apiKey,
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
      logger.info('EventExporter', 'Connected to server')
      this.flushQueue()
    })

    this.socket.on('disconnect', (err: any) => {
      this.isConnecting = false
      this.isConnected = false
      logger.info('EventExporter', 'Disconnected from server')
    })

    this.socket.on('connect_error', (err: any) => {
      this.isConnecting = false
      this.isConnected = false
      this.checkReconnectionAttempts()
      logger.error('EventExporter', 'Error connecting to server', err)
    })

    this.socket.on(SESSION_STOPPED_EVENT, (data: any) => {

      this.unsubscribeFromSession()
    })

    this.socket.on(SESSION_AUTO_CREATED, (data: any) => {

    })
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  setSocketUrl(socketUrl: string): void {
    this.socketUrl = socketUrl
  }

  private checkReconnectionAttempts(): void {
    if (this.attempts >= MAX_RECONNECTION_ATTEMPTS) {

      this.flushQueue()
    }
  }


  private flushQueue(): void {
    while (this.queue.length > 0 && (this.socket?.connected)) {
      const event = this.queue.shift()
      if (!event) continue

      if (this.socket?.connected) {
        this.socket.emit(event.name, event.data)
      }
    }
  }

  private unsubscribeFromSession() {
    const payload = {
      debugSessionId: this.sessionId,
    }
    if (this.socket?.connected) {
      this.socket.emit(SESSION_UNSUBSCRIBE_EVENT, payload)
    }
  }

  public send(event: any): void {
    if (this.socket?.connected) {
      this.socket.emit(SESSION_ADD_EVENT, event)
    } else {
      this.queue.push({ data: event, name: SESSION_ADD_EVENT })
      this.init()
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
    if (this.socket?.connected) {
      this.socket.emit(SESSION_SUBSCRIBE_EVENT, payload)
    } else {
      this.queue.push({ data: payload, name: SESSION_SUBSCRIBE_EVENT })
      this.init()
    }
  }

  public close(): void {
    if (this.socket?.connected) {
      setTimeout(() => {
        this.unsubscribeFromSession()
        this.attempts = 0
        this.isConnected = false
        this.isConnecting = false
        this.socket?.disconnect()
        this.socket = null
      }, 500)
    }
  }
}
