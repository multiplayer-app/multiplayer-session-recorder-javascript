import { OAuthManager, OAuthServerParams } from '../auth/oauth-manager.js'
import { writeProfile } from '../cli/profile.js'
import { BASE_API_URL } from '../config.js'
import logger from '../logger.js'

interface LoginOptions {
  url?: string
  profileName?: string
}

async function getOAuthParams(baseUrl: string): Promise<OAuthServerParams> {
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
  const profileName = opts.profileName || process.env.MULTIPLAYER_PROFILE || 'default'
  const oauthManager = new OAuthManager()

  logger.info('Fetching OAuth configuration...')
  const oauthParams = await getOAuthParams(baseUrl)
  await oauthManager.init(oauthParams)

  logger.info('Opening browser for authentication...')

  // Wire up stdin so the user can paste a token obtained via the manual URL
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
  if (token) {
    writeProfile(profileName, { apiKey: token, ...(opts.url ? { url: opts.url } : {}) })
    logger.info(`Successfully authenticated! Token saved to profile '${profileName}'.`)
  } else {
    logger.info('Successfully authenticated!')
  }
}


export function logout(): void {
  const oauthManager = new OAuthManager()
  oauthManager.logout()
  logger.info('Logged out successfully.')
}

export async function status(): Promise<void> {
  const oauthManager = new OAuthManager()
  const token = await oauthManager.getAccessToken()
  if (token) {
    logger.info('Authenticated.')
  } else {
    logger.info('Not authenticated. Run `multiplayer auth login` to sign in.')
  }
}
