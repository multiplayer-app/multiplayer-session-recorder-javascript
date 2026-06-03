/**
 * Request utility functions for React Native
 */

/**
 * Convert FormData to query string (React Native compatible)
 * @param formData - FormData object
 * @returns Query string
 */
export const formDataToQuery = (formData: any): string => {
  if (!formData) return ''

  // In React Native, FormData is handled differently
  // This is a simplified implementation
  const params = new URLSearchParams()

  if (typeof formData.entries === 'function') {
    for (const [key, value] of formData.entries()) {
      params.append(key, value as string)
    }
  } else if (typeof formData === 'object') {
    for (const [key, value] of Object.entries(formData)) {
      params.append(key, String(value))
    }
  }

  return params.toString()
}

/**
 * Convert object to query string
 * @param obj - Object to convert
 * @returns Query string
 */
export const objectToQuery = (obj: Record<string, any>): string => {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      params.append(key, String(value))
    }
  }

  return params.toString()
}

/**
 * Parse query string to object
 * @param queryString - Query string to parse
 * @returns Object with parsed parameters
 */
export const queryToObject = (queryString: string): Record<string, string> => {
  const params = new URLSearchParams(queryString)
  const obj: Record<string, string> = {}

  for (const [key, value] of params.entries()) {
    obj[key] = value
  }

  return obj
}
