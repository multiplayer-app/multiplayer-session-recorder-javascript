import io, { Socket } from 'socket.io-client'
import {
  DEBUG_SESSION_ADD_EVENT,
  DEBUG_SESSION_AUTO_CREATED,
  DEBUG_SESSION_STOPPED_EVENT,
  DEBUG_SESSION_SUBSCRIBE_EVENT,
  DEBUG_SESSION_UNSUBSCRIBE_EVENT,
} from '../constants'
import { IDebugSession } from '../types'
import { recorderEventBus } from '../eventBus'
import messagingService from '../services/messaging.service'

const MAX_RECONNECTION_ATTEMPTS = 2

export class RrwebEventExporter {
  private socket: Socket | null = null
  private queue: any[] = []
  private isConnecting: boolean = false
  private isConnected: boolean = false
  private usePostMessage: boolean = false
  private attempts: number = 0
  private sessionId: string | null = null

  constructor(private options: { socketUrl: string, apiKey: string, usePostMessageFallback?: boolean }) {

  }

  private init(): void {
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

    this.socket.on('connect', () => {
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

    this.socket.on(DEBUG_SESSION_STOPPED_EVENT, (data: any) => {
      recorderEventBus.emit(DEBUG_SESSION_STOPPED_EVENT, data)
      this.unsubscribeFromSession()
    })

    this.socket.on(DEBUG_SESSION_AUTO_CREATED, (data: any) => {
      recorderEventBus.emit(DEBUG_SESSION_AUTO_CREATED, data)
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
      messagingService.sendMessage('socket-emit', { event: DEBUG_SESSION_UNSUBSCRIBE_EVENT, data: payload })
    } else if (this.socket?.connected) {
      this.socket.emit(DEBUG_SESSION_UNSUBSCRIBE_EVENT, payload)
    }
  }

  public send(event: any): void {
    if (this.usePostMessage) {
      this.sendViaPostMessage(event)
    } else if (this.socket?.connected) {
      this.socket.emit(DEBUG_SESSION_ADD_EVENT, event)
    } else {
      this.queue.push({ data: event, name: DEBUG_SESSION_ADD_EVENT })
      this.init()
    }
  }

  public subscribeToSession(session: IDebugSession): void {
    this.sessionId = session.shortId || session._id
    const payload = {
      projectId: session.project,
      workspaceId: session.workspace,
      debugSessionId: this.sessionId,
      debugSessionType: session.creationType,
    }
    if (this.usePostMessage) {
      this.sendViaPostMessage({ type: DEBUG_SESSION_SUBSCRIBE_EVENT, ...payload })
    } else if (this.socket?.connected) {
      this.socket.emit(DEBUG_SESSION_SUBSCRIBE_EVENT, payload)
    } else {
      this.queue.push({ data: payload, name: DEBUG_SESSION_SUBSCRIBE_EVENT })
      this.init()
    }
  }

  public close(): void {
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
      }, 500)
    }
  }
}
