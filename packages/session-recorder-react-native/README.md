# Multiplayer Session Recorder for React Native

The Multiplayer Session Recorder for React Native provides comprehensive session recording capabilities for React Native applications, including gesture tracking, navigation monitoring, screen recording, and full-stack debugging. It includes full support for both bare React Native and Expo applications.

## ⚠️ Important: Web Platform Limitations

**This package does NOT support React Native Web.** The session recorder relies on native modules for core functionality:

- **Screen Recording**: Requires native screen capture capabilities
- **Gesture Recording**: Uses native gesture detection systems
- **Native Module Dependencies**: Core features depend on iOS/Android native modules

If you need web support, consider using the browser-specific session recorder package instead.

## Installation

```bash
npm install @multiplayer-app/session-recorder-react-native
# or
yarn add @multiplayer-app/session-recorder-react-native
```

### Required Dependencies

This package requires the following dependencies to be installed in your React Native application:

```bash
npm install @react-native-async-storage/async-storage @react-native-community/netinfo react-native-svg react-native-safe-area-context
# or
yarn add @react-native-async-storage/async-storage @react-native-community/netinfo react-native-svg react-native-safe-area-context
```

**Important**: Native modules must be installed directly in your app's `package.json`. React Native autolinking only links native modules that are declared by the app itself, not modules pulled in transitively by libraries. If you don't add them directly, you may see errors like "NativeModule: AsyncStorage is null" or SVGs not rendering.

#### Bare React Native projects

```bash
# Install native dependencies in your app
npm install @react-native-async-storage/async-storage @react-native-community/netinfo react-native-svg react-native-safe-area-context

# iOS: Install pods from your app's ios directory
cd ios && pod install && cd -

# Android: Clean and rebuild
cd android && ./gradlew clean && cd -
```

#### Expo projects

Use Expo's version-aware installer so versions match the SDK:

```bash
npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo react-native-svg react-native-safe-area-context
```

If you use Expo Router or a managed workflow, no extra autolinking steps are required beyond installing the packages.

#### Why direct install is required

- Autolinking scans only the app's `package.json`
- iOS CocoaPods/Android Gradle include native modules only when the app declares them
- Libraries should list native requirements as `peerDependencies` and document installation

<!-- Removed separate Expo Installation block to avoid duplication. Expo users should install native deps with `expo install` as shown above. -->

### Troubleshooting AsyncStorage

If you encounter:

```
[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null
```

1. Ensure `@react-native-async-storage/async-storage` is installed in your app (not only in this library)
2. iOS: run `cd ios && pod install`, then rebuild the app
3. Clear Metro cache: `npm start -- --reset-cache` (or `expo start -c`)
4. Clean builds: uninstall the app from device/simulator and rebuild

## Quick Start

### ⚠️ Important: SessionRecorderProvider Required

**The `SessionRecorderProvider` is required for the session recorder to work properly.** It provides:

- Context for session state management
- Widget modal functionality
- React hooks for session control
- Store management for session state

### Minimal Setup (Recommended for getting started)

#### For Basic React Native Apps (App.tsx)

```javascript
import React from 'react'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'

// Initialize with minimal required options
SessionRecorder.init({
  application: 'my-react-native-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY'
})

export default function App() {
  return <SessionRecorderProvider>{/* Your app content */}</SessionRecorderProvider>
}
```

#### For Expo Apps (\_layout.tsx)

```javascript
import React from 'react'
import { Stack } from 'expo-router'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'

// Initialize with minimal required options
SessionRecorder.init({
  application: 'my-expo-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY'
})

export default function RootLayout() {
  return (
    <SessionRecorderProvider>
      <Stack />
    </SessionRecorderProvider>
  )
}
```

This minimal setup will:

- ✅ Record gestures and navigation automatically
- ✅ Enable HTTP request/response monitoring
- ✅ Provide basic session recording capabilities
- ✅ Screen recording enabled (captures app UI)

### Basic Configuration

#### For Basic React Native Apps (App.tsx)

```javascript
import React from 'react'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'

SessionRecorder.init({
  application: 'my-react-native-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',
  recordGestures: true, // default is true
  recordNavigation: true, // default is true
  recordScreen: true // default is true
})

export default function App() {
  return <SessionRecorderProvider>{/* Your app content */}</SessionRecorderProvider>
}
```

#### For Expo Apps (\_layout.tsx)

