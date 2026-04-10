import { io, Socket } from 'socket.io-client'
import jwt from 'jsonwebtoken'
import { URL } from 'url'
import { createApiService } from './api.service.js'
import { getAuthHeaders } from '../lib/authHeaders.js'
import {
  AgentConfig,
  AgentMessage,
  AgentAttachment,
  AgentChat,
  ResolveIssuePayload,
  ChatSessionPayload,
  Issue
} from '../types/index.js'
import {
  SOCKET_RECONNECTION_DELAY,
  SOCKET_RECONNECTION_DELAY_MAX,
  EVENT_MESSAGE_NEW,
  EVENT_CHAT_NEW,
  EVENT_CHAT_UPDATE,
  EVENT_DEBUGGING_AGENT_RESOLVE_ISSUE,
  EVENT_DEBUGGING_AGENT_READY,
  EVENT_DEBUGGING_AGENT_FIX_PUSHED,
  EVENT_DEBUGGING_AGENT_FIX_FAILED,
  EVENT_CHAT_SUBSCRIBE,
  EVENT_CHAT_UNSUBSCRIBE
} from '../config.js'
import { Logger } from 'openai/client'

export interface RadarService {
  socket: Socket
  disconnect: () => void
  uploadContextDoc: (
    workspaceId: string,
    projectId: string,
    chatId: string,
    markdown: string
  ) => Promise<AgentAttachment>
  fetchMessages: (
    workspaceId: string,
    projectId: string,
    chatId: string,
    before?: string
  ) => Promise<{ messages: AgentMessage[]; hasMore: boolean }>
  fetchIssueByComponentHash: (workspaceId: string, projectId: string, componentHash: string) => Promise<Issue | null>
  bulkUpdateIssue: (
    workspaceId: string,
    projectId: string,
    componentHash: string,
    payload: Record<string, unknown>
  ) => Promise<void>
  notifyFixPushed: (payload: {
    chatId: string
    git: {
      branchName: string
      branchUrl?: string
      prUrl?: string
      repositoryUrl: string
      prTitle?: string
      prBody?: string
      codeChanges?: { additions: number; deletions: number }
    }
    issue: { componentHash: string }
  }) => void
  notifyFixFailed: (payload: { chatId: string; issue: { componentHash: string }; error?: string }) => void
  emitAgentMessage: (message: AgentMessage) => void
  emitAgentChatUpdate: (chat: AgentChat) => void
  emitIssueCheck: () => void
  onMessage: (handler: (message: AgentMessage) => void) => void
  onUserMessage: (handler: (message: AgentMessage) => void) => void
  onAbort: (handler: (params: { chatId: string }) => void) => void
  onAction: (
    handler: (params: { chatId: string; toolCallId: string; action: string; data?: Record<string, unknown> }) => void
  ) => void
  onResolveIssue: (handler: (payload: ResolveIssuePayload) => void) => void
  onSessionStart: (handler: (payload: ChatSessionPayload) => void) => void
  onChatUpdate: (handler: (chat: AgentChat) => void) => void
  onConnect: (handler: () => void) => void
  onDisconnect: (handler: (reason: string) => void) => void
  onError: (handler: (err: Error) => void) => void
  sendStreamMessage: (
    workspaceId: string,
    projectId: string,
    payload: { chatId?: string; content: string; contextKey?: string; userId?: string },
    signal?: AbortSignal
  ) => Promise<void>
  abortChat: (workspaceId: string, projectId: string, chatId: string) => Promise<void>
  fetchChat: (workspaceId: string, projectId: string, chatId: string) => Promise<AgentChat>
  subscribeChat: (chatId: string) => void
  unsubscribeChat: (chatId: string) => void
  fetchAgentChats: (
    workspaceId: string,
    projectId: string,
    options?: { dir?: string; agentName?: string; skip?: number; limit?: number }
  ) => Promise<{ data: AgentChat[]; cursor: { total: number; skip: number; limit: number } }>
}

