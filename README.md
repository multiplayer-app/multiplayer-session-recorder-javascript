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
  // IMPORTANT: in order to propagate OTLP headers to a backend
  // domain(s) with a different origin, add backend domain(s) below.
  // e.g. if you serve your website from www.example.com
  // and your backend domain is at api.example.com set value as shown below:
  // format: string|RegExp|Array
  // propagateTraceHeaderCorsUrls: [new RegExp('https://api.example.com', 'i')],
})


// add any key value pairs which should be associated with a session
SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'Jane Doe',
})

// optionally control via API (widget is enabled by default)
// if you're not using widget (see: `showWidget: true/false`)
// then you can programatically control the session recorder
// by using the methods below
SessionRecorder.start()
SessionRecorder.pause()
SessionRecorder.resume()
SessionRecorder.stop('Finished session') // optional: pass reason for stopping the session
```

### Advanced config

```javascript
import SessionRecorder from '@multiplayer-app/debugger-browser'

SessionRecorder.init({
  version: '1.0.0', // optional: version of your application
  application: 'my-app', // name of your application
  environment: 'production',
  apiKey: 'your-api-key', // replace with your Multiplayer OTLP key
  
  apiBaseUrl: 'https://api.multiplayer.app', // override API base URL if needed
  exporterEndpoint: 'https://otlp.multiplayer.app', // override OTLP collector URL if needed

  showWidget: true, // show in‑app recording widget (default: true)
  recordCanvas: true, // record canvas elements (default: false)
  // Add domains to not capture OTLP data in the session recording
  ignoreUrls: [
    /https:\/\/domain\.to\.ignore\/.*/, // can be regex or string
    /https:\/\/another\.domain\.to\.ignore\/.*/
  ],
  // NOTE: if frontend domain doesn't match to backend one, set backend domain to `propagateTraceHeaderCorsUrls` parameter
  propagateTraceHeaderCorsUrls: [
    new RegExp('https://your.backend.api.domain', 'i'), // can be regex or string
    new RegExp('https://another.backend.api.domain', 'i')
  ],

  // sample trace ratio used when session recording is not active.
  // configures what percentage (0.00-1.00) of OTLP data
  // should be sent through `exporters`
  sampleTraceRatio: 0,
  
  // optional: exporters allow you to send
  // OTLP data to observability platforms
  exporters: [
    // example:
    // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
    // new OTLPTraceExporter({
    //   url: '<opentelemetry-collector-url>', 
    // })
  ],

  captureBody: true, // capture request/response content
  captureHeaders: true, // capture request/response header content

  // set the maximum request/response content size (in bytes) that will be captured
  // any request/response content greater than size will be not included in session recordings
  maxCapturingHttpPayloadSize: 100000,

  // configure masking for sensitive data in session recordings
  masking: {
    maskAllInputs: false, // masks all input fields
    maskInputOptions: {
      password: true, // mask password fields
      email: false, // mask email fields
      tel: false, // mask telephone fields
      number: false, // mask number fields
      url: false, // mask URL fields
      search: false, // mask search fields
      textarea: false // mask textarea elements
    },

    // class-based masking
    maskTextClass: /sensitive|private/, // mask text in elements with these classes
    // CSS selector for text masking
    maskTextSelector: '.sensitive-data', // mask text in elements matching this selector
    
    // custom masking functions
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
      if (payload && payload.payload && payload.payload.args) {
        // mask sensitive console arguments
        payload.payload.args = payload.payload.args.map((arg) =>
          typeof arg === 'string' && arg.includes('password') ? '***MASKED***' : arg
        )
      }
      return payload
    },
    
    isContentMaskingEnabled: true, // enable content masking in session recordings
    maskBody: (payload, span) => {
      // note: `payload` is already a copy of the original request/response content
      if (payload && typeof payload === 'object') {
        // mask sensitive data
        if (payload.requestHeaders) {
          payload.requestHeaders = '***MASKED***'
        }
        if (payload.responseBody) {
          payload.responseBody = '***MASKED***'
        }
      }
      return payload
    },
    maskHeaders: (headers, span) => {
      // note: `headers` is already a copy of the original request/response content
      if (headers && typeof headers === 'object') {
        // mask sensitive headers
        if (headers.authorization) {
          headers.authorization = '***MASKED***'
        }
        if (headers.cookie) {
          headers.cookie = '***MASKED***'
        }
      }
      return headers
    },
    // list of field names to mask in request/response content
    maskBodyFieldsList: ['password', 'token', 'secret'],
    // list of headers to mask in request/response headers
    maskHeadersList: ['authorization', 'cookie', 'x-api-key'],
    // list of headers to capture. An empty array will capture all headers
    headersToInclude: ['content-type', 'user-agent'],
    // list of headers to exclude from capturing
    headersToExclude: ['authorization', 'cookie']
  },

  // advanced options

  // allow Multiplayer Chrome to use post messages through the library
  usePostMessageFallback: false
})

