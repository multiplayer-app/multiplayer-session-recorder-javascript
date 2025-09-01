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

## Install

```bash
npm i @multiplayer-app/session-recorder-node
# or
yarn add @multiplayer-app/session-recorder-node
```

## Set up backend services

### Route traces and logs to Multiplayer

Multiplayer Full Stack Session Recorder is built on top of OpenTelemetry.

### New to OpenTelemetry?

No problem. You can set it up in a few minutes. If your services don't already use OpenTelemetry, you'll first need to install the OpenTelemetry libraries. Detailed instructions for this can be found in the [OpenTelemetry documentation](https://opentelemetry.io/docs/).

### Already using OpenTelemetry?

You have two primary options for routing your data to Multiplayer:

***Direct Exporter***: This option involves using the Multiplayer Exporter directly within your services. It's a great choice for new applications or startups because it's simple to set up and doesn't require any additional infrastructure. You can configure it to send all session recording data to Multiplayer while optionally sending a sampled subset of data to your existing observability platform.

***OpenTelemetry Collector***: For large, scaled platforms, we recommend using an OpenTelemetry Collector. This approach provides more flexibility by having your services send all telemetry to the collector, which then routes specific session recording data to Multiplayer and other data to your existing observability tools.


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

### Capturing request/response and header content

In addition to sending traces and logs, you need to capture request and response content. We offer two solutions for this:

***In-Service Code Capture:*** You can use our libraries to capture, serialize, and mask request/response and header content directly within your service code. This is an easy way to get started, especially for new projects, as it requires no extra components in your platform.

***Multiplayer Proxy:*** Alternatively, you can run a [Multiplayer Proxy](https://github.com/multiplayer-app/multiplayer-proxy) to handle this outside of your services. This is ideal for large-scale applications and supports all languages, including those like Java that don't allow for in-service request/response hooks. The proxy can be deployed in various ways, such as an Ingress Proxy, a Sidecar Proxy, or an Embedded Proxy, to best fit your architecture.

### Option 1: In-Service Code Capture

The Multiplayer Session Recorder library provides utilities for capturing request, response and header content. See example below:

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
      // list of headers to mask in request/response headers
      maskHeadersList: ["set-cookie"],
      // set the maximum request/response content size (in bytes) that will be captured
      // any request/response content greater than size will be not included in session recordings
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

### Option 2: Multiplayer Proxy

The Multiplayer Proxy enables capturing request/response and header content without changing service code. See instructions at the [Multiplayer Proxy repository](https://github.com/multiplayer-app/multiplayer-proxy).

## Set up CLI app

The Multiplayer Full Stack Session Recorder can be used inside the CLI apps.

The [Multiplayer Time Travel Demo](https://github.com/multiplayer-app/multiplayer-time-travel-platform) includes an example [node.js CLI app](https://github.com/multiplayer-app/multiplayer-time-travel-platform/tree/main/clients/nodejs-cli-app).

See an additional example below.

### Quick start

Use the following code below to initialize and run the session recorder.

Example for Session Recorder initialization relies on [opentelemetry.ts](./examples/cli/src/opentelemetry.ts) file. Copy that file and put next to quick start code.

```javascript
// IMPORTANT: set up OpenTelemetry
// for an example see ./examples/cli/src/opentelemetry.ts
// NOTE: for the code below to work copy ./examples/cli/src/opentelemetry.ts to ./opentelemetry.ts
import { idGenerator } from "./opentelemetry"
import SessionRecorder from "@multiplayer-app/session-recorder-node"
import {
  SessionRecorderHttpInstrumentationHooksNode,
  SessionRecorderTraceIdRatioBasedSampler,
  SessionRecorderIdGenerator,
  SessionRecorderHttpTraceExporter,
  SessionRecorderHttpLogsExporter,
} from "@multiplayer-app/session-recorder-node"

SessionRecorder.init({
  apiKey: "MULTIPLAYER_OTLP_KEY", // note: replace with your Multiplayer OTLP key
  traceIdGenerator: idGenerator,
  resourceAttributes: {
    serviceName: "{YOUR_APPLICATION_NAME}"
    version: "{YOUR_APPLICATION_VERSION}",
    environment: "{YOUR_APPLICATION_ENVIRONMENT}",
  }
})

await sessionRecorder.start(
  SessionType.PLAIN,
  {
    name: "This is test session",
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
