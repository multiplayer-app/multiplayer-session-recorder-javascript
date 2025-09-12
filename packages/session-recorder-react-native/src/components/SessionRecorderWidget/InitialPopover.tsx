import React, { useState } from 'react'
import { View, Text, Pressable, Switch, Alert } from 'react-native'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { WidgetTextOverridesConfig } from '../../types'
import { sharedStyles } from './styles'
import ModalHeader from './ModalHeader'

interface InitialPopoverProps {
  textOverrides: WidgetTextOverridesConfig
  showContinuousRecording: boolean
  onStartRecording: (sessionType: SessionType) => void
  onSaveContinuousSession: () => void
  onClose: () => void
  isSubmitting: boolean
}

const InitialPopover: React.FC<InitialPopoverProps> = ({
  textOverrides,
  showContinuousRecording,
  onStartRecording,
  onSaveContinuousSession,
  onClose,
  isSubmitting
}) => {
  const [continuousRecording, setContinuousRecording] = useState(false)

  const handleStartRecording = async () => {
    try {
      const sessionType = continuousRecording ? SessionType.CONTINUOUS : SessionType.PLAIN
      onStartRecording(sessionType)
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording')
    }
  }

  return (
    <View style={sharedStyles.popoverContent}>
      <ModalHeader />

      <View style={sharedStyles.popoverBody}>
        {showContinuousRecording && (
          <View style={sharedStyles.continuousRecordingSection}>
            <Text style={sharedStyles.continuousRecordingLabel}>{textOverrides.continuousRecordingLabel}</Text>
            <Switch
              value={continuousRecording}
              onValueChange={setContinuousRecording}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={continuousRecording ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        )}

        <Text style={sharedStyles.title}>
          {showContinuousRecording ? textOverrides.initialTitleWithContinuous : textOverrides.initialTitleWithoutContinuous}
        </Text>

        <Text style={sharedStyles.description}>
          {showContinuousRecording
            ? textOverrides.initialDescriptionWithContinuous
            : textOverrides.initialDescriptionWithoutContinuous}
        </Text>

        <View style={sharedStyles.popoverFooter}>
          <Pressable style={[sharedStyles.actionButton, sharedStyles.startButton]} onPress={handleStartRecording}>
            <Text style={sharedStyles.actionButtonText}>{textOverrides.startRecordingButtonText}</Text>
          </Pressable>
        </View>

        {showContinuousRecording && continuousRecording && (
          <View style={sharedStyles.continuousOverlay}>
            <View style={sharedStyles.continuousOverlayContent}>
              <Text style={sharedStyles.continuousOverlayTitle}>🔴 {textOverrides.continuousOverlayTitle}</Text>
              <Text style={sharedStyles.continuousOverlayDescription}>{textOverrides.continuousOverlayDescription}</Text>
            </View>
            <Pressable
              style={[sharedStyles.actionButton, sharedStyles.saveButton]}
              onPress={onSaveContinuousSession}
              disabled={isSubmitting}
            >
              <Text style={sharedStyles.actionButtonText}>{textOverrides.saveLastSnapshotButtonText}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

export default InitialPopover
