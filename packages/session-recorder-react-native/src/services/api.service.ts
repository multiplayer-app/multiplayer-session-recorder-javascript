import { IResourceAttributes, ISessionAttributes, ApiServiceConfig } from '../types'

export interface StartSessionRequest {
  name?: string
  stoppedAt?: string | number
  sessionAttributes?: ISessionAttributes
  resourceAttributes?: IResourceAttributes
  debugSessionData?: Record<string, any>
  tags?: { key?: string, value: string }[]
}

export interface StopSessionRequest {
  sessionAttributes?: ISessionAttributes
  stoppedAt: string | number
}

export class ApiService {
  private config?: ApiServiceConfig
  private baseUrl: string = 'https://api.multiplayer.app'

  constructor() {
    this.config = {
      apiKey: '',
      apiBaseUrl: '',
      exporterEndpoint: '',
    }
  }

  init(config: ApiServiceConfig): void {
    this.config = {
      ...this.config,
      ...config,
    }
    if (config.apiBaseUrl) {
      this.baseUrl = config.apiBaseUrl
    }
  }

  /**
   * Update the API service configuration
   * @param config - Partial configuration to update
   */
  public updateConfigs(config: Partial<ApiServiceConfig>) {
    if (this.config) {
      this.config = { ...this.config, ...config }
    }
  }

  /**
   * Set the API key
   * @param apiKey - The API key to set
   */
  setApiKey(apiKey: string): void {
    if (this.config) {
      this.config.apiKey = apiKey
    }
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
    const url = `${this.baseUrl}/v0/radar${path}`
    const params = {
      method,
      body: body ? JSON.stringify(body) : null,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config?.apiKey && { 'X-Api-Key': this.config.apiKey }),
      },
    }

    try {
      const response = await fetch(url, {
        ...params,
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
      throw new Error('Error making request: ' + error.message)
    }
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
    try {
      const res = await this.makeRequest(
        '/debug-sessions/start',
        'POST',
        request,
        signal,
      )
      return res
    } catch (error: any) {
      throw error
    }
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
   * Start a new continuous debug session
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
   * Check debug session should be started remotely
   */
  async checkRemoteSession(
    requestBody: StartSessionRequest,
    signal?: AbortSignal,
  ): Promise<{ state: 'START' | 'STOP' }> {
    return this.makeRequest(
      '/remote-debug-session/check',
      'POST',
      requestBody,
      signal,
    )
  }
}
