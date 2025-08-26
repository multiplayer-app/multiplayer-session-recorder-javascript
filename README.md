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

# Multiplayer Full Stack Session Recorder

The Multiplayer Full Stack Session Recorder is a powerful tool that offers deep session replays with insights spanning frontend screens, platform traces, metrics, and logs. It helps your team pinpoint and resolve bugs faster by providing a complete picture of your backend system architecture. No more wasted hours combing through APM data; the Multiplayer Full Stack Session Recorder does it all in one place.

## What you get

- Full stack replays: rrweb‑based browser recording correlated with OTLP traces
- One‑click shareable sessions: Engineers can share session links containing all relevant information, eliminating the need for long tickets or clarifying issues through back-and-forth communication.
- Privacy by default: input/text masking and trace payload/header masking
- Flexible: works with any web app; Node SDK for backend correlation
- Lightweight widget: start/pause/stop/save controls for your users or QA

## Monorepo structure

- [packages/session-recorder-browser](./packages/session-recorder-browser/): Browser SDK and in‑app widget
- [packages/session-recorder-node](./packages/session-recorder-node/): Node.js SDK for backend tracing/session control
- [packages/session-recorder-common](./packages/session-recorder-common/): Shared OpenTelemetry utilities and types

### Installation

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

## Set up web client:

### Quick start
```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

SessionRecorder.init({
  application: 'my-web-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: '<YOUR_FRONTEND_OTEL_TOKEN>',
  // Optional: propagate trace headers to non‑same‑origin backends
  // format: string|RegExp|Array
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

### Advanced config

```javascript
import SessionRecorder from '@multiplayer-app/debugger-browser'

SessionRecorder.init({
  version: '1.0.0',
  application: 'my-app',
  environment: 'production',
  apiKey: 'your-api-key',
  showWidget: true, // show in‑app recording widget (default: true)
  recordCanvas: true, // record canvas elements (default: false)
  ignoreUrls: [
    /https:\/\/domain\.to\.ignore\/.*/, // can be regex or string
    /https:\/\/another\.domain\.to\.ignore\/.*/
  ],
  // NOTE: if frontend domain doesn't match to backend one, set backend domain to `propagateTraceHeaderCorsUrls` parameter
  propagateTraceHeaderCorsUrls: [
    new RegExp('https://your.backend.api.domain', 'i'), // can be regex or string
    new RegExp('https://another.backend.api.domain', 'i')
  ],
  sampleTraceRatio: 0.15, // control sampling for documentation/debug spans (default ~0.15)
  maxCapturingHttpPayloadSize: 100000,
  usePostMessageFallback: false, // Enable post message fallback if needed
  apiBaseUrl: 'https://api.multiplayer.app', // override API base URL if needed
  exporterEndpoint: 'https://otlp.multiplayer.app', // override OTLP collector URL if needed
  captureBody: true, // Capture body in traces
  captureHeaders: true, // Capture headers in traces
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
    maskInput: (text, element) => {
      if (element.classList.contains('credit-card')) {
        return '****-****-****-' + text.slice(-4)
      }
      return '***MASKED***'
    },
    maskText: (text, element) => {
      if (element.dataset.type === 'email') {
        const [local, domain] = text.split('@')
        return local.charAt(0) + '***@' + domain
      }
      return '***MASKED***'
    },
    maskConsoleEvent: (payload) => {
      // Custom console event masking
      if (payload && payload.payload && payload.payload.args) {
        // Mask sensitive console arguments
        payload.payload.args = payload.payload.args.map((arg) =>
          typeof arg === 'string' && arg.includes('password') ? '***MASKED***' : arg
        )
      }
      return payload
    },
    isMaskingEnabled: true, // Enable masking for debug span payload in traces
    maskBody: (payload, span) => {
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
    },
    maskHeaders: (headers, span) => {
      // Custom headers masking
      if (headers && typeof headers === 'object') {
        const maskedHeaders = { ...headers }
        // Mask sensitive headers
        if (maskedHeaders.authorization) {
          maskedHeaders.authorization = '***MASKED***'
        }
        if (maskedHeaders.cookie) {
          maskedHeaders.cookie = '***MASKED***'
        }
        return maskedHeaders
      }
      return headers
    },
    // List of body fields to mask in traces
    maskBodyFieldsList: ['password', 'token', 'secret'],
    // List of headers to mask in traces
    maskHeadersList: ['authorization', 'cookie', 'x-api-key'],
    // List of headers to include in traces (if specified, only these headers will be captured)
    headersToInclude: ['content-type', 'user-agent'],
    // List of headers to exclude from traces
    headersToExclude: ['authorization', 'cookie']
  }
})

SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'John Doe'
})
```

## Setup backend

### Setup opentelemetry

Use officials opentelemetry guidence from [here](https://opentelemetry.io/docs/languages/js) or [zero-code](https://opentelemetry.io/docs/zero-code/js/) approach

### Send opentelemetry to Multiplayer

Opentelemetry data can be sent to Multiplayer's collector in few ways:

### Option 1 (Direct Exporter):

```javascript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const traceExporter = new OTLPTraceExporter({
  url: 'https://otlp.multiplayer.app/v1/traces',
  headers: {
    'Authorization': '<YOUR_BACKEND_OTEL_TOKEN>'
  }
})
```

or

```javascript
import { SessionRecorderHttpTraceExporter } from '@multiplayer-app/session-recorder-node'

const traceExporter = new SessionRecorderHttpTraceExporter({
  url: 'https://otlp.multiplayer.app/v1/traces', // optional
  apiKey: '<YOUR_BACKEND_OTEL_TOKEN>'
})
```

### Option 2 (Collector):

Another option - send otlp data to [opentelemetry collector](https://github.com/multiplayer-app/multiplayer-otlp-collector).

Use following examples to send data to collector

```javascript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const traceExporter = new OTLPTraceExporter({
  url: 'http://<OTLP_COLLECTOR_URL>/v1/traces',
  headers: {
    'Authorization': '<YOUR_BACKEND_OTEL_TOKEN>'
  }
})
```

or

```javascript
import { SessionRecorderHttpTraceExporter } from '@multiplayer-app/session-recorder-node'

const traceExporter = new SessionRecorderHttpTraceExporter({
  url: 'http://<OTLP_COLLECTOR_URL>/v1/traces',
  apiKey: '<YOUR_BACKEND_OTEL_TOKEN>'
})
```

### Add request/response payloads

There's few ways to capture request/response payloads:

### Option 1 (instrumentation hook):

SessionRecorder library provides request/response for capturing payload.

```javascript
import {
  SessionRecorderHttpInstrumentationHooksNode,
} from '@multiplayer-app/session-recorder-node'
import {
  getNodeAutoInstrumentations,
} from '@opentelemetry/auto-instrumentations-node'
import { type Instrumentation } from '@opentelemetry/instrumentation'

export const instrumentations: Instrumentation[] = getNodeAutoInstrumentations({
  '@opentelemetry/instrumentation-http': {
    enabled: true,
    responseHook: SessionRecorderHttpInstrumentationHooksNode.responseHook({
      maskHeadersList: ['set-cookie'],
      maxPayloadSizeBytes: 500000,
      isMaskBodyEnabled: false,
      isMaskHeadersEnabled: true,
    }),
    requestHook: SessionRecorderHttpInstrumentationHooksNode.requestHook({
      maskHeadersList: ['Authorization', 'cookie'],
      maxPayloadSizeBytes: 500000,
      isMaskBodyEnabled: false,
      isMaskHeadersEnabled: true,
    }),
  }
})
```

### Option 2 (Envoy proxy):

Deploy [Envoy Proxy](https://github.com/multiplayer-app/multiplayer-proxy) in front of your backend service.


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
