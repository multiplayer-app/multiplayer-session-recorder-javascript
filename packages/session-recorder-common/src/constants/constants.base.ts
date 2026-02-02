import { SessionType } from '../type'

/**
 * @deprecated
 */
export const MULTIPLAYER_TRACE_DOC_PREFIX = 'd0cd0c'

export const MULTIPLAYER_TRACE_DEBUG_PREFIX = 'debdeb'

export const MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX = 'cdbcdb'

export const MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX = 'cdbcac'

export const MULTIPLAYER_TRACE_CONTINUOUS_SESSION_CACHE_PREFIX = 'debcdb'

export const MULTIPLAYER_TRACE_PREFIX_MAP = {
  [SessionType.CONTINUOUS]: MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
  [SessionType.SESSION_CACHE]: MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX,
  [SessionType.CONTINUOUS_SESSION_CACHE]: MULTIPLAYER_TRACE_CONTINUOUS_SESSION_CACHE_PREFIX,
  [SessionType.MANUAL]: MULTIPLAYER_TRACE_DEBUG_PREFIX,
} as Record<SessionType, string>

export const MULTIPLAYER_TRACE_DEBUG_SESSION_SHORT_ID_LENGTH = 8

export const MULTIPLAYER_TRACE_CLIENT_ID_LENGTH = 8

/**
 * @deprecated Use MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL instead
 */
export const MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_URL = 'https://api.multiplayer.app/v1/traces'

/**
 * @deprecated Use MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_HTTP_URL instead
 */
export const MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_URL = 'https://api.multiplayer.app/v1/logs'

export const MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_HTTP_URL = 'https://otlp.multiplayer.app/v1/traces'

export const MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_HTTP_URL = 'https://otlp.multiplayer.app/v1/logs'

export const MULTIPLAYER_OTEL_DEFAULT_TRACES_EXPORTER_GRPC_URL = 'https://otlp.multiplayer.app:4317/v1/traces'

export const MULTIPLAYER_OTEL_DEFAULT_LOGS_EXPORTER_GRPC_URL = 'https://otlp.multiplayer.app:4317/v1/logs'

export const MULTIPLAYER_BASE_API_URL = 'https://api.multiplayer.app'

export const MULTIPLAYER_ATTRIBUTE_PREFIX = 'multiplayer.'

export const ATTR_MULTIPLAYER_WORKSPACE_ID = 'multiplayer.workspace.id'

export const ATTR_MULTIPLAYER_PROJECT_ID = 'multiplayer.project.id'

export const ATTR_MULTIPLAYER_PLATFORM_ID = 'multiplayer.platform.id'

export const ATTR_MULTIPLAYER_CONTINUOUS_SESSION_AUTO_SAVE = 'multiplayer.session.auto-save'

export const ATTR_MULTIPLAYER_CONTINUOUS_SESSION_AUTO_SAVE_REASON = 'multiplayer.session.auto-save.reason'

export const ATTR_MULTIPLAYER_PLATFORM_NAME = 'multiplayer.platform.name'

export const ATTR_MULTIPLAYER_CLIENT_ID = 'multiplayer.client.id'

export const ATTR_MULTIPLAYER_INTEGRATION_ID = 'multiplayer.integration.id'

export const ATTR_MULTIPLAYER_SESSION_ID = 'multiplayer.session.id'

export const ATTR_MULTIPLAYER_SESSION_CLIENT_ID = 'multiplayer.session.client.id'

export const ATTR_MULTIPLAYER_HTTP_PROXY = 'multiplayer.http.proxy'

export const ATTR_MULTIPLAYER_HTTP_PROXY_TYPE = 'multiplayer.http.proxy.type'

export const ATTR_MULTIPLAYER_HTTP_REQUEST_BODY = 'multiplayer.http.request.body'

export const ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY = 'multiplayer.http.response.body'

export const ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS = 'multiplayer.http.request.headers'

export const ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS = 'multiplayer.http.response.headers'

export const ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY_ENCODING = 'multiplayer.http.response.body.encoding'

export const ATTR_MULTIPLAYER_RPC_REQUEST_MESSAGE = 'multiplayer.rpc.request.message'

export const ATTR_MULTIPLAYER_RPC_REQUEST_MESSAGE_ENCODING = 'multiplayer.rpc.request.message.encoding'

export const ATTR_MULTIPLAYER_RPC_RESPONSE_MESSAGE = 'multiplayer.rpc.response.message'

export const ATTR_MULTIPLAYER_GRPC_REQUEST_MESSAGE = 'multiplayer.rpc.grpc.request.message'

export const ATTR_MULTIPLAYER_GRPC_REQUEST_MESSAGE_ENCODING = 'multiplayer.rpc.request.message.encoding'

export const ATTR_MULTIPLAYER_GRPC_RESPONSE_MESSAGE = 'multiplayer.rpc.grpc.response.message'

export const ATTR_MULTIPLAYER_MESSAGING_MESSAGE_BODY = 'multiplayer.messaging.message.body'

export const ATTR_MULTIPLAYER_MESSAGING_MESSAGE_BODY_ENCODING = 'multiplayer.messaging.message.body.encoding'

export const ATTR_MULTIPLAYER_SESSION_RECORDER_VERSION = 'multiplayer.session-recorder.version'

export const ATTR_MULTIPLAYER_ISSUE_CUSTOM_HASH = 'multiplayer.issue.custom-hash'

export const ATTR_MULTIPLAYER_ISSUE_HASH = 'multiplayer.issue.hash'

export const ATTR_MULTIPLAYER_ISSUE_COMPONENT_HASH = 'multiplayer.issue.component-hash'

export const ATTR_MULTIPLAYER_USER_HASH = 'multiplayer.user.hash'

export const MASK_PLACEHOLDER = '***MASKED***'
