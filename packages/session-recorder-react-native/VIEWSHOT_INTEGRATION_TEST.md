# ViewShot Integration Test

This document explains how to test the complete react-native-view-shot integration.

## Test Setup

1. **Install Dependencies**

   ```bash
   npm install react-native-view-shot
   # For iOS
   cd ios && pod install && cd ..
   ```

2. **Test the Integration**

   ```typescript
   import React from 'react'
   import { View, Text, Button } from 'react-native'
   import { SessionRecorderProvider, useSessionRecorder } from './src/context/SessionRecorderContext'

   function TestApp() {
     const { client } = useSessionRecorder()

     const testScreenCapture = async () => {
       // Start session to enable automatic screen capture
       await client.start()

       // Wait a moment for initial screen capture
       setTimeout(() => {
         console.log('Screen capture should have happened automatically!')
         // Check the recorded events
         const events = client.getRecordedEvents?.()
         console.log('Recorded events:', events)
       }, 2000)
     }

     return (
       <View style={{ flex: 1, padding: 20 }}>
         <Text>ViewShot Integration Test</Text>
         <Button title='Test Screen Capture' onPress={testScreenCapture} />
         <Text>Touch the screen to test touch recording</Text>
       </View>
     )
   }

   export default function App() {
     return (
       <SessionRecorderProvider
         options={{
           apiKey: 'test-key',
           version: '1.0.0',
           application: 'TestApp',
           environment: 'test',
           recordScreen: true,
           recordGestures: true
         }}
       >
         <TestApp />
       </SessionRecorderProvider>
     )
   }
   ```

## Expected Behavior

When you run this test:

1. **Automatic Screen Capture**: The system should automatically capture the screen when the session starts
2. **Touch Recording**: Touching the screen should generate rrweb MouseInteraction events
3. **ViewShot Integration**: The same View that handles touch events should be used for screen capture
4. **Event Generation**: Both FullSnapshotEvent and IncrementalSnapshotEvent should be generated

## Verification Steps

1. **Check Console Logs**: Look for screen capture success/failure messages
2. **Verify Events**: Check that `getRecordedEvents()` returns both screen and touch events
3. **Test Touch Interactions**: Touch the screen and verify touch events are recorded
4. **Check Event Format**: Ensure events are in proper rrweb format

## Troubleshooting

### Common Issues

1. **"ViewShot ref not available"**: The ref setup might be timing-related

   - Solution: Ensure the SessionRecorderProvider wraps your app properly

2. **Screen capture fails**: react-native-view-shot might not be properly installed

   - Solution: Check installation and run `pod install` for iOS

3. **No events recorded**: Session might not be started
   - Solution: Call `client.start()` before testing

### Debug Information

Add this to your test component to debug:

```typescript
const debugInfo = () => {
  console.log('Session State:', client.sessionState)
  console.log('Is Recording:', client.isRecording)
  console.log('Events Count:', client.getRecordedEvents?.()?.length || 0)
}
```

## Success Criteria

✅ Screen capture works automatically when session starts
✅ Touch events are recorded automatically
✅ Events are in proper rrweb format
✅ No manual ref setup required
✅ Perfect synchronization between touch and screen events

## Next Steps

Once the test passes:

1. Integrate into your main app
2. Configure capture intervals and quality as needed
3. Export events for rrweb playback
4. Customize event filtering if required
