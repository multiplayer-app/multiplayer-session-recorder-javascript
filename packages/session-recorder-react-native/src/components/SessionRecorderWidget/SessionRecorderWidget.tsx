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

  const handleError = useCallback((error: any, message: string) => {
    const errorMessage = error instanceof Error ? error.message : message
    logger.error('SessionRecorderWidget', message, error)
    sessionRecorderStore.setState({ error: errorMessage })
  }, [])

  const onStartRecording = useCallback(
    async (sessionType: SessionType) => {
      if (!isOnline) {
        handleError(new Error('Cannot start recording while offline'), 'Cannot start recording while offline')
        return
      }
      try {
        await instance.start(sessionType)
        closeWidgetModal()
      } catch (error) {
        handleError(error, 'Failed to start recording')
      }
    },
    [isOnline, handleError]
  )

  const onStopRecording = useCallback(
    async (comment?: string) => {
      try {
        setIsSubmitting(true)
        await instance.stop(comment)
        closeWidgetModal()
      } catch (error) {
        handleError(error, 'Failed to stop recording')
      } finally {
        setIsSubmitting(false)
      }
    },
    [handleError]
  )

  const onCancelSession = useCallback(async () => {
    try {
      await instance.cancel()
      closeWidgetModal()
    } catch (error) {
      handleError(error, 'Failed to cancel session')
    }
  }, [handleError])

  const onSaveContinuousSession = useCallback(async () => {
    try {
      await instance.save()
    } catch (error) {
      handleError(error, 'Failed to save continuous session')
    }
  }, [handleError])

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
            isOnline={isOnline}
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
