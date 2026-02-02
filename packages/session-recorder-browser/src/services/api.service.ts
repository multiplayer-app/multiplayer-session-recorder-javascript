import messagingService from './messaging.service'
import { ApiServiceConfig } from '../types'
import {
  type ISessionAttributes,
  type IResourceAttributes,
  type IUserAttributes
} from '@multiplayer-app/session-recorder-common'
import { eventWithTime } from 'rrweb'

export interface StartSessionRequest {
  name?: string
  stoppedAt?: string | number
  sessionAttributes?: ISessionAttributes
  resourceAttributes?: IResourceAttributes
  userAttributes?: IUserAttributes | null
  debugSessionData?: Record<string, any>
  tags?: { key?: string; value: string }[]
}

export interface CreateErrorSpanSessionRequest {
  span: any
}

export interface StopSessionRequest {
  sessionAttributes?: ISessionAttributes
  stoppedAt: string | number
}

export interface CheckRemoteSessionRequest {
  sessionAttributes?: ISessionAttributes
  resourceAttributes?: IResourceAttributes
  userAttributes?: IUserAttributes | null
}

export class ApiService {
  private config: ApiServiceConfig

  constructor() {
    this.config = {
      apiKey: '',
      apiBaseUrl: '',
      exporterEndpoint: ''
    }
  }

  /**
   * Initialize the API service
   * @param config - API service configuration
   */
  public init(config: ApiServiceConfig) {
    this.config = {
      ...this.config,
      ...config
    }
  }

  /**
   * Update the API service configuration
   * @param config - Partial configuration to update
   */
  public updateConfigs(config: Partial<ApiServiceConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * Start a new debug session
   * @param request - Session start request data
   * @param signal - Optional AbortSignal for request cancellation
   */
  async startSession(request: StartSessionRequest, signal?: AbortSignal): Promise<any> {
    return this.makeRequest('/debug-sessions/start', 'POST', request, signal)
  }
  /**
   * Create a new error span session
   * @param request - Session create error span request data
   * @param signal - Optional AbortSignal for request cancellation
   */
  async createErrorSession(request: CreateErrorSpanSessionRequest, signal?: AbortSignal): Promise<any> {
    return this.makeRequest('/debug-sessions/error-span/start', 'POST', request, signal)
  }

  /**
   * Stop an active debug session
   * @param sessionId - ID of the session to stop
   * @param request - Session stop request data
   */
  async stopSession(sessionId: string, request: StopSessionRequest): Promise<any> {
    return this.makeRequest(`/debug-sessions/${sessionId}/stop`, 'PATCH', request)
  }

  /**
   * Cancel an active debug session
   * @param sessionId - ID of the session to cancel
   */
  async cancelSession(sessionId: string): Promise<any> {
    return this.makeRequest(`/debug-sessions/${sessionId}/cancel`, 'DELETE')
  }

  /**
   * Start a new debug session
   * @param request - Session start request data
   * @param signal - Optional AbortSignal for request cancellation
   */
  async startContinuousDebugSession(request: StartSessionRequest, signal?: AbortSignal): Promise<any> {
    return this.makeRequest('/continuous-debug-sessions/start', 'POST', request, signal)
  }

  /**
   * Save a continuous debug session
   * @param sessionId - ID of the session to save
   * @param request - Session save request data
   * @param signal - Optional AbortSignal for request cancellation
   */
  async saveContinuousDebugSession(
    sessionId: string,
    request: StartSessionRequest,
    signal?: AbortSignal
  ): Promise<any> {
    return this.makeRequest(`/continuous-debug-sessions/${sessionId}/save`, 'POST', request, signal)
  }

  /**
   * Stop an active continuous debug session
   * @param sessionId - ID of the session to stop
   */
  async stopContinuousDebugSession(sessionId: string): Promise<any> {
    return this.makeRequest(`/continuous-debug-sessions/${sessionId}/cancel`, 'DELETE')
  }

  /**
   * Check debug session should be started remotely
   */
  async checkRemoteSession(
    requestBody: CheckRemoteSessionRequest,
    signal?: AbortSignal
  ): Promise<{ state: 'START' | 'STOP' }> {
    return this.makeRequest('/remote-debug-session/check', 'POST', requestBody, signal)
  }

  /**
   * Export events to the session debugger API
   */
  async exportEvents(sessionId: string, requestBody: { events: eventWithTime[] }, signal?: AbortSignal): Promise<any> {
    return this.makeRequest(`/debug-sessions/${sessionId}/rrweb-events`, 'POST', requestBody, signal)
  }

  /**
   * Make a request to the session debugger API
   * @param path - API endpoint path (relative to the base URL)
   * @param method - HTTP method (GET, POST, PATCH, etc.)
   * @param body - request payload
   * @param signal - AbortSignal to set request's signal
   */
  private async makeRequest(path: string, method: string, body?: any, signal?: AbortSignal): Promise<any> {
    const url = `${this.config.apiBaseUrl}/v0/radar${path}`
    const params = {
      method,
      body: body ? JSON.stringify(body) : null,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'X-Api-Key': this.config.apiKey })
      }
    }

    try {
      const response = await fetch(url, {
        ...params,
        credentials: 'include',
        signal
      })

      if (!response.ok) {
        throw new Error('Network response was not ok: ' + response.statusText)
      }

      if (response.status === 204) {
        return null
      }

      return await response.json()
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Request aborted')
      }
      return this.handleRequestError(error, { url, params })
    }
  }

  private async handleRequestError(error: any, payload: { url: string; params: any }) {
    if (this.config.usePostMessageFallback) {
      try {
        const response = await messagingService.sendMessagePromise('request', payload)
        return response
      } catch (error: any) {
        throw new Error('Error making request: ' + error.message)
      }
    } else {
      throw new Error('Error making request: ' + error.message)
    }
  }
}
