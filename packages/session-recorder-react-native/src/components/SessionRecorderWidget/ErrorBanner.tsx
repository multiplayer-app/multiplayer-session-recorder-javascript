import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'

interface ErrorBannerProps {
  error: string
  onDismiss: () => void
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>✕</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  errorText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    marginRight: 8
  },
  dismissButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dismissText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold'
  }
})

export default ErrorBanner
