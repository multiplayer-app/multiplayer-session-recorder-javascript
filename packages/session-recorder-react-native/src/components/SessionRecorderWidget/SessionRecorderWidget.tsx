import React, { useMemo, useState } from 'react'
import { Alert, View, StyleSheet } from 'react-native'
import { SessionState } from '../../types'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { useSessionRecorder } from '../../context/SessionRecorderContext'
import FloatingButton from './FloatingButton'
import ModalContainer from './ModalContainer'
import InitialPopover from './InitialPopover'
import FinalPopover from './FinalPopover'

interface SessionRecorderWidgetProps {}

const SessionRecorderWidget: React.FC<SessionRecorderWidgetProps> = () => {
  const { sessionState, instance } = useSessionRecorder()
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
      Alert.alert('Error', 'Failed to start recording')
    }
  }

  const onStopRecording = async (comment: string) => {
    try {
      setIsSubmitting(true)
      await instance.stop(comment)
      closeModal()
      Alert.alert('Success', 'Session saved successfully')
    } catch (error) {
      Alert.alert('Error', 'Failed to save session')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onCancelSession = async () => {
    try {
      await instance.cancel()
      closeModal()
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel session')
    }
  }

  const onSaveContinuousSession = async () => {
    try {
      setIsSubmitting(true)
      await instance.save()
      closeModal()
      Alert.alert('Success', 'Continuous session saved successfully')
    } catch (error) {
      Alert.alert('Error', 'Failed to save continuous session')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderModalContent = useMemo(() => {
    if (sessionState === SessionState.started || sessionState === SessionState.paused) {
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
        showContinuousRecording={showContinuousRecording}
        onClose={closeModal}
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