```javascript
import React from 'react'
import { Stack } from 'expo-router'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'

SessionRecorder.init({
  application: 'my-expo-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',
  recordGestures: true, // default is true
  recordNavigation: true, // default is true
  recordScreen: true // default is true
})

export default function RootLayout() {
  return (
    <SessionRecorderProvider>
      <Stack />
    </SessionRecorderProvider>
  )
}
```

### Complete App Integration Example

Here's a complete example showing how to integrate the session recorder in your React Native app:

```javascript
import React, { useEffect, useRef } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'
import { AppNavigator } from './navigation/AppNavigator'

// Initialize session recorder
SessionRecorder.init({
  application: 'my-react-native-app',
  version: '1.0.0',
  environment: __DEV__ ? 'development' : 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',
  recordGestures: true,
  recordNavigation: true,
  recordScreen: false // Enable after adding permissions
})

export default function App() {
  const navigationRef = useRef(null)

  useEffect(() => {
    // Set session attributes for better debugging context
    SessionRecorder.setSessionAttributes({
      userId: 'user123',
      userType: 'premium',
      appVersion: '1.0.0'
    })
  }, [])

  return (
    <SessionRecorderProvider>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            SessionRecorder.setNavigationRef(navigationRef.current)
          }}
        >
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </SessionRecorderProvider>
  )
}
```

### Expo Configuration

For Expo applications, the package automatically detects the Expo environment:

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-react-native'

SessionRecorder.init({
  application: 'my-expo-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',
  recordGestures: true,
  recordNavigation: true,
  recordScreen: true
})
```

The package will automatically:

- Detect Expo environment using `expo-constants`
- Add Expo-specific attributes to traces
- Optimize performance for Expo runtime

### Navigation Integration

#### Expo Router (Recommended for Expo apps)

Expo Router already manages the NavigationContainer. Don't add your own.

```tsx
import { useEffect } from 'react'
import { Stack, useNavigationContainerRef } from 'expo-router'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef()

  useEffect(() => {
    const unsub = navigationRef.addListener?.('state', () => {
      SessionRecorder.setNavigationRef(navigationRef)
      unsub?.()
    })
    return unsub
  }, [navigationRef])

  return (
    <SessionRecorderProvider>
      <Stack />
    </SessionRecorderProvider>
  )
}
```

#### Classic React Navigation (Bare React Native)

If you own the `NavigationContainer`, set the ref in `onReady`:

```tsx
import { NavigationContainer } from '@react-navigation/native'
import { useRef } from 'react'
import { SessionRecorderProvider, SessionRecorder } from '@multiplayer-app/session-recorder-react-native'

export default function App() {
  const navigationRef = useRef<any>(null)

  return (
    <SessionRecorderProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          SessionRecorder.setNavigationRef(navigationRef.current)
        }}
      >
        {/* Your navigation stack */}
      </NavigationContainer>
    </SessionRecorderProvider>
  )
}
```

### Manual Session Control

```javascript
// Start a new recording session
SessionRecorder.start()

// Pause current recording
SessionRecorder.pause()

// Resume paused recording
SessionRecorder.resume()

// Stop recording with optional reason
SessionRecorder.stop('Session completed')

// Save continuous recording (for continuous mode)
SessionRecorder.save()

// Set session attributes for better context
SessionRecorder.setSessionAttributes({
  userId: 'user123',
  feature: 'checkout',
  version: '2.1.0'
})
```

## Session Provider & Hooks

### Disable Widget Button

To hide the floating widget button but keep the modal functionality:

```javascript
SessionRecorder.init({
  application: 'my-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',

  // Disable the floating button
  widget: {
    enabled: true,
    button: {
      visible: false // Hide the floating button
    }
  }
})
```

### Programmatic Widget Control

Use the `useSessionRecorder` hook to control the widget modal programmatically:

```javascript
import React from 'react'
import { View, Button } from 'react-native'
import { useSessionRecorder } from '@multiplayer-app/session-recorder-react-native'

function MyComponent() {
  const { openWidgetModal, closeWidgetModal } = useSessionRecorder()

  return (
    <View>
      <Button title='Open Session Recorder' onPress={openWidgetModal} />
      <Button title='Close Session Recorder' onPress={closeWidgetModal} />
    </View>
  )
}
```

### Session Control with Hooks

```javascript
import React from 'react'
import { View, Button } from 'react-native'
import { useSessionRecorder } from '@multiplayer-app/session-recorder-react-native'

