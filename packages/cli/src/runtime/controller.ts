import { EventEmitter } from 'events'
import mongoose from 'mongoose'
import {
  AgentConfig,
  Issue,
  AgentMessage,
  AgentToolCall,
  ConversationMessage,
  ChatSessionPayload,
  Release,
  ResolveIssuePayload,
} from '../types/index.js'
import { createRadarService, RadarService } from '../services/radar.service.js'
import { createApiService } from '../services/api.service.js'
import * as GitService from '../services/git.service.js'
import * as AiService from '../services/ai.service.js'
import * as PrService from '../services/pr.service.js'
import type { SessionSummary, SessionDetail, SessionMessage, SessionStatus, RuntimeState, QuitMode } from './types.js'
import {
  initialRuntimeState,
  addSession,
  upsertSession,
  setConnection,
  incrementResolved,
  setRateLimitActive,
} from './state.js'

type ConfirmResolver = (result: { approved: boolean; userResponse?: string }) => void
type Logger = (level: 'info' | 'error' | 'debug', msg: string) => void

interface ChatContext {
  chatId: string
  issue: Issue
  history: ConversationMessage[]
  abortController: AbortController | null
  isProcessing: boolean
  worktreeDir?: string
}

// ─── Path sanitization ────────────────────────────────────────────────────────

const THINKING_VERBS = [
  'Pondering', 'Cogitating', 'Ruminating', 'Contemplating', 'Deliberating',
  'Noodling', 'Scheming', 'Concocting', 'Devising', 'Wrangling',
  'Untangling', 'Deciphering', 'Spelunking', 'Excavating', 'Interrogating',
  'Scrutinizing', 'Dissecting', 'Reverse-engineering', 'Theorizing', 'Hypothesizing',
  'Philosophizing', 'Brainstorming', 'Percolating', 'Simmering', 'Marinating',
]

function randomThinkingVerb(): string {
  return THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)]!
}

const stripTerminalEscapes = (text: string): string =>
  text
    // OSC: ESC ] ... (BEL or ESC \)
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '')
    // CSI: ESC [ ... command
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    // 2-char ESC sequences
    .replace(/\x1B[@-Z\\-_]/g, '')

const normalizeStreamContent = (text: string): string =>
  stripTerminalEscapes(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\t/g, '  ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

const sanitizePaths = (text: string, dirs: string[]): string => {
  let result = normalizeStreamContent(text)
  for (const dir of dirs) {
    if (!dir) continue
    const prefix = dir.endsWith('/') ? dir : dir + '/'
    result = result.replaceAll(prefix, '')
    result = result.replaceAll(dir, '.')
  }
  return result
}

const sanitizeValue = (value: unknown, dirs: string[]): unknown => {
  if (typeof value === 'string') return sanitizePaths(value, dirs)
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, dirs))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(v, dirs)]),
    )
  }
  return value
}

