const win: (Window & typeof globalThis) | undefined = typeof window !== 'undefined' ? window : undefined

const global: typeof globalThis | undefined = typeof globalThis !== 'undefined' ? globalThis : win

export const ArrayProto = Array.prototype
export const nativeForEach = ArrayProto.forEach


export const nativeIndexOf = ArrayProto.indexOf

export const navigator = global?.navigator
export const document = global?.document
export const location = global?.location
export const fetch = global?.fetch
export const XMLHttpRequest =
    global?.XMLHttpRequest && 'withCredentials' in new global.XMLHttpRequest() ? global.XMLHttpRequest : undefined
export const AbortController = global?.AbortController
export const userAgent = navigator?.userAgent


export { win as window }
