import { StyleSheet } from 'react-native';

export const sharedStyles = StyleSheet.create({
  // Popover styles
  popoverContent: {
    flex: 1,
    paddingHorizontal: 0,
  },
  popoverHeader: {
    flexDirection: 'column',
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#f4f9ff',
    shadowColor: '#f4f9ff',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10,
  },
  modalHandle: {
    marginTop: 8,
    marginBottom: 16,
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
  },
  popoverHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e1e8f1',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  popoverBody: {
    flex: 1,
    padding: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 16,
  },
  popoverFooter: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },

  // Continuous recording styles
  continuousRecordingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e1e8f1',
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 3,
  },

  continuousRecordingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },

  continuousOverlay: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e8f1',
    backgroundColor: '#fff',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 3,
    flexDirection: 'column',
    gap: 8,
  },

  continuousOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  continuousOverlayTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d3748',
  },

  continuousOverlayDescription: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
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
    minHeight: 80,
  },

  // Button color variants
  startButton: {
    backgroundColor: '#473cfb',
  },
  stopButton: {
    backgroundColor: '#473cfb',
  },
  saveButton: {
    backgroundColor: '#473cfb',
  },
});
