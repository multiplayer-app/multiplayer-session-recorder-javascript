# RRWeb Integration for React Native Session Recorder

This document explains the rrweb-compatible event generation system implemented for React Native session recording.

## Overview

The React Native session recorder automatically generates rrweb-compatible events that can be replayed using standard rrweb players. **No manual intervention is required** - the system automatically captures:

1. **Screen snapshots** as `FullSnapshotEvent` with base64-encoded images (periodic + on interaction)
2. **Touch interactions** as `IncrementalSnapshotEvent` with `MouseInteraction` data (automatic)
3. **Navigation events** and other user interactions (automatic)

**Recording starts automatically when you call `sessionRecorder.start()` and stops when you call `sessionRecorder.stop()`.**

### 🚀 **Smart Change Detection**

The system now includes **intelligent change detection** that prevents duplicate events:

- **Automatic Comparison**: Each screen capture is compared with the previous one
- **Hash-Based Detection**: Uses lightweight hashing to detect changes quickly
- **Skip Unchanged Screens**: Only sends events when the screen actually changes
- **Touch-Triggered Capture**: Forces capture after touch interactions regardless of change detection

## Architecture

### Core Components

1. **RRWeb Types** (`src/types/rrweb.ts`)

   - Complete TypeScript definitions for rrweb events
   - React Native specific types for screen and touch data

2. **SessionRecorder** (`src/session-recorder.ts`)

   - Main entry point with `recordEvent()` method for custom events
   - Automatic touch recording (internal methods)
   - Automatic screen capture coordination

3. **ScreenRecorder** (`src/recorder/screenRecorder.ts`)

   - Captures screenshots and converts to `FullSnapshotEvent`
   - Creates virtual DOM with `<img>` elements containing base64 screenshots

4. **GestureRecorder** (`src/recorder/gestureRecorder.ts`)

   - Automatically converts touch events to rrweb `MouseInteraction` events
   - Maps React Native coordinates to rrweb format
   - Sets up automatic touch capture on session start

5. **TouchEventCapture** (`src/context/SessionRecorderContext.tsx`)
   - React component that automatically captures touch events
   - No manual setup required - works automatically when session is active

## Event Types Generated

### FullSnapshotEvent

```typescript
{
  type: EventType.FullSnapshot,
  data: {
    node: {
      type: 1, // Element node
      id: 1,
      tagName: 'div',
      attributes: { style: 'width: 375px; height: 667px; position: relative;' },
      childNodes: [{
        type: 1,
        id: 2,
        tagName: 'img',
        attributes: {
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          width: '375',
          height: '667',
          style: 'width: 375px; height: 667px;'
        }
      }]
    },
    initialOffset: { left: 0, top: 0 }
  },
  timestamp: 1640995200000
}
```

### IncrementalSnapshotEvent (Touch Interactions)

```typescript
{
  type: EventType.IncrementalSnapshot,
  data: {
    source: IncrementalSource.MouseInteraction,
    type: MouseInteractionType.TouchStart, // or TouchMove, TouchEnd
    id: 2, // References the image node ID
    x: 150,
    y: 200
  },
  timestamp: 1640995201000
}
```

## Usage

### Basic Setup (Automatic Recording)

```typescript
import { SessionRecorderProvider } from '@multiplayer-app/session-recorder-react-native'

function App() {
  return (
    <SessionRecorderProvider
      options={{
        apiKey: 'your-api-key',
        version: '1.0.0',
        application: 'MyApp',
        environment: 'production',
        recordScreen: true, // Automatic screen capture
        recordGestures: true // Automatic touch recording
      }}
    >
      <YourAppContent />
    </SessionRecorderProvider>
  )
}
```

**That's it!** Recording is now automatic. When you start a session, the system will:

- Automatically capture screen snapshots periodically
- Automatically record all touch interactions
- Generate rrweb-compatible events without any manual intervention

### Custom Event Recording (Optional)

```typescript
import { useSessionRecorder } from '@multiplayer-app/session-recorder-react-native'

function MyComponent() {
  const { client } = useSessionRecorder()

  const handleCustomEvent = () => {
    // Record a custom rrweb event (optional)
    client.recordEvent({
      type: EventType.Custom,
      data: { customData: 'value' },
      timestamp: Date.now()
    })
  }

  return <Button onPress={handleCustomEvent} title='Record Custom Event' />
}
```

