export * from './session-recorder'
export * from './session'
export * from './configs'

// Import types for use in this file
import type { eventWithTime } from '@rrweb/types'


export interface ReactNativeScreenData {
  width: number
  height: number
  base64Image: string
  timestamp: number
  screenName?: string
}

export interface ReactNativeTouchData {
  pageX: number
  pageY: number
  target?: string
  pressure?: number
  timestamp: number
}


// Event recording interface
export interface EventRecorder {
  recordEvent(event: eventWithTime): void
}