function SessionControls() {
  const { startSession, stopSession, pauseSession, resumeSession, saveSession } = useSessionRecorder()

  return (
    <View>
      <Button title='Start Session' onPress={() => startSession()} />
      <Button title='Pause Session' onPress={() => pauseSession()} />
      <Button title='Resume Session' onPress={() => resumeSession()} />
      <Button title='Stop Session' onPress={() => stopSession('User completed')} />
      <Button title='Save Session' onPress={() => saveSession()} />
    </View>
  )
}
```

### Session State with Hooks

```javascript
import React from 'react'
import { View, Text } from 'react-native'
import { useSessionRecorderStore } from '@multiplayer-app/session-recorder-react-native'

function SessionStatus() {
  const sessionType = useSessionRecorderStore((s) => s.sessionType)
  const isWidgetModalVisible = useSessionRecorderStore((s) => s.isWidgetModalVisible)
  const sessionState = useSessionRecorderStore((s) => s.sessionState)
  const isOnline = useSessionRecorderStore((s) => s.isOnline)

  return (
    <View>
      <Text>Session State: {sessionState}</Text>
      <Text>Session Type: {sessionType}</Text>
      <Text>Widget Visible: {isWidgetModalVisible ? 'Yes' : 'No'}</Text>
      <Text>Online: {isOnline ? 'Yes' : 'No'}</Text>
    </View>
  )
}
```

### Complete Example with Custom UI

```javascript
import React, { useEffect } from 'react'
import { View, Button, Text, Alert } from 'react-native'
import {
  SessionRecorderProvider,
  useSessionRecorder,
  useSessionRecorderStore
} from '@multiplayer-app/session-recorder-react-native'

function SessionRecorderUI() {
  const { startSession, stopSession, openWidgetModal } = useSessionRecorder()
  const { sessionState, isWidgetModalVisible } = useSessionRecorderStore((state) => ({
    sessionState: state.sessionState,
    isWidgetModalVisible: state.isWidgetModalVisible
  }))

  const handleStartRecording = async () => {
    try {
      await startSession()
      Alert.alert('Success', 'Session recording started')
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording')
    }
  }

  const handleStopRecording = async () => {
    try {
      await stopSession('User manually stopped')
      Alert.alert('Success', 'Session recording stopped')
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording')
    }
  }

  return (
    <View style={{ padding: 20 }}>
      <Text>Session State: {sessionState}</Text>
      <Text>Widget Modal: {isWidgetModalVisible ? 'Open' : 'Closed'}</Text>

      <Button title='Start Recording' onPress={handleStartRecording} />
      <Button title='Stop Recording' onPress={handleStopRecording} />
      <Button title='Open Widget' onPress={openWidgetModal} />
    </View>
  )
}

export default function App() {
  return (
    <SessionRecorderProvider>
      <SessionRecorderUI />
    </SessionRecorderProvider>
  )
}
```

## Features

- **🎯 Gesture Recording**: Track taps, swipes, and other touch interactions with target element information
- **🧭 Navigation Tracking**: Monitor screen transitions and navigation state changes
- **📱 Screen Recording**: Capture periodic screenshots (requires permissions)
- **🔗 OpenTelemetry Integration**: Correlate frontend actions with backend traces
- **🔒 HTTP Masking**: Protect sensitive data in request/response headers and bodies
- **⚡ Session Management**: Start, pause, resume, and stop sessions programmatically
- **📦 Expo Support**: Full compatibility with Expo applications including automatic environment detection
- **🎨 Session Widget**: Built-in UI widget for user-initiated session recording
- **📊 Continuous Recording**: Background recording with automatic error capture
- **🌐 Network Monitoring**: Track HTTP requests and responses with correlation

## Gesture Recording & Target Element Information

The session recorder automatically captures target element information for all gesture interactions, enriching your OpenTelemetry traces with valuable context about what users are interacting with.

### Captured Attributes

When users interact with elements, the following attributes are automatically added to gesture spans:

| Attribute                | Description                               | Example           |
| ------------------------ | ----------------------------------------- | ----------------- |
| `gesture.target`         | Primary identifier for the target element | `"Submit Button"` |
| `gesture.target.label`   | Accessibility label of the element        | `"Submit form"`   |
| `gesture.target.role`    | Accessibility role of the element         | `"button"`        |
| `gesture.target.test_id` | Test ID of the element                    | `"submit-btn"`    |
| `gesture.target.text`    | Text content of the element               | `"Submit"`        |

### How Target Information is Extracted

The recorder automatically extracts target information from React Native elements using the following priority:

1. **`accessibilityLabel`** - Explicit accessibility label (highest priority)
2. **Text content** - Text from child elements
3. **`testID`** - Test identifier (lowest priority)

### Best Practices for Better Trace Information

To get the most useful target information in your traces, follow these practices:

#### 1. Use Accessibility Labels

```jsx
<TouchableOpacity accessibilityLabel='Submit user registration form' accessibilityRole='button' onPress={handleSubmit}>
  <Text>Submit</Text>
