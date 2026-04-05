import fs from 'fs'
import path from 'path'
import os from 'os'
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

interface StoredData {
  oauth_client?: OauthClient
  oauth_data?: AuthData
}

function getStorePath(): string {
  return path.join(os.homedir(), '.multiplayer', 'oauth.json')
}

function readStore(): StoredData {
  const storePath = getStorePath()
  if (!fs.existsSync(storePath)) return {}
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf-8')) as StoredData
  } catch {
    return {}
  }
}

function writeStore(data: StoredData): void {
  const storePath = getStorePath()
  const dir = path.dirname(storePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
}

export class TokenStore {
  private authParams: AuthParams | undefined

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

  storeOauthClient(client: OauthClient): void {
    const store = readStore()
    store.oauth_client = client
    writeStore(store)
  }

  getOauthClient(): OauthClient | undefined {
    return readStore().oauth_client
  }

  storeAuthData(data: AuthData): void {
    const store = readStore()
    store.oauth_data = data
    writeStore(store)
  }

  getAuthData(): AuthData | undefined {
    return readStore().oauth_data
  }

  cleanup(force = false): void {
    const store = readStore()
    delete store.oauth_data
    if (force) delete store.oauth_client
    writeStore(store)
    this.authParams = undefined
  }
}
