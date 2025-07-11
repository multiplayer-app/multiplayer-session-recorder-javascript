import messagingService from './messaging.service'

export interface ApiServiceConfig {
  apiKey?: string
  exporterApiBaseUrl: string
  continuesDebugging?: boolean
  usePostMessageFallback?: boolean
}

export interface StartSessionRequest {
  name?: string
  stoppedAt?: string | number
  metadata?: Record<string, any>
  clientMetadata?: Record<string, any>
  debugSessionData?: Record<string, any>
}

export interface StopSessionRequest {
  userMetadata?: {
    comment?: string
  }
  stoppedAt: string | number
}

export class ApiService {
  private config: ApiServiceConfig

  // private get sessionPath() {
  //   return this.config.continuesDebugging
  //     ? '/continuous-debug-sessions'
  //     : '/debug-sessions'
  // }

  constructor() {
    this.config = {
      exporterApiBaseUrl: '',
    }
  }

  /**
   * Initialize the API service
   * @param config - API service configuration
   */
  public init(config: ApiServiceConfig) {
    this.config = { ...this.config, ...config }
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
  async startSession(
    request: StartSessionRequest,
    signal?: AbortSignal,
  ): Promise<any> {
    return this.makeRequest(
      '/debug-sessions/start',
      'POST',
      request,
      signal,
    )
  }


  /**
   * Stop an active debug session
   * @param sessionId - ID of the session to stop
   * @param request - Session stop request data
   */
  async stopSession(
    sessionId: string,
    request: StopSessionRequest,
  ): Promise<any> {
    return this.makeRequest(
      `/debug-sessions/${sessionId}/stop`,
      'PATCH',
      request,
    )
  }

  /**
   * Cancel an active debug session
   * @param sessionId - ID of the session to cancel
   */
  async cancelSession(sessionId: string): Promise<any> {
    return this.makeRequest(
      `/debug-sessions/${sessionId}/cancel`,
      'DELETE',
    )
  }



  /**
   * Start a new debug session
   * @param request - Session start request data
   * @param signal - Optional AbortSignal for request cancellation
   */
  async startContinuousDebugSession(
    request: StartSessionRequest,
    signal?: AbortSignal,
  ): Promise<any> {
    return this.makeRequest(
      '/continuous-debug-sessions/start',
      'POST',
      request,
      signal,
    )
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
    signal?: AbortSignal,
  ): Promise<any> {
    return this.makeRequest(
      `/continuous-debug-sessions/${sessionId}/save`,
      'POST',
      request,
      signal,
    )
  }


  /**
   * Stop an active continuous debug session
   * @param sessionId - ID of the session to stop
   */
  async stopContinuousDebugSession(sessionId: string): Promise<any> {
    return this.makeRequest(
      `/continuous-debug-sessions/${sessionId}/cancel`,
      'DELETE',
    )
  }

  /**
   * Make a request to the session debugger API
   * @param path - API endpoint path (relative to the base URL)
   * @param method - HTTP method (GET, POST, PATCH, etc.)
   * @param body - request payload
   * @param signal - AbortSignal to set request's signal
   */
  private async makeRequest(
    path: string,
    method: string,
    body?: any,
    signal?: AbortSignal,
  ): Promise<any> {
    const url = `${this.config.exporterApiBaseUrl}/v0/radar${path}`
    const params = {
      method,
      body: body ? JSON.stringify(body) : null,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'X-Api-Key': this.config.apiKey }),
      },
    }

    try {
      const response = await fetch(url, {
        ...params,
        credentials: 'include',
        signal,
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

  private async handleRequestError(
    error: any,
    payload: { url: string; params: any },
  ) {
    if (this.config.usePostMessageFallback) {
      try {
        const response = await messagingService.sendMessagePromise(
          'request',
          payload,
        )
        return response
      } catch (error: any) {
        throw new Error('Error making request: ' + error.message)
      }
    } else {
      throw new Error('Error making request: ' + error.message)
    }
  }
}
