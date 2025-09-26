import React, { useState, useCallback, memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { SessionState } from '../../types'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { useSessionRecorder } from '../../context/SessionRecorderContext'

import FinalPopover from './FinalPopover'
import ModalContainer from './ModalContainer'
import InitialPopover from './InitialPopover'
import FloatingButton from './FloatingButton'
import ErrorBanner from './ErrorBanner'
import { logger } from '../../utils'
import { useSessionRecorderStore } from '../../context/useSessionRecorderStore'
import { sessionRecorderStore } from '../../context/SessionRecorderStore'

interface SessionRecorderWidgetProps {}

const SessionRecorderWidget: React.FC<SessionRecorderWidgetProps> = memo(() => {
  const { instance, openWidgetModal, closeWidgetModal } = useSessionRecorder()
  const isOnline = useSessionRecorderStore<boolean>((s) => s.isOnline)
  const sessionType = useSessionRecorderStore<SessionType | null>((s) => s.sessionType)
  const isModalVisible = useSessionRecorderStore<boolean>((s) => s.isWidgetModalVisible)
  const sessionState = useSessionRecorderStore<SessionState | null>((s) => s.sessionState)
  const error = useSessionRecorderStore<string | null>((s) => s.error)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get configuration from instance
  const { widget, showContinuousRecording } = instance.config

  const dismissError = useCallback(() => {
    sessionRecorderStore.setState({ error: null })
  }, [])

  const setError = useCallback((errorMessage: string) => {
    sessionRecorderStore.setState({ error: errorMessage })
  }, [])

  const onStartRecording = useCallback(
    async (sessionType: SessionType) => {
      if (!isOnline) {
        const errorMessage = 'Cannot start recording while offline'
        logger.warn('SessionRecorderWidget', errorMessage)
        setError(errorMessage)
        return
      }
      try {
        await instance.start(sessionType)
        closeWidgetModal()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start recording'
        logger.error('SessionRecorderWidget', 'Failed to start recording', error)
        setError(errorMessage)
      }
    },
    [isOnline, setError]
  )

  const onStopRecording = useCallback(
    async (comment?: string) => {
      try {
        setIsSubmitting(true)
        await instance.stop(comment)
        closeWidgetModal()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording'
        logger.error('SessionRecorderWidget', 'Failed to stop recording', error)
        setError(errorMessage)
      } finally {
        setIsSubmitting(false)
      }
    },
    [setError]
  )

  const onCancelSession = useCallback(async () => {
    try {
      await instance.cancel()
      closeWidgetModal()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel session'
      logger.error('SessionRecorderWidget', 'Failed to cancel session', error)
      setError(errorMessage)
    }
  }, [setError])

  const onSaveContinuousSession = useCallback(async () => {
    try {
      await instance.save()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save continuous session'
      logger.error('SessionRecorderWidget', 'Failed to save continuous session', error)
      setError(errorMessage)
    }
  }, [setError])

  const isStarted = sessionState === SessionState.started || sessionState === SessionState.paused
  const isContinuous = sessionType === SessionType.CONTINUOUS

  return (
    <>
      {widget.button?.visible && (
        <View pointerEvents='box-none' style={styles.overlayContainer}>
          <FloatingButton sessionState={sessionState} onPress={openWidgetModal} />
        </View>
      )}
      <ModalContainer isVisible={isModalVisible} onClose={closeWidgetModal}>
        {isStarted && !isContinuous ? (
          <FinalPopover
            isSubmitting={isSubmitting}
            textOverrides={widget.textOverrides}
            onClose={closeWidgetModal}
            onStopRecording={onStopRecording}
            onCancelSession={onCancelSession}
          >
            {error && <ErrorBanner error={error} onDismiss={dismissError} />}
          </FinalPopover>
        ) : (
          <InitialPopover
            isOnline={isOnline}
            isSubmitting={isSubmitting}
            textOverrides={widget.textOverrides}
            isContinuous={isStarted && isContinuous}
            showContinuousRecording={showContinuousRecording}
            onClose={closeWidgetModal}
            onStopRecording={onStopRecording}
            onStartRecording={onStartRecording}
            onSaveContinuousSession={onSaveContinuousSession}
          >
            {error && <ErrorBanner error={error} onDismiss={dismissError} />}
          </InitialPopover>
        )}
      </ModalContainer>
    </>
  )
})

export default SessionRecorderWidget

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject
  }
})
