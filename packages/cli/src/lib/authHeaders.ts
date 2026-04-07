import jwt from 'jsonwebtoken'

interface ApiKeyPayload {
  workspace?: string
  project?: string
  integration?: string
}

function decodePayload(token: string): ApiKeyPayload | null {
  try {
    const result = jwt.decode(token) as ApiKeyPayload | null
    return result ?? null
  } catch {
    return null
  }
}

/**
 * Returns true if the token should be sent as `Authorization: Bearer`.
 * Project API keys are JWTs with workspace + project + integration claims.
 * Everything else (OAuth JWTs, opaque tokens) uses Bearer auth.
 */
export function isOAuthToken(apiKey: string): boolean {
  const payload = decodePayload(apiKey)
  // Project API keys have all three claims embedded in the JWT
  if (payload?.integration && payload?.workspace && payload?.project) return false
  return true
}

/**
 * Returns the correct auth headers for the given token.
 * OAuth tokens use `Authorization: Bearer`, project API keys use `x-api-key`.
 */
export function getAuthHeaders(apiKey: string): Record<string, string> {
  return isOAuthToken(apiKey)
    ? { Authorization: `Bearer ${apiKey}` }
    : { 'x-api-key': apiKey }
}
