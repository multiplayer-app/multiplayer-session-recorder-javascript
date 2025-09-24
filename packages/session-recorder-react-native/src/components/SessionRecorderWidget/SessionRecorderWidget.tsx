import React, { useMemo, useState, useCallback, memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { SessionState } from '../../types'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { useSessionRecorder } from '../../context/SessionRecorderContext'

import FloatingButton from './FloatingButton'
import ModalContainer from './ModalContainer'
import InitialPopover from './InitialPopover'
import FinalPopover from './FinalPopover'
import { logger } from '../../utils'
import { useSessionRecorderStore } from '../../context/useSessionRecorderStore'

interface SessionRecorderWidgetProps {}

const SessionRecorderWidget: React.FC<SessionRecorderWidgetProps> = memo(() => {
  const { instance, openWidgetModal, closeWidgetModal } = useSessionRecorder()
  const sessionType = useSessionRecorderStore<SessionType | null>((s) => s.sessionType)
  const isModalVisible = useSessionRecorderStore<boolean>((s) => s.isWidgetModalVisible)
  const sessionState = useSessionRecorderStore<SessionState | null>((s) => s.sessionState)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get configuration from instance
  const config = instance.config
  const widget = config.widget
  const textOverrides = config.widgetTextOverrides
  const showContinuousRecording = config.showContinuousRecording

  const onStartRecording = useCallback(async (sessionType: SessionType) => {
    try {
      await instance.start(sessionType)
      closeWidgetModal()
    } catch (error) {
      logger.error('SessionRecorderWidget', 'Failed to start recording', error)
      throw error
    }
  }, [])

  const onStopRecording = useCallback(async (comment?: string) => {
    try {
      setIsSubmitting(true)
      await instance.stop(comment)
      closeWidgetModal()
    } catch (error) {
      logger.error('SessionRecorderWidget', 'Failed to stop recording', error)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const onCancelSession = useCallback(async () => {
    try {
      await instance.cancel()
      closeWidgetModal()
    } catch (error) {
      logger.error('SessionRecorderWidget', 'Failed to cancel session', error)
    }
  }, [])

  const onSaveContinuousSession = useCallback(async () => {
    return instance.save()
  }, [])

  const renderModalContent = useMemo(() => {
    const isStarted = sessionState === SessionState.started || sessionState === SessionState.paused
    const isContinuous = sessionType === SessionType.CONTINUOUS
    if (isStarted && !isContinuous) {
      return (
        <FinalPopover
          isSubmitting={isSubmitting}
          textOverrides={textOverrides}
          onClose={closeWidgetModal}
          onStopRecording={onStopRecording}
          onCancelSession={onCancelSession}
        />
      )
    }

    return (
      <InitialPopover
        isSubmitting={isSubmitting}
        textOverrides={textOverrides}
        isContinuous={isStarted && isContinuous}
        showContinuousRecording={showContinuousRecording}
        onClose={closeWidgetModal}
        onStopRecording={onStopRecording}
        onStartRecording={onStartRecording}
        onSaveContinuousSession={onSaveContinuousSession}
      />
    )
  }, [
    sessionState,
    sessionType,
    isSubmitting,
    textOverrides,
    showContinuousRecording,
    closeWidgetModal,
    onStopRecording,
    onCancelSession,
    onStartRecording,
    onSaveContinuousSession
  ])

  return (
    <>
      {widget.button?.visible && (
        <View pointerEvents='box-none' style={styles.overlayContainer}>
          <FloatingButton sessionState={sessionState} onPress={openWidgetModal} />
        </View>
      )}
      <ModalContainer isVisible={isModalVisible} onClose={closeWidgetModal}>
        {renderModalContent}
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