const computeAvailableModels = (config: AgentConfig): string[] => {
  const models: string[] = []

  // claude-code SDK is always available (bundled)
  models.push('claude-code')

  // Anthropic models: available when no custom model URL (i.e. using Anthropic API directly)
  // or when model is already an Anthropic model
  if (!config.modelUrl || config.model?.startsWith('claude')) {
    if (config.modelKey || config.model?.startsWith('claude')) {
      models.push('claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5')
    }
  }

  // OpenAI-compatible models: available when a modelKey is provided
  if (config.modelKey && config.modelUrl) {
    models.push('gpt-4o', 'gpt-4o-mini')
  } else if (config.modelKey && !config.model?.startsWith('claude')) {
    models.push('gpt-4o', 'gpt-4o-mini')
  }

  // Include the currently configured model if not already listed
  if (config.model && !models.includes(config.model)) {
    models.push(config.model)
  }

  return [...new Set(models)]
}

export const createRadarService = (config: AgentConfig, logger: Logger): RadarService => {
  // URL.origin never has a trailing slash, so we use it directly as the API base
  const host = new URL(config.url).origin
  const apiBase = `${host}/v0/radar`

  /** Build a fully-qualified project-scoped API URL. */
  const projectUrl = (workspaceId: string, projectId: string, path: string) =>
    `${apiBase}/workspaces/${workspaceId}/projects/${projectId}${path}`

  /** Authenticated fetch with JSON support. Throws on non-ok responses. */
  async function fetchJson<T>(
    url: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...getAuthHeaders(config.apiKey),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> ?? {}),
    }
    const res = await fetch(url, { ...init, headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Request failed: ${init.method ?? 'GET'} ${url} ${res.status} ${text}`.trim())
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      return (await res.json()) as T
    }
    return undefined as unknown as T
  }

  /** Authenticated fetch that returns the raw Response (for streams, presigned URLs, etc.). */
  async function fetchRaw(url: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      ...getAuthHeaders(config.apiKey),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> ?? {}),
    }
    const res = await fetch(url, { ...init, headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Request failed: ${init.method ?? 'GET'} ${url} ${res.status} ${text}`.trim())
    }
    return res
  }

  const socket: Socket = io(`${host}/workspaces/${config.workspace}/projects/${config.project}/agents`, {
    path: '/v0/radar/ws',
    auth: {
      ...getAuthHeaders(config.apiKey),
      'x-is-debugging-agent': 'true',
      ...(config.name ? { 'x-agent-name': config.name } : {}),
      ...(config.dir ? { 'x-context-path': config.dir } : {}),
      'x-max-concurrent-issues': String(config.maxConcurrentIssues ?? 2),
      ...(config.noGitBranch ? { 'x-no-git-branch': 'true' } : {}),
      ...(config.model ? { 'x-model': config.model } : {}),
      'x-available-models': JSON.stringify(computeAvailableModels(config))
    },
    transports: ['websocket'],
    secure: host.startsWith('https'),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: SOCKET_RECONNECTION_DELAY,
    reconnectionDelayMax: SOCKET_RECONNECTION_DELAY_MAX
  })

  // Debug: log all incoming socket events
  socket.onAny((event: string, ...args: unknown[]) => {
    logger.info(`[SOCKET] event=${event}`, JSON.stringify(args).slice(0, 200))
  })

  const onConnect = (handler: () => void) => {
    socket.on('connect', handler)
  }

  const onDisconnect = (handler: (reason: string) => void) => {
    socket.on('disconnect', handler)
  }

  const onError = (handler: (err: Error) => void) => {
    socket.on('connect_error', handler)
  }

  const notifyFixPushed = (payload: {
    chatId: string
    git: {
      branchName: string
      branchUrl?: string
      prUrl?: string
      repositoryUrl: string
    }
    issue: { componentHash: string }
    codeChanges?: { additions: number; deletions: number }
  }) => {
    socket.emit(EVENT_DEBUGGING_AGENT_FIX_PUSHED, payload)
  }

  const notifyFixFailed = (payload: { chatId: string; issue: { componentHash: string }; error?: string }) => {
    socket.emit(EVENT_DEBUGGING_AGENT_FIX_FAILED, payload)
  }

  const emitAgentMessage = (message: AgentMessage) => {
    const payload = { ...message }
    if (!payload.content && payload.toolCalls?.length) {
      delete (payload as any).content
    }
    socket.emit(EVENT_MESSAGE_NEW, payload)
  }

  const emitAgentChatUpdate = (chat: AgentChat) => {
    socket.emit(EVENT_CHAT_UPDATE, chat)
  }

  const onMessage = (handler: (message: AgentMessage) => void) => {
    socket.on(EVENT_MESSAGE_NEW, (msg: AgentMessage) => handler(msg))
  }

  const onUserMessage = (handler: (message: AgentMessage) => void) => {
    socket.on(EVENT_MESSAGE_NEW, (msg: AgentMessage) => {
      if (msg.role === 'user') handler(msg)
    })
  }

  const onAbort = (handler: (params: { chatId: string }) => void) => {
    socket.on('agent:abort', (params: { chatId: string }) => handler(params))
  }

  const onAction = (
    handler: (params: { chatId: string; toolCallId: string; action: string; data?: Record<string, unknown> }) => void
  ) => {
    socket.on('agent:action', handler)
  }

  const emitIssueCheck = () => {
    socket.emit(EVENT_DEBUGGING_AGENT_READY)
  }

  const subscribeChat = (chatId: string) => {
    socket.emit(EVENT_CHAT_SUBSCRIBE, { chatId })
  }

  const unsubscribeChat = (chatId: string) => {
    socket.emit(EVENT_CHAT_UNSUBSCRIBE, { chatId })
  }

  const onChatUpdate = (handler: (chat: AgentChat) => void) => {
    socket.on(EVENT_CHAT_UPDATE, (chat: AgentChat) => handler(chat))
  }

  const onResolveIssue = (handler: (payload: ResolveIssuePayload) => void) => {
    socket.on(EVENT_DEBUGGING_AGENT_RESOLVE_ISSUE, (payload: ResolveIssuePayload) => handler(payload))
  }

  const onSessionStart = (handler: (payload: ChatSessionPayload) => void) => {
    socket.on(EVENT_CHAT_NEW, (payload: ChatSessionPayload) => handler(payload))
  }

  const disconnect = () => {
    socket.disconnect()
  }

  const uploadContextDoc = async (
    workspaceId: string,
    projectId: string,
    chatId: string,
    markdown: string
  ): Promise<AgentAttachment> => {
    const filename = 'context-doc.md'
    const size = Buffer.byteLength(markdown, 'utf8')

    const { url, key, bucket } = await fetchJson<{ url: string; key: string; bucket: string }>(
      projectUrl(workspaceId, projectId, '/files/presigned-url'),
      { method: 'POST', body: JSON.stringify({ filename, mimeType: 'text/markdown', size, chatId }) },
    )

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown' },
      body: markdown
    })
    if (!uploadRes.ok) throw new Error(`Failed to upload context doc: ${uploadRes.status}`)

    return {
      type: 'context',
      name: filename,
      mimeType: 'text/markdown',
      size,
      metadata: { s3Key: key, bucket }
    }
  }

  const fetchMessages = async (
    workspaceId: string,
    projectId: string,
    chatId: string,
    before?: string
  ): Promise<{ messages: AgentMessage[]; hasMore: boolean }> => {
    const query = new URLSearchParams({ limit: '20', ...(before ? { before } : {}) })
    return fetchJson<{ messages: AgentMessage[]; hasMore: boolean }>(
      projectUrl(workspaceId, projectId, `/agents/chats/${chatId}/messages?${query}`),
    )
  }

  const fetchIssueByComponentHash = async (
    workspaceId: string,
    projectId: string,
    componentHash: string
  ): Promise<Issue | null> => {
    const params = new URLSearchParams({ componentHash, limit: '1' })
    const data = await fetchJson<{ data: Issue[] }>(
      projectUrl(workspaceId, projectId, `/issues?${params}`),
    )
    return data.data?.[0] ?? null
  }

  const bulkUpdateIssue = async (
    workspaceId: string,
    projectId: string,
    componentHash: string,
    payload: Record<string, unknown>
  ): Promise<void> => {
    await fetchJson(
      projectUrl(workspaceId, projectId, '/issues/bulk'),
      { method: 'PATCH', body: JSON.stringify({ filter: { componentHash: [componentHash] }, payload }) },
    )
  }

  const sendStreamMessage = async (
    workspaceId: string,
    projectId: string,
    payload: { chatId?: string; content: string; contextKey?: string; userId?: string },
    signal?: AbortSignal
  ): Promise<void> => {
    const res = await fetchRaw(
      projectUrl(workspaceId, projectId, '/agents/chats/stream'),
      { method: 'POST', body: JSON.stringify(payload), signal },
    )
    // Consume the SSE stream so we know when the server finishes processing.
    // Messages are delivered via socket — we just drain the body here.
    try {
      const reader = res.body?.getReader()
      if (reader) {
        while (!(await reader.read()).done) {}
      }
    } catch {
      // Stream may be interrupted (e.g. abort signal)
    }
  }

  const abortChat = async (workspaceId: string, projectId: string, chatId: string): Promise<void> => {
    await fetchRaw(
      projectUrl(workspaceId, projectId, `/agents/chats/${chatId}/abort`),
      { method: 'POST' },
    )
  }

  const fetchChat = async (workspaceId: string, projectId: string, chatId: string): Promise<AgentChat> => {
    return fetchJson<AgentChat>(
      projectUrl(workspaceId, projectId, `/agents/chats/${chatId}`),
    )
  }

  const fetchAgentChats = async (
    workspaceId: string,
    projectId: string,
    options?: { dir?: string; agentName?: string; skip?: number; limit?: number }
  ): Promise<{ data: AgentChat[]; cursor: { total: number; skip: number; limit: number } }> => {
    const params = new URLSearchParams()
    if (options?.dir) params.set('dir', options.dir)
    if (options?.agentName) params.set('agentName', options.agentName)
    if (options?.skip != null) params.set('skip', String(options.skip))
    params.set('limit', String(options?.limit ?? 30))

    return fetchJson<{ data: AgentChat[]; cursor: { total: number; skip: number; limit: number } }>(
      projectUrl(workspaceId, projectId, `/agents/chats?${params}`),
    )
  }

  return {
    socket,
    disconnect,
    uploadContextDoc,
    fetchMessages,
    fetchIssueByComponentHash,
    bulkUpdateIssue,
    notifyFixPushed,
    notifyFixFailed,
    emitAgentMessage,
    emitAgentChatUpdate,
    emitIssueCheck,
    onMessage,
    onUserMessage,
    onAbort,
    onAction,
    onChatUpdate,
    onResolveIssue,
    onSessionStart,
    onConnect,
    onDisconnect,
    onError,
    sendStreamMessage,
    subscribeChat,
    unsubscribeChat,
    abortChat,
    fetchChat,
    fetchAgentChats
  }
}

