# Multiplayer Session Debugger

The Multiplayer **Session Debugger** is a powerful tool that offers deep session replays with insights spanning frontend screens, platform traces, metrics, and logs. It helps your team pinpoint and resolve bugs faster by providing a complete picture of your backend system architecture. No more wasted hours combing through APM data; the Multiplayer Session Debugger does it all in one place.

## Key Features

- **Reduced Inefficiencies**: Effortlessly capture the exact steps to reproduce an issue along with backend data in one click. No more hunting through scattered documentation, APM data, logs, or traces.
- **Faster Cross-Team Alignment**: Engineers can share session links containing all relevant information, eliminating the need for long tickets or clarifying issues through back-and-forth communication.
- **Uninterrupted Deep Work**: All system information—from architecture diagrams to API designs—is consolidated in one place. Minimize context switching and stay focused on what matters.

## Getting Started

### Installation

You can install the Multiplayer Session Debugger using npm or yarn:

```bash
npm install @multiplayer-app/session-debugger
# or
yarn add @multiplayer-app/session-debugger
```

### Basic Setup

To initialize the Multiplayer Session Debugger in your application, follow the steps below.

#### Import the Debugger

```javascript
import debuggerInstance from '@multiplayer-app/session-debugger'
```

#### Initialization

Use the following code to initialize the debugger with your application details:

```javascript
debuggerInstance.init({
  version: '{YOUR_APPLICATION_VERSION}',
  application: '{YOUR_APPLICATION_NAME}',
  environment: '{YOUR_APPLICATION_ENVIRONMENT}',
  apiKey: '{YOUR_API_KEY}'
})
```

Replace the placeholders with your application’s version, name, environment, and API key (OpenTelemetry Frontend Token).

#### Add User Metadata

To track user-specific metadata in session replays, add the following:

```javascript
window['mpSessionDebuggerMetadata'] = {
  userId: '{userId}',
  userName: '{userName}'
}
```

Replace the placeholders with the actual user information (e.g., user ID and username).

## Dependencies

This library relies on the following packages:

- **[rrweb](https://github.com/rrweb-io/rrweb)**: Provides the frontend session replay functionality, recording the user’s interactions with the app.
- **[OpenTelemetry](https://opentelemetry.io/)**: Used to capture backend traces, metrics, and logs that integrate seamlessly with the session replays for comprehensive debugging.

## Example Usage

```javascript
import debuggerInstance from "@multiplayer-app/session-debugger";

debuggerInstance.init({
  version: "1.0.0",
  application: "MyApp",
  environment: "production",
  apiKey: "your-api-key",
  canvasEnabled: true,
  showWidget: true,
  ignoreUrls: [
    /https:\/\/domain\.to\.ignore\/.*/, // can be regex or string
    /https:\/\/another\.domain\.to\.ignore\/.*/,
  ],
  // NOTE: if frontend domain doesn't match to backend one, set backend domain to `propagateTraceHeaderCorsUrls` parameter
  propagateTraceHeaderCorsUrls: [
    new RegExp("https://your.backend.api.domain", "i"), // can be regex or string
    new RegExp("https://another.backend.api.domain", "i")
  ],
  schemifyDocSpanPayload: true,
  maskDebugSpanPayload: true,
  docTraceRatio: 0.15 // 15% of traces will be sent for auto-documentation
  maxCapturingHttpPayloadSize: 100000,
  disableCapturingHttpPayload: false
});

window["mpSessionDebuggerMetadata"] = {
  userId: "12345",
  userName: "John Doe",
};
```

## Session Debugger for Next.js

To integrate the SessionDebugger component into your Next.js application, follow these steps:

- Create a new file (e.g., SessionDebugger.js or SessionDebugger.tsx) in your root directory or a components directory.

- Import the component

In the newly created file, add the following code:

```javascript
'use client' // Mark as Client Component
import { useEffect } from 'react'
import debuggerInstance from '@multiplayer-app/session-debugger'

export default function SessionDebugger() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      debuggerInstance.init({
        version: '{YOUR_APPLICATION_VERSION}',
        application: '{YOUR_APPLICATION_NAME}',
        environment: '{YOUR_APPLICATION_ENVIRONMENT}',
        apiKey: '{YOUR_API_KEY}'
      })

      window['mpSessionDebuggerMetadata'] = {
        userId: '{userId}',
        userName: '{userName}'
      }
    }
  }, [])

  return null // No UI output needed
}
```

Replace the placeholders with the actual information.

Now, you can use the SessionDebugger component in your application by adding it to your desired page or layout file:

```javascript
import SessionDebugger from './SessionDebugger' // Adjust the path as necessary

export default function MyApp() {
  return (
    <>
      <SessionDebugger />
      {/* Other components */}
    </>
  )
}
```

## Note

If frontend domain doesn't match to backend one, set backend domain to `propagateTraceHeaderCorsUrls` parameter:

```javascript
import debuggerInstance from '@multiplayer-app/session-debugger'

debuggerInstance.init({
  version: '{YOUR_APPLICATION_VERSION}',
  application: '{YOUR_APPLICATION_NAME}',
  environment: '{YOUR_APPLICATION_ENVIRONMENT}',
  apiKey: '{YOUR_API_KEY}',
  propagateTraceHeaderCorsUrls: new RegExp(`https://your.backend.api.domain`, 'i')
})
```

If frontend sends api requests to two or more different domains put them to `propagateTraceHeaderCorsUrls` as array:

```javascript
import debuggerInstance from '@multiplayer-app/session-debugger'

debuggerInstance.init({
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

For more details on how the Multiplayer Session Debugger integrates with your backend architecture and system auto-documentation, check out our [official documentation](https://www.multiplayer.app/docs/features/system-auto-documentation/).

## License

This library is distributed under the [MIT License](LICENSE).