## Integration Points

### Screen Capture Integration

The `ScreenRecorder` class now includes **complete react-native-view-shot integration**:

```typescript
// In screenRecorder.ts - _captureScreenBase64 method
private async _captureScreenBase64(): Promise<string | null> {
  try {
    if (!this.viewShotRef) {
      console.warn('ViewShot ref not available for screen capture')
      return null
    }

    // Capture the screen using react-native-view-shot
    const result = await captureRef(this.viewShotRef, {
      format: this.captureFormat,
      quality: this.captureQuality,
      result: 'base64'
    })

    return result
  } catch (error) {
    console.error('Failed to capture screen:', error)
    return null
  }
}
```

**The ViewShot ref is automatically set up** in the `TouchEventCapture` component, so no manual configuration is needed!

### Automatic ViewShot Setup

The `TouchEventCapture` component automatically sets up the ViewShot ref:

```typescript
// In SessionRecorderContext.tsx
const TouchEventCapture: React.FC<{ children: ReactNode }> = ({ children }) => {
  const context = useContext(SessionRecorderContext)
  const viewShotRef = useRef<View>(null)

  // Callback ref to set the viewshot ref immediately when available
  const setViewShotRef = (ref: View | null) => {
    if (ref && context?.client) {
      context.client.setViewShotRef?.(ref)
    }
  }

  return (
    <View
      ref={(ref) => {
        viewShotRef.current = ref
        setViewShotRef(ref)
      }}
      style={{ flex: 1 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </View>
  )
}
```

This ensures that:

- The same View that captures touch events is used for screen capture
- Perfect synchronization between touch interactions and screen captures
- No manual ref setup required

### Required Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "react-native-view-shot": "^3.8.0"
  }
}
```

## Automatic Event Flow

1. **Session Start**: `SessionRecorder.start()` automatically initializes all recorders
2. **Automatic Screen Capture**: `ScreenRecorder` automatically captures screenshots periodically + on interactions
3. **Automatic Touch Events**: `TouchEventCapture` automatically captures all touch interactions
4. **Automatic Event Generation**: Touch events are automatically converted to rrweb `MouseInteraction` events
5. **Automatic Event Recording**: All events are automatically stored and can be exported

**No manual intervention required!** The entire process is automatic once you start a session.

## Customization

### Screen Capture Frequency

```typescript
// Adjust capture interval in ScreenRecorder
screenRecorder.setCaptureInterval(3000) // Capture every 3 seconds
```

### Change Detection Configuration

```typescript
// Enable/disable change detection
screenRecorder.setChangeDetection(true) // Default: true

// Adjust hash sample size for change detection
screenRecorder.setHashSampleSize(200) // Default: 100 characters

// Force capture (bypasses change detection)
screenRecorder.forceCapture()
```

### Touch Event Throttling

```typescript
// Adjust gesture throttling in GestureRecorder
gestureRecorder.setGestureThrottle(100) // Throttle to 100ms
```

### Event Filtering

You can filter events by modifying the `recordEvent` method in `SessionRecorder`:

```typescript
recordEvent(event: RRWebEvent): void {
  if (!this._isInitialized || this.sessionState !== SessionState.started) {
    return
  }

  // Add custom filtering logic here
  if (event.type === EventType.IncrementalSnapshot) {
    // Filter out certain touch events if needed
  }

  this._recorder.recordEvent(event)
}
```

## Exporting Events

To export recorded events for rrweb playback:

```typescript
const events = sessionRecorder.getRecordedEvents()
// Save events to file or send to server
```

## Troubleshooting

### Common Issues

1. **Screen capture not working**: Ensure `react-native-view-shot` is properly installed and configured
2. **Touch events not recorded**: Check that `TouchEventCapture` wraps your app content
3. **Events not generated**: Verify session is in `started` state

### Debug Mode

Enable debug logging by setting:

```typescript
// In your app configuration
console.log('Recording stats:', sessionRecorder.getRecordingStats())
```

## Future Enhancements

- [ ] Support for multiple screen orientations
- [ ] Gesture recognition and classification
- [ ] Performance optimization for large sessions
- [ ] Integration with additional React Native libraries
- [ ] Custom event types for React Native specific interactions

## Compatibility

This implementation is compatible with:

- rrweb 1.x and 2.x
- React Native 0.60+
- iOS and Android platforms
- Standard rrweb players and replay tools
