import {
  trace,
  AttributeValue,
  context
} from '@opentelemetry/api'

/**
 * @description Add attribute to current span
 * @param {string} key
 * @param {AttributeValue} value
 * @returns {void}
 */
export const setAttribute = (key: string, value: AttributeValue) => {
  const span = trace.getSpan(context.active())
  if (!span) return

  span.setAttribute(key, value)
}
