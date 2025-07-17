# Multiplayer OpenTelemetry Core

This package provides implementations of the OpenTelemetry API for trace and metrics. It's intended for use both on the server and in the browser.

## Built-in Implementations

- [Multiplayer OpenTelemetry Core](#multiplayer-opentelemetry-core)
  - [Built-in Implementations](#built-in-implementations)
    - [Constants](#constants)
    - [Multiplayer Filter Trace Exporter](#multiplayer-filter-trace-exporter)
    - [Multiplayer Grpc Trace Exporter Node](#multiplayer-grpc-trace-exporter-node)
    - [Multiplayer Http Instrumentation Hooks Node](#multiplayer-http-instrumentation-hooks-node)
    - [Multiplayer Http Logs exporter node](#multiplayer-http-logs-exporter-node)
    - [Multiplayer Http Trace exporter web](#multiplayer-http-trace-exporter-web)
    - [Multiplayer Http Trace exporter node](#multiplayer-http-trace-exporter-node)
    - [Multiplayer id generator](#multiplayer-id-generator)
    - [Multiplayer Json Trace serializer](#multiplayer-json-trace-serializer)
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

### Multiplayer Filter Trace Exporter

Wrapper for node otlp exporter. This wrapper removes span attributes with `multiplayer.` prefix.

```javascript
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { MultiplayerHttpTraceExporterNode } from '@multiplayer-app/otlp-core'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const multiplayerTraceExporter = new MultiplayerHttpTraceExporterNode({
  apiKey: MULTIPLAYER_OTLP_KEY
})

const apmProviderTraceExporter = new OTLPTraceExporter({
  url: 'http://some.apm/v1/traces'
})

const apmFilteredTraceExporter = new MultiplayerFilterTraceExporter(apmProviderTraceExporter)

const provider = new BasicTracerProvider({
  spanProcessors: [new BatchSpanProcessor(apmFilteredTraceExporter), new BatchSpanProcessor(multiplayerTraceExporter)]
})

provider.register()
```

### Multiplayer Grpc Trace Exporter Node

```javascript
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { MultiplayerGrpcTraceExporterNode } from '@multiplayer-app/otlp-core'

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>' // api key from multiplayer integration
}

const exporter = new MultiplayerGrpcTraceExporterNode(collectorOptions)
const provider = new BasicTracerProvider({
  spanProcessors: [
    new BatchSpanProcessor(exporter, {
      // The maximum queue size. After the size is reached spans are dropped.
      maxQueueSize: 1000,
      // The interval between two consecutive exports
      scheduledDelayMillis: 30000
    })
  ]
})

provider.register()
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
      headersToMask: ['<my-auth-header>'],
      maxPayloadSizeBytes: 5000,
      schemifyDocSpanPayload: true,
      maskDebugSpanPayload: true,
      uncompressPayload: true
    }),
    requestHook: MultiplayerHttpInstrumentationHooks.requestHook({
      headersToMask: ['<my-auth-header>'],
      maxPayloadSizeBytes: 5000,
      schemifyDocSpanPayload: true,
      maskDebugSpanPayload: true
    }),
  },
)
```

### Multiplayer Http Logs exporter node

Multiplayer json serializer for logs exporter which filters out logs which doesn't begin with debug prefix from being sent to collector.

```javascript
import { LoggerProvider } from '@opentelemetry/sdk-logs'
import {
  MultiplayerHttpLogExporterNode
} from '@multiplayer-app/otlp-core'

const loggerProvider = new LoggerProvider({
  resource,
})

const logExporter = new MultiplayerHttpLogExporterNode({
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>', // api key from multiplayer integration
})

const logRecordProcessor = return new BatchLogRecordProcessor(logExporter)

loggerProvider.addLogRecordProcessor(logRecordProcessor)
apiLogs.logs.setGlobalLoggerProvider(loggerProvider)
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

### Multiplayer Http Trace exporter node

```javascript
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { MultiplayerHttpTraceExporterNode } from '@multiplayer-app/otlp-core'

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is https://api.multiplayer.app/v1/traces
  apiKey: '<multiplayer-otlp-key>' // api key from multiplayer integration
}

const exporter = new MultiplayerHttpTraceExporterNode(collectorOptions)
const provider = new BasicTracerProvider({
  spanProcessors: [
    new BatchSpanProcessor(exporter, {
      // The maximum queue size. After the size is reached spans are dropped.
      maxQueueSize: 1000,
      // The interval between two consecutive exports
      scheduledDelayMillis: 30000
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
import { MultiplayerIdGenerator, MultiplayerExporterBrowser } from '@multiplayer-app/otlp-core'

const idGenerator = new MultiplayerIdGenerator({ autoDocTracesRatio: 0.05 })

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

### Multiplayer Json Trace serializer

Multiplayer json serializer for exporter filters out traces which doesn't begin with debug or document prefix from being sent to collector.

```javascript
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import { OTLPExporterConfigBase, OTLPExporterBrowserBase } from '@opentelemetry/otlp-exporter-base'
import { IExportTraceServiceResponse } from '@opentelemetry/otlp-transformer'
import { MultiplayerJsonTraceSerializer, MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_URL } from '@multiplayer-app/otlp-core'

interface MultiplayerExporterConfig extends OTLPExporterConfigBase {
  apiKey?: string;
}

export class MultiplayerHttpExporter
  extends OTLPExporterBrowserBase<ReadableSpan, IExportTraceServiceResponse>
  implements SpanExporter
{
  constructor(config: MultiplayerExporterConfig = {}) {
    super(
      {
        ...config,
        url: config.url || MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_URL,
        headers: {}
      },
      MultiplayerJsonTraceSerializer,
      { 'Content-Type': 'application/json' },
      ''
    )
  }

  getDefaultUrl(config: OTLPExporterConfigBase): string {
    return config.url || MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_URL
  }
}
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
