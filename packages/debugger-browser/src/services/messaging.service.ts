
class MessagingService {
  private isBrowser: boolean
  private promiseIdCounter: number = 0
  private promiseMap: Map<string, PromiseHandler> = new Map()
  private messagingServices: Map<string, Array<(payload: any) => void>> = new Map()

  constructor() {
    this.isBrowser = typeof window !== 'undefined'
    this.setupMessageListener()
  }

  private generatePromiseId(): string {
    return `promise_${++this.promiseIdCounter}`
  }

  public sendMessage(action: string, payload?: any): void {
    if (!this.isBrowser) return

    const message: MessagePayload = {
      type: 'MULTIPLAYER_SESSION_DEBUGGER_LIB',
      action,
      payload,
    }

    window.postMessage(message, '*')
  }

  public sendMessagePromise(action: string, payload?: any): Promise<any> {
    if (!this.isBrowser) {
      return Promise.reject(new Error('Not in browser environment'))
    }

    const promiseId = this.generatePromiseId()

    const promise = new Promise<any>((resolve, reject) => {
      this.promiseMap.set(promiseId, { resolve, reject })
    })

    const message: MessagePayload = {
      type: 'MULTIPLAYER_SESSION_DEBUGGER_LIB',
      action,
      payload,
      promiseId,
    }

    window.postMessage(message, '*')

    return promise
  }

  public on(action: string, handler: (payload: any) => void): void {
    const handlers = this.messagingServices.get(action) || []
    handlers.push(handler)
    this.messagingServices.set(action, handlers)
  }

  public off(action: string, handler?: (payload: any) => void): void {
    if (!handler) {
      // Remove all handlers for this action
      this.messagingServices.delete(action)
      return
    }

    const handlers = this.messagingServices.get(action)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
        if (handlers.length === 0) {
          this.messagingServices.delete(action)
        } else {
          this.messagingServices.set(action, handlers)
        }
      }
    }
  }

  private setupMessageListener(): void {
    if (!this.isBrowser) return
    window.addEventListener('message', (event: MessageEvent) => {
      const { type, action, payload, promiseId } = event.data as MessagePayload

      if (type !== 'MULTIPLAYER_SESSION_DEBUGGER_EXTENSION' || !action) return

      // Handle promise response
      if (promiseId && this.promiseMap.has(promiseId)) {
        const { resolve, reject } = this.promiseMap.get(promiseId)!
        const { error, response } = payload as messagingServiceResponse
        if (error) {
          reject(error)
        } else {
          resolve(response)
        }
        this.promiseMap.delete(promiseId)
        return
      }

      // Handle regular message handlers
      const handlers = this.messagingServices.get(action)
      if (handlers) {
        handlers.forEach(handler => handler(payload))
      }
    })
  }
}


interface messagingServiceResponse {
  error?: Error
  response?: any
}

interface PromiseHandler {
  resolve: (value: any) => void
  reject: (reason?: any) => void
}

interface MessagePayload {
  type: string
  action: string
  payload?: any
  promiseId?: string
}


const messagingService = new MessagingService()

export default messagingService