import { isArray, isFormData, isNullish } from './type-utils'
import { nativeForEach } from './globals'

const breaker: any = {}

export function eachArray<E = any>(
  obj: E[] | null | undefined,
  iterator: (value: E, key: number) => void | any,
  thisArg?: any,
): void {
  if (isArray(obj)) {
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, thisArg)
    } else if ('length' in obj && obj.length === +obj.length) {
      for (let i = 0, l = obj.length; i < l; i++) {
        if (i in obj && iterator.call(thisArg, obj[i], i) === breaker) {
          return
        }
      }
    }
  }
}

export function each(obj: any, iterator: (value: any, key: any) => void | any, thisArg?: any): void {
  if (isNullish(obj)) {
    return
  }
  if (isArray(obj)) {
    return eachArray(obj, iterator, thisArg)
  }
  if (isFormData(obj)) {
    for (const pair of obj.entries()) {
      if (iterator.call(thisArg, pair[1], pair[0]) === breaker) {
        return
      }
    }
    return
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (iterator.call(thisArg, obj[key], key) === breaker) {
        return
      }
    }
  }
}

export const isValidRegex = function (str: string): boolean {
  try {
    new RegExp(str)
  } catch {
    return false
  }
  return true
}