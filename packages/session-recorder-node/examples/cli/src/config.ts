export const NODE_ENV = process.env.NODE_ENV || 'development'
export const isProduction = NODE_ENV === 'production'

export const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')

export const COMPONENT_NAME = process.env.npm_package_name?.split('/').pop() as string || process.env.SERVICE_NAME || 'timegate'
export const COMPONENT_VERSION = process.env.npm_package_version || '0.0.1'
export const ENVIRONMENT = process.env.ENVIRONMENT || 'staging'

export const MULTIPLAYER_OTLP_KEY = process.env.MULTIPLAYER_OTLP_KEY as string

if (!MULTIPLAYER_OTLP_KEY) {
  throw new Error('MULTIPLAYER_OTLP_KEY is not set')
}

export const OTLP_TRACES_ENDPOINT = process.env.OTLP_TRACES_ENDPOINT || 'https://api.multiplayer.app/v1/traces'
export const OTLP_LOGS_ENDPOINT = process.env.OTLP_LOGS_ENDPOINT || 'https://api.multiplayer.app/v1/logs'

export const MULTIPLAYER_OTLP_SPAN_RATIO = process.env.MULTIPLAYER_OTLP_SPAN_RATIO
  ? Number(process.env.MULTIPLAYER_OTLP_SPAN_RATIO)
  : 0.01

export let DIALOGUE_HUB_SERVICE_URL = ''
export let EPOCH_ENGINE_SERVICE_URL = ''
export let MINDS_OF_TIME_SERVICE_URL = ''
export let VAULT_OF_TIME_SERVICE_URL = ''

export const MULTIPLAYER_BACKEND_SOURCE = process.env.MULTIPLAYER_BACKEND_SOURCE || 'production'

switch (process.env.MULTIPLAYER_BACKEND_SOURCE) {
  case 'production':
    DIALOGUE_HUB_SERVICE_URL = 'https://api.demo.multiplayer.app/v1/dialogue-hub'
    EPOCH_ENGINE_SERVICE_URL = 'https://api.demo.multiplayer.app/v1/epoch-engine'
    MINDS_OF_TIME_SERVICE_URL = 'https://api.demo.multiplayer.app/v1/minds-of-time'
    VAULT_OF_TIME_SERVICE_URL = 'https://api.demo.multiplayer.app/v1/vault-of-time'
    break
  default:
    DIALOGUE_HUB_SERVICE_URL = 'http://localhost:3000/v1/dialogue-hub'
    EPOCH_ENGINE_SERVICE_URL = 'http://localhost:3000/v1/epoch-engine'
    MINDS_OF_TIME_SERVICE_URL = 'http://localhost:3000/v1/minds-of-time'
    VAULT_OF_TIME_SERVICE_URL = 'http://localhost:3000/v1/vault-of-time'
}

DIALOGUE_HUB_SERVICE_URL = process.env.DIALOGUE_HUB_SERVICE_URL || DIALOGUE_HUB_SERVICE_URL
EPOCH_ENGINE_SERVICE_URL = process.env.EPOCH_ENGINE_SERVICE_URL || EPOCH_ENGINE_SERVICE_URL
MINDS_OF_TIME_SERVICE_URL = process.env.MINDS_OF_TIME_SERVICE_URL || MINDS_OF_TIME_SERVICE_URL
VAULT_OF_TIME_SERVICE_URL = process.env.VAULT_OF_TIME_SERVICE_URL || VAULT_OF_TIME_SERVICE_URL
