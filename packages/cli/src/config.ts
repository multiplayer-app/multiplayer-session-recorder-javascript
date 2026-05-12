import path from 'path'
import os from 'os'

// ─── Multiplayer home directory ───────────────────────────────────────────────

export const MP_DIR = path.join(os.homedir(), '.multiplayer')
export const LEGACY_TOKENS_FILE = path.join(MP_DIR, 'tokens.json')

// ─── API ──────────────────────────────────────────────────────────────────────

export const PRODUCTION_HOSTNAME = 'api.multiplayer.app'
export const PRODUCTION_WEB_HOSTNAME = 'go.multiplayer.app'
export const API_URL = process.env.MULTIPLAYER_URL || `https://${PRODUCTION_HOSTNAME}/v0`
export const BASE_API_URL = process.env.MULTIPLAYER_BASE_URL || `https://${PRODUCTION_HOSTNAME}`
// ─── Demo repo ────────────────────────────────────────────────────────────────

export const DEMO_REPO_URL = 'https://github.com/multiplayer-app/cli-app-demo'

// ─── Agent defaults ───────────────────────────────────────────────────────────

export const DEFAULT_MAX_CONCURRENT = 2

// ─── AI service limits ────────────────────────────────────────────────────────

export const MAX_FILE_SIZE = 50_000 // chars
export const MAX_FILES_TO_READ = 20

// ─── Socket.IO reconnection ───────────────────────────────────────────────────

export const SOCKET_RECONNECTION_DELAY = 2_000 // ms
export const SOCKET_RECONNECTION_DELAY_MAX = 30_000 // ms

// ─── Socket event names ───────────────────────────────────────────────────────

export const EVENT_MESSAGE_NEW = 'message:new'
export const EVENT_CHAT_NEW = 'chat:new'
export const EVENT_CHAT_UPDATE = 'chat:update'
export const EVENT_CHAT_SUBSCRIBE = 'chat:subscribe'
export const EVENT_CHAT_UNSUBSCRIBE = 'chat:unsubscribe'
export const EVENT_AGENT_CHAT_BULK_DELETE = 'chat:bulk_delete'
export const EVENT_AGENT_CHAT_DELETE = 'chat:delete'
export const EVENT_DEBUGGING_AGENT_RESOLVE_ISSUE = 'debugging-agent:resolve-issue'
export const EVENT_DEBUGGING_AGENT_READY = 'debugging-agent:ready'
export const EVENT_DEBUGGING_AGENT_FIX_PUSHED = 'debugging-agent:fix-pushed'
export const EVENT_DEBUGGING_AGENT_FIX_FAILED = 'debugging-agent:fix-failed'
export const EVENT_DEBUGGING_AGENT_UPDATE = 'debugging-agent:update'