// add any key value pairs which should be associated with a session
SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'John Doe'
})
```

### Framework notes

- Next.js: initialize the browser SDK in a Client Component (see example in the browser README). Ensure it runs only in the browser.
- CORS: when your frontend calls multiple API domains, set `propagateTraceHeaderCorsUrls` to match them so parent/child spans correlate across services.

## Set up backend

### Set up OpenTelemetry data

To set up OpenTelemetry in your backend services see the [OpenTelemetry documentation](https://opentelemetry.io/docs/languages/js). Note: JavaScript supports a [zero-code instrumentation approach](https://opentelemetry.io/docs/zero-code/js)

### Send OpenTelemetry data to Multiplayer

OpenTelemetry data can be sent to Multiplayer's collector in few ways:

### Option 1: Direct Exporter

Send OpenTelemetry data from your services to Multiplayer and optionally other destinations (e.g., OpenTelemetry Collectors, observability platforms, etc.).

This is the quickest way to get started, but consider using an OpenTelemetry Collector (see [Option 2](#option-2-opentelemetry-collector) below) if you're scalling or a have a large platform.

```javascript
import {
  SessionRecorderHttpTraceExporter,
  SessionRecorderHttpLogsExporter,
  SessionRecorderTraceExporterWrapper
  SessionRecorderLogsExporterWrapper,
} from "@multiplayer-app/session-recorder-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"

// set up Multiplayer exporters. Note: GRPC exporters are also available.
// see: `SessionRecorderGrpcTraceExporter` and `SessionRecorderGrpcLogsExporter`
const multiplayerTraceExporter = new SessionRecorderHttpTraceExporter({
  apiKey: "MULTIPLAYER_OTLP_KEY", // note: replace with your Multiplayer OTLP key
})
const multiplayerLogExporter = new SessionRecorderHttpLogsExporter({
  apiKey: "MULTIPLAYER_OTLP_KEY", // note: replace with your Multiplayer OTLP key
})

// Multiplayer exporter wrappers filter out session recording atrtributes before passing to provided exporter
const traceExporter = new SessionRecorderTraceExporterWrapper(
  // add any OTLP trace exporter
  new OTLPTraceExporter({
    // ...
  })
)
const logExporter = new SessionRecorderLogsExporterWrapper(
  // add any OTLP log exporter
  new OTLPLogExporter({
    // ...
  })
)
```

### Option 2: OpenTelemetry Collector

If you're scalling or a have a large platform, consider running a dedicated collector. See the Multiplayer OpenTelemetry collector [repository](https://github.com/multiplayer-app/multiplayer-otlp-collector) which shows how to configure the standard OpenTelemetry Collector to send data to Multiplayer and optional other destinations.

Add standard [OpenTelemetry code](https://opentelemetry.io/docs/languages/js/exporters/) to export OTLP data to your collector.

See a basic example below:

```javascript
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"

const traceExporter = new OTLPTraceExporter({
  url: 'http://<OTLP_COLLECTOR_URL>/v1/traces',
  headers: {
    // ...
  }
})

const logExporter = new OTLPLogExporter({
  url: 'http://<OTLP_COLLECTOR_URL>/v1/logs',
  headers: {
    // ...
  }
})
```

### Capturing request and response content

There's few options to capture request/response content.

### Option 1: Instrumentation hook

Session Recorder library provides request/response for capturing payload.

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

### Option 2 (Envoy proxy)

Deploy [Envoy Proxy](https://github.com/multiplayer-app/multiplayer-proxy) in front of your backend service.

## Documentation

- Browser SDK: `packages/session-recorder-browser/README.md`
- Node SDK: `packages/session-recorder-node/README.md`
- [System Auto‑Documentation](https://www.multiplayer.app/docs/features/system-auto-documentation/)

## Security and privacy

Masking is enabled by default. Review and adjust masking rules to avoid capturing sensitive PII in recordings or traces. Consider adding explicit allow/deny lists for headers and payload fields.

## License

MIT — see [LICENSE](./LICENSE).