</TouchableOpacity>
```

#### 2. Add Test IDs for Testing Context

```jsx
<TouchableOpacity testID='registration-submit-btn' accessibilityLabel='Submit registration' onPress={handleSubmit}>
  <Text>Submit</Text>
</TouchableOpacity>
```

#### 3. Use Semantic Text Content

```jsx
<TouchableOpacity onPress={handleSubmit}>
  <Text>Submit Registration</Text> {/* Clear, descriptive text */}
</TouchableOpacity>
```

#### 4. Avoid Generic Labels

```jsx
// ❌ Poor trace information
<TouchableOpacity accessibilityLabel="Button" onPress={handleSubmit}>
  <Text>Click</Text>
</TouchableOpacity>

// ✅ Rich trace information
<TouchableOpacity
  accessibilityLabel="Submit user registration form"
  testID="registration-submit"
  onPress={handleSubmit}
>
  <Text>Submit Registration</Text>
</TouchableOpacity>
```

### Example Trace Output

With proper element labeling, your gesture traces will include rich context:

```json
{
  "spanName": "Gesture.tap",
  "attributes": {
    "gesture.type": "tap",
    "gesture.platform": "react-native",
    "gesture.coordinates.x": 150.5,
    "gesture.coordinates.y": 200.3,
    "gesture.target": "Submit user registration form",
    "gesture.target.label": "Submit user registration form",
    "gesture.target.role": "button",
    "gesture.target.test_id": "registration-submit",
    "gesture.target.text": "Submit Registration"
  }
}
```

This rich context helps you:

- **Debug user interactions** more effectively
- **Understand user behavior** patterns
- **Identify UI issues** faster
- **Correlate frontend actions** with backend events

## Screen Recording

The session recorder captures your app's UI using `react-native-view-shot`, which:

- ✅ **No permissions required** - Captures only your app's interface
- ✅ **Works out of the box** - No additional setup needed
- ✅ **Privacy-friendly** - Only captures your app's content, not system UI
- ❌ **App-only** - Cannot capture other apps or system screens

This is different from system-wide screen recording which would require permissions.

## Configuration Options

### Required Options

| Option        | Type   | Description                    |
| ------------- | ------ | ------------------------------ |
| `apiKey`      | string | Your Multiplayer API key       |
| `application` | string | Application name               |
| `version`     | string | Application version            |
| `environment` | string | Environment (production, etc.) |

### Optional Options

| Option                         | Type    | Default | Description                            |
| ------------------------------ | ------- | ------- | -------------------------------------- |
| `recordGestures`               | boolean | true    | Enable gesture recording               |
| `recordNavigation`             | boolean | true    | Enable navigation tracking             |
| `recordScreen`                 | boolean | true    | Enable screen recording                |
| `sampleTraceRatio`             | number  | 0.15    | Trace sampling ratio (0.0-1.0)         |
| `captureBody`                  | boolean | true    | Capture request/response bodies        |
| `captureHeaders`               | boolean | true    | Capture request/response headers       |
| `masking`                      | object  | -       | Data masking configuration             |
| `ignoreUrls`                   | array   | []      | URLs to exclude from monitoring        |
| `propagateTraceHeaderCorsUrls` | array   | []      | URLs for CORS trace header propagation |
| `showContinuousRecording`      | boolean | true    | Show continuous recording option       |
| `widget`                       | object  | -       | Session widget configuration           |

## Advanced Configuration

### Full Configuration Example

```javascript
SessionRecorder.init({
  // Required options
  application: 'my-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',

  // Recording options
  recordGestures: true,
  recordNavigation: true,
  recordScreen: true, // Captures app UI automatically

  // Network monitoring
  // NOTE: if frontend domain doesn't match to backend one, set backend domain to `propagateTraceHeaderCorsUrls` parameter
  propagateTraceHeaderCorsUrls: [
    new RegExp('https://your.backend.api.domain', 'i'), // can be regex or string
    new RegExp('https://another.backend.api.domain', 'i')
  ],
  ignoreUrls: [/https:\/\/analytics\.example\.com/, /https:\/\/crashlytics\.com/],
  captureBody: true,
  captureHeaders: true,
  maxCapturingHttpPayloadSize: 100000,

  // Data masking for sensitive information
  masking: {
    isContentMaskingEnabled: true,
    maskHeadersList: ['authorization', 'cookie', 'x-api-key'],
    maskBodyFieldsList: ['password', 'token', 'secret', 'creditCard'],
    maskTextInputs: true,
    maskImages: false,
    maskButtons: false
  },

  // Session widget configuration
  widget: {
    enabled: true,
    button: {
      visible: true,
      placement: 'bottomRight' // or 'bottomLeft'
    }
  },

  // Continuous recording
  showContinuousRecording: true
})
```

### Environment-Specific Configuration

```javascript
import { SessionRecorder, LogLevel } from '@multiplayer-app/session-recorder-react-native'

