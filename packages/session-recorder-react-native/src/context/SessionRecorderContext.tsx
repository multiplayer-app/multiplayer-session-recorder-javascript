import React, { createContext, useContext, PropsWithChildren, useState, useEffect, useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SessionRecorderOptions, SessionState } from '../types'
import SessionRecorder from '../session-recorder'
import sessionRecorder from '../session-recorder'
import { ScreenRecorderView } from '../components/ScreenRecorderView'

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
      <ScreenRecorderView>{children}</ScreenRecorderView>
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
    </SessionRecorderContext.Provider>
  )
}

export const useSessionRecorder = (): SessionRecorderContextType => {
  const context = useContext(SessionRecorderContext)
  if (!context) {
    throw new Error('useSessionRecorder must be used within a SessionRecorderProvider')
  }
  return context
}
