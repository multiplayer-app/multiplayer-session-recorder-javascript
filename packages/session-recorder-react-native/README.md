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
npm install @react-native-async-storage/async-storage @react-native-community/netinfo react-native-mmkv
# or
yarn add @react-native-async-storage/async-storage @react-native-community/netinfo react-native-mmkv
```

**Note**: If these dependencies are not installed, the session recorder will throw clear error messages indicating which dependencies are missing.

### Expo Installation

For Expo applications, the package automatically detects the Expo environment and provides Expo-specific optimizations:

```bash
npx expo install @multiplayer-app/session-recorder-react-native
```

The package will automatically detect if you're running in an Expo environment and provide the appropriate configuration.

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

### React Navigation Integration

```javascript
import { NavigationContainer } from '@react-navigation/native'
import SessionRecorder from '@multiplayer-app/session-recorder-react-native'

export default function App() {
  const navigationRef = useRef(null)

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

- **Gesture Recording**: Track taps, swipes, and other touch interactions
- **Navigation Tracking**: Monitor screen transitions and navigation state
- **Screen Recording**: Capture periodic screenshots (requires permissions)
- **OpenTelemetry Integration**: Correlate with backend traces
- **HTTP Masking**: Protect sensitive data in request/response headers and bodies
- **Session Management**: Start, pause, resume, and stop sessions
- **Expo Support**: Full compatibility with Expo applications including automatic environment detection

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