const config = {
  application: 'my-app',
  version: '1.0.0',
  apiKey: process.env.MULTIPLAYER_API_KEY,

  // Development-specific options
  ...(__DEV__ && {
    logger: {
      enabled: true,
      level: LogLevel.DEBUG
    }
  })
}

SessionRecorder.init(config)
```

## Troubleshooting

### Common Issues

#### 1. AsyncStorage Errors

```
[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null
```

**Solution:**

- Ensure `@react-native-async-storage/async-storage` is installed in your app
- iOS: Run `cd ios && pod install`
- Clear Metro cache: `npm start -- --reset-cache`
- Clean builds: Uninstall app and rebuild

#### 2. Screen Recording Not Working

- Ensure `recordScreen: true` in configuration
- Check that `react-native-view-shot` is properly installed
- Verify the app has a valid view to capture
- Check console logs for capture errors

#### 3. Navigation Tracking Not Working

- Make sure you've set the navigation ref: `SessionRecorder.setNavigationRef(navigationRef)`
- For Expo Router: Use `useNavigationContainerRef()` hook
- For React Navigation: Set ref in `onReady` callback

#### 4. Gesture Recording Issues

- Gesture recording uses native modules and should work automatically
- Check that `recordGestures: true` is set
- Ensure app is not in background mode

#### 5. Expo Environment Not Detected

- Ensure `expo-constants` is installed: `npx expo install expo-constants`
- Check that you're using the correct Expo SDK version

#### 6. Build Issues

- **iOS**: Run `cd ios && pod install` after installing dependencies
- **Android**: Run `cd android && ./gradlew clean`
- Clear Metro cache: `npm start -- --reset-cache`

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
import { SessionRecorder, LogLevel } from '@multiplayer-app/session-recorder-react-native'

SessionRecorder.init({
  // ... other config
  logger: {
    enabled: true,
    level: LogLevel.DEBUG
  }
})
```

## Examples

Check out the complete example applications in the `examples/` directory:

- **Bare React Native**: `examples/example-app/` - Full React Native app with session recording
- **Expo App**: `examples/example-app-expo/` - Expo app with session recording

Both examples include:

- Complete setup and configuration
- Navigation integration
- Session management
- Error handling
- Best practices

## API Reference

### SessionRecorder Methods

| Method                        | Description                     | Parameters               |
| ----------------------------- | ------------------------------- | ------------------------ |
| `init(options)`               | Initialize the session recorder | `SessionRecorderOptions` |
| `start()`                     | Start a new recording session   | -                        |
| `stop(reason?)`               | Stop current recording          | `string?`                |
| `pause()`                     | Pause current recording         | -                        |
| `resume()`                    | Resume paused recording         | -                        |
| `save()`                      | Save continuous recording       | -                        |
| `setNavigationRef(ref)`       | Set navigation reference        | `NavigationContainerRef` |
| `setSessionAttributes(attrs)` | Set session metadata            | `Record<string, any>`    |

### Configuration Types

```typescript
interface SessionRecorderOptions {
  // Required
  apiKey: string
  application: string
  version: string
  environment: string

  // Optional
  exporterEndpoint?: string
  apiBaseUrl?: string
  recordGestures?: boolean
  recordNavigation?: boolean
  recordScreen?: boolean
  sampleTraceRatio?: number
  captureBody?: boolean
  captureHeaders?: boolean
  maxCapturingHttpPayloadSize?: number
  masking?: MaskingOptions
  ignoreUrls?: Array<string | RegExp>
  propagateTraceHeaderCorsUrls?: PropagateTraceHeaderCorsUrls
  showContinuousRecording?: boolean
  schemifyDocSpanPayload?: boolean
  widget?: WidgetConfig
  logger?: {
    level?: number
    enabled?: boolean
  }
}
```

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

MIT License - see LICENSE file for details.
