import React, { useMemo, useState } from 'react'
import { View, Text, Pressable, Alert, Switch } from 'react-native'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { WidgetTextOverridesConfig } from '../../types'
import { sharedStyles } from './styles'
import ModalHeader from './ModalHeader'
import { CapturingIcon } from './icons'

interface InitialPopoverProps {
  textOverrides: WidgetTextOverridesConfig
  isContinuous: boolean
  showContinuousRecording: boolean
  onStartRecording: (sessionType: SessionType) => void
  onStopRecording: (comment?: string) => void
  onSaveContinuousSession: () => void
  onClose: () => void
  isSubmitting: boolean
}

const InitialPopover: React.FC<InitialPopoverProps> = ({
  isContinuous,
  textOverrides,
  showContinuousRecording,
  onStartRecording,
  onStopRecording,
  onSaveContinuousSession
}) => {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [continuousRecording, setContinuousRecording] = useState(isContinuous)

  const handleStartRecording = async () => {
    try {
      setLoading(true)
      onStartRecording(SessionType.PLAIN)
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleContinuousRecording = async (value: boolean) => {
    try {
      setLoading(true)
      setContinuousRecording(value)
      if (value) {
        await onStartRecording(SessionType.CONTINUOUS)
      } else {
        await onStopRecording()
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${value ? 'start' : 'stop'} continuous recording`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveContinuousSession = async () => {
    try {
      setSaving(true)
      await onSaveContinuousSession()
    } catch (error) {
      Alert.alert('Error', 'Failed to save continuous session')
    } finally {
      setSaving(false)
    }
  }

  const textContent = useMemo(() => {
    return {
      label: textOverrides.continuousRecordingLabel,
      title: showContinuousRecording ? textOverrides.initialTitleWithContinuous : textOverrides.initialTitleWithoutContinuous,
      description: showContinuousRecording
        ? textOverrides.initialDescriptionWithContinuous
        : textOverrides.initialDescriptionWithoutContinuous
    }
  }, [showContinuousRecording, textOverrides])

  return (
    <View style={sharedStyles.popoverContent}>
      <ModalHeader />

      <View style={sharedStyles.popoverBody}>
        {showContinuousRecording && (
          <View style={sharedStyles.continuousRecordingSection}>
            <Text style={sharedStyles.continuousRecordingLabel}>{textContent.label}</Text>
            <Switch
              disabled={loading}
              value={continuousRecording}
              onValueChange={handleToggleContinuousRecording}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={continuousRecording ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        )}

        {!continuousRecording ? (
          <>
            <Text style={sharedStyles.title}>{textContent.title}</Text>
            <Text style={sharedStyles.description}>{textContent.description}</Text>
            <View style={sharedStyles.popoverFooter}>
              <Pressable
                disabled={loading}
                onPress={handleStartRecording}
                style={[sharedStyles.actionButton, sharedStyles.startButton]}
              >
                <Text style={sharedStyles.actionButtonText}>
                  {loading ? 'Starting to record...' : textOverrides.startRecordingButtonText}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={sharedStyles.continuousOverlay}>
              <View style={sharedStyles.continuousOverlayHeader}>
                <CapturingIcon size={20} color='red' />
                <Text style={sharedStyles.continuousOverlayTitle}>{textOverrides.continuousOverlayTitle}</Text>
              </View>
              <Text style={sharedStyles.continuousOverlayDescription}>{textOverrides.continuousOverlayDescription}</Text>
            </View>
            <View style={sharedStyles.popoverFooter}>
              <Pressable
                disabled={saving}
                onPress={handleSaveContinuousSession}
                style={[sharedStyles.actionButton, sharedStyles.saveButton]}
              >
                <Text style={sharedStyles.actionButtonText}>
                  {saving ? 'Saving...' : textOverrides.saveLastSnapshotButtonText}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

export default InitialPopover
