import { DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE } from '../config'

export const configs = {
  recordRequestHeaders: true,
  recordResponseHeaders: true,
  shouldRecordBody: true,
  maxCapturingHttpPayloadSize: DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE,
}

export const setMaxCapturingHttpPayloadSize = (_maxCapturingHttpPayloadSize: number) => {
  configs.maxCapturingHttpPayloadSize = _maxCapturingHttpPayloadSize
}

export const setShouldRecordHttpData = (shouldRecordBody: boolean, shouldRecordHeaders: boolean) => {
  configs.recordRequestHeaders = shouldRecordHeaders
  configs.recordResponseHeaders = shouldRecordHeaders
  configs.shouldRecordBody = shouldRecordBody
}