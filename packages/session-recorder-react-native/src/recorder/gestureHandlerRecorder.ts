import { Gesture } from 'react-native-gesture-handler'
import { ReactNode } from 'react'
import { SessionState } from '../types'
import { GestureInstrumentation } from '../otel/instrumentations/gestureInstrumentation'

export interface GestureHandlerRecorderProps {
  children: ReactNode
  sessionState: SessionState | null
  onGestureRecord: (gestureType: string, data: any) => void
}

export class GestureHandlerRecorder {
  private gestureInstrumentation: GestureInstrumentation
  private onGestureRecord?: (gestureType: string, data: any) => void

  constructor() {
    this.gestureInstrumentation = new GestureInstrumentation()
    this.gestureInstrumentation.enable()
  }

  setGestureCallback(callback: (gestureType: string, data: any) => void) {
    this.onGestureRecord = callback
  }

  // Create tap gesture
  createTapGesture() {
    return Gesture.Tap()
      .onStart((event) => {
        this.recordGesture('tap', {
          x: event.x,
          y: event.y,
          timestamp: Date.now(),
        })
      })
  }

  // Create pan gesture (for swipes and drags)
  createPanGesture() {
    return Gesture.Pan()
      .onStart((event) => {
        this.recordGesture('pan_start', {
          x: event.x,
          y: event.y,
          timestamp: Date.now(),
        })
      })
      .onUpdate((event) => {
        this.recordGesture('pan_update', {
          x: event.x,
          y: event.y,
          translationX: event.translationX,
          translationY: event.translationY,
          velocityX: event.velocityX,
          velocityY: event.velocityY,
          timestamp: Date.now(),
        })
      })
      .onEnd((event) => {
        this.recordGesture('pan_end', {
          x: event.x,
          y: event.y,
          translationX: event.translationX,
          translationY: event.translationY,
          velocityX: event.velocityX,
          velocityY: event.velocityY,
          timestamp: Date.now(),
        })
      })
  }

  // Create pinch gesture
  createPinchGesture() {
    return Gesture.Pinch()
      .onStart((event) => {
        this.recordGesture('pinch_start', {
          scale: event.scale,
          focalX: event.focalX,
          focalY: event.focalY,
          timestamp: Date.now(),
        })
      })
      .onUpdate((event) => {
        this.recordGesture('pinch_update', {
          scale: event.scale,
          focalX: event.focalX,
          focalY: event.focalY,
          timestamp: Date.now(),
        })
      })
      .onEnd((event) => {
        this.recordGesture('pinch_end', {
          scale: event.scale,
          focalX: event.focalX,
          focalY: event.focalY,
          timestamp: Date.now(),
        })
      })
  }

  // Create long press gesture
  createLongPressGesture() {
    return Gesture.LongPress()
      .minDuration(500)
      .onStart((event) => {
        this.recordGesture('long_press', {
          x: event.x,
          y: event.y,
          duration: 500,
          timestamp: Date.now(),
        })
      })
  }

  private recordGesture(gestureType: string, data: any) {
    // Record with OpenTelemetry
    switch (gestureType) {
      case 'tap':
        this.gestureInstrumentation.recordTap(data.x, data.y)
        break
      case 'pan_start':
      case 'pan_update':
      case 'pan_end':
        this.gestureInstrumentation.recordPan(data.translationX || 0, data.translationY || 0)
        break
      case 'pinch_start':
      case 'pinch_update':
      case 'pinch_end':
        this.gestureInstrumentation.recordPinch(data.scale, undefined)
        break
      case 'long_press':
        this.gestureInstrumentation.recordLongPress(data.duration, undefined)
        break
    }

    // Record with session recorder
    if (this.onGestureRecord) {
      this.onGestureRecord(gestureType, data)
    }
  }

  // Create a gesture detector component
  createGestureDetector(children: ReactNode, sessionState: SessionState | null): ReactNode {
    if (sessionState !== SessionState.started) {
      return children
    }

    const tapGesture = this.createTapGesture()
    const panGesture = this.createPanGesture()
    const pinchGesture = this.createPinchGesture()
    const longPressGesture = this.createLongPressGesture()

    // Note: This would need to be implemented as a proper React component
    // For now, return children directly - the gesture detection would be handled
    // at the app level by wrapping the entire app with GestureHandlerRootView
    return children
  }
}
