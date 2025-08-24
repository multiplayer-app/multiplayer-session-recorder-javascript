![Description](.github/header-js.png)

<div align="center">
<a href="https://github.com/multiplayer-app/multiplayer-session-recorder-javascript">
  <img src="https://img.shields.io/github/stars/multiplayer-app/multiplayer-session-recorder-javascript.svg?style=social&label=Star&maxAge=2592000" alt="GitHub stars">
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

# Multiplayer Full Stack Session Recorder

The Multiplayer Full Stack Session Recorder is a powerful tool that offers deep session replays with insights spanning frontend screens, platform traces, metrics, and logs. It helps your team pinpoint and resolve bugs faster by providing a complete picture of your backend system architecture. No more wasted hours combing through APM data; the Multiplayer Full Stack Session Recorder does it all in one place.

## What you get

- Full stack replays: rrweb‑based browser recording correlated with OTLP traces
- One‑click shareable sessions: Engineers can share session links containing all relevant information, eliminating the need for long tickets or clarifying issues through back-and-forth communication.
- Privacy by default: input/text masking and trace payload/header masking
- Flexible: works with any web app; Node SDK for backend correlation
- Lightweight widget: start/pause/stop/save controls for your users or QA

## Monorepo structure

- `packages/session-recorder-browser`: Browser SDK and in‑app widget
- `packages/session-recorder-node`: Node.js SDK for backend tracing/session control
- `packages/session-recorder-common`: Shared OpenTelemetry utilities and types

## Installation

Browser (includes a peer dependency on `@opentelemetry/api`):

```bash
npm i @multiplayer-app/session-recorder-browser @opentelemetry/api
# or
yarn add @multiplayer-app/session-recorder-browser @opentelemetry/api
```

Node:

```bash
npm i @multiplayer-app/session-recorder-node
# or
yarn add @multiplayer-app/session-recorder-node
```

Node.js >= 18 is required.

## Quick start

### Browser

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

SessionRecorder.init({
  application: 'my-web-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: '<YOUR_FRONTEND_OTEL_TOKEN>',
  // Optional: propagate trace headers to non‑same‑origin backends
  // propagateTraceHeaderCorsUrls: [new RegExp('https://api.example.com', 'i')],
})

SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'Jane Doe',
})

// Optionally control via API (widget is enabled by default)
// SessionRecorder.start()
// SessionRecorder.pause()
// SessionRecorder.resume()
// SessionRecorder.stop('Finished purchase flow')
```

### Node

```javascript
import { sessionRecorder, SessionType } from '@multiplayer-app/session-recorder-node'

await sessionRecorder.init({
  apiKey: '<YOUR_BACKEND_OTEL_TOKEN>',
  resourceAttributes: {
    serviceName: 'orders-service',
    version: '1.0.0',
    environment: 'production',
  },
  // Optionally provide a custom traceIdGenerator compatible with your OTel setup
  // traceIdGenerator,
})

await sessionRecorder.start(SessionType.PLAIN, {
  name: 'Checkout flow',
  sessionAttributes: { accountId: 'acc_123', accountName: 'Acme' },
})

// ... your application logic

await sessionRecorder.stop()
```

## Configuration highlights

- `showWidget` (browser): show in‑app recording widget (default: true)
- `recordCanvas` (browser): record canvas elements (default: false)
- `propagateTraceHeaderCorsUrls` (browser): string|RegExp|Array to forward trace headers to cross‑origin APIs
- `docTraceRatio` / `sampleTraceRatio`: control sampling for documentation/debug spans (default ~0.15)
- `exporterApiBaseUrl`: override API base URL if needed
- `masking` (browser): privacy configuration
    - `maskAllInputs` (default: true)
    - `maskTextClass` / `maskTextSelector`
    - `maskInput`, `maskText`, `maskConsoleEvent` (custom functions)
    - Trace payload/header controls: `isMaskingEnabled`, `maskBody`, `maskHeaders`, `maskBodyFieldsList`, `maskHeadersList`, `headersToInclude`, `headersToExclude`

See package docs for full option lists and defaults.

## Framework notes

- Next.js: initialize the browser SDK in a Client Component (see example in the browser README). Ensure it runs only in the browser.
- CORS: when your frontend calls multiple API domains, set `propagateTraceHeaderCorsUrls` to match them so parent/child spans correlate across services.

## Documentation

- Browser SDK: `packages/session-recorder-browser/README.md`
- Node SDK: `packages/session-recorder-node/README.md`
- Official product docs: [System Auto‑Documentation](https://www.multiplayer.app/docs/features/system-auto-documentation/)

## Security and privacy

Masking is enabled by default. Review and adjust masking rules to avoid capturing sensitive PII in recordings or traces. Consider adding explicit allow/deny lists for headers and payload fields.

## License

MIT — see [LICENSE](https://github.com/multiplayer-app/multiplayer-session-recorder-javascript/blob/main/LICENSE).
