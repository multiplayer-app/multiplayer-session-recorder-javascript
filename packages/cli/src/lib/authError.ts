export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export const AUTH_STATUS_CODES: ReadonlySet<number> = new Set([401, 403])

const AUTH_MESSAGE_PATTERN = /\b(401|403|unauthorized|forbidden|authentication|invalid\s+token|jwt\s+expired|invalid\s+api\s+key)\b/i

export const isAuthErrorMessage = (msg: string): boolean => AUTH_MESSAGE_PATTERN.test(msg)
