export interface AgentConfig {
  url: string
  apiKey: string
  /** 'oauth' = token from browser login; 'api_key' = personal project token pasted by user */
  authType?: 'oauth' | 'api_key'
  workspace?: string
  project?: string
  /** Human-readable name from GET /v0/api/workspaces/:id (optional, for UI) */
  workspaceDisplayName?: string
  /** Human-readable name from GET /v0/api/.../projects/:id (optional, for UI) */
  projectDisplayName?: string
  name?: string
  dir: string
  model: string
  modelKey: string
  modelUrl?: string
  maxConcurrentIssues: number
  noGitBranch?: boolean
  /** Skip the Multiplayer SDK installation check/setup step entirely */
  skipSdkCheck?: boolean
  /** Whether session recorder setup step has been completed or skipped */
  sessionRecorderSetupDone?: boolean
  /** Detected stacks that need session recorder SDK setup (populated when user confirms setup) */
  sessionRecorderStacks?: import('../session-recorder/detectStacks.js').DetectedStack[]
}

export interface IssueMetadata {
  culprit?: string
  message?: string
  stacktrace?: string
  spanKind?: number
  httpTarget?: string
  httpUrl?: string
  httpRoute?: string
  httpMethod?: string
  value?: string
  type?: string
  filename?: string
  function?: string
}

export interface IssueService {
  serviceName: string
  serviceNameSlug: string
  release?: string
  environment?: string
  environmentSlug?: string
}

export interface IssueSolution {
  inProgress?: boolean
  agent?: string
  fixWithAgentFailed?: boolean
  gitBranch?: string
  gitRepositoryUrl?: string
  prUrl?: string
}

export interface Issue {
  _id: string
  workspace: string
  project: string
  hash: string
  componentHash: string
  title: string
  resolved: boolean
  archived: boolean
  severity?: number
  category: string
  metadata: IssueMetadata
  service: IssueService
  solution?: IssueSolution
  lastSeen?: string
  createdAt?: string
  updatedAt?: string
}

export type IssueStatus = 'pending' | 'analyzing' | 'applying' | 'pushing' | 'done' | 'failed'

export interface ActiveIssue {
  issue: Issue
  status: IssueStatus
  branchName?: string
  prUrl?: string
  error?: string
  startedAt: Date
}

export interface LogEntry {
  timestamp: Date
  level: 'info' | 'error' | 'debug'
  message: string
}

export interface FilePatch {
  filePath: string
  newContent: string
}

export interface Release {
  _id: string
  version: string
  commitHash?: string
  repositoryUrl?: string
  releaseNotes?: string
}

export interface SessionRecordingData {
  traces: unknown[]
  logs: unknown[]
  rrweb: unknown[]
}

export interface ResolveIssuePayload {
  chatId: string
  issue: Issue
  release?: Release
  agentSettings?: {
    fixabilityScoreThreshold?: number
  }
}

export type AgentMessageRole = 'user' | 'assistant' | 'agent' | 'system' | 'tool' | 'reasoning' | 'error'

export type AgentChatStatus = 'processing' | 'streaming' | 'finished' | 'aborted' | 'waitingForUserAction' | 'error'

export interface AgentToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  output?: Record<string, unknown>
  error?: string
  requiresConfirmation?: boolean
  requiresUserAction?: boolean
  approved?: boolean
  approvalId?: string
  userResponse?: string
}

export interface AgentAttachment {
  _id?: string
  type: 'file' | 'link' | 'artifact' | 'context'
  name: string
  url?: string
  mimeType?: string
  size?: number
  metadata?: Record<string, unknown>
}

export interface AgentMessage {
  id?: string
  _id?: string
  chat: string
  role: AgentMessageRole
  content: string
  reasoning?: string
  toolCalls?: AgentToolCall[]
  attachments?: AgentAttachment[]
  agentName?: string
  activity?: string
  createdAt?: string
  updatedAt?: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentChat {
  _id: string
  title?: string
  status?: AgentChatStatus
  contextKey?: string
  model?: string
  agentName?: string
  dir?: string
  metadata?: Record<string, unknown> & {
    issue?: {
      componentHash: string
    }
    release?: {
      _id: string
      version: string
      commitHash: string
    }
    component?: {
      entityId: string
      name: string
    }
    environment?: {
      name: string
    }
    debugSession?: {
      _id: string
    }
  }
  git?: {
    branchName?: string
    branchUrl?: string
    prUrl?: string
    codeChanges?: {
      additions: number
      deletions: number
    }
  }
  createdAt?: string
  updatedAt?: string
}

export interface ChatSessionPayload {
  chatId: string
  chat: AgentChat
}
