import React, { ReactNode, useCallback, useMemo } from 'react'
import { View, PanResponder } from 'react-native'

export interface GestureCaptureWrapperProps {
  children: ReactNode
  onGestureRecord: (gestureType: string, data: any) => void
  enabled?: boolean
}

export const GestureCaptureWrapper: React.FC<GestureCaptureWrapperProps> = ({ children, onGestureRecord, enabled }) => {
  const recordGesture = useCallback(
    (gestureType: string, data: any) => {
      if (!enabled) return
      onGestureRecord(gestureType, data)
    },
    [enabled, onGestureRecord]
  )

  // Native touch event implementation as fallback
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        recordGesture('tap', {
          x: evt.nativeEvent.locationX,
          y: evt.nativeEvent.locationY,
          timestamp: Date.now()
        })
      },
      onPanResponderMove: (evt) => {
        recordGesture('pan_update', {
          x: evt.nativeEvent.locationX,
          y: evt.nativeEvent.locationY,
          translationX: evt.nativeEvent.pageX - evt.nativeEvent.locationX,
          translationY: evt.nativeEvent.pageY - evt.nativeEvent.locationY,
          timestamp: Date.now()
        })
      },
      onPanResponderRelease: (evt) => {
        recordGesture('pan_end', {
          x: evt.nativeEvent.locationX,
          y: evt.nativeEvent.locationY,
          timestamp: Date.now()
        })
      }
    })
  }, [recordGesture])

  return (
    <View collapsable={false} style={{ flex: 1 }} pointerEvents='box-none' {...panResponder.panHandlers}>
      {children}
    </View>
  )
}
