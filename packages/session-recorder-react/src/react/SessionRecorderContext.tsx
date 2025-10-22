import React, { createContext, useContext, useEffect, useCallback, type PropsWithChildren } from 'react'
import SessionRecorder from '@multiplayer-app/session-recorder-browser'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { useSessionRecorderStore, sessionRecorderStore } from './useSessionRecorderStore'

type SessionRecorderOptions = any

interface SessionRecorderContextType {
  instance: typeof SessionRecorder
  startSession: (sessionType?: SessionType) => void | Promise<void>
  stopSession: (comment?: string) => Promise<void>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  cancelSession: () => Promise<void>
  saveSession: () => Promise<any>
}

const SessionRecorderContext = createContext<SessionRecorderContextType | null>(null)

export interface SessionRecorderProviderProps extends PropsWithChildren {
  options?: SessionRecorderOptions
}

export const SessionRecorderProvider: React.FC<SessionRecorderProviderProps> = ({ children, options }) => {
  const isInitialized = useSessionRecorderStore((s) => s.isInitialized)

  useEffect(() => {
    if (options) {
      SessionRecorder.init(options)
    }
    sessionRecorderStore.setState({ isInitialized: SessionRecorder.isInitialized })
  }, [])

  useEffect(() => {
    sessionRecorderStore.setState({
      sessionState: SessionRecorder.sessionState,
      sessionType: SessionRecorder.sessionType
    })

    const onStateChange = (state: any) => {
      sessionRecorderStore.setState({ sessionState: state })
    }
    const onInit = () => {
      sessionRecorderStore.setState({ isInitialized: true })
    }

    SessionRecorder.on('state-change', onStateChange)
    SessionRecorder.on('init', onInit)
    return () => {
      SessionRecorder.off('state-change', onStateChange)
      SessionRecorder.off('init', onInit)
    }
  }, [])

  const startSession = useCallback((sessionType: SessionType = SessionType.PLAIN) => {
    return SessionRecorder.start(sessionType)
  }, [])

  const stopSession = useCallback((comment?: string) => {
    return SessionRecorder.stop(comment)
  }, [])

  const pauseSession = useCallback(() => {
    return SessionRecorder.pause()
  }, [])

  const resumeSession = useCallback(() => {
    return SessionRecorder.resume()
  }, [])

  const cancelSession = useCallback(() => {
    return SessionRecorder.cancel()
  }, [])

  const saveSession = useCallback(() => {
    return SessionRecorder.save()
  }, [])

  return (
    <SessionRecorderContext.Provider
      value={{
        instance: SessionRecorder,
        startSession,
        stopSession,
        pauseSession,
        resumeSession,
        cancelSession,
        saveSession
      }}
    >
      {children}
      {/* No widget component here; consumer can import the browser widget if needed */}
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
