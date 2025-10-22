import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';

import { logger } from '../../utils';
import { OTEL_IGNORE_URLS } from '../../config';
import { type TracerReactNativeConfig } from '../../types';
import {
  extractResponseBody,
  headersToObject,
  processHttpPayload,
} from '../helpers';

export function getInstrumentations(config: TracerReactNativeConfig) {
  const instrumentations = [];

  // Fetch instrumentation
  try {
    instrumentations.push(
      new FetchInstrumentation({
        clearTimingResources: false,
        ignoreUrls: [...OTEL_IGNORE_URLS, ...(config.ignoreUrls || [])],
        propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls,
        applyCustomAttributesOnSpan: async (span, request, response) => {
          if (!config) return;

          const { captureBody, captureHeaders } = config;

          try {
            if (!captureBody && !captureHeaders) {
              return;
            }

            const requestBody = request.body;
            const requestHeaders = headersToObject(request.headers);
            const responseHeaders = headersToObject(
              response instanceof Response ? response.headers : undefined
            );

            let responseBody: string | null = null;
            if (response instanceof Response && response.body) {
              responseBody = await extractResponseBody(response);
            }

            const payload = {
              requestBody,
              responseBody,
              requestHeaders,
              responseHeaders,
            };
            processHttpPayload(payload, config, span);
          } catch (error) {
            // eslint-disable-next-line
            logger.error('DEBUGGER_LIB', 'Failed to capture fetch payload', error)
          }
        },
      })
    );
  } catch (error) {
    logger.warn('DEBUGGER_LIB', 'Fetch instrumentation not available', error);
  }

  // XMLHttpRequest instrumentation
  try {
    instrumentations.push(
      new XMLHttpRequestInstrumentation({
        clearTimingResources: false,
        ignoreUrls: [...OTEL_IGNORE_URLS, ...(config.ignoreUrls || [])],
        propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls,
        applyCustomAttributesOnSpan: (span, xhr) => {
          if (!config) return;

          const { captureBody, captureHeaders } = config;

          try {
            if (!captureBody && !captureHeaders) {
              return;
            }

            // @ts-ignore
            const requestBody = xhr.networkRequest.requestBody;
            // @ts-ignore
            const responseBody = xhr.networkRequest.responseBody;
            // @ts-ignore
            const requestHeaders = xhr.networkRequest.requestHeaders || {};
            // @ts-ignore
            const responseHeaders = xhr.networkRequest.responseHeaders || {};

            const payload = {
              requestBody,
              responseBody,
              requestHeaders,
              responseHeaders,
            };
            processHttpPayload(payload, config, span);
          } catch (error) {
            // eslint-disable-next-line
            logger.error('DEBUGGER_LIB', 'Failed to capture xml-http payload', error)
          }
        },
      })
    );
  } catch (error) {
    logger.warn(
      'DEBUGGER_LIB',
      'XMLHttpRequest instrumentation not available',
      error
    );
  }

  // Custom React Native instrumentations
  // try {
  //   instrumentations.push(new ReactNativeInstrumentation())
  // } catch (error) {
  //   console.warn('React Native instrumentation not available:', error)
  // }

  return instrumentations;
}