export interface ApiKeyPayload {
  workspace?: string
  project?: string
  integration?: string
  type?: string
}

export const decodeApiKeyPayload = (apiKey: string): ApiKeyPayload => {
  try {
    return (jwt.decode(apiKey) as ApiKeyPayload) || {}
  } catch {
    return {}
  }
}

export const validateApiKey = async (url: string, apiKey: string): Promise<{ workspace: string; project: string }> => {
  const payload = decodeApiKeyPayload(apiKey)

  // Project API keys are JWTs with workspace + project + integration embedded.
  // Everything else (OAuth JWTs without integration, opaque tokens) uses Bearer auth.
  if (!payload.workspace || !payload.project || !payload.integration) {
    const api = createApiService({ url, apiKey: '', bearerToken: apiKey })
    const session = await api.fetchUserSession()
    const workspace = session?.workspaces?.[0]
    if (!workspace) throw new Error('No workspace found for this account')

    const projects = await api.fetchProjects(workspace._id)
    const project = projects[0]
    if (!project?._id) throw new Error('No project found for this account')

    return { workspace: workspace._id, project: project._id }
  }

  const api = createApiService({ url, apiKey })
  const project = await api.fetchProject(payload.workspace, payload.project)

  if (!project) {
    throw new Error('API key validation failed: workspace or project not found')
  }

  return {
    workspace: payload.workspace,
    project: payload.project
  }
}
