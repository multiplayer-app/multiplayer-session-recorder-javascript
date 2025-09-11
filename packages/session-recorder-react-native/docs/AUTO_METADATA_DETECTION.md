# Automatic App Metadata Detection

The session recorder automatically detects app metadata from your project configuration files **without requiring any developer intervention**.

## How It Works

The library automatically extracts app information from common configuration files in this priority order:

1. **`app.json`** - Expo/React Native app configuration
2. **`app.config.js`** - Dynamic Expo configuration
3. **`package.json`** - Node.js package configuration (fallback)

## Supported Configuration Files

### app.json

```json
{
  "name": "My Awesome App",
  "version": "1.2.3",
  "displayName": "My App",
  "ios": {
    "bundleIdentifier": "com.mycompany.myapp",
    "buildNumber": "123"
  },
  "android": {
    "package": "com.mycompany.myapp",
    "versionCode": 123
  }
}
```

### app.config.js

```javascript
export default {
  name: 'My Awesome App',
  version: '1.2.3',
  displayName: 'My App',
  ios: {
    bundleIdentifier: 'com.mycompany.myapp',
    buildNumber: '123'
  },
  android: {
    package: 'com.mycompany.myapp',
    versionCode: 123
  }
}
```

### package.json (fallback)

```json
{
  "name": "my-awesome-app",
  "version": "1.2.3"
}
```

## Detected Metadata

The following information is automatically extracted:

- **App Name** - From `name` or `displayName`
- **App Version** - From `version`
- **Bundle ID** - From `ios.bundleIdentifier` or `android.package`
- **Build Number** - From `ios.buildNumber` or `android.versionCode`

## Build Process

The metadata detection happens automatically during the build process:

1. The build script scans your project root for configuration files
2. Extracts relevant metadata from the first found configuration
3. Generates a TypeScript file with the detected metadata
4. The session recorder uses this metadata in all recordings

## No Developer Action Required

✅ **Zero configuration** - Works out of the box
✅ **Automatic detection** - Scans common config files
✅ **Build-time generation** - No runtime file reading
✅ **Fallback support** - Graceful degradation

## Manual Override (Optional)

If you need to override the auto-detected metadata, you can still use the manual configuration:

```typescript
import { configureAppMetadata } from '@multiplayer-app/session-recorder-react-native'

configureAppMetadata({
  name: 'Custom App Name',
  version: '2.0.0',
  bundleId: 'com.custom.app'
})
```

## Priority Order

The metadata detection follows this priority:

1. **Expo Config** (if using Expo)
2. **Manual Configuration** (if `configureAppMetadata` was called)
3. **Auto-detected Metadata** (from config files)
4. **Fallback Values** (defaults)

This ensures maximum compatibility across different React Native setups while providing rich metadata for debugging sessions.
