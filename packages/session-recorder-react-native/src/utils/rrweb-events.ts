import { Dimensions } from 'react-native'
import { EventType, type eventWithTime, NodeType, type serializedNodeWithId, IncrementalSource, type mutationData } from '@rrweb/types'
import { getAppMetadata } from './platform'

/**
 * Creates a meta event to mark the start of recording
 * @param sessionId - The session ID
 * @param sessionType - The type of session (PLAIN or CONTINUOUS)
 * @param additionalData - Additional data to include in the meta event
 * @returns MetaEvent object
 */
export function createRecordingMetaEvent(): eventWithTime {
  const screenDimensions = Dimensions.get('window')
  const metadata = getAppMetadata()

  return {
    type: EventType.Meta,
    data: {
      href: metadata.bundleId || metadata.name || 'https://native.multiplayer.app',
      width: screenDimensions.width,
      height: screenDimensions.height,
    },
    timestamp: Date.now(),
  }
}

/**
 * Create a full snapshot event with the given base64 image
 * @param base64Image - Base64 encoded image data
 * @param width - Screen width
 * @param height - Screen height
 * @param captureFormat - Image format (png, jpg, etc.)
 * @param nodeIdCounter - Starting node ID counter (will be modified)
 * @param timestamp - Optional timestamp to use for the event
 * @returns Full snapshot event
 */
export function createFullSnapshotEvent(
  base64Image: string,
  width: number,
  height: number,
  captureFormat: string = 'jpg',
  nodeIdCounter: { current: number },
  timestamp?: number,
): eventWithTime {
  // Create a virtual DOM node representing the screen as an image
  const imageNode: serializedNodeWithId = {
    type: NodeType.Element,
    id: 0,
    tagName: 'img',
    attributes: {
      src: `data:image/${captureFormat};base64,${base64Image}`,
      width: width.toString(),
      height: height.toString(),
      style: `width: ${width}px; height: ${height}px;`,
    },
    childNodes: [],
  }

  // Create the root container
  const rootNode: serializedNodeWithId = {
    type: NodeType.Element,
    id: nodeIdCounter.current++,
    tagName: 'div',
    attributes: {
      style: `width: ${width}px; height: ${height}px; position: relative;`,
    },
    childNodes: [imageNode],
  }

  const domNode: serializedNodeWithId = {
    type: NodeType.Document,
    childNodes: [
      {
        type: NodeType.DocumentType,
        name: 'html',
        publicId: '',
        systemId: '',
        id: nodeIdCounter.current++,
      },
      {
        type: NodeType.Element,
        tagName: 'html',
        attributes: {},
        childNodes: [
          {
            type: NodeType.Element,
            tagName: 'head',
            attributes: {},
            childNodes: [
              {
                type: NodeType.Element,
                tagName: 'meta',
                attributes: { charset: 'utf-8' },
                childNodes: [],
                id: nodeIdCounter.current++,
              },
              {
                type: NodeType.Element,
                tagName: 'meta',
                attributes: {
                  name: 'viewport',
                  content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
                },
                childNodes: [],
                id: nodeIdCounter.current++,
              },
            ],
            id: nodeIdCounter.current++,
          },
          {
            type: NodeType.Element,
            tagName: 'body',
            attributes: {
              style: 'margin: 0; padding: 0; width: 100%; height: 100%;',
            },
            childNodes: [rootNode],
            id: nodeIdCounter.current++,
          },
        ],
        id: nodeIdCounter.current++,
      },
    ],
    id: nodeIdCounter.current++,
  }

  return {
    type: EventType.FullSnapshot,
    data: {
      node: domNode,
      initialOffset: { left: 0, top: 0 },
    },
    timestamp: timestamp || Date.now(),
  }
}

/**
 * Create an incremental snapshot event with mutation data to update image src
 * @param base64Image - New base64 encoded image data
 * @param captureFormat - Image format (png, jpg, etc.)
 * @param timestamp - Optional timestamp to use for the event
 * @returns Incremental snapshot event with mutation data
 */
