import { hostname } from 'os'
import { node, NodeSDK } from '@opentelemetry/sdk-node'
import {
  BatchSpanProcessor,
  ParentBasedSampler,
} from '@opentelemetry/sdk-trace-base'
import {
  getNodeAutoInstrumentations,
  getResourceDetectors,
} from '@opentelemetry/auto-instrumentations-node'
import {
  resourceFromAttributes,
  detectResources,
} from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_HOST_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_PROCESS_RUNTIME_VERSION,
  SEMRESATTRS_PROCESS_PID,
} from '@opentelemetry/semantic-conventions'
import api from '@opentelemetry/api'
// import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import {
  SessionRecorderHttpInstrumentationHooksNode,
  SessionRecorderTraceIdRatioBasedSampler,
  SessionRecorderIdGenerator,
  SessionRecorderHttpTraceExporter,
  SessionRecorderHttpLogsExporter,
} from '@multiplayer-app/session-recorder-node'
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import * as apiLogs from '@opentelemetry/api-logs'
// import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'

import {
  OTLP_TRACES_ENDPOINT,
  OTLP_LOGS_ENDPOINT,
  MULTIPLAYER_OTLP_KEY,
  MULTIPLAYER_OTLP_SPAN_RATIO,
  COMPONENT_NAME,
  COMPONENT_VERSION,
  ENVIRONMENT,
} from './config'

// NOTE: Update instrumentation configuration as needed
// For more see: https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node
const instrumentations = [
  getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      requestHook: SessionRecorderHttpInstrumentationHooksNode.requestHook({
        maskHeadersList: ['X-Api-Key'],
        maxPayloadSizeBytes: 5000,
        schemifyDocSpanPayload: false,
        isMaskBodyEnabled: false,
      }),
      responseHook: SessionRecorderHttpInstrumentationHooksNode.responseHook({
        maskHeadersList: ['X-Api-Key'],
        maxPayloadSizeBytes: 5000,
        schemifyDocSpanPayload: false,
        isMaskBodyEnabled: false,
      }),
    },
  }),
]

const getResource = () => {
  const resourceWithAttributes = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: COMPONENT_NAME,
    [ATTR_SERVICE_VERSION]: COMPONENT_VERSION,
    [SEMRESATTRS_HOST_NAME]: hostname(),
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
    [SEMRESATTRS_PROCESS_RUNTIME_VERSION]: process.version,
    [SEMRESATTRS_PROCESS_PID]: process.pid,
  })
  const detectedResources = detectResources({ detectors: getResourceDetectors() })
  const resource = resourceWithAttributes.merge(detectedResources)

  return resource
}

export const idGenerator = new SessionRecorderIdGenerator()

const opentelemetry = () => {
  // const traceExporter = new OTLPTraceExporter({
  //   url: OTLP_TRACES_ENDPOINT,
  //   headers: {
  //     Authorization: MULTIPLAYER_OTLP_KEY
  //   },
  // })
  const traceExporter = new SessionRecorderHttpTraceExporter({
    apiKey: MULTIPLAYER_OTLP_KEY,
    url: OTLP_TRACES_ENDPOINT,
  })

  const resource = getResource()

  const provider = new node.NodeTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(traceExporter),
    ],
    sampler: new ParentBasedSampler({
      root: new SessionRecorderTraceIdRatioBasedSampler(MULTIPLAYER_OTLP_SPAN_RATIO),
    }),
    idGenerator,
  })

  // const logExporter = new OTLPLogExporter({
  //   url: OTLP_LOGS_ENDPOINT,
  //   headers: {
  //     Authorization: MULTIPLAYER_OTLP_KEY
  //   },
  // })
  const logExporter = new SessionRecorderHttpLogsExporter({
    apiKey: MULTIPLAYER_OTLP_KEY,
    url: OTLP_LOGS_ENDPOINT,
  })
  const logRecordProcessor = new BatchLogRecordProcessor(logExporter)

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [logRecordProcessor],
  })

  apiLogs.logs.setGlobalLoggerProvider(loggerProvider)

  provider.register()
  api.trace.setGlobalTracerProvider(provider)
  api.propagation.setGlobalPropagator(new W3CTraceContextPropagator())

  const sdk = new NodeSDK({
    instrumentations,
  })

  sdk.start()
}

opentelemetry()
