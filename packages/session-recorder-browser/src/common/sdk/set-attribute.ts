import {
  trace,
  AttributeValue,
  context
} from '@opentelemetry/api'
import {
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
  ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
  ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
  ATTR_MULTIPLAYER_RPC_REQUEST_MESSAGE,
  ATTR_MULTIPLAYER_RPC_RESPONSE_MESSAGE,
  ATTR_MULTIPLAYER_GRPC_REQUEST_MESSAGE,
  ATTR_MULTIPLAYER_GRPC_RESPONSE_MESSAGE,
  ATTR_MULTIPLAYER_MESSAGING_MESSAGE_BODY
} from '../constants.base'
import mask, { sensitiveFields, sensitiveHeaders } from './mask'

/**
 * @description Set attribute to current span
 * @param {string} key
 * @param {AttributeValue} value
 * @returns {void}
 */
export const setAttribute = (key: string, value: AttributeValue) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  span.setAttribute(key, value)
}

/**
 * @description Set request body to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setHttpRequestBody = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveFields)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_HTTP_REQUEST_BODY, body)
}

/**
 * @description Set request headers to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setHttpRequestHeaders = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveHeaders)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS, body)
}

/**
 * @description Set response body to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setHttpResponseBody = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveFields)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY, body)
}

/**
 * @description Set response body to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setHttpResponseHeaders = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveFields)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS, body)
}

/**
 * @description Set message body to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setMessageBody = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveFields)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_MESSAGING_MESSAGE_BODY, body)
}

/**
 * @description Set rpc request message to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setRpcRequestMessage = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveFields)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_RPC_REQUEST_MESSAGE, body)
}

/**
 * @description Set rpc response message to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setRpcResponseMessage = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveFields)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_RPC_RESPONSE_MESSAGE, body)
}

/**
 * @description Set grpc request message to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setGrpcRequestMessage = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveFields)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_GRPC_REQUEST_MESSAGE, body)
}

/**
 * @description Set grpc response message to current span attributes
 * @param body
 * @param {{ mask: boolean }} options
 * @returns {void}
 */
export const setGrpcResponseMessage = (
  body: any,
  options: { mask: boolean } = { mask: true }
) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  if (options?.mask) {
    body = mask(sensitiveFields)(body, span)
  }

  span.setAttribute(ATTR_MULTIPLAYER_GRPC_RESPONSE_MESSAGE, body)
}
