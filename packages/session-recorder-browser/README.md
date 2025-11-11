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

- Full stack replays: browser screen recording correlated with OTLP traces and logs
- One‑click shareable sessions: Engineers can share session links containing all relevant information, eliminating the need for long tickets or clarifying issues through back-and-forth communication.
- Privacy by default: input/text masking and trace payload/header masking
- Flexible: works with any web app; Node SDK for backend correlation
- Lightweight widget: start/pause/stop/save controls for your users or QA

### Installation

```bash
npm i @multiplayer-app/session-recorder-browser
# or
yarn add @multiplayer-app/session-recorder-browser
```

## Set up web client:

### Quick start

Use the following code below to initialize and run the session recorder.

### Initialize

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

SessionRecorder.init({
  application: 'my-web-app',
  version: '1.0.0',
  environment: 'production',
  apiKey: 'MULTIPLAYER_API_KEY' // note: replace with your Multiplayer API key
  // IMPORTANT: in order to propagate OTLP headers to a backend
  // domain(s) with a different origin, add backend domain(s) below.
  // e.g. if you serve your website from www.example.com
  // and your backend domain is at api.example.com set value as shown below:
  // format: string|RegExp|Array
  propagateTraceHeaderCorsUrls: [new RegExp('https://api.example.com', 'i')],
})


// Use session attributes to attach user context to recordings.
// The provided `userName` and `userId` will be visible in the Multiplayer
// sessions list and in the session details (shown as the reporter),
// making it easier to identify who reported or recorded the session.

SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'John Doe'
})
```

### Advanced config

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

SessionRecorder.init({
  version: '1.0.0', // optional: version of your application
  application: 'my-app', // name of your application
  environment: 'production',
  apiKey: 'MULTIPLAYER_API_KEY', // note: replace with your Multiplayer API key

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
  }
})
```

### Manual session recording

Below is an example showing how to create a session recording in `MANUAL` mode. Manual session recordings stream and save all the data between calling `start` and `stop`.

```javascript
// add any key value pairs which should be associated with a session
SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'John Doe'
})
// optionally control via API (widget is enabled by default)
// if you're not using widget (see: `showWidget: true/false`)
// then you can programatically control the session recorder
// by using the methods below

// Option A: fire-and-forget (simple)
// SessionRecorder.start()
// ... later ...
// SessionRecorder.stop('Finished session')

// Option B: wire up your own UI controls
const startButton = document.getElementById('start')
const pauseButton = document.getElementById('pause')
const resumeButton = document.getElementById('resume')
const stopButton = document.getElementById('stop')

startButton?.addEventListener('click', () => {
  SessionRecorder.start()
})

startContinuousButton?.addEventListener('click', () => {
  SessionRecorder.start(SessionType.CONTINUOUS)
})

pauseButton?.addEventListener('click', () => {
  SessionRecorder.pause()
})

resumeButton?.addEventListener('click', () => {
  SessionRecorder.resume()
})

stopButton?.addEventListener('click', () => {
  SessionRecorder.stop('Finished session') // optional reason
})
```

### Continuous session recording

Below is an example showing how to create a session in `CONTINUOUS` mode. Continuous session recordings **stream** all the data received between calling `start` and `stop` -
but only **save** a rolling window data (90 seconds by default) when:

- an exception or error occurs;
- when `save` is called; or
- programmatically, when the auto-save attribute is attached to a span.

```javascript
// add any key value pairs which should be associated with a session
SessionRecorder.setSessionAttributes({
  userId: '12345',
  userName: 'John Doe'
})
// optionally control via API (widget is enabled by default)
// if you're not using widget (see: `showWidget: true/false`)
// then you can programatically control the session recorder
// by using the methods below
// Option A: fire-and-forget (simple)
// SessionRecorder.start(SessionType.CONTINUOUS)
// ... later ...
// SessionRecorder.save()
// ... later ...
// SessionRecorder.stop('Finished session')
// Option B: wire up your own UI controls
const startContinuousButton = document.getElementById('start-continuous')
const saveButton = document.getElementById('save')
const stopButton = document.getElementById('stop')

startContinuousButton?.addEventListener('click', () => {
  SessionRecorder.start(SessionType.CONTINUOUS)
})

saveButton?.addEventListener('click', () => {
  SessionRecorder.save()
})

stopButton?.addEventListener('click', () => {
  SessionRecorder.stop('Finished session') // optional reason
})
```

### Capture exceptions

The browser SDK captures uncaught errors and unhandled promise rejections automatically and turns them into error traces that are linked to your session.

For each error span we record:

- status set to `ERROR`
- standard exception attributes: `exception.type`, `exception.message`, `exception.stacktrace`

Manual reporting (e.g. inside try/catch or library boundaries):

```javascript
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

try {
  // code that may throw
} catch (err) {
  SessionRecorder.captureException(err) // Error | unknown | string
}

// You can also send arbitrary reasons
SessionRecorder.captureException('Payment form validation failed')
```

When running in `CONTINUOUS` mode, any captured exception automatically marks the current trace as an error and auto‑saves the rolling window so you can replay the seconds leading up to the failure.

Continuous session recordings may also be saved from within any service or component involved in a trace by adding the attributes below to a span:

```javascript
import { trace, context } from '@opentelemetry/api'
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

const activeContext = context.active()

const activeSpan = trace.getSpan(activeContext)

activeSpan.setAttribute(SessionRecorder.ATTR_MULTIPLAYER_CONTINUOUS_SESSION_AUTO_SAVE, true)
activeSpan.setAttribute(SessionRecorder.ATTR_MULTIPLAYER_CONTINUOUS_SESSION_AUTO_SAVE_REASON, 'Some reason')
```

## Framework-Specific Integrations

The Multiplayer Session Recorder works with any web framework, but we provide specialized packages and examples for popular frameworks to make integration easier.

### React & Next.js

For React and Next.js applications, use the dedicated React package which includes idiomatic hooks, context helpers, and navigation tracking:

- **Package**: [@multiplayer-app/session-recorder-react](../session-recorder-react/README.md)
- **Features**: React hooks, context providers, error boundaries, and Next.js integration tips
- **Documentation**: [React/Next.js Integration Guide](../session-recorder-react/README.md)

### Vue.js

For Vue.js applications, use the browser package directly. We provide comprehensive examples and integration guides:

- **Package**: `@multiplayer-app/session-recorder-browser` (this package)
- **Examples**: [Vue.js Example Application](./examples/vue/README.md)
- **Features**: Plugin-based integration, composables, Vue Router integration, and HTTP client support

### Angular

For Angular applications, use the browser package with Angular-specific setup. We provide detailed examples and integration guides:

- **Package**: `@multiplayer-app/session-recorder-browser` (this package)
- **Examples**: [Angular Example Application](./examples/angular/README.md)
- **Features**: Service-based integration, app initializer setup, Angular HttpClient integration, and router support

### React Native

For React Native applications (iOS and Android), use the dedicated React Native package:

- **Package**: [@multiplayer-app/session-recorder-react-native](../session-recorder-react-native/README.md)
- **Features**: Native screen recording, gesture tracking, navigation monitoring, and full-stack debugging
- **Documentation**: [React Native Integration Guide](../session-recorder-react-native/README.md)
- **Note**: Does not support React Native Web - use the browser package for web platforms

## Documentation

For more details on how the Multiplayer Session Recorder integrates with your backend architecture and system auto-documentation, check out our [official documentation](https://www.multiplayer.app/docs/features/system-auto-documentation/).

## License

This library is distributed under the [MIT License](./LICENSE).
