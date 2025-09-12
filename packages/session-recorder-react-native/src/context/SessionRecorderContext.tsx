import React, { createContext, useContext, PropsWithChildren, useState, useEffect, useRef } from 'react'
import { SessionRecorderOptions, SessionState } from '../types'
import sessionRecorder from '../session-recorder'
import { ScreenRecorderView } from '../components/ScreenRecorderView'
import SessionRecorderWidget from '../components/SessionRecorderWidget'

interface SessionRecorderContextType {
  instance: typeof sessionRecorder
  isInitialized: boolean
  sessionState: SessionState | null
}

const SessionRecorderContext = createContext<SessionRecorderContextType | null>(null)

export interface SessionRecorderProviderProps extends PropsWithChildren {
  options: SessionRecorderOptions
}

export const SessionRecorderProvider: React.FC<SessionRecorderProviderProps> = ({ children, options }) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [sessionState, setSessionState] = useState<SessionState | null>(SessionState.stopped)
  const optionsRef = useRef<string>()

  useEffect(() => {
    const newOptions = JSON.stringify(options)
    if (optionsRef.current === JSON.stringify(options)) return
    optionsRef.current = newOptions
    sessionRecorder.init(options)
    setIsInitialized(true)
  }, [options])

  useEffect(() => {
    setSessionState(sessionRecorder.sessionState)
    sessionRecorder.on('state-change', (state: SessionState) => {
      setSessionState(state)
    })
  }, [])

  return (
    <SessionRecorderContext.Provider value={{ instance: sessionRecorder, sessionState, isInitialized }}>
      <ScreenRecorderView>{children}</ScreenRecorderView>
      {isInitialized && !!sessionRecorder.config.showWidget && <SessionRecorderWidget />}
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
