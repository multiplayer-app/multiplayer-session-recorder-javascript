import React, { useMemo, useState } from 'react'
import { View, Text, Pressable, Alert, Switch } from 'react-native'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { TextOverridesOptions } from '../../types'
import { sharedStyles } from './styles'
import ModalHeader from './ModalHeader'
import { CapturingIcon } from './icons'

interface InitialPopoverProps extends React.PropsWithChildren {
  isContinuous: boolean
  showContinuousRecording: boolean
  textOverrides: TextOverridesOptions
  onStartRecording: (sessionType: SessionType) => void
  onStopRecording: (comment?: string) => void
  onSaveContinuousSession: () => void
  onClose: () => void
  isSubmitting: boolean
  isOnline: boolean
}

const InitialPopover: React.FC<InitialPopoverProps> = ({
  isContinuous,
  textOverrides,
  showContinuousRecording,
  onStartRecording,
  onStopRecording,
  onSaveContinuousSession,
  isOnline,
  children
}) => {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [continuousRecording, setContinuousRecording] = useState(isContinuous)

  const handleStartRecording = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot start recording while offline. Please check your internet connection.')
      return
    }

    try {
      setLoading(true)
      await onStartRecording(SessionType.PLAIN)
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
        {children}
        {showContinuousRecording && (
          <View style={sharedStyles.continuousRecordingSection}>
            <Text style={sharedStyles.continuousRecordingLabel}>{textContent.label}</Text>
            <Switch
              disabled={loading}
              value={continuousRecording}
              ios_backgroundColor='#e2e8f0'
              onValueChange={handleToggleContinuousRecording}
              trackColor={{ false: '#e2e8f0', true: '#493bff' }}
              thumbColor={'#ffffff'}
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