const sanitizeMessage = (msg: AgentMessage, dirs: string[]): AgentMessage => {
  const active = dirs.filter(Boolean)
  if (active.length === 0) {
    return {
      ...msg,
      content: normalizeStreamContent(msg.content),
    }
  }
  return {
    ...msg,
    content: sanitizePaths(msg.content, active),
    toolCalls: msg.toolCalls?.map((tc) => ({
      ...tc,
      input: sanitizeValue(tc.input, active) as Record<string, unknown>,
      output: tc.output ? (sanitizeValue(tc.output, active) as Record<string, unknown>) : undefined,
    })),
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class RuntimeController extends EventEmitter {
  private _config: AgentConfig
  private radar: RadarService | null = null
  private chatContexts = new Map<string, ChatContext>()
  private pendingMessages = new Map<string, AgentMessage[]>()
  private pendingConfirmations = new Map<string, ConfirmResolver>()
  private sessionDetails = new Map<string, SessionDetail>()
  private _state: RuntimeState
  private quitMode: QuitMode | null = null
  private log: Logger
  private _pendingDetailEmit = new Map<string, { detail: SessionDetail; timer: ReturnType<typeof setTimeout> }>()

  constructor(config: AgentConfig, logger?: Logger) {
    super()
    this._config = config
    this._state = {
      ...initialRuntimeState(config.maxConcurrentIssues),
      ...(config.workspaceDisplayName?.trim() ? { workspaceDisplayName: config.workspaceDisplayName.trim() } : {}),
      ...(config.projectDisplayName?.trim() ? { projectDisplayName: config.projectDisplayName.trim() } : {}),
    }
    this.log =
      logger ??
      ((level, msg) => {
        if (level === 'error') process.stderr.write(`[${level}] ${msg}\n`)
        else process.stdout.write(`[${level}] ${msg}\n`)
      })
  }

  get config(): AgentConfig {
    return this._config
  }

  getState(): RuntimeState {
    return this._state
  }

  getSessionDetail(chatId: string): SessionDetail | undefined {
    return this.sessionDetails.get(chatId)
  }

  async loadSessionMessages(chatId: string, before?: string): Promise<void> {
    const detail = this.sessionDetails.get(chatId)
    if (!detail) return
    // Don't refetch for sessions that are actively streaming
    const summary = this._state.sessions.find((s) => s.chatId === chatId)
    if (summary && !['done', 'failed', 'aborted', 'pending'].includes(summary.status)) return

    try {
      const cfg = this._config
      const rawMessages = await this.radar!.fetchMessages(cfg.workspace ?? '', cfg.project ?? '', chatId, before)

      const dirs = this.getDirs(chatId)
      const messages: SessionMessage[] = rawMessages.messages.map((m) => ({
        id: m._id ?? new mongoose.Types.ObjectId().toString(),
        role: m.role,
        content: m.content ? sanitizePaths(m.content, dirs) : '',
        activity: m.activity,
        agentName: m.agentName,
        attachments: m.attachments,
        toolCalls: m.toolCalls?.map((tc: AgentToolCall) => ({
          ...tc,
          input: sanitizeValue(tc.input, dirs) as Record<string, unknown>,
          output: tc.output ? (sanitizeValue(tc.output, dirs) as Record<string, unknown>) : undefined,
        })),
        createdAt: new Date(m.createdAt ?? Date.now()),
      }))
      detail.messages = before ? [...messages, ...detail.messages] : messages
      detail.hasMore = rawMessages.hasMore ?? false
      this.log(
        'info',
        `Loaded ${messages.length} messages for chatId: ${chatId}, before: ${before}, hasMore: ${detail.hasMore}`,
      )
      this.emit('session-detail', chatId, { ...detail })
    } catch (err: unknown) {
      this.log(
        'error',
        `Failed to fetch messages for chatId: ${chatId}, before: ${before}, error: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  connect(): void {
    this.setState(setConnection(this._state, 'connecting'))
    this.log('info', `Connecting to ${this._config.url}`)

    const radar = createRadarService(this._config)
    this.radar = radar

    radar.onConnect(() => {
      this.setState(setConnection(this._state, 'connected'))
      radar.emitIssueCheck()
    })

    radar.onDisconnect((reason) => {
      this.setState(setConnection(this._state, 'disconnected'))
      this.log('info', `Disconnected: ${reason}`)
    })

    radar.onError((err) => {
      this.setState(setConnection(this._state, 'error', err.message))
      this.log('error', `Connection error: ${err.message}`)
    })

    radar.onUserMessage((msg) => {
      void this.handleUserMessage(msg)
    })

    // Listen for all incoming messages (assistant responses from server-side streaming)
    radar.onMessage((msg) => {
      this.log('debug', `message:new received: role=${msg.role} chat=${msg.chat}`)
      if (msg.chat && msg.role !== 'user') {
        this.addSessionMessage(msg.chat, {
          id: msg._id,
          role: msg.role,
          content: msg.content ?? '',
          activity: msg.activity,
        })
      }
    })

    radar.onAbort((params) => {
      this.handleAbort(params)
    })

    radar.onChatUpdate((chat) => {
      this.log('info', `chat:update received: id=${chat._id} status=${chat.status}`)
      if (chat._id && chat.status) {
        this.emit('chat-status', chat._id, chat.status)
      }
    })

    radar.onAction((params) => {
      this.handleAction(params)
    })

    radar.onResolveIssue((payload) => {
      void this.processIssueFromResolvePayload(payload)
    })

    radar.onSessionStart((payload) => {
      this.restoreChat(payload)
    })

    void this.loadWorkspaceProjectDisplayNames()
  }

  private async loadWorkspaceProjectDisplayNames(): Promise<void> {
    const workspaceId = this._config.workspace
    const projectId = this._config.project
    if (!workspaceId || !projectId || !this._config.apiKey) return

    if (this._config.workspaceDisplayName?.trim() && this._config.projectDisplayName?.trim()) {
      return
    }

    try {
      const api = createApiService(this._config)
      const [ws, proj] = await Promise.all([api.fetchWorkspace(workspaceId), api.fetchProject(workspaceId, projectId)])
      const workspaceDisplayName = ws?.name?.trim()
      const projectDisplayName = proj?.name?.trim()
      if (!workspaceDisplayName && !projectDisplayName) return

      this.setState({
        ...this._state,
        ...(workspaceDisplayName ? { workspaceDisplayName } : {}),
        ...(projectDisplayName ? { projectDisplayName } : {}),
      })
    } catch (err: unknown) {
      this.log('debug', `Could not load workspace/project labels: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  disconnect(): void {
    this.radar?.disconnect()
    this.radar = null
  }

  quit(mode: QuitMode): void {
    this.quitMode = mode
    if (mode === 'now') {
      this.disconnect()
      this.emit('quit')
      return
    }
    // Quit after current: check if any sessions are active
    const active = this._state.sessions.filter((s) => !['done', 'failed', 'aborted'].includes(s.status))
    if (active.length === 0) {
      this.disconnect()
      this.emit('quit')
    }
    // Otherwise wait — processIssue finally block will emit quit when last session ends
  }

  // ─── Chat composer API ─────────────────────────────────────────────────────

  /**
   * Send a user message to an active chat session via the /stream endpoint.
   * The SSE response is discarded — socket delivers messages to the UI.
   */
  async sendUserMessage(chatId: string, content: string): Promise<void> {
    const cfg = this._config
    if (!this.radar || !cfg.workspace || !cfg.project) return

    this.log('info', `Sending user message to ${chatId}: ${content.slice(0, 80)}`)

    // Optimistically add user message to the local UI
    this.addSessionMessage(chatId, { role: 'user', content })
    this.emit('chat-status', chatId, 'processing')

    // Subscribe to chat events so we receive chat:update and message:new
    this.radar.subscribeChat(chatId)

    const ctx = this.chatContexts.get(chatId)
    const contextKey = ctx?.issue?.componentHash

    try {
      await this.radar.sendStreamMessage(cfg.workspace, cfg.project, { chatId, content, contextKey, userId: 'guest' })
      // Stream request accepted — poll for completion since chat:update
      // socket events may not be delivered to the agent socket.
      // void this.pollChatUntilDone(chatId)
    } catch (err: unknown) {
      this.log('error', `Failed to send message to ${chatId}: ${err instanceof Error ? err.message : String(err)}`)
      this.emit('chat-status', chatId, 'error')
      throw err
    }
  }

  /**
   * Poll the chat status until it leaves 'processing'/'streaming', then sync messages.
   */
  private async pollChatUntilDone(chatId: string): Promise<void> {
    const cfg = this._config
    if (!this.radar || !cfg.workspace || !cfg.project) return

    const POLL_INTERVAL = 3000
    const MAX_POLLS = 100

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL))

      try {
        const chat = await this.radar.fetchChat(cfg.workspace!, cfg.project!, chatId)
        this.log('debug', `poll ${i + 1}: chatId=${chatId} status=${chat?.status}`)

        if (chat?.status && chat.status !== 'processing' && chat.status !== 'streaming') {
          this.emit('chat-status', chatId, chat.status)
          await this.loadSessionMessages(chatId)
          return
        }
      } catch {
        this.log('error', `poll failed for ${chatId}`)
      }
    }

    this.log('error', `poll timeout for ${chatId}`)
  }

  /**
   * Abort an active chat session via the /:chatId/abort endpoint.
   */
  async abortChatSession(chatId: string): Promise<void> {
    const cfg = this._config
    if (!this.radar || !cfg.workspace || !cfg.project) return

    this.log('info', `Requesting abort for chat ${chatId}`)

    try {
      await this.radar.abortChat(cfg.workspace, cfg.project, chatId)
    } catch (err: unknown) {
      this.log('error', `Failed to abort ${chatId}: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }

  /**
   * Fetch the current chat status from the server. Returns the AgentChatStatus
   * or null if the chat is not found.
   */
  async fetchChatStatus(chatId: string): Promise<string | null> {
    const cfg = this._config
    if (!this.radar || !cfg.workspace || !cfg.project) return null

    try {
      const chat = await this.radar.fetchChat(cfg.workspace, cfg.project, chatId)
      return chat?.status ?? null
    } catch {
      return null
    }
  }

  // ─── Internal state helpers ──────────────────────────────────────────────────

  /**
   * Coalesces rapid session-detail emissions during streaming into at most one
   * React re-render per ~16 ms (one animation frame). The last detail seen
   * within the window is always emitted, so no updates are lost.
   */
  private scheduleDetailEmit(chatId: string, detail: SessionDetail): void {
    const pending = this._pendingDetailEmit.get(chatId)
    if (pending) {
      pending.detail = { ...detail }
      return
    }
    const entry = { detail: { ...detail }, timer: null as unknown as ReturnType<typeof setTimeout> }
    entry.timer = setTimeout(() => {
      this._pendingDetailEmit.delete(chatId)
      this.emit('session-detail', chatId, entry.detail)
    }, 16)
    this._pendingDetailEmit.set(chatId, entry)
  }

  private setState(next: RuntimeState): void {
    this._state = next
    this.emit('state', this._state)
  }

  private getDirs(chatId: string): string[] {
    const ctx = this.chatContexts.get(chatId)
    return [this._config.dir, ctx?.worktreeDir].filter(Boolean) as string[]
  }

  private addSessionMessage(chatId: string, msg: Omit<SessionMessage, 'id' | 'createdAt'> & { id?: string }): void {
    const detail = this.sessionDetails.get(chatId)
    if (!detail) return
    const full: SessionMessage = {
      id: msg.id ?? new mongoose.Types.ObjectId().toString(),
      createdAt: new Date(),
      ...msg,
    }
    detail.messages = [...detail.messages, full]
    this.emit('session-detail', chatId, { ...detail })
  }

  private upsertSessionMessage(chatId: string, msgId: string, updates: Partial<SessionMessage>): void {
    const detail = this.sessionDetails.get(chatId)
    if (!detail) return
    const idx = detail.messages.findIndex((m) => m.id === msgId)
    if (idx === -1) {
      detail.messages = [
        ...detail.messages,
        {
          id: msgId,
          createdAt: new Date(),
          role: 'assistant',
          content: '',
          ...updates,
        } as SessionMessage,
      ]
    } else {
      const msgs = [...detail.messages]
      msgs[idx] = { ...msgs[idx]!, ...updates }
      detail.messages = msgs
    }
    this.scheduleDetailEmit(chatId, detail)
  }

  /** Emit a sanitized message to Radar for the given chat. */
  private emitToRadar(
    chatId: string,
    content: string,
    role: AgentMessage['role'] = 'assistant',
    activity?: string,
    msgId?: string,
  ): void {
    const dirs = this.getDirs(chatId)

    this.radar?.emitAgentMessage({
      _id: msgId,
      chat: chatId,
      role,
      content: sanitizePaths(content, dirs),
      agentName: this._config.name,
      activity,
    })
  }

  /**
   * Creates the streaming callbacks used during AI execution.
   * Both processIssue and handleUserMessage use the same pattern; this avoids
   * duplicating ~60 lines of setup in each method.
   *
   * Returns the callbacks and a mutable `state` object so callers can read
   * accumulated streamContent and the current turnMsgId after the AI call.
   */
  private makeStreamCallbacks(
    chatId: string,
    getDirs: () => string[],
    activity?: string,
  ): {
    callbacks: AiService.StreamCallbacks
    state: { turnMsgId: string; streamContent: string }
  } {
    const cfg = this._config
    const radar = this.radar
    const state = {
      turnMsgId: new mongoose.Types.ObjectId().toString(),
      streamContent: '',
    }
    const toolCallsMap = new Map<string, AgentToolCall>()

    const emitToolCallsToRadarAndSession = () => {
      const calls = Array.from(toolCallsMap.values())
      const normalized = normalizeStreamContent(state.streamContent)
      radar?.emitAgentMessage(
        sanitizeMessage(
          {
            _id: state.turnMsgId,
            chat: chatId,
            role: 'assistant',
            content: normalized,
            agentName: cfg.name,
            activity,
            toolCalls: calls,
          },
          getDirs(),
        ),
      )
      const sanitizedCalls = calls.map((tc) => ({
        ...tc,
        input: sanitizeValue(tc.input, getDirs()) as Record<string, unknown>,
      }))
      this.upsertSessionMessage(chatId, state.turnMsgId, {
        role: 'assistant',
        activity,
        toolCalls: sanitizedCalls,
      })
    }

    const callbacks: AiService.StreamCallbacks = {
      onProgress: (data: string) => {
        state.streamContent += data
        const normalized = normalizeStreamContent(state.streamContent)
        const sanitized = sanitizePaths(normalized, getDirs())
        radar?.emitAgentMessage(
          sanitizeMessage(
            {
              _id: state.turnMsgId,
              chat: chatId,
              role: 'assistant',
              content: normalized,
              agentName: cfg.name,
              activity,
            },
            getDirs(),
          ),
        )
        this.upsertSessionMessage(chatId, state.turnMsgId, {
          role: 'assistant',
          content: sanitized,
          activity,
        })
      },

      onTurnStart: () => {
        state.turnMsgId = new mongoose.Types.ObjectId().toString()
        state.streamContent = ''
        toolCallsMap.clear()
        const verb = randomThinkingVerb()
        const thinkingMsgId = new mongoose.Types.ObjectId().toString()
        radar?.emitAgentMessage({
          _id: thinkingMsgId,
          chat: chatId,
          role: 'reasoning',
          content: `${verb}...`,
          agentName: cfg.name,
        })
        this.addSessionMessage(chatId, { id: thinkingMsgId, role: 'reasoning', content: `${verb}...` })
      },

      onToolCall: ({ id, name, input }) => {
        toolCallsMap.set(id, { id, name, input, status: 'running' })
        emitToolCallsToRadarAndSession()
      },

      onToolCallResult: ({ id, name, input, status, output }) => {
        toolCallsMap.set(id, { id, name, input, status, output })
        emitToolCallsToRadarAndSession()
      },

      confirmToolCall: this.makeConfirmFn(chatId),
    }

    return { callbacks, state }
  }

  /** Emit a tool call confirmation request to Radar and wait for the user's response. */
  private makeConfirmFn(chatId: string): AiService.ConfirmToolCallFn {
    return (toolCallId, toolName, input) => {
      const dirs = this.getDirs(chatId)
      this.radar?.emitAgentMessage(
        sanitizeMessage(
          {
            chat: chatId,
            role: 'assistant',
            content: '',
            agentName: this._config.name,
            toolCalls: [
              {
                id: toolCallId,
                name: toolName,
                input,
                status: 'pending',
                requiresConfirmation: true,
              },
            ],
          },
          dirs,
        ),
      )
      return new Promise((resolve) => {
        this.pendingConfirmations.set(toolCallId, resolve)
      })
    }
  }

  // ─── Session restore ──────────────────────────────────────────────────────────

  private restoreChat(payload: ChatSessionPayload): void {
    void this.restoreChatAsync(payload)
  }

  private async restoreChatAsync({ chatId, chat }: ChatSessionPayload): Promise<void> {
    const existing = this.chatContexts.get(chatId)
    if (existing?.isProcessing) return

    const cfg = this._config
    const componentHash = chat.metadata?.issue?.componentHash ?? ''

    // Subscribe to chat events for real-time updates
    this.radar?.subscribeChat(chatId)

    try {
      await this.restoreChatInner(chatId, chat, cfg, componentHash)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.log('error', `Session restore failed for chat ${chatId}: ${message}`)
      this.radar?.notifyFixFailed({
        chatId,
        issue: { componentHash },
        error: `Session restore failed: ${message}`,
      })
    }
  }

  private makeStubIssue(chatId: string, componentHash: string, title: string, cfg: AgentConfig): Issue {
    return {
      _id: chatId,
      workspace: cfg.workspace ?? '',
      project: cfg.project ?? '',
      hash: componentHash,
      componentHash,
      title,
      resolved: false,
      archived: false,
      category: '',
      metadata: {},
      service: { serviceName: '', serviceNameSlug: '' },
    }
  }

  private async restoreChatInner(
    chatId: string,
    chat: ChatSessionPayload['chat'],
    cfg: AgentConfig,
    componentHash: string,
  ): Promise<void> {
    // Fetch the real issue from the API; fall back to a minimal stub if unavailable
    let issue: Issue
    if (componentHash && cfg.workspace && cfg.project) {
      try {
        const fetched = await this.radar!.fetchIssueByComponentHash(cfg.workspace, cfg.project, componentHash)
        issue = fetched ?? this.makeStubIssue(chatId, componentHash, chat.title ?? 'Unknown issue', cfg)
      } catch {
        issue = this.makeStubIssue(chatId, componentHash, chat.title ?? 'Unknown issue', cfg)
      }
    } else {
      issue = this.makeStubIssue(chatId, componentHash, chat.title ?? 'Unknown issue', cfg)
    }

    let apiMessages: AgentMessage[] = []
    let hasMore: boolean = false
    try {
      const res = await this.radar!.fetchMessages(cfg.workspace ?? '', cfg.project ?? '', chatId)
      apiMessages = res.messages
      hasMore = res.hasMore
    } catch {
      // Non-fatal — proceed with empty history
    }

    const history: ConversationMessage[] = apiMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Prepend context doc to history so AI has issue context on continue
    const contextAttachment = apiMessages.flatMap((m) => m.attachments ?? []).find((a) => a.type === 'context' && a.url)
    if (contextAttachment?.url) {
      try {
        const res = await fetch(contextAttachment.url)
        if (res.ok) {
          history.unshift({ role: 'user', content: await res.text() })
          this.log('info', `Context doc restored for chat ${chatId}`)
        }
      } catch {
        // Non-fatal
      }
    }

    // Try to restore worktree for a previously worked branch
    let restoredWorktreeDir: string | undefined
    let restoredBranchName: string | undefined
    if (!cfg.noGitBranch) {
      const branchName = issue.solution?.gitBranch || GitService.makeBranchName(componentHash, issue.title)
      restoredBranchName = branchName
      const worktreeDir = GitService.makeWorktreeDir(componentHash)
      try {
        const existsLocally = await GitService.branchExistsLocally(cfg.dir, branchName)
        let existsRemotely = false
        if (!existsLocally) {
          existsRemotely = await GitService.branchExistsRemotely(cfg.dir, branchName)
        }
        if (existsLocally || existsRemotely) {
          restoredWorktreeDir = await GitService.createWorktreeFromExisting(cfg.dir, worktreeDir, branchName)
          this.log('info', `Restored worktree for branch ${branchName} at ${restoredWorktreeDir}`)
        }
      } catch (err) {
        this.log('debug', `Could not restore worktree for branch ${branchName}: ${(err as Error).message}`)
      }
    }

    // Append a sentinel so the AI treats the above as read-only history and does
    // not re-execute any instructions found in it when the next user message arrives.
    if (history.length > 0) {
      history.push({ role: 'assistant', content: '[Session restored. Awaiting new instructions.]' })
    }

    this.chatContexts.set(chatId, {
      chatId,
      issue,
      history,
      abortController: new AbortController(),
      isProcessing: false,
      worktreeDir: restoredWorktreeDir,
    })

    if (componentHash) {
      const statusMap: Partial<Record<string, SessionStatus>> = {
        finished: 'done',
        aborted: 'aborted',
        processing: 'analyzing',
        streaming: 'analyzing',
        waitingForUserAction: 'pending',
        error: 'pending',
      }
      const tuiStatus = statusMap[chat.status ?? ''] ?? 'pending'

      const summary: SessionSummary = {
        chatId,
        issueId: componentHash,
        issueTitle: issue.title,
        issueService: issue.service.serviceName,
        status: tuiStatus,
        startedAt: new Date(chat.createdAt ?? Date.now()),
      }
      this.setState(addSession(this._state, summary))

      const dirs = [cfg.dir, restoredWorktreeDir].filter(Boolean) as string[]
      const sessionMessages: SessionMessage[] = apiMessages.map((m) => ({
        id: m.id ?? m._id ?? new mongoose.Types.ObjectId().toString(),
        role: m.role,
        content: m.content ? sanitizePaths(m.content, dirs) : '',
        activity: m.activity,
        agentName: m.agentName,
        attachments: m.attachments,
        toolCalls: m.toolCalls?.map((tc: AgentToolCall) => ({
          ...tc,
          input: sanitizeValue(tc.input, dirs) as Record<string, unknown>,
          output: tc.output ? (sanitizeValue(tc.output, dirs) as Record<string, unknown>) : undefined,
        })),
        createdAt: new Date(m.createdAt ?? Date.now()),
      }))

      const detail: SessionDetail = { ...summary, hasMore, messages: sessionMessages }
      this.sessionDetails.set(chatId, detail)
      this.emit('session-detail', chatId, { ...detail })
    }

    this.log('info', `Session restored: ${chatId} (${history.length} messages)`)

    // Resume or re-notify depending on how far the previous session got
    if (!cfg.noGitBranch && restoredWorktreeDir && restoredBranchName) {
      const hasChanges = await GitService.hasUncommittedChanges(restoredWorktreeDir)
      if (hasChanges) {
        // Uncommitted changes exist — complete the fix (commit, push, PR, notify)
        this.log('info', `Uncommitted changes found in restored worktree — completing fix for ${componentHash}`)
        try {
          await this.commitPushAndNotify(chatId, issue, restoredWorktreeDir, restoredBranchName)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          this.log('error', `Restore: commit/push failed: ${message}`)
          this.radar?.notifyFixFailed({ chatId, issue: { componentHash }, error: `Restore push failed: ${message}` })
        } finally {
          try {
            await GitService.removeWorktree(cfg.dir, restoredWorktreeDir)
            const ctx = this.chatContexts.get(chatId)
            if (ctx) ctx.worktreeDir = undefined
          } catch {
            /* best-effort */
          }
        }
      } else if (issue.solution?.gitBranch && !issue.solution.prUrl) {
        // Branch pushed but PR not yet created — create it now
        this.log('info', `Branch pushed but no PR — creating PR for ${componentHash}`)
        try {
          const [codeChanges, repositoryUrl] = await Promise.all([
            GitService.getDiffStats(restoredWorktreeDir),
            GitService.getRemoteUrl(restoredWorktreeDir),
          ])
          const context = this.chatContexts.get(chatId)
          const prContent = await AiService.generatePrContent(
            issue,
            context?.history ?? [],
            codeChanges,
            cfg.model,
            cfg.modelKey,
            cfg.modelUrl,
          )

          const prUrl = await PrService.createPullRequest(
            restoredWorktreeDir,
            cfg,
            issue.solution.gitBranch,
            prContent.title,
            prContent.body,
          )
          if (prUrl) {
            const prMsg = `Pull request created: [${prUrl}](${prUrl})`
            this.emitToRadar(chatId, prMsg, 'assistant', 'git')
            this.addSessionMessage(chatId, { role: 'assistant', content: prMsg, activity: 'git' })
            this.setState(upsertSession(this._state, { chatId, prUrl }))
          }
          this.radar?.emitAgentChatUpdate({
            _id: chatId,
            contextKey: issue.componentHash,
            status: 'finished',
            agentName: cfg.name,
            dir: cfg.dir,
          })
          this.radar?.notifyFixPushed({
            chatId,
            git: {
              branchName: issue.solution.gitBranch,
              branchUrl: GitService.getBranchUrl(repositoryUrl ?? '', issue.solution.gitBranch),
              prUrl: prUrl ?? undefined,
              repositoryUrl: repositoryUrl ?? '',
              codeChanges,
            },
            issue: { componentHash: issue.componentHash },
          })
        } catch (err) {
          // Non-fatal — re-emit without PR
          this.log('error', `Restore: PR creation failed: ${(err as Error).message}`)
          this.radar?.notifyFixPushed({
            chatId,
            git: {
              branchName: issue.solution.gitBranch,
              branchUrl: GitService.getBranchUrl(issue.solution.gitRepositoryUrl ?? '', issue.solution.gitBranch),
              prUrl: undefined,
              repositoryUrl: issue.solution.gitRepositoryUrl ?? '',
            },
            issue: { componentHash: issue.componentHash },
          })
        } finally {
          try {
            await GitService.removeWorktree(cfg.dir, restoredWorktreeDir)
            const ctx = this.chatContexts.get(chatId)
            if (ctx) ctx.worktreeDir = undefined
          } catch {
            /* best-effort */
          }
        }
      } else if (issue.solution?.gitBranch) {
        // Already fully fixed — re-emit so radar reflects the current state
        this.radar?.notifyFixPushed({
          chatId,
          git: {
            branchName: issue.solution.gitBranch,
            branchUrl: GitService.getBranchUrl(issue.solution.gitRepositoryUrl ?? '', issue.solution.gitBranch),
            prUrl: issue.solution.prUrl ?? undefined,
            repositoryUrl: issue.solution.gitRepositoryUrl ?? '',
          },
          issue: { componentHash: issue.componentHash },
        })
        this.log('info', `Re-emitted fix-pushed for already-fixed issue ${componentHash}`)
        try {
          await GitService.removeWorktree(cfg.dir, restoredWorktreeDir)
          const ctx = this.chatContexts.get(chatId)
          if (ctx) ctx.worktreeDir = undefined
        } catch {
          /* best-effort */
        }
      }
    } else if (issue.solution?.gitBranch) {
      // No worktree available — just re-emit if already fixed
      this.radar?.notifyFixPushed({
        chatId,
        git: {
          branchName: issue.solution.gitBranch,
          branchUrl: GitService.getBranchUrl(issue.solution.gitRepositoryUrl ?? '', issue.solution.gitBranch),
          prUrl: issue.solution.prUrl ?? undefined,
          repositoryUrl: issue.solution.gitRepositoryUrl ?? '',
        },
        issue: { componentHash: issue.componentHash },
      })
      this.log('info', `Re-emitted fix-pushed for already-fixed issue ${componentHash}`)
    }

    const queued = this.pendingMessages.get(chatId)
    if (queued?.length) {
      this.pendingMessages.delete(chatId)
      this.log('info', `Draining ${queued.length} buffered message(s) for chat ${chatId}`)
      for (const pendingMsg of queued) {
        void this.handleUserMessage(pendingMsg)
      }
    }
  }

  // ─── Issue processing ─────────────────────────────────────────────────────────

  private async processIssueFromResolvePayload(payload: ResolveIssuePayload): Promise<void> {
    const chatId = payload.chatId
    if (!chatId) {
      this.log('error', 'debugging-agent:resolve-issue: missing chatId')
      return
    }
    await this.processIssue(
      {
        chatId,
        chat: {
          _id: chatId,
          title: payload.issue.title,
          status: 'processing',
          metadata: {
            issue: { componentHash: payload.issue.componentHash },
          },
        },
      },
      { issue: payload.issue, release: payload.release },
      payload.agentSettings,
    )
  }

  private async processIssue(
    { chatId, chat }: ChatSessionPayload,
    enriched: { issue: Issue; release?: Release },
    agentSettings?: { fixabilityScoreThreshold?: number },
  ): Promise<void> {
    if (this.quitMode === 'after-current') return

    const existing = this.chatContexts.get(chatId)
    if (existing?.isProcessing) return

    const activeCount = this._state.sessions.filter((s) => !['done', 'failed', 'aborted'].includes(s.status)).length
    if (activeCount >= this._config.maxConcurrentIssues) {
      this.log('info', `Max concurrent issues reached, skipping: ${chat.title ?? chatId}`)
      return
    }

    const cfg = this._config
    const issue = enriched.issue
    const noGitBranch = cfg.noGitBranch
    const branchName = GitService.makeBranchName(issue.componentHash, issue.title)
    const worktreeDir = noGitBranch ? undefined : GitService.makeWorktreeDir(issue.componentHash)

    // Fetch any existing message history for this chat
    let apiMessages: AgentMessage[] = []
    try {
      const { messages } = await this.radar!.fetchMessages(cfg.workspace as string, cfg.project as string, chatId)
      apiMessages = messages
    } catch {
      // Non-fatal — proceed with empty history
    }

    const history: ConversationMessage[] = apiMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // If this chat already has history, it was previously processed.
    // Restore context only — do not re-run full issue resolution.
    if (history.length > 0) {
      this.log('info', `Chat ${chatId} has existing history (${history.length} messages) — restoring context only`)
      if (!this.chatContexts.has(chatId)) {
        this.chatContexts.set(chatId, {
          chatId,
          issue,
          history,
          abortController: new AbortController(),
          isProcessing: false,
        })
      }
      // Register in TUI so the session is visible with the correct status
      const summary: SessionSummary = {
        chatId,
        issueId: issue.componentHash,
        issueTitle: issue.title,
        issueService: issue.service.serviceName,
        status: 'pending',
        startedAt: new Date(),
      }
      this.setState(addSession(this._state, summary))
      this.radar?.emitAgentChatUpdate({
        _id: chatId,
        contextKey: issue.componentHash,
        status: 'processing',
        agentName: cfg.name,
        dir: cfg.dir,
      })
      return
    }

    const abortController = new AbortController()
    const context: ChatContext = {
      chatId,
      issue,
      history,
      abortController,
      isProcessing: true,
    }
    this.chatContexts.set(chatId, context)

    // Register session in state and TUI
    const summary: SessionSummary = {
      chatId,
      issueId: issue.componentHash,
      issueTitle: issue.title,
      issueService: issue.service.serviceName,
      status: 'analyzing',
      startedAt: new Date(),
    }
    this.setState(addSession(this._state, summary))
    const detail: SessionDetail = { ...summary, messages: [] }
    this.sessionDetails.set(chatId, detail)
    this.emit('session-detail', chatId, { ...detail })
    this.log('info', `New issue: ${issue.title} (chat: ${chatId})`)

    const { callbacks, state: streamState } = this.makeStreamCallbacks(chatId, () => this.getDirs(chatId), 'analyzing')

    try {
      // 1. Build context doc, upload it, analyse fixability — bail early if unfixable
      const { proceed, debugContext } = await this.prepareContextAndScore(chatId, issue, enriched, agentSettings)
      if (!proceed) return

      // 2. Set up the initial prompt (first message in history, or build from issue data)
      const issuePrompt =
        context.history[0]?.content ?? AiService.buildIssuePromptFallback(issue, enriched?.release, debugContext)
      if (context.history.length === 0) {
        context.history.push({ role: 'user', content: issuePrompt })
        this.radar?.emitAgentMessage({
          chat: chatId,
          role: 'agent',
          content: issuePrompt,
          agentName: cfg.name,
        })
        this.addSessionMessage(chatId, { role: 'agent', content: issuePrompt })
      }

      // 3. Create an isolated git worktree for this branch
      await this.setupGitWorktree(chatId, context, branchName, worktreeDir, noGitBranch)

      this.emitToRadar(chatId, 'Analyzing issue...', 'reasoning', 'analyzing')

      // 4. Run the AI to produce patches
      const patches = await AiService.resolveIssue(
        issue,
        context.worktreeDir ?? cfg.dir,
        issuePrompt,
        cfg.model,
        cfg.modelKey,
        cfg.modelUrl,
        abortController.signal,
        callbacks,
      )

      if (streamState.streamContent) {
        context.history.push({
          role: 'assistant',
          content: normalizeStreamContent(streamState.streamContent),
        })
      }

      if (abortController.signal.aborted) {
        this.setState(upsertSession(this._state, { chatId, status: 'aborted', error: 'Aborted by user' }))
        this.emit('chat-status', chatId, 'aborted')
        this.log('info', `Aborted: ${issue.title}`)
        this.radar?.emitAgentChatUpdate({
          _id: chatId,
          contextKey: issue.componentHash,
          status: 'aborted',
          agentName: cfg.name,
          dir: cfg.dir,
        })
        return
      }

      if (patches.length === 0) {
        this.setState(upsertSession(this._state, { chatId, status: 'failed', error: 'AI produced no patches' }))
        this.emit('chat-status', chatId, 'error')
        this.log('error', `No patches for: ${issue.title}`)
        this.emitToRadar(chatId, 'No patches generated for this issue.', 'error', 'analyzing')
        this.addSessionMessage(chatId, { role: 'error', content: 'No patches generated for this issue.' })
        this.radar?.emitAgentChatUpdate({
          _id: chatId,
          contextKey: issue.componentHash,
          status: 'error',
          agentName: cfg.name,
          dir: cfg.dir,
        })
        return
      }

      // 5. Dry-run mode: skip commit/push
      if (cfg.noGitBranch) {
        const effectiveBranch = await GitService.getCurrentBranch(cfg.dir)
        this.setState(upsertSession(this._state, { chatId, status: 'done', branchName: effectiveBranch }))
        this.setState(incrementResolved(this._state))
        const dryRunMsg = `Dry run: patches applied to current branch \`${effectiveBranch}\` (no commit or push)`
        this.log('info', dryRunMsg)
        this.emitToRadar(chatId, dryRunMsg, 'assistant', 'git')
        this.addSessionMessage(chatId, { role: 'assistant', content: dryRunMsg, activity: 'git' })
        return
      }

      // 6. Commit, push, create PR, notify Radar
      await this.commitPushAndNotify(chatId, issue, context.worktreeDir!, branchName)
    } catch (err: unknown) {
      const message = AiService.classifyAiError(err)
      this.setState(upsertSession(this._state, { chatId, status: 'failed', error: message }))
      this.emit('chat-status', chatId, 'error')
      this.log('error', `Failed ${issue.componentHash.slice(0, 8)}: ${message}`)
      this.emitToRadar(chatId, message, 'error')
      this.addSessionMessage(chatId, { role: 'error', content: message })
      this.radar?.emitAgentChatUpdate({
        _id: chatId,
        contextKey: issue.componentHash,
        status: 'error',
        agentName: cfg.name,
        dir: cfg.dir,
      })
      this.radar?.notifyFixFailed({ chatId, issue: { componentHash: issue.componentHash }, error: message })
    } finally {
      context.isProcessing = false
      context.abortController = null

      this.radar?.emitIssueCheck()

      const stillActive = this._state.sessions.filter((s) => !['done', 'failed', 'aborted'].includes(s.status)).length
      this.setState(setRateLimitActive(this._state, stillActive))

      if (context.worktreeDir) {
        try {
          await GitService.removeWorktree(cfg.dir, context.worktreeDir)
        } catch (err: unknown) {
          this.log('error', `Failed to remove worktree ${context.worktreeDir}: ${(err as Error).message}`)
        }
        context.worktreeDir = undefined
      }

      if ((this.quitMode as QuitMode | null) === 'after-current') {
        const remaining = this._state.sessions.filter((s) => !['done', 'failed', 'aborted'].includes(s.status)).length
        if (remaining === 0) {
          this.disconnect()
          this.emit('quit')
        }
      }
    }
  }

  /**
   * Fetches debug context, builds and uploads the context doc, and runs fixability
   * analysis. Returns `{ proceed: false }` if the issue score is too low to fix
   * automatically (caller should return early).
   */
  private async prepareContextAndScore(
    chatId: string,
    issue: Issue,
    enriched: { issue: Issue; release?: Release },
    agentSettings?: { fixabilityScoreThreshold?: number },
  ): Promise<{ proceed: boolean; debugContext?: string }> {
    const cfg = this._config
    const radar = this.radar

    try {
      const mcpConfig = { apiKey: cfg.apiKey, apiUrl: cfg.url }
      const debugResult = await AiService.fetchIssueDebugContext(issue, mcpConfig)

      if (debugResult?.debugSessionId) {
        radar?.emitAgentChatUpdate({
          _id: chatId,
          contextKey: issue.componentHash,
          agentName: cfg.name,
          dir: cfg.dir,
          metadata: {
            debugSession: {
              _id: debugResult.debugSessionId,
            },
          },
        })
      }

      const markdown = AiService.buildIssueContextDoc(issue, enriched.release, debugResult?.context)

      const attachment = await radar?.uploadContextDoc(issue.workspace, issue.project, chatId, markdown)
      if (attachment) {
        radar?.emitAgentMessage({
          chat: chatId,
          role: 'assistant',
          content: '',
          agentName: cfg.name,
          attachments: [attachment],
        })
      }

      const analysis = await AiService.analyseIssueContext(markdown, cfg.model, cfg.modelKey, cfg.modelUrl)

      const issueUpdate: Record<string, unknown> = { fixabilityScore: analysis.fixabilityScore }
      const severityMap: Record<string, number> = { high: 50, medium: 40, low: 20 }
      if (!issue.severity) {
        issueUpdate.severity = severityMap[analysis.severity] ?? 40
      }
      await radar?.bulkUpdateIssue(issue.workspace, issue.project, issue.componentHash, issueUpdate)

      const threshold = agentSettings?.fixabilityScoreThreshold
      if (threshold !== undefined && analysis.fixabilityScore < threshold) {
        const reason = `Fixability score is ${analysis.fixabilityScore}/100 (threshold: ${threshold}) — issue requires manual investigation.`
        this.log('info', reason)
        this.emitToRadar(chatId, reason, 'assistant', 'analyzing')
        this.addSessionMessage(chatId, { role: 'assistant', content: reason, activity: 'analyzing' })
        radar?.emitAgentChatUpdate({
          _id: chatId,
          contextKey: issue.componentHash,
          status: 'waitingForUserAction',
          agentName: cfg.name,
          dir: cfg.dir,
        })
        return { proceed: false }
      }

      return {
        proceed: true,
        debugContext: debugResult?.context,
      }
    } catch {
      // Context doc upload/analysis failure is non-fatal — proceed without it
      return { proceed: true }
    }
  }

  /**
   * Creates an isolated git worktree for the issue branch, or logs a dry-run
   * notice if git branching is disabled.
   */
  private async setupGitWorktree(
    chatId: string,
    context: ChatContext,
    branchName: string,
    worktreeDir: string | undefined,
    noGitBranch: boolean | undefined,
  ): Promise<void> {
    if (!noGitBranch) {
      this.log('info', `Creating git worktree for branch ${branchName}...`)
      const actualWorktreeDir = await GitService.createWorktree(this._config.dir, worktreeDir!, branchName)
      context.worktreeDir = actualWorktreeDir
      const msg = `Preparing isolated workspace for branch \`${branchName}\` in worktree \`${actualWorktreeDir.split('/').pop()}\`...`
      this.emitToRadar(chatId, msg, 'assistant', 'git')
      this.addSessionMessage(chatId, { role: 'assistant', content: msg, activity: 'git' })
    } else {
      this.log('info', 'Dry run: applying patches directly to current branch')
      const msg = 'Dry run: applying patches directly to current branch...'
      this.emitToRadar(chatId, msg, 'assistant', 'git')
      this.addSessionMessage(chatId, { role: 'assistant', content: msg, activity: 'git' })
    }
  }

  /**
   * Commits all changes, pushes the branch, creates a pull request, and notifies
   * Radar of the fix. Called after AI patches have been applied to the worktree.
   */
  private async commitPushAndNotify(chatId: string, issue: Issue, workDir: string, branchName: string): Promise<void> {
    this.setState(upsertSession(this._state, { chatId, status: 'pushing', branchName }))

    const pushMsg = `Committing and pushing branch \`${branchName}\`...`
    this.log('info', pushMsg.replace(/`/g, ''))
    this.emitToRadar(chatId, pushMsg, 'assistant', 'git')
    this.addSessionMessage(chatId, { role: 'assistant', content: pushMsg, activity: 'git' })

    const commitSha = await GitService.commitAll(
      workDir,
      `fix: resolve issue ${issue.title} (${issue.componentHash.slice(0, 8)}) - \n\nAuto-generated by multiplayer debugging agent.`,
    )
    await GitService.push(workDir, branchName)
    const [codeChanges, repositoryUrl] = await Promise.all([
      GitService.getDiffStats(workDir),
      GitService.getRemoteUrl(workDir),
    ])

    this.setState(upsertSession(this._state, { chatId, status: 'done', branchName }))
    this.setState(incrementResolved(this._state))
    this.emit('chat-status', chatId, 'finished')
    this.log(
      'info',
      `Fix pushed: ${branchName} (${commitSha.slice(0, 7)}) +${codeChanges.additions}/-${codeChanges.deletions}`,
    )

    const branchUrl = repositoryUrl ? GitService.getBranchUrl(repositoryUrl, branchName) : ''
    const pushedMsg = branchUrl
      ? `Fix pushed to branch [\`${branchName}\`](${branchUrl}) (${commitSha.slice(0, 7)})`
      : `Fix pushed to branch \`${branchName}\` (${commitSha.slice(0, 7)})`
    this.emitToRadar(chatId, pushedMsg, 'assistant', 'git')
    this.addSessionMessage(chatId, { role: 'assistant', content: pushedMsg, activity: 'git' })

    const context = this.chatContexts.get(chatId)
    const prContent = await AiService.generatePrContent(
      issue,
      context?.history ?? [],
      codeChanges ?? { additions: 0, deletions: 0 },
      this._config.model,
      this._config.modelKey,
      this._config.modelUrl,
    )

    this.emitToRadar(chatId, 'Creating pull request...', 'assistant', 'git')
    const prUrl = await PrService.createPullRequest(workDir, this._config, branchName, prContent.title, prContent.body)

    if (prUrl) {
      this.log('info', `Pull request created: ${prUrl}`)
      const prMsg = `Pull request created: [${prUrl}](${prUrl})`
      this.emitToRadar(chatId, prMsg, 'assistant', 'git')
      this.addSessionMessage(chatId, { role: 'assistant', content: prMsg, activity: 'git' })
      this.setState(upsertSession(this._state, { chatId, prUrl }))
    } else {
      const noprMsg = 'Could not create pull request automatically.'
      this.emitToRadar(chatId, noprMsg, 'assistant', 'git')
      this.addSessionMessage(chatId, { role: 'assistant', content: noprMsg, activity: 'git' })
    }

    this.radar?.emitAgentChatUpdate({
      _id: chatId,
      contextKey: issue.componentHash,
      status: 'finished',
      agentName: this._config.name,
      dir: this._config.dir,
    })
    this.radar?.notifyFixPushed({
      chatId,
      git: {
        branchName,
        branchUrl: GitService.getBranchUrl(repositoryUrl ?? '', branchName),
        prUrl: prUrl ?? undefined,
        repositoryUrl: repositoryUrl ?? '',
        ...(!prUrl ? { prTitle: prContent.title, prBody: prContent.body } : {}),
        codeChanges,
      },
      issue: { componentHash: issue.componentHash },
    })
  }

  // ─── Conversation handling ────────────────────────────────────────────────────

  private async handleUserMessage(msg: AgentMessage): Promise<void> {
    const { chat: chatId, content } = msg
    const context = this.chatContexts.get(chatId)
    if (!context) {
      this.log('info', `User message for unknown chat ${chatId}, buffering until restored`)
      const queue = this.pendingMessages.get(chatId) ?? []
      queue.push(msg)
      this.pendingMessages.set(chatId, queue)
      return
    }
    if (context.isProcessing) {
      this.log('info', `User message while processing (${chatId}), ignoring`)
      return
    }

    this.log('info', `User message in ${chatId}: ${content.slice(0, 60)}`)

    const cfg = this._config
    const dirs = this.getDirs(chatId)
    context.history.push({ role: 'user', content })

    const abortController = new AbortController()
    context.abortController = abortController
    context.isProcessing = true
    this.radar?.emitAgentChatUpdate({
      _id: chatId,
      contextKey: context.issue.componentHash,
      status: 'processing',
      agentName: cfg.name,
      dir: cfg.dir,
    })

    const { callbacks, state: streamState } = this.makeStreamCallbacks(chatId, () => dirs)

    try {
      const response = await AiService.continueChat(
        context.history,
        context.worktreeDir ?? cfg.dir,
        cfg.model,
        cfg.modelKey,
        cfg.modelUrl,
        abortController.signal,
        callbacks,
      )
      const final = normalizeStreamContent(streamState.streamContent || response)
      if (final) context.history.push({ role: 'assistant', content: final })
      const status = abortController.signal.aborted ? 'aborted' : 'finished'
      this.radar?.emitAgentChatUpdate({
        _id: chatId,
        contextKey: context.issue.componentHash,
        status,
        agentName: cfg.name,
        dir: cfg.dir,
      })
    } catch (err: unknown) {
      const message = AiService.classifyAiError(err)
      this.log('error', `Chat error (${chatId}): ${message}`)
      this.radar?.emitAgentMessage(
        sanitizeMessage(
          {
            _id: streamState.turnMsgId,
            chat: chatId,
            role: 'error',
            content: `Error: ${message}`,
            agentName: cfg.name,
          },
          dirs,
        ),
      )
      this.radar?.emitAgentChatUpdate({
        _id: chatId,
        contextKey: context.issue.componentHash,
        status: 'error',
        agentName: cfg.name,
        dir: cfg.dir,
      })
    } finally {
      context.isProcessing = false
      context.abortController = null
    }
  }

  private handleAbort({ chatId }: { chatId: string }): void {
    const context = this.chatContexts.get(chatId)
    if (!context?.isProcessing || !context.abortController) return
    this.log('info', `Aborting chat ${chatId}`)
    context.abortController.abort()
    for (const [toolCallId, resolve] of this.pendingConfirmations) {
      resolve({ approved: false, userResponse: 'Aborted by user' })
      this.pendingConfirmations.delete(toolCallId)
    }
  }

  private handleAction({
    toolCallId,
    action,
    data,
  }: {
    chatId: string
    toolCallId: string
    action: string
    data?: Record<string, unknown>
  }): void {
    const resolve = this.pendingConfirmations.get(toolCallId)
    if (!resolve) return
    this.pendingConfirmations.delete(toolCallId)
    resolve({
      approved: action === 'approve',
      userResponse: data?.userResponse as string | undefined,
    })
  }
}
