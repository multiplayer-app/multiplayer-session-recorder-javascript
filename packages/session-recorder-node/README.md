![Description](../../docs/img/header-js.png)

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

### Installation

```bash
npm i @multiplayer-app/session-recorder-node
# or
yarn add @multiplayer-app/session-recorder-node
```

## Set up backend services

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
  url: "http://<OTLP_COLLECTOR_URL>/v1/traces",
  headers: {
    // ...
  }
})

const logExporter = new OTLPLogExporter({
  url: "http://<OTLP_COLLECTOR_URL>/v1/logs",
  headers: {
    // ...
  }
})
```

### Capturing request and response content

There"s few options to capture request/response content.

### Option 1: Instrumentation hook

Session Recorder library provides request/response for capturing payload.

```javascript
import {
  SessionRecorderHttpInstrumentationHooksNode,
} from "@multiplayer-app/session-recorder-node"
import {
  getNodeAutoInstrumentations,
} from "@opentelemetry/auto-instrumentations-node"
import { type Instrumentation } from "@opentelemetry/instrumentation"

export const instrumentations: Instrumentation[] = getNodeAutoInstrumentations({
  "@opentelemetry/instrumentation-http": {
    enabled: true,
    responseHook: SessionRecorderHttpInstrumentationHooksNode.responseHook({
      maskHeadersList: ["set-cookie"],
      maxPayloadSizeBytes: 500000,
      isMaskBodyEnabled: false,
      isMaskHeadersEnabled: true,
    }),
    requestHook: SessionRecorderHttpInstrumentationHooksNode.requestHook({
      maskHeadersList: ["Authorization", "cookie"],
      maxPayloadSizeBytes: 500000,
      isMaskBodyEnabled: false,
      isMaskHeadersEnabled: true,
    }),
  }
})
```

### Option 2: Envoy proxy

Deploy [Multiplayer Envoy Proxy](https://github.com/multiplayer-app/multiplayer-proxy) in front of your backend service.

## Set up cli app

### Quick start

Use the following code to initialize the session recorder with your application details:

```javascript
import SessionRecorder from "@multiplayer-app/session-recorder-node"
import {
  SessionRecorderHttpInstrumentationHooksNode,
  SessionRecorderTraceIdRatioBasedSampler,
  SessionRecorderIdGenerator,
  SessionRecorderHttpTraceExporter,
  SessionRecorderHttpLogsExporter,
} from "@multiplayer-app/session-recorder-node"

const idGenerator = new SessionRecorderIdGenerator()

SessionRecorder.init({
  apiKey: "MULTIPLAYER_OTLP_KEY", // note: replace with your Multiplayer OTLP key
  traceIdGenerator: idGenerator,
  resourceAttributes: {
    serviceName: "{YOUR_APPLICATION_NAME}"
    version: "{YOUR_APPLICATION_VERSION}",
    environment: "{YOUR_APPLICATION_ENVIRONMENT}",
  }
})

// ...

await sessionRecorder.start(
  SessionType.PLAIN,
  {
    name: "Test session name",
    sessionAttributes: {
      accountId: "687e2c0d3ec8ef6053e9dc97",
      accountName: "Acme Corporation"
    }
  }
)

// do something here

await sessionRecorder.stop()
```

Replace the placeholders with your application’s version, name, environment, and API key.

## License

MIT — see [LICENSE](./LICENSE).
