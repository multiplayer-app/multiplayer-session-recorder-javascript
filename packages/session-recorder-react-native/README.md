# Multiplayer Session Recorder for React Native

The Multiplayer Session Recorder for React Native provides session recording capabilities for React Native applications, including gesture tracking, navigation monitoring, and screen recording. It also includes full support for Expo applications.

## Installation

```bash
npm install @multiplayer-app/session-recorder-react-native
# or
yarn add @multiplayer-app/session-recorder-react-native
```

### Required Dependencies

This package requires the following dependencies to be installed in your React Native application:

```bash
npm install @react-native-async-storage/async-storage @react-native-community/netinfo react-native-mmkv react-native-svg
# or
yarn add @react-native-async-storage/async-storage @react-native-community/netinfo react-native-mmkv react-native-svg
```

**Important**: Native modules like `@react-native-async-storage/async-storage` and `react-native-svg` must be installed directly in your app's `package.json`. React Native autolinking only links native modules that are declared by the app itself, not modules pulled in transitively by libraries. If you don't add them directly, you may see errors like "NativeModule: AsyncStorage is null" or SVGs not rendering.

#### Bare React Native projects

```bash
# install native deps in the app
npm install @react-native-async-storage/async-storage @react-native-community/netinfo react-native-mmkv react-native-svg

# iOS: install pods from your app's ios directory
cd ios && pod install && cd -
```

#### Expo projects

Use Expo's version-aware installer so versions match the SDK:

```bash
npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo react-native-mmkv react-native-svg
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

## Setup

### Basic Configuration

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-react-native'

SessionRecorder.init({
  application: 'my-react-native-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'MULTIPLAYER_OTLP_KEY',
  recordGestures: true,
  recordNavigation: true,
  recordScreen: false // Requires additional permissions
})
```

### Expo Configuration

For Expo applications, the package automatically detects the Expo environment. You can also explicitly specify the platform:

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-react-native'

SessionRecorder.init({
  application: 'my-expo-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'MULTIPLAYER_OTLP_KEY',
  platform: 'expo', // Optional: explicitly set platform
  recordGestures: true,
  recordNavigation: true,
  recordScreen: false
})
```

The package will automatically:

- Detect Expo environment using `expo-constants`
- Add Expo-specific attributes to traces
- Optimize performance for Expo runtime

### Navigation integration

#### Expo Router (recommended)

Expo Router already manages the NavigationContainer. Don’t add your own.

```tsx
import { useEffect } from 'react'
import { Stack, useNavigationContainerRef } from 'expo-router'
import SessionRecorder from '@multiplayer-app/session-recorder-react-native'

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef()

  useEffect(() => {
    const unsub = navigationRef.addListener?.('state', () => {
      SessionRecorder.setNavigationRef(navigationRef)
      unsub?.()
    })
    return unsub
  }, [navigationRef])

  return <Stack />
}
```

#### Classic React Navigation (no Expo Router)

If you own the `NavigationContainer`, set the ref in `onReady`:

```tsx
import { NavigationContainer } from '@react-navigation/native'
import { useRef } from 'react'
import SessionRecorder from '@multiplayer-app/session-recorder-react-native'

export default function App() {
  const navigationRef = useRef<any>(null)

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        SessionRecorder.setNavigationRef(navigationRef.current)
      }}
    >
      {/* Your navigation stack */}
    </NavigationContainer>
  )
}
```

### Manual Control

```javascript
// Start recording
SessionRecorder.start()

// Pause recording
SessionRecorder.pause()

// Resume recording
SessionRecorder.resume()

// Stop recording
SessionRecorder.stop('Session completed')

// Save continuous recording
SessionRecorder.save()
```

## Features

- **Gesture Recording**: Track taps, swipes, and other touch interactions with target element information
- **Navigation Tracking**: Monitor screen transitions and navigation state
- **Screen Recording**: Capture periodic screenshots (requires permissions)
- **OpenTelemetry Integration**: Correlate with backend traces
- **HTTP Masking**: Protect sensitive data in request/response headers and bodies
- **Session Management**: Start, pause, resume, and stop sessions
- **Expo Support**: Full compatibility with Expo applications including automatic environment detection

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

## Permissions

For screen recording, you'll need to add permissions to your app:

### iOS (Info.plist)

```xml
<key>NSCameraUsageDescription</key>
<string>This app needs camera access to record screen interactions</string>
```

### Android (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## Configuration Options

| Option             | Type    | Default | Description                             |
| ------------------ | ------- | ------- | --------------------------------------- |
| `apiKey`           | string  | -       | Your Multiplayer API key                |
| `application`      | string  | -       | Application name                        |
| `version`          | string  | -       | Application version                     |
| `environment`      | string  | -       | Environment (production, staging, etc.) |
| `platform`         | string  | auto    | Platform ('react-native' or 'expo')     |
| `recordGestures`   | boolean | true    | Enable gesture recording                |
| `recordNavigation` | boolean | true    | Enable navigation tracking              |
| `recordScreen`     | boolean | false   | Enable screen recording                 |
| `sampleTraceRatio` | number  | 0.15    | Trace sampling ratio                    |
| `captureBody`      | boolean | true    | Capture request/response bodies         |
| `captureHeaders`   | boolean | true    | Capture request/response headers        |
| `httpMasking`      | object  | -       | HTTP masking configuration              |

## Advanced Configuration

```javascript
SessionRecorder.init({
  application: 'my-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'MULTIPLAYER_OTLP_KEY',

  // Recording options
  recordGestures: true,
  recordNavigation: true,
  recordScreen: false,

  // Network monitoring
  ignoreUrls: [/https:\/\/analytics\.example\.com/],
  captureBody: true,
  captureHeaders: true,
  maxCapturingHttpPayloadSize: 100000,

  // HTTP masking
  httpMasking: {
    isContentMaskingEnabled: true,
    maskHeadersList: ['authorization', 'cookie', 'x-api-key'],
    maskBodyFieldsList: ['password', 'token', 'secret']
  },

  // Session attributes
  sessionAttributes: {
    userId: '12345',
    userType: 'premium'
  }
})
```

## Troubleshooting

### Common Issues

1. **Screen recording not working**: Ensure you have the necessary permissions
2. **Navigation tracking not working**: Make sure you've set the navigation ref
3. **Gesture recording issues**: Gesture recording uses native PanResponder and should work out of the box
4. **Expo environment not detected**: Ensure `expo-constants` is installed and accessible
5. **Expo build issues**: Make sure you're using the correct entry point for Expo applications

### Debug Mode

Enable debug logging:

```javascript
SessionRecorder.init({
  // ... other config
  debug: true
})
```

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

MIT License - see LICENSE file for details.
