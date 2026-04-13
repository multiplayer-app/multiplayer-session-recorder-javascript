import crypto from 'crypto'

export interface OauthClient {
  clientId: string
  clientSecret: string
  registrationToken?: string
  redirectUri: string
  clientSecretExpiresAt?: number // Unix timestamp in seconds
}

export interface AuthParams {
  codeVerifier: string
  state: string
}

export interface AuthData {
  oauthAccessToken: string
  oauthRefreshToken: string
  accessTokenExpiresAt: number
}

export class TokenStore {
  private authParams: AuthParams | undefined
  private oauthClients: Record<string, OauthClient> = {}
  private authData: AuthData | undefined

  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    return { codeVerifier, codeChallenge }
  }

  getAuthParams(): AuthParams | undefined {
    return this.authParams
  }

  generateAuthParams(): AuthParams & { codeChallenge: string } {
    const { codeVerifier, codeChallenge } = this.generatePKCE()
    const state = crypto.randomBytes(16).toString('hex')
    this.authParams = { codeVerifier, state }
    return { ...this.authParams, codeChallenge }
  }

  storeOauthClient(client: OauthClient, serverUrl: string): void {
    this.oauthClients[serverUrl] = client
  }

  getOauthClient(serverUrl: string): OauthClient | undefined {
    return this.oauthClients[serverUrl]
  }

  storeAuthData(data: AuthData): void {
    this.authData = data
  }

  getAuthData(): AuthData | undefined {
    return this.authData
  }

  cleanup(force = false, serverUrl?: string): void {
    this.authData = undefined
    this.authParams = undefined
    if (force && serverUrl) {
      delete this.oauthClients[serverUrl]
    } else if (force) {
      this.oauthClients = {}
    }
  }
}
