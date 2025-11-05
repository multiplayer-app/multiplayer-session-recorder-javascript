![Description](./docs/img/header-js.png)

<div align="center">
<a href="https://github.com/multiplayer-app/multiplayer-session-recorder-javascript">
  <img src="https://img.shields.io/github/stars/multiplayer-app/multiplayer-session-recorder-javascript?style=social&label=Star&maxAge=2592000" alt="GitHub stars">
</a>
  <a href="https://github.com/multiplayer-app/multiplayer-session-recorder-javascript/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/multiplayer-app/multiplayer-session-recorder-javascript" alt="License">
  </a>
  <a href="https://multiplayer.app">
    <img src="https://img.shields.io/badge/Visit-multiplayer.app-blue" alt="Visit Multiplayer">
  </a>

</div>
<div>
  <p align="center">
    <a href="https://x.com/trymultiplayer">
      <img src="https://img.shields.io/badge/Follow%20on%20X-000000?style=for-the-badge&logo=x&logoColor=white" alt="Follow on X" />
    </a>
    <a href="https://www.linkedin.com/company/multiplayer-app/">
      <img src="https://img.shields.io/badge/Follow%20on%20LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="Follow on LinkedIn" />
    </a>
    <a href="https://discord.com/invite/q9K3mDzfrx">
      <img src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join our Discord" />
    </a>
  </p>
</div>

# Multiplayer Session Recorder React

React bindings for the [Multiplayer Full Stack Session Recorder](../session-recorder-browser/README.md).

Use this wrapper to wire the browser SDK into your React or Next.js application with idiomatic hooks, context helpers, and navigation tracking.

## Installation

```bash
npm install @multiplayer-app/session-recorder-react @opentelemetry/api
# or
yarn add @multiplayer-app/session-recorder-react @opentelemetry/api
```

To get full‑stack session recording working, set up one of our backend SDKs/CLI apps:

- [Node.js](https://github.com/multiplayer-app/multiplayer-session-recorder-javascript/tree/main/packages/session-recorder-node)
- [Python](https://github.com/multiplayer-app/multiplayer-session-recorder-python?tab=readme-ov-file)
- [Java](https://github.com/multiplayer-app/multiplayer-session-recorder-java?tab=readme-ov-file)
- [.NET](https://github.com/multiplayer-app/multiplayer-session-recorder-dotnet?tab=readme-ov-file)
- [Go](https://github.com/multiplayer-app/multiplayer-session-recorder-go?tab=readme-ov-file)
- [Ruby](https://github.com/multiplayer-app/multiplayer-session-recorder-ruby?tab=readme-ov-file)

## Quick start

1. Wrap your application with the `SessionRecorderProvider`.
2. Pass the same configuration you would supply to the browser SDK.
3. Start or stop sessions using the widget or the provided hooks.

### Minimal setup with manual initialization

```tsx
// src/main.tsx or src/index.tsx app root
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SessionRecorderProvider } from '@multiplayer-app/session-recorder-react'

const sessionRecorderConfig = {
  version: '1.0.0',
  environment: 'production',
  application: 'my-react-app',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY',
  // IMPORTANT: in order to propagate OTLP headers to a backend
  // domain(s) with a different origin, add backend domain(s) below.
  // e.g. if you serve your website from www.example.com
  // and your backend domain is at api.example.com set value as shown below:
  // format: string|RegExp|Array
  propagateTraceHeaderCorsUrls: [new RegExp('https://api.example.com', 'i')]
}

// Initialize the session recorder manually
SessionRecorderProvider.init(sessionRecorderConfig)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SessionRecorderProvider>
    <App />
  </SessionRecorderProvider>
)
```

### Minimal setup with provider initialization

```tsx
// src/main.tsx or src/index.tsx app root
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SessionRecorderProvider } from '@multiplayer-app/session-recorder-react'

const sessionRecorderConfig = {
  version: '1.0.0',
  environment: 'production',
  application: 'my-react-app',
  apiKey: 'YOUR_MULTIPLAYER_API_KEY'
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SessionRecorderProvider options={sessionRecorderConfig}>
    <App />
  </SessionRecorderProvider>
)
```

Behind the scenes, the provider initializes the shared Browser SDK (if you pass the configuration as options to the provider) — or you can initialize it manually as shown in the example above. It then sets up listeners and exposes helper APIs through React context and selectors.

### Set session attributes to provide context for the session

Use session attributes to attach user context to recordings. The provided `userName` and `userId` will be visible in the Multiplayer sessions list and in the session details (shown as the reporter), making it easier to identify who reported or recorded the session.

```tsx
import { useEffect } from 'react'
import SessionRecorder from '@multiplayer-app/session-recorder-react'
//... your code

const MyComponent = () => {
  useEffect(() => {
    SessionRecorder.setSessionAttributes({
      userId: '12345', // replace with your user id
      userName: 'John Doe' // replace with your user name
    })
  }, [])

  //... your code
}

//... your code
```

### Using without the built‑in widget (imperative‑only)

If you prefer not to render our floating widget, disable it and rely purely on the imperative hooks. Use the context hook when you need imperative control (for example, to bind to buttons or QA tooling) as shown in the example below:

```tsx
// Provider configuration
<SessionRecorderProvider
  options={{
    application: 'my-react-app',
    version: '1.0.0',
    environment: 'production',
    apiKey: 'YOUR_MULTIPLAYER_API_KEY',
    showWidget: false // hide the built-in widget
  }}
>
  <App />
</SessionRecorderProvider>
```

#### Conditional controls with state (recommended UX)

Create your own UI and wire it to the hook methods. Render only the relevant actions based on the current session state (e.g., show Stop only when recording is started):

```tsx
import React from 'react'
import { useSessionRecorder, useSessionRecordingState, SessionState, SessionType } from '@multiplayer-app/session-recorder-react'

export function SmartSessionControls() {
  const { startSession, stopSession, pauseSession, resumeSession } = useSessionRecorder()
  const sessionState = useSessionRecordingState()

  const isStarted = sessionState === SessionState.started
  const isPaused = sessionState === SessionState.paused

  return (
    <div>
      {/* Idle state: allow starting */}
      {!isStarted && !isPaused && (
        <>
          <button onClick={() => startSession()}>Start</button>
          <button onClick={() => startSession(SessionType.CONTINUOUS)}>Start Continuous</button>
        </>
      )}

      {/* Started state: allow pause or stop */}
      {isStarted && (
        <>
          <button onClick={() => pauseSession()}>Pause</button>
          <button onClick={() => stopSession('Finished recording')}>Stop</button>
        </>
      )}

      {/* Paused state: allow resume or stop */}
      {isPaused && (
        <>
          <button onClick={() => resumeSession()}>Resume</button>
          <button onClick={() => stopSession('Finished recording')}>Stop</button>
        </>
      )}
    </div>
  )
}
```

## Reading recorder state with selectors

The package ships a lightweight observable store that mirrors the browser SDK. Use the selectors to drive UI state without forcing rerenders on unrelated updates.

```tsx
import React from 'react'
import {
  useSessionRecordingState,
  useSessionType,
  useIsInitialized,
  SessionState,
  SessionType
} from '@multiplayer-app/session-recorder-react'

export function RecorderStatusBanner() {
  const isReady = useIsInitialized()
  const sessionState = useSessionRecordingState()
  const sessionType = useSessionType()

  if (!isReady) {
    return <span>Session recorder initializing…</span>
  }

  return (
    <span>
      State: {sessionState ?? SessionState.stopped} | Mode: {sessionType ?? SessionType.MANUAL}
    </span>
  )
}
```

## Recording navigation in React apps

The Session Recorder React package includes a `useNavigationRecorder` hook that forwards router changes to the shared navigation recorder. Attach it inside your routing layer to correlate screen changes with traces and replays.

```tsx
// React Router v7/v6
import { useLocation, useNavigationType } from 'react-router-dom'
import { useNavigationRecorder } from '@multiplayer-app/session-recorder-react'

export function NavigationTracker() {
  const location = useLocation()
  const navigationType = useNavigationType()

  useNavigationRecorder(location.pathname, {
    navigationType,
    params: location.state as Record<string, unknown> | undefined
  })

  return null
}
```

```tsx
// React Router v5 (older)
import { useLocation, useHistory } from 'react-router-dom'
import { useNavigationRecorder } from '@multiplayer-app/session-recorder-react'

export function NavigationTrackerLegacy() {
  const location = useLocation()
  const history = useHistory()

  // PUSH | REPLACE | POP => push | replace | pop
  const navigationType = (history.action || 'PUSH').toLowerCase()

  useNavigationRecorder(location.pathname, {
    navigationType,
    params: location.state as Record<string, unknown> | undefined
  })

  return null
}
```

### Advanced navigation metadata

`useNavigationRecorder` accepts an options object allowing you to override the detected `path`, attach custom `routeName`, include query params, or disable document title capture. For full control you can call `SessionRecorder.navigation.record({ ... })` directly using the shared browser instance exported by this package.

## Configuration reference

The `options` prop passed to `SessionRecorderProvider` is forwarded to the underlying browser SDK. Refer to the [browser README](../session-recorder-browser/README.md#initialize) for the full option list, including:

- `application`, `version`, `environment`, `apiKey`
- `showWidget`, `showContinuousRecording`
- `recordNavigation`, `recordCanvas`, `recordGestures`
- `propagateTraceHeaderCorsUrls`, `ignoreUrls`
- `masking`, `captureBody`, `captureHeaders`
- `maxCapturingHttpPayloadSize` and other advanced HTTP controls

Any time `recordNavigation` is enabled, the browser SDK will emit OpenTelemetry navigation spans and keep an in-memory stack of visited routes. You can access the navigation helpers through `SessionRecorder.navigation` if you need to introspect from React components.

## Next.js integration tips

- Initialize the provider in a Client Component (for example `app/providers.tsx`) because the browser SDK requires `window`.
- In the App Router, render the `SessionRecorderProvider` at the top of `app/layout.tsx` and add the `NavigationTracker` component inside your root layout so every route change is captured.
- If your frontend calls APIs on different origins, set `propagateTraceHeaderCorsUrls` so backend traces correlate correctly.

### Next.js support (coming soon) and temporary solution

An official Next.js-specific wrapper is coming soon. Until then, you can use this package safely in Next.js by:

1. Initializing in a Client Component

```tsx
'use client'
import React from 'react'
import { SessionRecorderProvider } from '@multiplayer-app/session-recorder-react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionRecorderProvider
      options={{
        application: 'my-next-app',
        version: '1.0.0',
        environment: 'production',
        apiKey: 'YOUR_MULTIPLAYER_API_KEY',
        showWidget: true
      }}
    >
      {children}
    </SessionRecorderProvider>
  )
}
```

2. Tracking navigation (App Router)

```tsx
'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavigationRecorder } from '@multiplayer-app/session-recorder-react'

export function NavigationTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Convert search params to an object for richer metadata
  const params = Object.fromEntries(searchParams?.entries?.() ?? [])

  // Hook records whenever pathname changes (query changes included via params)
  useNavigationRecorder(pathname || '/', {
    params,
    framework: 'nextjs',
    source: 'next/navigation'
  })

  return null
}
```

3. Tracking navigation (Pages Router, older)

```tsx
'use client'
import { useRouter } from 'next/router'
import { useNavigationRecorder } from '@multiplayer-app/session-recorder-react'

export function NavigationTrackerLegacy() {
  const { asPath, query } = useRouter()
  const pathname = asPath.split('?')[0]

  useNavigationRecorder(pathname, {
    params: query,
    framework: 'nextjs',
    source: 'next/router'
  })

  return null
}
```

## TypeScript support

All hooks and helpers ship with TypeScript types. To extend the navigation metadata, annotate the `params` or `metadata` properties in your own app code. The package re-exports all relevant browser SDK types for convenience.

## Troubleshooting

- Ensure the provider wraps your entire component tree so context hooks resolve.
- Confirm `SessionRecorder.init` runs only once. The provider handles this automatically if you pass the configuration as options to the provider; do not call it manually elsewhere.
- Ensure the session recorder required options are passed and the API key is valid.
- For SSR environments, guard any direct `document` or `window` usage behind `typeof window !== 'undefined'` checks (the helper hooks already do this).

## License

Distributed under the [MIT License](../session-recorder-browser/LICENSE).
