import type { AgentAttachment, AgentMessage, AgentToolCall } from '../types/index.js'

export type RuntimeMode = 'tui' | 'headless'

export type StartupStep = 'api-key' | 'workspace' | 'directory' | 'model' | 'rate-limits' | 'connecting'

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export type SessionStatus = 'pending' | 'analyzing' | 'pushing' | 'done' | 'failed' | 'aborted'

export type QuitMode = 'now' | 'after-current'

export interface SessionSummary {
  chatId: string
  issueId: string
  issueTitle: string
  issueService: string
  status: SessionStatus
  branchName?: string
  prUrl?: string
  error?: string
  startedAt: Date
}

export interface SessionMessage {
  id: string
  role: AgentMessage['role']
  content: string
  activity?: string
  agentName?: string
  attachments?: AgentAttachment[]
  toolCalls?: AgentToolCall[]
  createdAt: Date
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[]
  hasMore?: boolean
}

export interface RateLimitState {
  active: number
  limit: number
}

export interface RuntimeState {
  connection: ConnectionState
  connectionError?: string
  sessions: SessionSummary[]
  resolvedCount: number
  rateLimitState: RateLimitState
}
