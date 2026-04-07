import { OAuthManager, OAuthServerParams } from '../auth/oauth-manager.js'
import { writeProfile } from '../cli/profile.js'
import { BASE_API_URL } from '../config.js'
import logger from '../logger.js'

function getProfileName(): string {
  return process.env.MULTIPLAYER_PROFILE || 'default'
}

async function getOAuthParams(): Promise<OAuthServerParams> {
  const response = await fetch(`${BASE_API_URL}/.well-known/oauth-authorization-server`)
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

export async function login(): Promise<void> {
  const oauthManager = new OAuthManager()

  logger.info('Fetching OAuth configuration...')
  const oauthParams = await getOAuthParams()
  await oauthManager.init(oauthParams)

  logger.info('Opening browser for authentication...')
  await oauthManager.authenticate(url => {
    process.stdout.write(`\nIf your browser did not open, visit this URL to authenticate:\n\n  ${url}\n\n`)
  })

  const token = await oauthManager.getAccessToken()
  if (token) {
    const profileName = getProfileName()
    writeProfile(profileName, { apiKey: token })
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
