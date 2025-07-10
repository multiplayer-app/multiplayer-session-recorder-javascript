import type { OutgoingHttpHeaders } from 'http'
import { MASK_PLACEHOLDER } from '../constants.base'

const headerNamesToMask = [
  'set-cookie',
  'cookie',
  'authorization',
  'proxyAuthorization',
]

export const maskHeaders = (headers: OutgoingHttpHeaders, customHeaderNamesToMask: string[] = []) => {
  const _headers: OutgoingHttpHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
  const _headerNamesToMask = [...headerNamesToMask, ...customHeaderNamesToMask]

  for (const headerNameToMask of _headerNamesToMask) {
    if (headerNameToMask.toLowerCase() in _headers) {
      _headers[headerNameToMask] = MASK_PLACEHOLDER
    }
  }

  return _headers
}
