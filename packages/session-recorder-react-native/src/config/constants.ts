export const OTEL_MP_SAMPLE_TRACE_RATIO = 0.15;

export const SESSION_ID_PROP_NAME = 'multiplayer-session-id';

export const SESSION_SHORT_ID_PROP_NAME = 'multiplayer-session-short-id';

export const SESSION_CONTINUOUS_DEBUGGING_PROP_NAME =
  'multiplayer-session-continuous-debugging';

export const SESSION_STATE_PROP_NAME = 'multiplayer-session-state';

export const SESSION_TYPE_PROP_NAME = 'multiplayer-session-type';

export const SESSION_PROP_NAME = 'multiplayer-session-data';

export const SESSION_STARTED_EVENT = 'debug-session:started';

export const SESSION_STOPPED_EVENT = 'debug-session:stopped';

export const SESSION_SUBSCRIBE_EVENT = 'debug-session:subscribe';

export const SESSION_UNSUBSCRIBE_EVENT = 'debug-session:unsubscribe';

export const SESSION_AUTO_CREATED = 'debug-session:auto-created';

export const SESSION_ADD_EVENT = 'debug-session:rrweb:add-event';

export const DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE = 100000;

export const SESSION_RESPONSE = 'multiplayer-debug-session-response';

export const CONTINUOUS_DEBUGGING_TIMEOUT = 60000; // 1 minutes

export const DEBUG_SESSION_MAX_DURATION_SECONDS = 10 * 60 + 30; // TODO: move to shared config otel core

// // Package version - injected by webpack during build
// declare const PACKAGE_VERSION: string
// export const PACKAGE_VERSION_EXPORT = PACKAGE_VERSION || '1.0.0'

// Regex patterns for OpenTelemetry ignore URLs
export const OTEL_IGNORE_URLS = [
  // Traces endpoint
  /.*\/v1\/traces/,
  // Debug sessions endpoints
  /.*\/v0\/radar\/debug-sessions\/start\/?$/,
  /.*\/v0\/radar\/debug-sessions\/[^/]+\/stop\/?$/,
  /.*\/v0\/radar\/debug-sessions\/[^/]+\/cancel\/?$/,

  // Continuous debug sessions endpoints
  /.*\/v0\/radar\/continuous-debug-sessions\/start\/?$/,
  /.*\/v0\/radar\/continuous-debug-sessions\/[^/]+\/save\/?$/,
  /.*\/v0\/radar\/continuous-debug-sessions\/[^/]+\/cancel\/?$/,

  // Remote debug session endpoint
  /.*\/v0\/radar\/remote-debug-session\/check\/?$/,

  // Connectivity probe endpoints (avoid noisy spans)
  /https:\/\/clients3\.google\.com\/generate_204/,
  /http:\/\/clients3\.google\.com\/generate_204/,
  /http(s)?:\/\/www\.google\.com\/generate_204/,
  /http(s)?:\/\/connectivitycheck\.android\.com\/generate_204/,
  /http(s)?:\/\/connectivitycheck\.gstatic\.com\/generate_204/,
  /http(s)?:\/\/captive\.apple\.com/,

  // Or use a more general pattern to catch all radar API endpoints
  // /.*\/v0\/radar\/.*/
];
