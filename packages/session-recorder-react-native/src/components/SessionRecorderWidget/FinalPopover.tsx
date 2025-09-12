import React, { useState } from 'react'
import { View, Text, Pressable, TextInput, Linking, Alert } from 'react-native'
import { WidgetTextOverridesConfig } from '../../types'
import { sharedStyles } from './styles'

interface FinalPopoverProps {
  textOverrides: WidgetTextOverridesConfig
  onStopRecording: (comment: string) => void
  onCancelSession: () => void
  onClose: () => void
  isSubmitting: boolean
}

const FinalPopover: React.FC<FinalPopoverProps> = ({
  textOverrides,
  onStopRecording,
  onCancelSession,
  onClose,
  isSubmitting
}) => {
  const [comment, setComment] = useState('')

  const handleStopRecording = async () => {
    try {
      await onStopRecording(comment)
    } catch (error) {
      Alert.alert('Error', 'Failed to save session')
    }
  }

  return (
    <View style={sharedStyles.popoverContent}>
      <View style={sharedStyles.popoverHeader}>
        <Pressable onPress={() => Linking.openURL('https://www.multiplayer.app')}>
          <Text style={sharedStyles.logoText}>Multiplayer</Text>
        </Pressable>
        <Pressable onPress={onCancelSession} style={sharedStyles.cancelButton}>
          <Text style={sharedStyles.cancelButtonText}>{textOverrides.cancelButtonText}</Text>
        </Pressable>
        <Pressable onPress={onClose} style={sharedStyles.closeButton}>
          <Text style={sharedStyles.closeButtonText}>×</Text>
        </Pressable>
      </View>

      <View style={sharedStyles.popoverBody}>
        <Text style={sharedStyles.title}>{textOverrides.finalTitle}</Text>
        <Text style={sharedStyles.description}>{textOverrides.finalDescription}</Text>

        <TextInput
          style={sharedStyles.commentInput}
          placeholder={textOverrides.commentPlaceholder}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          textAlignVertical='top'
        />

        <View style={sharedStyles.popoverFooter}>
          <Pressable
            style={[sharedStyles.actionButton, sharedStyles.stopButton]}
            onPress={handleStopRecording}
            disabled={isSubmitting}
          >
            <Text style={sharedStyles.actionButtonText}>{isSubmitting ? 'Saving...' : textOverrides.saveButtonText}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export default FinalPopover
