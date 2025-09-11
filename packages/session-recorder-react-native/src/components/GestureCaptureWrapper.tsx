import React, { ReactNode, useCallback, useMemo } from 'react'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'

export interface GestureCaptureWrapperProps {
  children: ReactNode
  onGestureRecord: (gestureType: string, data: any) => void
}

export const GestureCaptureWrapper: React.FC<GestureCaptureWrapperProps> = ({ children, onGestureRecord }) => {
  const recordGesture = useCallback(
    (gestureType: string, data: any) => {
      // Record with session recorder
      onGestureRecord(gestureType, data)
    },
    [onGestureRecord]
  )

  // Create tap gesture
  const tapGesture = useMemo(() => {
    return Gesture.Tap()
      .runOnJS(true)
      .onStart((event) => {
        recordGesture('tap', {
          x: event.x,
          y: event.y,
          timestamp: Date.now()
        })
      })
  }, [recordGesture])

  // Create pan gesture (for swipes and drags)
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .runOnJS(true)
      .onStart((event) => {
        recordGesture('pan_start', {
          x: event.x,
          y: event.y,
          timestamp: Date.now()
        })
      })
      .onUpdate((event) => {
        recordGesture('pan_update', {
          x: event.x,
          y: event.y,
          translationX: event.translationX,
          translationY: event.translationY,
          velocityX: event.velocityX,
          velocityY: event.velocityY,
          timestamp: Date.now()
        })
      })
      .onEnd((event) => {
        recordGesture('pan_end', {
          x: event.x,
          y: event.y,
          translationX: event.translationX,
          translationY: event.translationY,
          velocityX: event.velocityX,
          velocityY: event.velocityY,
          timestamp: Date.now()
        })
      })
  }, [recordGesture])

  // Create long press gesture
  const longPressGesture = useMemo(() => {
    return Gesture.LongPress()
      .runOnJS(true)
      .minDuration(500)
      .onStart((event) => {
        recordGesture('long_press', {
          x: event.x,
          y: event.y,
          duration: 500,
          timestamp: Date.now()
        })
      })
  }, [recordGesture])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={Gesture.Simultaneous(tapGesture, panGesture, longPressGesture)}>{children}</GestureDetector>
    </GestureHandlerRootView>
  )
}