export function createIncrementalSnapshotWithImageUpdate(
  base64Image: string,
  captureFormat: string = 'jpg',
  timestamp?: number,
): eventWithTime {
  const mutationData: mutationData = {
    source: IncrementalSource.Mutation,
    texts: [],
    attributes: [
      {
        id: 0,
        attributes: {
          src: `data:image/${captureFormat};base64,${base64Image}`,
        },
      },
    ],
    removes: [],
    adds: [],
  }

  return {
    type: EventType.IncrementalSnapshot,
    data: mutationData,
    timestamp: timestamp || Date.now(),
  }
}

/**
 * Create a simple image node for React Native screen capture
 * @param base64Image - Base64 encoded image data
 * @param width - Image width
 * @param height - Image height
 * @param captureFormat - Image format (png, jpg, etc.)
 * @param nodeId - Node ID for the image
 * @returns Serialized node with ID
 */
export function createImageNode(
  base64Image: string,
  width: number,
  height: number,
  captureFormat: string = 'jpg',
  nodeId: number,
): serializedNodeWithId {
  return {
    type: NodeType.Element,
    id: nodeId,
    tagName: 'img',
    attributes: {
      src: `data:image/${captureFormat};base64,${base64Image}`,
      width: width.toString(),
      height: height.toString(),
      style: `width: ${width}px; height: ${height}px;`,
    },
    childNodes: [],
  }
}

/**
 * Create a document node for React Native screen capture
 * @param imageNode - The image node to include
 * @param width - Screen width
 * @param height - Screen height
 * @param nodeIdCounter - Node ID counter (will be modified)
 * @returns Document node
 */
export function createDocumentNode(
  imageNode: serializedNodeWithId,
  width: number,
  height: number,
  nodeIdCounter: { current: number },
): serializedNodeWithId {
  // Create the root container
  const rootNode: serializedNodeWithId = {
    type: NodeType.Element,
    id: nodeIdCounter.current++,
    tagName: 'div',
    attributes: {
      style: `width: ${width}px; height: ${height}px; position: relative;`,
    },
    childNodes: [imageNode],
  }

  return {
    type: NodeType.Document,
    childNodes: [
      {
        type: NodeType.DocumentType,
        name: 'html',
        publicId: '',
        systemId: '',
        id: nodeIdCounter.current++,
      },
      {
        type: NodeType.Element,
        tagName: 'html',
        attributes: {},
        childNodes: [
          {
            type: NodeType.Element,
            tagName: 'head',
            attributes: {},
            childNodes: [
              {
                type: NodeType.Element,
                tagName: 'meta',
                attributes: { charset: 'utf-8' },
                childNodes: [],
                id: nodeIdCounter.current++,
              },
              {
                type: NodeType.Element,
                tagName: 'meta',
                attributes: {
                  name: 'viewport',
                  content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
                },
                childNodes: [],
                id: nodeIdCounter.current++,
              },
            ],
            id: nodeIdCounter.current++,
          },
          {
            type: NodeType.Element,
            tagName: 'body',
            attributes: {},
            childNodes: [rootNode],
            id: nodeIdCounter.current++,
          },
        ],
        id: nodeIdCounter.current++,
      },
    ],
    id: nodeIdCounter.current++,
  }
}

/**
 * Generate a simple hash for screen comparison
 * This is a lightweight hash that focuses on the beginning and end of the base64 string
 * to detect changes without doing a full comparison
 * @param base64Image - Base64 encoded image
 * @param sampleSize - Number of characters to sample from each part
 * @returns Hash string for comparison
 */
export function generateScreenHash(base64Image: string, sampleSize: number = 100): string {
  // Use a simple hash that samples the beginning, middle, and end of the base64 string
  // This is much faster than comparing the entire string
  const start = base64Image.substring(0, sampleSize)
  const middle = base64Image.substring(
    Math.floor(base64Image.length / 2) - sampleSize / 2,
    Math.floor(base64Image.length / 2) + sampleSize / 2,
  )
  const end = base64Image.substring(base64Image.length - sampleSize)

  // Combine samples and create a simple hash
  const combined = start + middle + end
  return simpleHash(combined)
}

/**
 * Simple hash function for string comparison
 * @param str - String to hash
 * @returns Hash value as string
 */
export function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
