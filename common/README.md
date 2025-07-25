# Session Recorder OpenTelemetry Core

This package provides implementations of the OpenTelemetry API for trace and metrics. It's intended for use both on the server and in the browser.

## Built-in Implementations

- [Session Recorder OpenTelemetry Core](#session-recorder-opentelemetry-core)
  - [Built-in Implementations](#built-in-implementations)
    - [Constants](#constants)
    - [Setup opentelemetry for capturing http request/response body](#session-recorder-http-instrumentation-hooks-node)
    - [Session Recorder Http Trace exporter web](#session-recorder-http-trace-exporter-web)
    - [Session Recorder id generator](#session-recorder-id-generator)
    - [Trace id ratio based sampler](#trace-id-ratio-based-sampler)
    - [Helper for capturing exception in session recording](#helper-for-capturing-exceptions)
    - [Helpers for adding content to session recording](#helper-for-setting-attributes-to-span)
  - [License](#license)

### Constants

```javascript
import {
  MULTIPLAYER_TRACE_DOC_PREFIX,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_URL,
  MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_URL,
  MULTIPLAYER_ATTRIBUTE_PREFIX,
  MULTIPLAYER_MAX_HTTP_REQUEST_RESPONSE_SIZE,
  ATTR_MULTIPLAYER_DEBUG_SESSION,
  ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
  ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY_ENCODING,
  ATTR_MULTIPLAYER_RPC_REQUEST_MESSAGE,
  ATTR_MULTIPLAYER_RPC_RESPONSE_MESSAGE,
  ATTR_MULTIPLAYER_GRPC_REQUEST_MESSAGE,
  ATTR_MULTIPLAYER_GRPC_RESPONSE_MESSAGE,
  ATTR_MULTIPLAYER_MESSAGING_MESSAGE_BODY,
} from '@multiplayer-app/session-recorder-opentelemetry'
```

### Setup opentelemetry for capturing http request/response body

Session Recorder hooks for nodejs http instrumentation for injecting http request/response headers and payload to span.

```javascript
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { type Instrumentation } from '@opentelemetry/instrumentation'
import { SessionRecorderHttpInstrumentationHooks } from '@multiplayer-app/session-recorder-opentelemetry'

export const instrumentations: Instrumentation[] = getNodeAutoInstrumentations({
  '@opentelemetry/instrumentation-http': {
    enabled: true,
    responseHook: SessionRecorderHttpInstrumentationHooks.responseHook({
      maxPayloadSizeBytes: 1000,
      uncompressPayload: true,
      captureHeaders: true,
      captureBody: true,
      isMaskingEnabled: true,
      maskBody: (data, span) => {
        // mask logic here
        return data
      },
      maskHeaders: (data, span) => {
        // mask logic here
        return data
      },
      maskBodyFieldsList: ['password', 'card'],
      maskHeadersList: ['x-trace-id'],
      headersToInclude: ['Set-Cookie', 'Authorization'],
      headersToExclude: ['Cookie'],
    }),
    requestHook: SessionRecorderHttpInstrumentationHooks.requestHook({
      maxPayloadSizeBytes: 1000,
      captureHeaders: true,
      captureBody: true,
      isMaskingEnabled: true,
      maskBody: (data, span) => {
        // mask logic here
        return data
      },
      maskHeaders: (data, span) => {
        // mask logic here
        return data
      },
      maskBodyFieldsList: ['password', 'card'],
      maskHeadersList: ['x-trace-id'],
      headersToInclude: ['Set-Cookie', 'Authorization'],
      headersToExclude: ['Cookie'],
    }),
  },
)
```

### Session Recorder Http Trace exporter web

```javascript
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { SessionRecorderHttpTraceExporterBrowser } from '@multiplayer-app/session-recorder-opentelemetry'

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>' // api key from multiplayer integration
}

const exporter = new SessionRecorderHttpTraceExporterBrowser(collectorOptions)
const provider = new WebTracerProvider({
  spanProcessors: [
    new BatchSpanProcessor(exporter, {
      // The maximum queue size. After the size is reached spans are dropped.
      maxQueueSize: 100,
      // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
      maxExportBatchSize: 10,
      // The interval between two consecutive exports
      scheduledDelayMillis: 500,
      // How long the export can run before it is cancelled
      exportTimeoutMillis: 30000
    })
  ]
})

provider.register()
```

### Session Recorder id generator


```javascript
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { SessionRecorderIdGenerator, SessionRecorderHttpTraceExporterBrowser } from '@multiplayer-app/session-recorder-opentelemetry'

const idGenerator = new SessionRecorderIdGenerator({ autoDocTracesRatio: 0.05 })

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>' // api key from multiplayer integration
}

const exporter = new SessionRecorderHttpTraceExporterBrowser(collectorOptions)
const provider = new WebTracerProvider({
  spanProcessors: [
    new BatchSpanProcessor(exporter, {
      // The maximum queue size. After the size is reached spans are dropped.
      maxQueueSize: 100,
      // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
      maxExportBatchSize: 10,
      // The interval between two consecutive exports
      scheduledDelayMillis: 500,
      // How long the export can run before it is cancelled
      exportTimeoutMillis: 30000
    })
  ],
  idGenerator
})

idGenerator.setSessionId('<multiplayer-debug-session-short-id>')
```

### Trace id ratio based sampler

Session Recorder sampler will always sample traces with appropriate prefixes, other traces will be sampled using ration provided to constructor.

```javascript
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { SessionRecorderTraceIdRatioBasedSampler, SessionRecorderHttpTraceExporterBrowser } from '@multiplayer-app/session-recorder-opentelemetry'

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>' // api key from multiplayer integration
}

const exporter = new SessionRecorderHttpTraceExporterBrowser(collectorOptions)
const provider = new WebTracerProvider({
  spanProcessors: [
    new BatchSpanProcessor(exporter, {
      // The maximum queue size. After the size is reached spans are dropped.
      maxQueueSize: 100,
      // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
      maxExportBatchSize: 10,
      // The interval between two consecutive exports
      scheduledDelayMillis: 500,
      // How long the export can run before it is cancelled
      exportTimeoutMillis: 30000
    })
  ],
  sampler: new SessionRecorderTraceIdRatioBasedSampler(0.05)
})
```

### Helper for capturing exception in session recording

```javascript
import { SessionRecorderSdk } from '@multiplayer-app/session-recorder-opentelemetry'

const error = new Error('Some text here')

SessionRecorderSdk.captureException(error)
```

### Helpers for adding content to session recording

```javascript
import { SessionRecorderSdk } from '@multiplayer-app/session-recorder-opentelemetry'

SessionRecorderSdk.setAttribute('{{SOME_KEY}}', '{{SOME_VALUE}}')

// following helpers do masking of sensitive fields
SessionRecorderSdk.setHttpRequestBody('{{ANY_REQUEST_PAYLOAD_HERE}}')

SessionRecorderSdk.setHttpRequestHeaders({ Cookie: '...', Authorization: '...'})

SessionRecorderSdk.setHttpResponseBody({some_payload: '{{ANY_REQUEST_PAYLOAD_HERE}}'})

SessionRecorderSdk.setHttpResponseHeaders({ 'Set-Cookie': '...' })

SessionRecorderSdk.setMessageBody({some_payload: '{{ANY_REQUEST_PAYLOAD_HERE}}'})

SessionRecorderSdk.setRpcRequestMessage({some_payload: '{{ANY_REQUEST_PAYLOAD_HERE}}'})

SessionRecorderSdk.setRpcResponseMessage({some_payload: '{{ANY_REQUEST_PAYLOAD_HERE}}'})

SessionRecorderSdk.setGrpcRequestMessage({some_payload: '{{ANY_REQUEST_PAYLOAD_HERE}}'})

SessionRecorderSdk.setGrpcResponseMessage({some_payload: '{{ANY_REQUEST_PAYLOAD_HERE}}'})

```

## License

MIT - See [LICENSE](./LICENSE) for more information.
