import SessionRecorder from '@multiplayer-app/session-recorder-react-native'
import React, { PropsWithChildren } from 'react'
import { View } from 'react-native'

interface ScreenRecorderViewProps extends PropsWithChildren {}

export const ScreenRecorderView = ({ children }: ScreenRecorderViewProps) => {
  // Callback ref to set the viewshot ref immediately when available
  const setViewShotRef = (ref: View | null) => {
    if (ref) {
      SessionRecorder.setViewShotRef?.(ref)
    }
  }

  return (
    <View ref={setViewShotRef} style={{ flex: 1 }}>
      {children}
    </View>
  )
}
