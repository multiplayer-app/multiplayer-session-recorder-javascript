# Multiplayer Session Recorder

The Multiplayer **Session Recorder** is a powerful tool that offers deep session replays with insights spanning frontend screens, platform traces, metrics, and logs. It helps your team pinpoint and resolve bugs faster by providing a complete picture of your backend system architecture. No more wasted hours combing through APM data; the Multiplayer Session Recorder does it all in one place.

## Key Features

- **Reduced Inefficiencies**: Effortlessly capture the exact steps to reproduce an issue along with backend data in one click. No more hunting through scattered documentation, APM data, logs, or traces.
- **Faster Cross-Team Alignment**: Engineers can share session links containing all relevant information, eliminating the need for long tickets or clarifying issues through back-and-forth communication.
- **Uninterrupted Deep Work**: All system information—from architecture diagrams to API designs—is consolidated in one place. Minimize context switching and stay focused on what matters.

## Getting Started

### Installation

You can install the Multiplayer Session Recorder using npm or yarn:

```bash
npm install @multiplayer-app/debugger-browser
# or
yarn add @multiplayer-app/debugger-browser
```

### Basic Setup

To initialize the Multiplayer Session Recorder in your application, follow the steps below.

#### Import the Session Recorder

```javascript
import SessionRecorder from '@multiplayer-app/debugger-browser'
```

#### Initialization

Use the following code to initialize the session recorder with your application details:

```javascript
SessionRecorder.init({
  version: '{YOUR_APPLICATION_VERSION}',
  application: '{YOUR_APPLICATION_NAME}',
  environment: '{YOUR_APPLICATION_ENVIRONMENT}',
  apiKey: '{YOUR_API_KEY}'
})
```

Replace the placeholders with your application’s version, name, environment, and API key (OpenTelemetry Frontend Token).

#### Add User attributes

To track user-specific attributes in session replays, add the following:

```javascript
SessionRecorder.setSessionAttributes({
  userId: '{userId}',
  userName: '{userName}'
})
```

Replace the placeholders with the actual user information (e.g., user ID and username).

## Dependencies

This library relies on the following packages:

- **[rrweb](https://github.com/rrweb-io/rrweb)**: Provides the frontend session replay functionality, recording the user’s interactions with the app.
- **[OpenTelemetry](https://opentelemetry.io/)**: Used to capture backend traces, metrics, and logs that integrate seamlessly with the session replays for comprehensive debugging.

## Configuration Options

The Session Recorder supports various configuration options with sensible defaults:

### Default Values

- `showWidget`: `true` - Show the recording widget by default
- `recordCanvas`: `false` - Disable canvas recording by default
- `docTraceRatio`: `0.15` - 15% of traces for auto-documentation
- `sampleTraceRatio`: `0.15` - 15% sampling ratio
- `schemifyDocSpanPayload`: `true` - Enable payload schematization
- `disableCapturingHttpPayload`: `false` - Enable HTTP payload capture
- `maxCapturingHttpPayloadSize`: `100000` - 100KB max payload size
- `usePostMessageFallback`: `false` - Disable post message fallback
- `widgetButtonPlacement`: `'bottom-right'` - Default widget position
- `masking.maskAllInputs`: `true` - Mask all inputs by default
- `masking.maskDebugSpanPayload`: `true` - Mask debug span payload by default

## Example Usage

```javascript
import SessionRecorder from '@multiplayer-app/debugger-browser'

SessionRecorder.init({
  version: '1.0.0',
  application: 'my-app',
  environment: 'production',
  apiKey: 'your-api-key',
  showWidget: true,
  recordCanvas: true,
  ignoreUrls: [
    /https:\/\/domain\.to\.ignore\/.*/, // can be regex or string
    /https:\/\/another\.domain\.to\.ignore\/.*/
  ],
  // NOTE: if frontend domain doesn't match to backend one, set backend domain to `propagateTraceHeaderCorsUrls` parameter
  propagateTraceHeaderCorsUrls: [
    new RegExp('https://your.backend.api.domain', 'i'), // can be regex or string
    new RegExp('https://another.backend.api.domain', 'i')
  ],
  docTraceRatio: 0.15, // 15% of traces will be sent for auto-documentation
  sampleTraceRatio: 0.15, // 15% sampling ratio
  schemifyDocSpanPayload: true,
  maxCapturingHttpPayloadSize: 100000,
  disableCapturingHttpPayload: false,
  usePostMessageFallback: false, // Enable post message fallback if needed
  exporterApiBaseUrl: 'https://api.multiplayer.app', // Custom API base URL (optional)
  // Configure masking for sensitive data in session recordings
  masking: {
    maskAllInputs: true, // Masks all input fields by default
    maskInputOptions: {
      password: true, // Always mask password fields
      email: false, // Don't mask email fields by default
      tel: false, // Don't mask telephone fields by default
      number: false, // Don't mask number fields by default
      url: false, // Don't mask URL fields by default
      search: false, // Don't mask search fields by default
      textarea: false // Don't mask textarea elements by default
    },
    // Class-based masking
    maskTextClass: /sensitive|private/, // Mask text in elements with these classes
    // CSS selector for text masking
    maskTextSelector: '.sensitive-data', // Mask text in elements matching this selector
    // Custom masking functions
    maskInputFn: (text, element) => {
      if (element.classList.contains('credit-card')) {
        return '****-****-****-' + text.slice(-4)
      }
      return '***MASKED***'
    },
    maskTextFn: (text, element) => {
      if (element.dataset.type === 'email') {
        const [local, domain] = text.split('@')
        return local.charAt(0) + '***@' + domain
      }
      return '***MASKED***'
    },
    maskDebugSpanPayload: true, // Mask debug span payload in traces
    maskDebugSpanPayloadFn: (payload) => {
      // Custom trace payload masking
      if (payload && typeof payload === 'object') {
        const maskedPayload = { ...payload }
        // Mask sensitive trace data
        if (maskedPayload.requestHeaders) {
          maskedPayload.requestHeaders = '***MASKED***'
        }
        if (maskedPayload.responseBody) {
          maskedPayload.responseBody = '***MASKED***'
        }
        return maskedPayload
      }
      return payload
    }
  }
})

SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'John Doe'
})
```

## API Methods

The Session Recorder provides several methods for controlling session recording:

### Session Control

- `SessionRecorder.start(type, session?)` - Start a new session with optional existing session
- `SessionRecorder.stop(comment?)` - Stop the current session with optional comment
- `SessionRecorder.pause()` - Pause the current session
- `SessionRecorder.cancel()` - Cancel the current session
- `SessionRecorder.save()` - Save the continuous debugging session

### Configuration

- `SessionRecorder.setSessionAttributes(attributes)` - Set session metadata
- `SessionRecorder.recordingButtonClickHandler = handler` - Set custom click handler

### Session Attributes

You can set various session attributes for better tracking:

```javascript
SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'John Doe',
  userEmail: 'john@example.com',
  accountId: 'acc_123',
  accountName: 'Enterprise Account'
})
```

## Masking Configuration

The Session Recorder includes comprehensive masking options to protect sensitive data during session recordings. You can configure masking behavior through the `masking` option:

### Basic Masking Options

- `maskAllInputs`: If `true`, masks all input fields in the recording (default: `true`)
- `maskDebugSpanPayload`: If `true`, masks debug span payload in traces (default: `true`)

### Input Type Masking

You can control masking for specific input types:

```javascript
maskInputOptions: {
  password: true,    // Always mask password fields (default: true)
  email: false,      // Don't mask email fields by default
  tel: false,        // Don't mask telephone fields by default
  number: false,     // Don't mask number fields by default
  url: false,        // Don't mask URL fields by default
  search: false,     // Don't mask search fields by default
  textarea: false,   // Don't mask textarea elements by default
  select: false,     // Don't mask select elements by default
  // ...other types
}
```

### CSS Selector Masking

You can mask specific elements using CSS selectors:

```javascript
masking: {
  // Mask text in elements matching this selector
  maskTextSelector: '.sensitive-data, [data-private="true"], .user-profile .email',
}
```

### Class-Based Masking

You can mask text based on CSS classes using string or RegExp patterns:

```javascript
masking: {
  maskTextClass: 'sensitive',    // Mask text in elements with class 'sensitive'
}
```

Or with RegExp pattern:

```javascript
masking: {
  maskTextClass: /private|confidential/,  // Mask text in elements with classes 'private' or 'confidential'
}
```

### Custom Masking Functions

For advanced masking scenarios, you can provide custom functions:

```javascript
masking: {
  // Custom function for input masking
  maskInputFn: (text, element) => {
    // Custom logic to mask input text
    if (element.classList.contains('credit-card')) {
      return '****-****-****-' + text.slice(-4);
    }
    return '***MASKED***';
  },

  // Custom function for text masking
  maskTextFn: (text, element) => {
    // Custom logic to mask text content
    if (element.dataset.type === 'email') {
      const [local, domain] = text.split('@');
      return local.charAt(0) + '***@' + domain;
    }
    return '***MASKED***';
  },

  // Custom function for masking debug span payload in traces
  maskDebugSpanPayloadFn: (payload) => {
    // Custom logic to mask sensitive data in trace payloads
    if (payload && typeof payload === 'object') {
      const maskedPayload = { ...payload };
      // Mask sensitive fields
      if (maskedPayload.headers) {
        maskedPayload.headers = '***MASKED***';
      }
      if (maskedPayload.body) {
        maskedPayload.body = '***MASKED***';
      }
      return maskedPayload;
    }
    return payload;
  },
}
```

### Example: Comprehensive Masking Setup

```javascript
Debugger.init({
  // ... other options
  masking: {
    maskAllInputs: true,
    maskInputOptions: {
      password: true,
      email: true, // Mask email fields for privacy
      tel: true, // Mask telephone fields for privacy
      number: false, // Allow number fields
      url: false, // Allow URL fields
      search: false, // Allow search fields
      textarea: false // Allow textarea elements
      // ...other types
    },
    maskTextClass: /sensitive|private|confidential/, // Mask text in elements with these classes
    maskTextSelector: '.user-email, .user-phone, .credit-card, [data-sensitive="true"]', // Mask text in elements matching this selector
    maskInputFn: (text, element) => {
      // Custom credit card masking
      if (element.classList.contains('credit-card')) {
        return '****-****-****-' + text.slice(-4)
      }
      return '***MASKED***'
    },
    maskTextFn: (text, element) => {
      // Custom email masking
      if (element.dataset.type === 'email') {
        const [local, domain] = text.split('@')
        return local.charAt(0) + '***@' + domain
      }
      return '***MASKED***'
    },
    maskDebugSpanPayload: true, // Mask debug span payload in traces
    maskDebugSpanPayloadFn: (payload) => {
      // Custom trace payload masking
      if (payload && typeof payload === 'object') {
        const maskedPayload = { ...payload }
        // Mask sensitive trace data
        if (maskedPayload.requestHeaders) {
          maskedPayload.requestHeaders = '***MASKED***'
        }
        if (maskedPayload.responseBody) {
          maskedPayload.responseBody = '***MASKED***'
        }
        return maskedPayload
      }
      return payload
    }
  }
})
```

## Session Recorder for Next.js

To integrate the MySessionRecorder component into your Next.js application, follow these steps:

- Create a new file (e.g., MySessionRecorder.js or MySessionRecorder.tsx) in your root directory or a components directory.

- Import the component

In the newly created file, add the following code:

```javascript
'use client' // Mark as Client Component
import { useEffect } from 'react'
import SessionRecorder from '@multiplayer-app/debugger-browser'

export default function MySessionRecorder() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      SessionRecorder.init({
        version: '{YOUR_APPLICATION_VERSION}',
        application: '{YOUR_APPLICATION_NAME}',
        environment: '{YOUR_APPLICATION_ENVIRONMENT}',
        apiKey: '{YOUR_API_KEY}',
        recordCanvas: true, // Enable canvas recording
        masking: {
          maskAllInputs: true,
          maskInputOptions: {
            password: true,
            email: false,
            tel: false
          }
        }
      })

      SessionRecorder.setSessionAttributes({
        userId: '{userId}',
        userName: '{userName}'
      })
    }
  }, [])

  return null // No UI output needed
}
```

Replace the placeholders with the actual information.

Now, you can use the MySessionRecorder component in your application by adding it to your desired page or layout file:

```javascript
import MySessionRecorder from './MySessionRecorder' // Adjust the path as necessary

export default function MyApp() {
  return (
    <>
      <MySessionRecorder />
      {/* Other components */}
    </>
  )
}
```

## Note

If frontend domain doesn't match to backend one, set backend domain to `propagateTraceHeaderCorsUrls` parameter:

```javascript
import SessionRecorder from '@multiplayer-app/debugger-browser'

SessionRecorder.init({
  version: '{YOUR_APPLICATION_VERSION}',
  application: '{YOUR_APPLICATION_NAME}',
  environment: '{YOUR_APPLICATION_ENVIRONMENT}',
  apiKey: '{YOUR_API_KEY}',
  propagateTraceHeaderCorsUrls: new RegExp(`https://your.backend.api.domain`, 'i')
})
```

If frontend sends api requests to two or more different domains put them to `propagateTraceHeaderCorsUrls` as array:

```javascript
import SessionRecorder from '@multiplayer-app/debugger-browser'

SessionRecorder.init({
  version: '{YOUR_APPLICATION_VERSION}',
  application: '{YOUR_APPLICATION_NAME}',
  environment: '{YOUR_APPLICATION_ENVIRONMENT}',
  apiKey: '{YOUR_API_KEY}',
  propagateTraceHeaderCorsUrls: [
    new RegExp(`https://your.backend.api.domain`, 'i'),
    new RegExp(`https://another.backend.api.domain`, 'i')
  ]
})
```

## Documentation

For more details on how the Multiplayer Session Recorder integrates with your backend architecture and system auto-documentation, check out our [official documentation](https://www.multiplayer.app/docs/features/system-auto-documentation/).

## License

This library is distributed under the [MIT License](LICENSE).
