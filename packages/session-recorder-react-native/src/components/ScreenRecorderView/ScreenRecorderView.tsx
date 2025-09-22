import SessionRecorder from '@multiplayer-app/session-recorder-react-native'
import React, { PropsWithChildren, useCallback } from 'react'
import { View } from 'react-native'
import { SessionState } from '../../types'
import { logger } from '../../utils'
import { GestureCaptureWrapper } from '../GestureCaptureWrapper'

interface ScreenRecorderViewProps extends PropsWithChildren {}

export const ScreenRecorderView = ({ children }: ScreenRecorderViewProps) => {
  // Set up gesture recording callback
  const handleGestureRecord = useCallback((gestureType: string, data: any) => {
    if (SessionRecorder.sessionState !== SessionState.started) {
      logger.debug('SessionRecorderContext', 'Gesture recording skipped', {
        client: !!SessionRecorder.sessionState,
        sessionState: SessionRecorder.sessionState
      })
      return
    }
    logger.debug('SessionRecorderContext', 'Gesture recorded', { gestureType, data })
    try {
      // Record gesture as appropriate touch events
      switch (gestureType) {
        case 'tap':
          // For tap, record both touch start and end
          logger.debug('SessionRecorderContext', 'Recording tap as touch start + end')
          SessionRecorder.recordTouchStart?.(data.x, data.y, undefined, 1.0)
          SessionRecorder.recordTouchEnd?.(data.x, data.y, undefined, 1.0)
          break

        case 'pan_start':
          logger.debug('SessionRecorderContext', 'Recording pan_start as touch start')
          SessionRecorder.recordTouchStart?.(data.x, data.y, undefined, 1.0)
          break

        case 'pan_update':
          logger.debug('SessionRecorderContext', 'Recording pan_update as touch move')
          SessionRecorder.recordTouchMove?.(data.x, data.y, undefined, 1.0)
          break

        case 'pan_end':
          logger.debug('SessionRecorderContext', 'Recording pan_end as touch end')
          SessionRecorder.recordTouchEnd?.(data.x, data.y, undefined, 1.0)
          break

        case 'long_press':
          logger.debug('SessionRecorderContext', 'Recording long_press as touch start + end')
          SessionRecorder.recordTouchStart?.(data.x, data.y, undefined, 1.0)
          SessionRecorder.recordTouchEnd?.(data.x, data.y, undefined, 1.0)
          break
        default:
      }
    } catch (error) {
      logger.error('SessionRecorderContext', 'Failed to record gesture event', error)
    }
  }, [])

  // Callback ref to set the viewshot ref immediately when available
  const setViewShotRef = (ref: View | null) => {
    if (ref) {
      SessionRecorder.setViewShotRef?.(ref)
    }
  }

  const gesturesEnabled = SessionRecorder.sessionState === SessionState.started

  return (
    <View ref={setViewShotRef} style={{ flex: 1 }}>
      <GestureCaptureWrapper enabled={gesturesEnabled} onGestureRecord={handleGestureRecord}>
        {children}
      </GestureCaptureWrapper>
    </View>
  )
}
