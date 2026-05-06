import { OAuthManager } from '../auth/oauth-manager.js'
import { deleteProfileTokenData } from '../auth/token-store.js'
import { writeCredentials, renameAccount } from '../cli/profile.js'
import { createApiService } from './api.service.js'
import { BASE_API_URL } from '../config.js'
import { logger } from '../logger.js'

interface LoginOptions {
  url?: string
  profileName?: string
}

async function getOAuthParams(baseUrl: string) {
  const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)
  if (!response.ok) {
    throw new Error(`Failed to fetch OAuth configuration: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as any
  return {
    authorizationServerUrl: data.issuer,
    authorizationEndpoint: data.authorization_endpoint,
    tokenEndpoint: data.token_endpoint,
    registrationEndpoint: data.registration_endpoint,
  }
}

export async function login(opts: LoginOptions = {}): Promise<void> {
  const baseUrl = opts.url || BASE_API_URL
  const profileName = opts.profileName || 'default'
  const oauthManager = new OAuthManager(profileName)

  logger.info('Fetching OAuth configuration...')
  const oauthParams = await getOAuthParams(baseUrl)
  await oauthManager.init(oauthParams)

  logger.info('Opening browser for authentication...')

  const stdinHandler = (data: Buffer | string) => {
    oauthManager.completeManualAuth(data.toString().trim())
    process.stdin.pause()
  }
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', stdinHandler)
  process.stdin.resume()

  const fallbackRedirectUri = `${new URL(oauthParams.authorizationEndpoint).origin}/auth/authorize/oauth/callback`
  await oauthManager.authenticate((_browserUrl, fallbackUrl) => {
    process.stdout.write(
      `\nIf your browser did not open, visit this URL to authenticate and copy the token shown:\n\n  ${fallbackUrl}\n\nPaste the token: `,
    )
  }, fallbackRedirectUri)

  process.stdin.removeListener('data', stdinHandler)
  process.stdin.pause()

  const token = await oauthManager.getAccessToken()

  // Fetch email and rename the account key to the user's email
  let finalProfileName = profileName
  try {
    const api = createApiService({ url: baseUrl, apiKey: '', bearerToken: token! })
    const session = await api.fetchUserSession()
    if (session.email) {
      writeCredentials(profileName, { authType: 'oauth', email: session.email, ...(opts.url ? { url: opts.url } : {}) })
      if (session.email !== profileName) {
        renameAccount(profileName, session.email)
        finalProfileName = session.email
      }
      logger.info(`Successfully authenticated as ${session.email}!`)
      return
    }
  } catch { /* non-fatal — fall through to generic save */ }

  writeCredentials(profileName, {
    authType: 'oauth',
    ...(opts.url ? { url: opts.url } : {}),
  })

  logger.info(`Successfully authenticated! Credentials saved for profile '${finalProfileName}'.`)
}

/**
 * Silently return a valid OAuth access token for the given profile, refreshing
 * if the stored token is expired. Returns null when no token data exists
 * (caller should prompt for re-login).
 */
export async function refreshOAuthTokenIfNeeded(apiUrl: string, profileName: string): Promise<string | null> {
  const oauthManager = new OAuthManager(profileName)

  // The constructor already loads persisted server params. Try to fetch fresh
  // ones in case the server config changed; fall back to cached on network error.
  try {
    const oauthParams = await getOAuthParams(apiUrl)
    oauthManager.loadParams(oauthParams)
  } catch {
    // Network unreachable — proceed with whatever is cached in the token store
  }

  return oauthManager.getAccessToken()
}

export function logout(profileName = 'default'): void {
  const oauthManager = new OAuthManager(profileName)
  oauthManager.logout()
  deleteProfileTokenData(profileName)
  logger.info('Logged out successfully.')
}

export async function status(profileName = 'default'): Promise<void> {
  const oauthManager = new OAuthManager(profileName)
  const token = await oauthManager.getAccessToken()
  if (token) {
    logger.info('Authenticated.')
  } else {
    logger.info('Not authenticated. Run `multiplayer auth login` to sign in.')
  }
}
