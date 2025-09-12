import { StyleSheet } from 'react-native'

export const sharedStyles = StyleSheet.create({
  // Popover styles
  popoverContent: {
    flex: 1,
    paddingHorizontal: 20
  },
  popoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6B7280'
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6'
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500'
  },
  popoverBody: {
    flex: 1,
    paddingVertical: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24
  },
  popoverFooter: {
    marginTop: 'auto',
    paddingTop: 20
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center'
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },

  // Continuous recording styles
  continuousRecordingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8
  },
  continuousRecordingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151'
  },
  continuousOverlay: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B'
  },
  continuousOverlayContent: {
    marginBottom: 16
  },
  continuousOverlayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 8
  },
  continuousOverlayDescription: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20
  },

  // Comment input styles
  commentInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#F9FAFB',
    marginBottom: 24,
    minHeight: 80
  },

  // Button color variants
  startButton: {
    backgroundColor: '#007AFF'
  },
  stopButton: {
    backgroundColor: '#FF4444'
  },
  saveButton: {
    backgroundColor: '#34C759'
  }
})
