/**
 * Validation helper functions for configuration objects
 */

export const isValidStringOrRegExp = (value: string | RegExp | undefined, defaultValue: string | RegExp) => {
  return typeof value === 'string' || value instanceof RegExp ? value : defaultValue
}

export const isValidString = <T extends string>(value: string | undefined | T, defaultValue: string) => {
  return typeof value === 'string' ? value.trim() : defaultValue
}

export const isValidNumber = (value: number | undefined, defaultValue: number) => {
  return typeof value === 'number' ? value : defaultValue
}

export const isValidBoolean = (value: boolean | undefined, defaultValue: boolean) => {
  return typeof value === 'boolean' ? value : defaultValue
}

export const isValidArray = <T>(value: ReadonlyArray<T> | undefined, defaultValue: ReadonlyArray<T>): T[] => {
  return Array.isArray(value) ? [...value] as T[] : [...defaultValue] as T[]
}

export const isValidEnum = <T>(value: any | T, defaultValue: T, enumValues: T[]): T => {
  return enumValues.includes(value as T) ? value as T : defaultValue
}

export const isValidFunction = (value: any, defaultValue: any) => {
  return typeof value === 'function' ? value : defaultValue
}