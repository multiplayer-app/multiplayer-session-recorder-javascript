# Multiplayer OpenTelemetry Core

This package provides implementations of the OpenTelemetry API for trace and metrics. It's intended for use both on the server and in the browser.

## Built-in Implementations

- [Multiplayer OpenTelemetry Core](#multiplayer-opentelemetry-core)
  - [Built-in Implementations](#built-in-implementations)
    - [Constants](#constants)
    - [Multiplayer Http Instrumentation Hooks Node](#multiplayer-http-instrumentation-hooks-node)
    - [Multiplayer Http Trace exporter web](#multiplayer-http-trace-exporter-web)
    - [Multiplayer id generator](#multiplayer-id-generator)
    - [Trace id ratio based sampler](#trace-id-ratio-based-sampler)
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
  ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS
} from '@multiplayer-app/otlp-core'
```

### Multiplayer Http Instrumentation Hooks Node

Multiplayer hooks for nodejs http instrumentation for injecting http request/response headers and payload to span.

```javascript
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { type Instrumentation } from '@opentelemetry/instrumentation'
import { MultiplayerHttpInstrumentationHooks } from '@multiplayer-app/otlp-core'

export const instrumentations: Instrumentation[] = getNodeAutoInstrumentations({
  '@opentelemetry/instrumentation-http': {
    enabled: true,
    responseHook: MultiplayerHttpInstrumentationHooks.responseHook({
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
    requestHook: MultiplayerHttpInstrumentationHooks.requestHook({
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

### Multiplayer Http Trace exporter web

```javascript
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { MultiplayerHttpTraceExporterBrowser } from '@multiplayer-app/otlp-core'

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>' // api key from multiplayer integration
}

const exporter = new MultiplayerHttpTraceExporterBrowser(collectorOptions)
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

### Multiplayer id generator

Multiplayer introduces 2 kind of traces: debug and doc, they have `d0cd0c` and `debdeb` prefixes in `traceId` accordingly.
Multiplayer Id generator will set `debdeb` prefix to `traceId` if debug session id was set using method `setSessionId`.
Put documentation traces ratio to constructor, by default it's `0`.

```javascript
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { SessionRecorderIdGenerator, MultiplayerExporterBrowser } from '@multiplayer-app/otlp-core'

const idGenerator = new SessionRecorderIdGenerator({ autoDocTracesRatio: 0.05 })

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>' // api key from multiplayer integration
}

const exporter = new MultiplayerExporterBrowser(collectorOptions)
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

Multiplayer sampler will always sample debug and document traces with appropriate prefixes, other traces will be sampled using ration provided to constructor.

```javascript
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { MultiplayerTraceIdRatioBasedSampler, MultiplayerExporterBrowser } from '@multiplayer-app/otlp-core'

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>' // api key from multiplayer integration
}

const exporter = new MultiplayerExporterBrowser(collectorOptions)
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
  sampler: new MultiplayerTraceIdRatioBasedSampler(0.05)
})
```

## License

MIT - See [LICENSE](./LICENSE) for more information.
