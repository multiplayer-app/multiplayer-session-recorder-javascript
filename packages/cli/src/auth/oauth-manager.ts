import http from 'http'
import net from 'net'
import { exec } from 'child_process'
import { URL, parse as parseUrl } from 'url'
import { TokenStore, OauthClient, AuthData } from './token-store.js'

export interface OAuthServerParams {
  authorizationServerUrl: string
  registrationEndpoint: string
  authorizationEndpoint: string
  tokenEndpoint: string
}

interface ClientRegistrationResponse {
  client_id: string
  client_secret: string
  redirect_uris: string[]
  client_id_issued_at?: number
  client_secret_expires_at?: number
  registration_access_token?: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
}

function isLikelyOfflineError(error: unknown): boolean {
  const msg = ((error as any)?.message || '').toString()
  return (
    (error as any)?.name === 'AbortError' ||
    msg.includes('fetch failed') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT')
  )
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, () => {
      const address = server.address()
      if (typeof address === 'object' && address?.port) {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        reject(new Error('Failed to get available port'))
      }
    })
    server.on('error', reject)
  })
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`
  exec(cmd)
}

export class OAuthManager {
  private tokenStore = new TokenStore()
  private authServer: http.Server | null = null
  private authorizationServerUrl = ''
  private registrationEndpoint = ''
  private authorizationEndpoint = ''
  private tokenEndpoint = ''
  private _callbackResolve: (() => void) | undefined
  private _callbackReject: ((err: Error) => void) | undefined
  private _callbackDone: Promise<void> | undefined

  private setParams(params: OAuthServerParams): void {
    this.authorizationServerUrl = params.authorizationServerUrl
    this.registrationEndpoint = params.registrationEndpoint
    this.authorizationEndpoint = params.authorizationEndpoint
    this.tokenEndpoint = params.tokenEndpoint
  }

  async init(oauthParams: OAuthServerParams, retry = 0): Promise<void> {
    if (retry > 10) throw new Error('Too many registration retries')
    this.setParams(oauthParams)

    const { redirectUri } = await this.getClientCredentials()
    const urlObj = new URL(redirectUri)
    const callbackPort = Number(urlObj.port)

    const portFree = await isPortAvailable(callbackPort)
    if (!portFree) {
      const newPort = await getAvailablePort()
      await this.registerClient(`http://localhost:${newPort}/callback`)
      await this.init(oauthParams, ++retry)
    }
  }

  private async registerClient(redirectUri: string): Promise<OauthClient> {
    const clientMetadata = {
      client_name: 'Multiplayer CLI',
      client_uri: 'https://multiplayer.app',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }

    try {
      const response = await fetch(this.registrationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(clientMetadata),
      })

      if (!response.ok) {
        throw new Error(`Client registration failed: ${response.status} ${response.statusText}`)
      }

      const resp = (await response.json()) as ClientRegistrationResponse
      const clientData: OauthClient = {
        clientId: resp.client_id,
        clientSecret: resp.client_secret,
        redirectUri: resp.redirect_uris[0]!,
        registrationToken: resp.registration_access_token,
        clientSecretExpiresAt: resp.client_secret_expires_at,
      }

      this.tokenStore.storeOauthClient(clientData)
      return clientData
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        throw new Error('Network error: please check your internet connection and try again.')
      }
      throw error
    }
  }

  private isClientSecretExpired(clientData: OauthClient): boolean {
    if (!clientData.clientSecretExpiresAt) return true
    return Date.now() >= clientData.clientSecretExpiresAt * 1000 - 5 * 60 * 1000
  }

  private async getClientCredentials(): Promise<OauthClient> {
    let clientData = this.tokenStore.getOauthClient()

    if (!clientData) {
      const callbackPort = await getAvailablePort()
      clientData = await this.registerClient(`http://localhost:${callbackPort}/callback`)
    } else if (this.isClientSecretExpired(clientData)) {
      clientData = await this.registerClient(clientData.redirectUri)
    }

    return clientData
  }

  async authenticate(onUrl?: (url: string) => void): Promise<void> {
    const { clientId, redirectUri } = await this.getClientCredentials()
    const authClientParams = this.tokenStore.generateAuthParams()
    const urlObj = new URL(redirectUri)
    const callbackPort = Number(urlObj.port)

    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: authClientParams.state,
      code_challenge: authClientParams.codeChallenge,
      code_challenge_method: 'S256',
      token_type: 'PERSONAL',
    })

    const authUrl = `${this.authorizationEndpoint}?${authParams.toString()}`

    // Wait for the server to start, then open the browser
    await this.startCallbackServer(callbackPort)

    openBrowser(authUrl)
    onUrl?.(authUrl)

    // Wait for the browser callback to complete
    await this._callbackDone
  }

  /**
   * Starts the local HTTP server. Resolves when the server is ready to accept
   * connections. The separate `_callbackDone` promise resolves when the browser
   * OAuth callback is fully handled.
   */
  private startCallbackServer(callbackPort: number): Promise<void> {
    // Create the callback promise before starting the server so it's ready
    // when the browser hits /callback
    this._callbackDone = new Promise<void>((res, rej) => {
      this._callbackResolve = res
      this._callbackReject = rej
    })

    return new Promise<void>((serverReady, serverError) => {
      if (this.authServer) {
        const address = this.authServer.address()
        const port = typeof address === 'object' && address ? address.port : undefined
        if (port === callbackPort) {
          serverReady()
          return
        }
      }

      const authServer = http.createServer(async (req, res) => {
        if (!req.url) return
        const parsed = parseUrl(req.url, true)
        if (parsed.pathname !== '/callback') return

        try {
          const code = parsed.query.code as string
          const state = parsed.query.state as string
          const error = parsed.query.error as string

          if (error) throw new Error(`OAuth error: ${error}`)
          if (!code || !state) throw new Error('Missing authorization code or state')

          await this.handleCallback(code, state)
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(
            '<html><body><h1>Authentication successful!</h1><p>You can close this window and return to the terminal.</p></body></html>',
          )
          this._callbackResolve?.()
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`<html><body><h1>Authentication failed</h1><p>${err.message}</p></body></html>`)
          this._callbackReject?.(err)
        } finally {
          await this.stopCallbackServer()
        }
      })

      authServer.listen(callbackPort, () => {
        this.authServer = authServer
        serverReady()
      })

      authServer.on('error', err => {
        authServer.close()
        serverError(err)
      })
    })
  }

  private async handleCallback(code: string, state: string): Promise<void> {
    const { clientId, clientSecret, redirectUri } = await this.getClientCredentials()
    const authParams = this.tokenStore.getAuthParams()

    if (state !== authParams?.state) throw new Error('Invalid state parameter')
    if (!authParams?.codeVerifier) throw new Error('Missing code verifier')

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: authParams.codeVerifier,
    })

    const tokenData = await this.fetchToken(tokenParams, clientData => {
      // On expired client secret, re-register and retry
      return this.registerClient(clientData.redirectUri).then(newClient => {
        const retryParams = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: newClient.redirectUri,
          client_id: newClient.clientId,
          client_secret: newClient.clientSecret,
          code_verifier: authParams.codeVerifier!,
        })
        return this.fetchToken(retryParams)
      })
    })

    this.tokenStore.storeAuthData({
      oauthAccessToken: tokenData.access_token,
      oauthRefreshToken: tokenData.refresh_token,
      accessTokenExpiresAt: Date.now() + tokenData.expires_in * 1000,
    })
  }

  /**
   * Fetch a token, with optional expired-client-secret recovery.
   */
  private async fetchToken(
    params: URLSearchParams,
    onExpiredSecret?: (current: OauthClient) => Promise<TokenResponse>,
  ): Promise<TokenResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: params.toString(),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: any
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error_description: errorText }
        }

        const isExpiredSecret =
          errorData.error === 'invalid_client' ||
          errorData.error_description?.toLowerCase().includes('expired') ||
          errorData.error_description?.toLowerCase().includes('client secret')

        if (isExpiredSecret && onExpiredSecret) {
          const current = this.tokenStore.getOauthClient()
          this.tokenStore.cleanup(true)
          return onExpiredSecret(current!)
        }

        throw new Error(
          `Token request failed: ${response.status} ${response.statusText} - ${errorData.error_description || errorText}`,
        )
      }

      return (await response.json()) as TokenResponse
    } catch (error) {
      clearTimeout(timeoutId)
      if (isLikelyOfflineError(error)) {
        throw new Error('Network error: please check your internet connection and try again.')
      }
      throw error
    }
  }

  private stopCallbackServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.authServer) return resolve()
      this.authServer.close(err => (err ? reject(err) : resolve()))
      this.authServer = null
    })
  }

  async getAccessToken(): Promise<string | null> {
    const authData = this.tokenStore.getAuthData()
    if (!authData?.oauthAccessToken) return null

    if (Date.now() >= authData.accessTokenExpiresAt) {
      return this.refreshToken(authData.oauthRefreshToken)
    }

    return authData.oauthAccessToken
  }

  private async refreshToken(refreshToken: string): Promise<string | null> {
    const { clientId, clientSecret, redirectUri } = await this.getClientCredentials()

    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })

    try {
      const tokenData = await this.fetchToken(tokenParams, current => {
        this.tokenStore.cleanup(true)
        return this.registerClient(current?.redirectUri ?? redirectUri).then(newClient => {
          const retryParams = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: newClient.clientId,
            client_secret: newClient.clientSecret,
          })
          return this.fetchToken(retryParams)
        })
      })

      const authData: AuthData = {
        oauthAccessToken: tokenData.access_token,
        oauthRefreshToken: tokenData.refresh_token,
        accessTokenExpiresAt: Date.now() + tokenData.expires_in * 1000,
      }
      this.tokenStore.storeAuthData(authData)
      return tokenData.access_token
    } catch (error) {
      this.logout()
      throw error
    }
  }

  logout(): void {
    this.tokenStore.cleanup()
  }

  isAuthenticated(): boolean {
    const authData = this.tokenStore.getAuthData()
    return !!authData?.oauthAccessToken
  }
}
