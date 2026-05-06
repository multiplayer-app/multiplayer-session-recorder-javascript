import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { MP_DIR, LEGACY_TOKENS_FILE } from '../config.js'
import { getFileSuffix } from '../cli/profile.js'

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

export interface OAuthServerParams {
  authorizationServerUrl: string
  authorizationEndpoint: string
  tokenEndpoint: string
  registrationEndpoint: string
}

export interface ProfileTokenData {
  authData?: AuthData
  oauthClient?: OauthClient
  oauthServerParams?: OAuthServerParams
}

type TokensFile = Record<string, ProfileTokenData>

function credentialsFilePath(): string {
  return path.join(MP_DIR, `credentials${getFileSuffix()}.json`)
}

function migrateTokensFile(): void {
  if (!fs.existsSync(LEGACY_TOKENS_FILE)) return
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_TOKENS_FILE, 'utf-8')) as TokensFile
    const existing = readTokensFile()
    for (const [account, tokenData] of Object.entries(legacy)) {
      existing[account] = { ...existing[account], ...tokenData }
    }
    writeTokensFile(existing)
    fs.unlinkSync(LEGACY_TOKENS_FILE)
  } catch { /* best-effort */ }
}

function readTokensFile(): TokensFile {
  try {
    return JSON.parse(fs.readFileSync(credentialsFilePath(), 'utf-8')) as TokensFile
  } catch {
    return {}
  }
}

function writeTokensFile(data: TokensFile): void {
  try {
    const dir = path.dirname(credentialsFilePath())
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(credentialsFilePath(), JSON.stringify(data, null, 2), 'utf-8')
  } catch {
    // Best-effort
  }
}

export function readProfileTokenData(profileName: string): ProfileTokenData {
  migrateTokensFile()
  return readTokensFile()[profileName] ?? {}
}

export function writeProfileTokenData(profileName: string, data: Partial<ProfileTokenData>): void {
  migrateTokensFile()
  const all = readTokensFile()
  all[profileName] = { ...all[profileName], ...data }
  writeTokensFile(all)
}

export function deleteProfileTokenData(profileName: string): void {
  migrateTokensFile()
  const all = readTokensFile()
  const entry = all[profileName]
  if (!entry) return
  // Only remove OAuth token fields — preserve apiKey, authType, workspace, etc.
  delete entry.authData
  delete entry.oauthClient
  delete entry.oauthServerParams
  writeTokensFile(all)
}

/**
 * In-process token store scoped to a single profile.
 * Reads from and writes to ~/.multiplayer/tokens.json.
 */
export class TokenStore {
  private profileName: string
  private authParams: AuthParams | undefined
  private data: ProfileTokenData

  constructor(profileName: string) {
    this.profileName = profileName
    this.data = readProfileTokenData(profileName)
  }

  private save(): void {
    writeProfileTokenData(this.profileName, this.data)
  }

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

  storeOauthClient(client: OauthClient, _serverUrl: string): void {
    this.data.oauthClient = client
    this.save()
  }

  getOauthClient(_serverUrl: string): OauthClient | undefined {
    return this.data.oauthClient
  }

  storeAuthData(authData: AuthData): void {
    this.data.authData = authData
    this.save()
  }

  getAuthData(): AuthData | undefined {
    return this.data.authData
  }

  storeOAuthServerParams(params: OAuthServerParams): void {
    this.data.oauthServerParams = params
    this.save()
  }

  getOAuthServerParams(): OAuthServerParams | undefined {
    return this.data.oauthServerParams
  }

  cleanup(force = false, _serverUrl?: string): void {
    this.data.authData = undefined
    this.authParams = undefined
    if (force) {
      this.data.oauthClient = undefined
    }
    this.save()
  }
}
