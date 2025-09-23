import React, { useMemo, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SessionState } from '../../types'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { useSessionRecorder } from '../../context/SessionRecorderContext'
import FloatingButton from './FloatingButton'
import ModalContainer from './ModalContainer'
import InitialPopover from './InitialPopover'
import FinalPopover from './FinalPopover'
import { logger } from '../../utils'

interface SessionRecorderWidgetProps {}

const SessionRecorderWidget: React.FC<SessionRecorderWidgetProps> = () => {
  const { sessionState, sessionType, instance } = useSessionRecorder()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get configuration from instance
  const config = instance.config
  const textOverrides = config.widgetTextOverrides
  const showContinuousRecording = config.showContinuousRecording

  const openModal = () => {
    setIsModalVisible(true)
  }

  const closeModal = () => {
    setIsModalVisible(false)
  }

  const onStartRecording = async (sessionType: SessionType) => {
    try {
      await instance.start(sessionType)
      closeModal()
    } catch (error) {
      logger.error('SessionRecorderWidget', 'Failed to start recording', error)
      throw error
    }
  }

  const onStopRecording = async (comment?: string) => {
    try {
      setIsSubmitting(true)
      await instance.stop(comment)
      closeModal()
    } catch (error) {
      logger.error('SessionRecorderWidget', 'Failed to stop recording', error)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  const onCancelSession = async () => {
    try {
      await instance.cancel()
      closeModal()
    } catch (error) {
      logger.error('SessionRecorderWidget', 'Failed to cancel session', error)
    }
  }

  const onSaveContinuousSession = async () => {
    return instance.save()
  }

  const renderModalContent = useMemo(() => {
    const isStarted = sessionState === SessionState.started || sessionState === SessionState.paused
    const isContinuous = sessionType === SessionType.CONTINUOUS
    if (isStarted && !isContinuous) {
      return (
        <FinalPopover
          isSubmitting={isSubmitting}
          textOverrides={textOverrides}
          onClose={closeModal}
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
        onClose={closeModal}
        onStopRecording={onStopRecording}
        onStartRecording={onStartRecording}
        onSaveContinuousSession={onSaveContinuousSession}
      />
    )
  }, [sessionState, isSubmitting, textOverrides, showContinuousRecording])

  return (
    <>
      <View pointerEvents='box-none' style={styles.overlayContainer}>
        <FloatingButton sessionState={sessionState} onPress={openModal} />
      </View>
      <ModalContainer isVisible={isModalVisible} onClose={closeModal}>
        {renderModalContent}
      </ModalContainer>
    </>
  )
}

export default SessionRecorderWidget

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject
  }
})
