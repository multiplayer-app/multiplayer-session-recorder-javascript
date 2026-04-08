import { io, Socket } from 'socket.io-client'
import jwt from 'jsonwebtoken'
import { URL } from 'url'
import { createApiService } from './api.service.js'
import { getAuthHeaders, isOAuthToken } from '../lib/authHeaders.js'
import {
  AgentConfig,
  AgentMessage,
  AgentAttachment,
  AgentChat,
  ResolveIssuePayload,
  ChatSessionPayload,
  Issue,
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
} from '../config.js'

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
    signal?: AbortSignal,
  ) => Promise<void>
  abortChat: (
    workspaceId: string,
    projectId: string,
    chatId: string,
  ) => Promise<void>
  fetchChat: (
    workspaceId: string,
    projectId: string,
    chatId: string,
  ) => Promise<AgentChat | null>
  subscribeChat: (chatId: string) => void
  unsubscribeChat: (chatId: string) => void
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

export const createRadarService = (config: AgentConfig): RadarService => {
  // URL.origin never has a trailing slash, so we use it directly as the API base
  const host = new URL(config.url).origin
  const apiBase = `${host}/v0/radar`

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
      'x-available-models': JSON.stringify(computeAvailableModels(config)),
    },
    transports: ['websocket'],
    secure: host.startsWith('https'),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: SOCKET_RECONNECTION_DELAY,
    reconnectionDelayMax: SOCKET_RECONNECTION_DELAY_MAX,
  })

  // Debug: log all incoming socket events
  socket.onAny((event: string, ...args: unknown[]) => {
    console.log(`[SOCKET] event=${event}`, JSON.stringify(args).slice(0, 200))
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
    handler: (params: { chatId: string; toolCallId: string; action: string; data?: Record<string, unknown> }) => void,
  ) => {
    socket.on('agent:action', handler)
  }

  const emitIssueCheck = () => {
    socket.emit(EVENT_DEBUGGING_AGENT_READY)
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

  const uploadContextDoc = async (
    workspaceId: string,
    projectId: string,
    chatId: string,
    markdown: string,
  ): Promise<AgentAttachment> => {
    const filename = 'context-doc.md'
    const size = Buffer.byteLength(markdown, 'utf8')

    const presignRes = await fetch(`${apiBase}/workspaces/${workspaceId}/projects/${projectId}/files/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(config.apiKey),
      },
      body: JSON.stringify({ filename, mimeType: 'text/markdown', size, chatId }),
    })
    if (!presignRes.ok) throw new Error(`Failed to get presigned URL: ${presignRes.status}`)
    const { url, key, bucket } = (await presignRes.json()) as { url: string; key: string; bucket: string }

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown' },
      body: markdown,
    })
    if (!uploadRes.ok) throw new Error(`Failed to upload context doc: ${uploadRes.status}`)

    return {
      type: 'context',
      name: filename,
      mimeType: 'text/markdown',
      size,
      metadata: { s3Key: key, bucket },
    }
  }

  const fetchMessages = async (
    workspaceId: string,
    projectId: string,
    chatId: string,
    before?: string,
  ): Promise<{ messages: AgentMessage[]; hasMore: boolean }> => {
    const query = new URLSearchParams({ limit: '20', ...(before ? { before } : {}) })
    const res = await fetch(
      `${apiBase}/workspaces/${workspaceId}/projects/${projectId}/agents/chats/${chatId}/messages?${query.toString()}`,
      { headers: getAuthHeaders(config.apiKey) },
    )
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`)
    const data = (await res.json()) as { messages: AgentMessage[]; hasMore: boolean }
    return data
  }

  const fetchIssueByComponentHash = async (
    workspaceId: string,
    projectId: string,
    componentHash: string,
  ): Promise<Issue | null> => {
    const params = new URLSearchParams({ componentHash, limit: '1' })
    const res = await fetch(`${apiBase}/workspaces/${workspaceId}/projects/${projectId}/issues?${params}`, {
      headers: getAuthHeaders(config.apiKey),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { data: Issue[] }
    return data.data?.[0] ?? null
  }

  const bulkUpdateIssue = async (
    workspaceId: string,
    projectId: string,
    componentHash: string,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    const res = await fetch(`${apiBase}/workspaces/${workspaceId}/projects/${projectId}/issues/bulk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(config.apiKey) },
      body: JSON.stringify({ filter: { componentHash: [componentHash] }, payload }),
    })
    if (!res.ok) throw new Error(`Failed to update issue: ${res.status}`)
  }

  const sendStreamMessage = async (
    workspaceId: string,
    projectId: string,
    payload: { chatId?: string; content: string; contextKey?: string; userId?: string },
    signal?: AbortSignal,
  ): Promise<void> => {
    const res = await fetch(
      `${apiBase}/workspaces/${workspaceId}/projects/${projectId}/agents/chats/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(config.apiKey),
        },
        body: JSON.stringify(payload),
        signal,
      },
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Failed to send message: ${res.status} ${text}`)
    }
    // Don't consume SSE stream — socket handles message delivery.
    // Just close the response to free the connection.
    try { res.body?.cancel() } catch { }
  }

  const abortChat = async (
    workspaceId: string,
    projectId: string,
    chatId: string,
  ): Promise<void> => {
    const res = await fetch(
      `${apiBase}/workspaces/${workspaceId}/projects/${projectId}/agents/chats/${chatId}/abort`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(config.apiKey),
        },
      },
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Failed to abort chat: ${res.status} ${text}`)
    }
  }

  const fetchChat = async (
    workspaceId: string,
    projectId: string,
    chatId: string,
  ): Promise<AgentChat | null> => {
    const res = await fetch(
      `${apiBase}/workspaces/${workspaceId}/projects/${projectId}/agents/chats/${chatId}`,
      { headers: getAuthHeaders(config.apiKey) },
    )
    if (!res.ok) return null
    return (await res.json()) as AgentChat
  }

  const subscribeChat = (chatId: string) => {
    console.log(`[RADAR] chat:subscribe emitting for ${chatId}, connected=${socket.connected}`)
    socket.emit('chat:subscribe', { chatId })
  }

  const unsubscribeChat = (chatId: string) => {
    socket.emit('chat:unsubscribe', { chatId })
  }

  const disconnect = () => {
    socket.disconnect()
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
    project: payload.project,
  }
}
