import React, { createContext, useContext, ReactNode, PropsWithChildren, useState, useEffect, useRef, useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SessionRecorderOptions, SessionState } from '../types'
import SessionRecorder from '../session-recorder'
import { GestureCaptureWrapper } from '../components/GestureCaptureWrapper'
import sessionRecorder from '../session-recorder'
import { logger } from '../utils'

interface SessionRecorderContextType {
  instance: typeof SessionRecorder
}

const SessionRecorderContext = createContext<SessionRecorderContextType | null>(null)

export interface SessionRecorderProviderProps extends PropsWithChildren {
  options: SessionRecorderOptions
}

export const SessionRecorderProvider: React.FC<SessionRecorderProviderProps> = ({ children, options }) => {
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const optionsRef = useRef<string>()

  useEffect(() => {
    const newOptions = JSON.stringify(options)
    if (optionsRef.current === JSON.stringify(options)) return
    optionsRef.current = newOptions
    SessionRecorder.init(options)
  }, [options])

  useEffect(() => {
    setSessionState(SessionRecorder.sessionState)
    SessionRecorder.on('state-change', (state: SessionState) => {
      setSessionState(state)
    })
  }, [])

  const onToggleSession = () => {
    if (SessionRecorder.sessionState === SessionState.started) {
      SessionRecorder.stop()
    } else {
      SessionRecorder.start()
    }
  }

  return (
    <SessionRecorderContext.Provider value={{ instance: sessionRecorder }}>
      <GestureEventCapture>
        {children}
        <Pressable onPress={onToggleSession}>
          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 100,
              width: 48,
              height: 48,
              paddingTop: 16,
              paddingLeft: 10,
              backgroundColor: 'red',
              borderTopLeftRadius: 24,
              borderBottomLeftRadius: 24
            }}
          >
            <Text style={{ color: 'white' }}>{sessionState === SessionState.started ? 'Stop' : 'Start'}</Text>
          </View>
        </Pressable>
      </GestureEventCapture>
    </SessionRecorderContext.Provider>
  )
}

// Gesture-based event capture component
const GestureEventCapture: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  return (
    <GestureCaptureWrapper onGestureRecord={handleGestureRecord}>
      <View ref={setViewShotRef} style={{ flex: 1 }}>
        {children}
      </View>
    </GestureCaptureWrapper>
  )
}

export const useSessionRecorder = (): SessionRecorderContextType => {
  const context = useContext(SessionRecorderContext)
  if (!context) {
    throw new Error('useSessionRecorder must be used within a SessionRecorderProvider')
  }
  return context
}
