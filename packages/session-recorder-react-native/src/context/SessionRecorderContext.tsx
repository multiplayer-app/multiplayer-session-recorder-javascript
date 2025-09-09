import React, { createContext, useContext, ReactNode, PropsWithChildren, useMemo, useState, useEffect, useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SessionRecorderOptions, SessionState } from '../types'
import SessionRecorder from '../session-recorder'

interface SessionRecorderContextType {
  client: typeof SessionRecorder
}

const SessionRecorderContext = createContext<SessionRecorderContextType | null>(null)

export interface SessionRecorderProviderProps extends PropsWithChildren {
  options: SessionRecorderOptions
  client?: typeof SessionRecorder
}

export const SessionRecorderProvider: React.FC<SessionRecorderProviderProps> = ({ children, client, options }) => {
  const [sessionState, setSessionState] = useState<SessionState | null>(null)

  const sessionRecorder = useMemo(() => {
    if (client) return client
    SessionRecorder.init(options)
    return SessionRecorder
  }, [])

  useEffect(() => {
    if (!sessionRecorder) return
    setSessionState(sessionRecorder.sessionState)
  }, [sessionRecorder])

  const onToggleSession = () => {
    if (sessionState === SessionState.started) {
      setSessionState(SessionState.stopped)
      sessionRecorder.stop()
    } else {
      setSessionState(SessionState.started)
      sessionRecorder.start()
    }
  }

  return (
    <SessionRecorderContext.Provider value={{ client: sessionRecorder }}>
      <TouchEventCapture>
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
      </TouchEventCapture>
    </SessionRecorderContext.Provider>
  )
}

// Touch event capture component
const TouchEventCapture: React.FC<{ children: ReactNode }> = ({ children }) => {
  const context = useContext(SessionRecorderContext)
  const viewShotRef = useRef<View>(null)

  // Set the viewshot ref in the session recorder when component mounts
  useEffect(() => {
    if (context?.client && viewShotRef.current) {
      context.client.setViewShotRef?.(viewShotRef.current)
    }
  }, [context?.client])

  // Callback ref to set the viewshot ref immediately when available
  const setViewShotRef = (ref: View | null) => {
    if (ref && context?.client) {
      context.client.setViewShotRef?.(ref)
    }
  }

  const handleTouchStart = (event: any) => {
    if (!context?.client || context.client.sessionState !== SessionState.started) return // SessionState.started

    try {
      const { pageX, pageY, target } = event.nativeEvent
      const pressure = event.nativeEvent.force || 1.0

      // Record touch start event automatically
      context.client.recordTouchStart?.(pageX, pageY, target?.toString(), pressure)
    } catch (error) {
      console.warn('Failed to record touch start event:', error)
    }
  }

  const handleTouchMove = (event: any) => {
    if (!context?.client || context.client.sessionState !== SessionState.started) return // SessionState.started

    try {
      const { pageX, pageY, target } = event.nativeEvent
      const pressure = event.nativeEvent.force || 1.0

      // Record touch move event automatically
      context.client.recordTouchMove?.(pageX, pageY, target?.toString(), pressure)
    } catch (error) {
      console.warn('Failed to record touch move event:', error)
    }
  }

  const handleTouchEnd = (event: any) => {
    if (!context?.client || context.client.sessionState !== SessionState.started) return // SessionState.started

    try {
      const { pageX, pageY, target } = event.nativeEvent
      const pressure = event.nativeEvent.force || 1.0

      // Record touch end event automatically
      context.client.recordTouchEnd?.(pageX, pageY, target?.toString(), pressure)
    } catch (error) {
      console.warn('Failed to record touch end event:', error)
    }
  }

  return (
    <View
      ref={setViewShotRef}
      style={{ flex: 1 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </View>
  )
}

export const useSessionRecorder = (): SessionRecorderContextType => {
  const context = useContext(SessionRecorderContext)
  if (!context) {
    throw new Error('useSessionRecorder must be used within a SessionRecorderProvider')
  }
  return context
}
