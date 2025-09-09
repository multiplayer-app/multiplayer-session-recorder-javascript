/**
 * Example usage of the React Native Session Recorder with rrweb integration
 * This file demonstrates how to use the updated session recorder system
 */

import React from 'react'
import { View, Text, Button, StyleSheet, Alert } from 'react-native'
import { SessionRecorderProvider, useSessionRecorder } from './src/context/SessionRecorderContext'
import { EventType } from './src/types'

// Example app component
function App() {
  return (
    <SessionRecorderProvider
      options={{
        apiKey: 'your-api-key-here',
        version: '1.0.0',
        application: 'ExampleApp',
        environment: 'development',
        recordScreen: true,
        recordGestures: true,
        recordNavigation: true
      }}
    >
      <MainContent />
    </SessionRecorderProvider>
  )
}

// Main content component that will be wrapped by TouchEventCapture
function MainContent() {
  const { client } = useSessionRecorder()

  const handleStartSession = () => {
    try {
      client.start()
      Alert.alert('Session Started', 'Recording has begun!')
    } catch (error) {
      Alert.alert('Error', `Failed to start session: ${error}`)
    }
  }

  const handleStopSession = () => {
    try {
      client.stop()
      Alert.alert('Session Stopped', 'Recording has ended!')
    } catch (error) {
      Alert.alert('Error', `Failed to stop session: ${error}`)
    }
  }

  const handleRecordCustomEvent = () => {
    // Example of recording a custom rrweb event
    const customEvent = {
      type: EventType.Custom,
      data: {
        customType: 'button_click',
        buttonId: 'example_button',
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }

    client.recordEvent(customEvent)
    Alert.alert('Custom Event', 'Custom event recorded!')
  }

  const handleGetRecordingStats = () => {
    // This would need to be implemented in the SessionRecorder
    // const stats = client.getRecordingStats()
    // Alert.alert('Recording Stats', `Events recorded: ${stats.totalEvents}`)
    Alert.alert('Recording Stats', 'Feature coming soon!')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Session Recorder Example</Text>
      <Text style={styles.subtitle}>This app demonstrates rrweb-compatible session recording for React Native</Text>

      <View style={styles.buttonContainer}>
        <Button title='Start Recording' onPress={handleStartSession} color='#4CAF50' />
      </View>

      <View style={styles.buttonContainer}>
        <Button title='Stop Recording' onPress={handleStopSession} color='#F44336' />
      </View>

      <View style={styles.buttonContainer}>
        <Button title='Record Custom Event' onPress={handleRecordCustomEvent} color='#2196F3' />
      </View>

      <View style={styles.buttonContainer}>
        <Button title='Get Recording Stats' onPress={handleGetRecordingStats} color='#FF9800' />
      </View>

      <Text style={styles.instructions}>
        Recording is now AUTOMATIC! When you start a session, the system will automatically:
        {'\n'}• Capture screen snapshots periodically
        {'\n'}• Record all touch interactions (start, move, end)
        {'\n'}• Generate rrweb-compatible events
        {'\n'}• No manual setup required!
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333'
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666'
  },
  buttonContainer: {
    marginVertical: 10
  },
  instructions: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 30,
    color: '#888',
    fontStyle: 'italic'
  }
})

export default App

/**
 * AUTOMATIC RECORDING INTEGRATION:
 *
 * 1. Screen Capture (AUTOMATIC with react-native-view-shot):
 *    - Install: npm install react-native-view-shot
 *    - iOS: Add to Podfile and run pod install
 *    - Android: No additional setup needed
 *    - Screen capture happens automatically when session starts
 *    - Captures the same View element that handles touch events
 *
 * 2. Touch Events (AUTOMATIC):
 *    - TouchEventCapture automatically wraps your app content
 *    - Touch events are automatically converted to rrweb MouseInteraction events
 *    - Coordinates are automatically mapped from React Native to rrweb format
 *    - No manual setup required!
 *
 * 3. Event Recording (AUTOMATIC):
 *    - All events are automatically stored in the RecorderReactNativeSDK
 *    - Events can be exported using getRecordedEvents()
 *    - Events are compatible with standard rrweb players
 *    - Recording starts/stops automatically with session
 *
 * 4. ViewShot Integration (AUTOMATIC):
 *    - The TouchEventCapture View is automatically used for screen capture
 *    - No need to manually set up viewshot refs
 *    - Screen captures include all touch interactions
 *    - Perfect synchronization between touch events and screen captures
 *
 * 5. Customization (Optional):
 *    - Modify capture intervals in ScreenRecorder
 *    - Adjust touch event throttling in GestureRecorder
 *    - Add custom event types as needed
 *    - All core functionality works automatically out of the box
 */
