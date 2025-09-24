import React, { createContext, useContext, PropsWithChildren, useEffect, useCallback } from 'react'
import { SessionRecorderOptions, SessionState } from '../types'
import sessionRecorder from '../session-recorder'
import { ScreenRecorderView } from '../components/ScreenRecorderView'
import SessionRecorderWidget from '../components/SessionRecorderWidget'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { sessionRecorderStore, SessionRecorderState } from './SessionRecorderStore'
import { useStoreSelector } from './useStoreSelector'

interface SessionRecorderContextType {
  instance: typeof sessionRecorder
  openWidgetModal: () => void
  closeWidgetModal: () => void
  startSession: (sessionType?: SessionType) => Promise<void>
  stopSession: (comment?: string) => Promise<void>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  cancelSession: () => Promise<void>
  saveSession: () => Promise<void>
}

const SessionRecorderContext = createContext<SessionRecorderContextType | null>(null)

export interface SessionRecorderProviderProps extends PropsWithChildren {
  options?: SessionRecorderOptions
}

export const SessionRecorderProvider: React.FC<SessionRecorderProviderProps> = ({ children, options }) => {
  const isInitialized = useStoreSelector<SessionRecorderState, boolean>(sessionRecorderStore, (s) => s.isInitialized)

  useEffect(() => {
    if (options) {
      sessionRecorder.init(options)
    }
    sessionRecorderStore.setState({ isInitialized: sessionRecorder.isInitialized })
  }, [])

  useEffect(() => {
    sessionRecorderStore.setState({
      sessionState: sessionRecorder.sessionState,
      sessionType: sessionRecorder.sessionType
    })
    const onStateChange = (sessionState: SessionState, sessionType: SessionType) => {
      sessionRecorderStore.setState({ sessionState, sessionType })
    }
    sessionRecorder.on('state-change', onStateChange)
    return () => {
      sessionRecorder.off('state-change', onStateChange)
    }
  }, [])

  const startSession = useCallback((sessionType: SessionType = SessionType.PLAIN) => {
    return sessionRecorder.start(sessionType)
  }, [])

  const stopSession = useCallback((comment?: string) => {
    return sessionRecorder.stop(comment)
  }, [])

  const pauseSession = useCallback(() => {
    return sessionRecorder.pause()
  }, [])

  const resumeSession = useCallback(() => {
    return sessionRecorder.resume()
  }, [])

  const cancelSession = useCallback(() => {
    return sessionRecorder.cancel()
  }, [])

  const saveSession = useCallback(() => {
    return sessionRecorder.save()
  }, [])

  const openWidgetModal = useCallback(() => {
    sessionRecorderStore.setState({ isWidgetModalVisible: true })
  }, [])

  const closeWidgetModal = useCallback(() => {
    sessionRecorderStore.setState({ isWidgetModalVisible: false })
  }, [])

  return (
    <SessionRecorderContext.Provider
      value={{
        instance: sessionRecorder,
        openWidgetModal,
        closeWidgetModal,
        startSession,
        stopSession,
        pauseSession,
        resumeSession,
        cancelSession,
        saveSession
      }}
    >
      <ScreenRecorderView>{children}</ScreenRecorderView>
      {isInitialized && !!sessionRecorder.config.widget.enabled && <SessionRecorderWidget />}
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
