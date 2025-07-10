import DOMPurify from 'dompurify'
import { Breaker } from '../types'
import { hasOwnProperty, isArray, isFormData, isNullish } from './type-utils'
import { nativeForEach } from './globals'

const breaker: Breaker = {}

export function eachArray<E = any>(
  obj: E[] | null | undefined,
  iterator: (value: E, key: number) => void | Breaker,
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

/**
 * @param {*=} obj
 * @param {function(...*)=} iterator
 * @param {Object=} thisArg
 */
export function each(obj: any, iterator: (value: any, key: any) => void | Breaker, thisArg?: any): void {
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
    if (hasOwnProperty.call(obj, key)) {
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

export function insertTrustedHTML(element: HTMLElement, html: string) {
  const sanitizedHTML = DOMPurify.sanitize(html, { RETURN_DOM: true })

  element.replaceChildren(...Array.from(sanitizedHTML.childNodes))
}
