/**
 * RRWeb event types for React Native session recording
 * Based on rrweb specification: https://github.com/rrweb-io/rrweb
 */

export enum EventType {
  DomContentLoaded = 0,
  Load = 1,
  FullSnapshot = 2,
  IncrementalSnapshot = 3,
  Meta = 4,
  Custom = 5,
  Plugin = 6,
}

export enum IncrementalSource {
  Mutation = 0,
  MouseMove = 1,
  MouseInteraction = 2,
  Scroll = 3,
  ViewportResize = 4,
  Input = 5,
  TouchMove = 6,
  MediaInteraction = 7,
  StyleSheetRule = 8,
  CanvasMutation = 9,
  Font = 10,
  Selection = 11,
  AdoptedStyleSheet = 12,
}

export enum MouseInteractionType {
  MouseUp = 0,
  MouseDown = 1,
  Click = 2,
  ContextMenu = 3,
  DblClick = 4,
  Focus = 5,
  Blur = 6,
  TouchStart = 7,
  TouchMove = 8,
  TouchEnd = 9,
  TouchCancel = 10,
}

export interface MouseInteractionData {
  type: MouseInteractionType
  id: number
  x: number
  y: number
}

export interface TouchInteractionData {
  type: MouseInteractionType
  id: number
  x: number
  y: number
  pressure?: number
  target?: string
}

export interface FullSnapshotEvent {
  type: EventType.FullSnapshot
  data: {
    node: SerializedNodeWithId
    initialOffset: {
      left: number
      top: number
    }
  }
  timestamp: number
}

export interface IncrementalSnapshotEvent {
  type: EventType.IncrementalSnapshot
  data: {
    source: IncrementalSource
    id?: number
    x?: number
    y?: number
    type?: MouseInteractionType
  } & Partial<MouseInteractionData> & Partial<TouchInteractionData>
  timestamp: number
}

export interface SerializedNodeWithId {
  type: number
  id: number
  tagName?: string
  attributes?: Record<string, string>
  childNodes?: SerializedNodeWithId[]
  textContent?: string
  style?: Record<string, string>
}

export interface RRWebEvent {
  type: EventType
  data: any
  timestamp: number
}

// React Native specific types
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
  recordEvent(event: RRWebEvent): void
}
