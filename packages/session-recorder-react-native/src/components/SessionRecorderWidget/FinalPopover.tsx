import React, { useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, Keyboard } from 'react-native'
import { TextOverridesOptions } from '../../types'
import { sharedStyles } from './styles'
import ModalHeader from './ModalHeader'
import { logger } from '../../utils'

interface FinalPopoverProps extends React.PropsWithChildren {
  isOnline: boolean
  textOverrides: TextOverridesOptions
  onStopRecording: (comment: string) => void
  onCancelSession: () => void
  onClose: () => void
  isSubmitting: boolean
}

const FinalPopover: React.FC<FinalPopoverProps> = ({
  isOnline,
  textOverrides,
  onStopRecording,
  onCancelSession,
  isSubmitting,
  children
}) => {
  const [comment, setComment] = useState('')

  const handleStopRecording = async () => {
    try {
      await onStopRecording(comment)
    } catch (error) {
      logger.error('FinalPopover', 'Failed to save session', error)
    }
  }

  return (
    <View style={sharedStyles.popoverContent}>
      <ModalHeader>
        <Pressable onPress={onCancelSession} disabled={!isOnline} style={sharedStyles.cancelButton}>
          <Text style={sharedStyles.cancelButtonText}>{textOverrides.cancelButtonText}</Text>
        </Pressable>
      </ModalHeader>

      <ScrollView style={sharedStyles.popoverBody} keyboardShouldPersistTaps='handled' contentInsetAdjustmentBehavior='automatic'>
        {children}
        <Text style={sharedStyles.title}>{textOverrides.finalTitle}</Text>
        <Text style={sharedStyles.description}>{textOverrides.finalDescription}</Text>

        <TextInput
          style={sharedStyles.commentInput}
          placeholder={textOverrides.commentPlaceholder}
          placeholderTextColor={'#9CA3AF'}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          textAlignVertical='top'
          returnKeyType='done'
          blurOnSubmit
          onSubmitEditing={() => Keyboard.dismiss()}
        />

        <View style={sharedStyles.popoverFooter}>
          <Pressable
            disabled={isSubmitting || !isOnline}
            style={[sharedStyles.actionButton, sharedStyles.stopButton]}
            onPress={handleStopRecording}
          >
            <Text style={sharedStyles.actionButtonText}>{isSubmitting ? 'Saving...' : textOverrides.saveButtonText}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

export default FinalPopover
