import type { Span } from '@opentelemetry/api'
import { MASK_PLACEHOLDER } from '../constants.base'

const MAX_DEPTH = 8
export const sensitiveFields: string[] = [
  'password',
  'pass',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'secret',
  'api_key',
  'apiKey',
  'authorization',
  'auth_token',
  'authToken',
  'jwt',
  'session_id',
  'sessionId',
  'sessionToken',
  'client_secret',
  'clientSecret',
  'private_key',
  'privateKey',
  'public_key',
  'publicKey',
  'key',
  'encryption_key',
  'encryptionKey',
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
  'ssn',
  'sin',
  'pin',
  'security_code',
  'securityCode',
  'bank_account',
  'bankAccount',
  'iban',
  'swift',
  'bic',
  'routing_number',
  'routingNumber',
  'license_key',
  'licenseKey',
  'otp',
  'mfa_code',
  'mfaCode',
  'phone_number',
  'phoneNumber',
  'email',
  'address',
  'dob',
  'tax_id',
  'taxId',
  'passport_number',
  'passportNumber',
  'driver_license',
  'driverLicense',

  'set-cookie',
  'cookie',
  'authorization',
  'proxyAuthorization',
]

export const sensitiveHeaders: string[] = [
  'set-cookie',
  'cookie',
  'authorization',
  'proxyAuthorization',
]

const maskAll = (value: any, depth = 0) => {
  const type = typeof value
  const isObject = type === 'object'
  let isArray = false

  if (Array.isArray(value)) {
    isArray = true
  }

  if (depth > MAX_DEPTH && (isObject || isArray)) {
    return undefined
  }

  if (isArray) {
    return value.map((val: any) => maskAll(val, depth + 1), value)
  }

  if (isObject) {
    for (const key in value) {
      value[key] = maskAll(value[key], depth + 1)
    }

    return value
  }

  if (type === 'string') {
    return MASK_PLACEHOLDER
  }

  return value
}

const maskSelected = (value: any, keysToMask: string[]): any => {
  const type = typeof value
  const isObject = type === 'object'

  const _keysToMask = new Set(keysToMask)

  if (Array.isArray(value)) {
    return value.map((val: any) => maskSelected(val, keysToMask), value)
  }

  if (isObject) {
    for (const key in value) {
      if (_keysToMask.has(key)) {
        value[key] = MASK_PLACEHOLDER
      } else {
        value[key] = maskSelected(value[key], keysToMask)
      }
    }

    return value
  }

  if (type === 'string') {
    return value
  }

  return value
}

export default (keysToMask: string[] = []) => (value: any, span?: Span): any => {
  let payloadJson
  try {
    payloadJson = JSON.parse(value)
  } catch {
    payloadJson = value
  }
  let maskedData
  if (keysToMask.length) {
    maskedData = maskSelected(payloadJson, keysToMask)
  } else {
    maskedData = maskAll(payloadJson)
  }
  if (typeof maskedData !== 'string') {
    maskedData = JSON.stringify(maskedData)
  }

  return maskedData
}
