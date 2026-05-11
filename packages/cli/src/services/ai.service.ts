import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'
import cliPath from '@anthropic-ai/claude-agent-sdk/embed'
import { simpleGit } from 'simple-git'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { Issue, FilePatch, Release, ConversationMessage } from '../types/index.js'
import { MAX_FILE_SIZE, MAX_FILES_TO_READ } from '../config.js'
import { getAuthHeaders } from '../lib/authHeaders.js'
import {
  buildChatTitlePrompt,
  buildDebuggingSystemPrompt,
  ANALYSE_ISSUE_SYSTEM_PROMPT,
  buildAnalyseIssueUserMessage,
  PR_GENERATION_SYSTEM_PROMPT,
  buildPrUserMessage,
  buildIssuePromptFallback,
  buildClaudeCodeDebuggingSystemPrompt,
} from '../prompts.js'

const execAsync = promisify(exec)

export interface McpConfig {
  apiKey: string
  apiUrl: string
  authType?: 'oauth' | 'api_key'
}

// ─── Provider requirement checks ─────────────────────────────────────────────

export const checkClaudeRequirements = async (): Promise<void> => {
  try {
    await execAsync('claude --version', { timeout: 5000 })
  } catch {
    throw new Error('Claude CLI is not installed. Install it with:\n  npm install -g @anthropic-ai/claude-code')
  }

  const hasEnvKey = !!process.env.ANTHROPIC_API_KEY
  const hasConfigFile = (() => {
    try {
      return fs.existsSync(path.join(os.homedir(), '.claude.json'))
    } catch {
      return false
    }
  })()

  if (!hasEnvKey && !hasConfigFile) {
    throw new Error('Claude CLI is not authenticated. Run:\n  claude auth login')
  }
}

export const fetchAnthropicModels = async (modelKey?: string): Promise<string[]> => {
  try {
    const client = new Anthropic(modelKey ? { apiKey: modelKey } : {})
    const page = await client.models.list({ limit: 100 })
    const ids = page.data.map((m) => m.id).filter((id) => id.startsWith('claude-'))
    const idSet = new Set(ids)

    // Filter out dated snapshots: if stripping the trailing -YYYYMMDD yields another id in
    // the set, this entry is a snapshot of that model and the canonical alias already covers it.
    // Exception: models whose canonical name happens to end in a date (e.g. claude-haiku-4-5-20251001)
    // are kept because their base (e.g. claude-haiku-4-5) doesn't appear in the list.
    return ids.filter((id) => {
      const match = id.match(/^(.+)-(\d{8})$/)
      return match ? !idSet.has(match[1]!) : true
    })
  } catch {
    return []
  }
}

export const checkOpenAiRequirements = async (apiKey: string, baseUrl?: string): Promise<void> => {
  if (!apiKey) {
    throw new Error('AI API key is required for OpenAI-compatible models')
  }
  const client = new OpenAI({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  })
  try {
    await client.models.list()
  } catch (err: any) {
    const msg: string = err?.message || String(err)
    const lower = msg.toLowerCase()
    if (lower.includes('401') || lower.includes('incorrect api key') || lower.includes('invalid api key')) {
      throw new Error('Invalid AI API key — authentication failed')
    }
    throw new Error(`AI API key validation failed: ${msg}`)
  }
}

export const classifyAiError = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (
    lower.includes('rate limit') ||
    lower.includes('ratelimit') ||
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('quota') ||
    lower.includes('overloaded')
  ) {
    return `AI rate limit exceeded — please wait before retrying.\n${message}`
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('invalid api key') ||
    lower.includes('incorrect api key') ||
    lower.includes('authentication') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return `AI authentication failed — check your API key.\n${message}`
  }
  if (
    lower.includes('context_length_exceeded') ||
    lower.includes('context length') ||
    lower.includes('maximum context') ||
    lower.includes('token limit') ||
    lower.includes('too long') ||
    lower.includes('max_tokens')
  ) {
    return `AI context length exceeded — issue is too large to process.\n${message}`
  }
  if (
    lower.includes('model_not_found') ||
    lower.includes('model not found') ||
    lower.includes('no such model') ||
    lower.includes('does not exist')
  ) {
    return `AI model not found — check the model name in config.\n${message}`
  }
  if (
    lower.includes('insufficient_quota') ||
    lower.includes('billing') ||
    lower.includes('payment required') ||
    lower.includes('upgrade your plan')
  ) {
    return `AI quota or billing issue — check your API account.\n${message}`
  }
  if (
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('enotfound') ||
    lower.includes('fetch failed') ||
    lower.includes('network error')
  ) {
    return `Network error connecting to AI service.\n${message}`
  }
  if (lower.includes('claude code process exited with code')) {
    const codeMatch = message.match(/code (\d+)/)
    const code = codeMatch?.[1] ?? '1'
    if (code === '1') return 'Claude Code exited unexpectedly (exit code 1). This usually means Claude Code is not authenticated or has a configuration error. Run `claude` in your terminal to check.'
    if (code === '127') return 'Claude Code binary not found (exit code 127). Make sure `claude` is installed and available in PATH.'
    return `Claude Code process exited with code ${code}.`
  }
  if (lower.includes('claude code executable not found') || lower.includes('claude code native binary not found')) {
    return 'Claude Code executable not found. Make sure `claude` is installed and available in PATH.'
  }
  if (lower.includes('claude code process aborted')) {
    return 'Claude Code process was aborted.'
  }

  return message
}

export type ProgressCallback = (data: string) => void

export type ToolCallCallback = (toolCall: { id: string; name: string; input: Record<string, unknown> }) => void

export type ToolCallResultCallback = (result: {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'succeeded' | 'failed'
  output?: Record<string, unknown>
}) => void

export type TurnStartCallback = () => void

// Called before executing a tool that requires user approval.
// Return { approved: true } to proceed, { approved: false } to reject (rejection message is fed back to the AI).
export type ConfirmToolCallFn = (
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>
) => Promise<{ approved: boolean; userResponse?: string }>

// Bundles all streaming/progress callbacks to avoid long parameter lists
export interface StreamCallbacks {
  onProgress?: ProgressCallback
  onToolCall?: ToolCallCallback
  onToolCallResult?: ToolCallResultCallback
  onTurnStart?: TurnStartCallback
  confirmToolCall?: ConfirmToolCallFn
}

// Tools that must pause and wait for user confirmation before execution
const CONFIRM_REQUIRED_TOOLS = new Set(['write_patch'])

export const generateChatTitle = async (
  issue: Issue,
  model: string,
  modelKey: string,
  modelUrl?: string,
): Promise<string> => {
  const prompt = buildChatTitlePrompt(issue)

  try {
    if (model === 'claude-code' || isAnthropicModel(model)) {
      const claudeModel = model === 'claude-code' ? undefined : model
      return (await runClaudeCodePrompt(prompt, claudeModel)).trim() || issue.title
    } else {
      const client = new OpenAI({
        apiKey: modelKey,
        ...(modelUrl ? { baseURL: modelUrl } : {}),
      })
      const response = await client.chat.completions.create({
        model,
        max_tokens: 64,
        messages: [{ role: 'user', content: prompt }],
      })
      return response.choices[0]?.message?.content?.trim() ?? issue.title
    }
  } catch {
    return `[${issue.service.serviceName}] ${issue.title}`
  }
}

const isAnthropicModel = (model: string): boolean => model.startsWith('claude') && model !== 'claude-code'


const findSpanById = (traces: unknown[], targetSpanId: string): any => {
  for (const item of traces as any[]) {
    // Flat ITraceData format (from API)
    if (item.SpanId === targetSpanId) return item
    // OTLP nested format (from S3)
    const scopeSpans = item.scopeSpans ?? item.scope_spans ?? []
    for (const scope of scopeSpans) {
      for (const span of scope.spans ?? []) {
        const sid = span.spanId ?? span.span_id
        if (sid === targetSpanId) return span
      }
    }
  }
  return undefined
}

export const fetchIssueDebugContext = async (
  issue: Issue,
  mcpConfig: McpConfig,
): Promise<{ context: string; debugSessionId: string } | undefined> => {
  try {
    const listUrl = new URL(
      `/v0/radar/workspaces/${issue.workspace}/projects/${issue.project}/debug-sessions`,
      mcpConfig.apiUrl,
    )
    listUrl.searchParams.set('issueComponentHash', issue.componentHash)
    listUrl.searchParams.set('limit', '1')
    listUrl.searchParams.set('sortKey', 'createdAt')
    listUrl.searchParams.set('sortDirection', '-1')
    const listRes = await fetch(listUrl.toString(), {
      headers: getAuthHeaders(mcpConfig.apiKey, mcpConfig.authType),
    })
    if (!listRes.ok) return undefined
    const listData = (await listRes.json()) as any
    const debugSession = listData.data?.[0]
    if (!debugSession) return undefined

    // Find the span ID for this specific issue in the session
    const sessionIssue = (debugSession.issues as any[] | undefined)?.find(
      (i: any) => i.issueComponentHash === issue.componentHash,
    )
    const targetSpanId = sessionIssue?.spanId as string | undefined

    let traces: unknown[] = []
    let logs: unknown[] = []

    if (debugSession.finishedS3Transfer && Array.isArray(debugSession.s3Files)) {
      const tracesFile = (debugSession.s3Files as any[]).find((f: any) => f.dataType === 'OTLP_TRACES')
      const logsFile = (debugSession.s3Files as any[]).find((f: any) => f.dataType === 'OTLP_LOGS')
      const [tracesData, logsData] = await Promise.all([
        tracesFile?.url ? fetch(tracesFile.url).then((r: any) => (r.ok ? r.json() : [])) : Promise.resolve([]),
        logsFile?.url ? fetch(logsFile.url).then((r: any) => (r.ok ? r.json() : [])) : Promise.resolve([]),
      ])
      traces = Array.isArray(tracesData) ? tracesData : (tracesData?.data ?? [])
      logs = Array.isArray(logsData) ? logsData : (logsData?.data ?? [])
    } else {
      const tracesUrl = new URL(
        `/v0/radar/workspaces/${issue.workspace}/projects/${issue.project}/debug-sessions/${debugSession._id}/otel-traces`,
        mcpConfig.apiUrl,
      )
      tracesUrl.searchParams.set('skip', '0')
      tracesUrl.searchParams.set('limit', '300')
      const logsUrl = new URL(
        `/v0/radar/workspaces/${issue.workspace}/projects/${issue.project}/debug-sessions/${debugSession._id}/otel-logs`,
        mcpConfig.apiUrl,
      )
      logsUrl.searchParams.set('skip', '0')
      logsUrl.searchParams.set('limit', '300')
      const [tracesRes, logsRes] = await Promise.all([
        fetch(tracesUrl.toString(), {
          headers: getAuthHeaders(mcpConfig.apiKey, mcpConfig.authType),
        }),
        fetch(logsUrl.toString(), {
          headers: getAuthHeaders(mcpConfig.apiKey, mcpConfig.authType),
        }),
      ])
      traces = tracesRes.ok ? ((await tracesRes.json()) as any).data : []
      logs = logsRes.ok ? ((await logsRes.json()) as any).data : []
    }

    const issueSpan = targetSpanId ? findSpanById(traces, targetSpanId) : undefined

    return {
      context: JSON.stringify({ sessionId: debugSession._id, issueSpan, traces, logs }),
      debugSessionId: debugSession._id,
    }
  } catch {
    return undefined
  }
}

export interface IssueAnalysis {
  fixabilityScore: number
  severity: 'high' | 'medium' | 'low'
}

export const analyseIssueContext = async (
  markdown: string,
  model: string,
  modelKey: string,
  modelUrl?: string,
): Promise<IssueAnalysis> => {
  const systemPrompt = ANALYSE_ISSUE_SYSTEM_PROMPT
  const userMessage = buildAnalyseIssueUserMessage(markdown)

  try {
    if (model === 'claude-code' || isAnthropicModel(model)) {
      const claudeModel = model === 'claude-code' ? undefined : model
      const text = await runClaudeCodePrompt(`${systemPrompt}\n\n${userMessage}`, claudeModel)
      return JSON.parse(text) as IssueAnalysis
    }

    const openai = new OpenAI({
      apiKey: modelKey,
      ...(modelUrl ? { baseURL: modelUrl } : {}),
    })
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 100,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })
    const text = response.choices[0]?.message?.content ?? ''
    return JSON.parse(text) as IssueAnalysis
  } catch {
    // Fall back to a conservative default so the agent still runs
    return {
      fixabilityScore: 70,
      severity: 'medium',
    }
  }
}

interface SpanData {
  operation?: string
  service?: string
  attributes: Record<string, any>
  exception?: { type?: string; message?: string; stacktrace?: string }
}

const extractSpanData = (span: any): SpanData => {
  // Flat ITraceData format (from API — uppercase field names)
  if (span.SpanId) {
    const attributes: Record<string, any> = (span.SpanAttributes as Record<string, any> | undefined) ?? {}
    let exception: SpanData['exception']
    const eventNames = (span['Events.Name'] as string[] | undefined) ?? []
    const eventAttrs = (span['Events.Attributes'] as Record<string, any>[] | undefined) ?? []
    for (let i = 0; i < eventNames.length; i++) {
      if (eventNames[i] === 'exception') {
        const ea = eventAttrs[i] ?? {}
        exception = {
          type: ea['exception.type'],
          message: ea['exception.message'],
          stacktrace: ea['exception.stacktrace'],
        }
        break
      }
    }
    return { operation: span.SpanName, service: span.ServiceName, attributes, exception }
  }

  // OTLP format (from S3 — camelCase nested)
  const attributes: Record<string, any> = {}
  for (const kv of span.attributes ?? []) {
    if (kv.key) attributes[kv.key] = kv.value?.stringValue ?? kv.value?.intValue ?? kv.value
  }
  let exception: SpanData['exception']
  for (const event of span.events ?? []) {
    if (event.name === 'exception') {
      const evAttrs: Record<string, any> = {}
      for (const kv of event.attributes ?? []) {
        if (kv.key) evAttrs[kv.key] = kv.value?.stringValue ?? kv.value?.intValue ?? kv.value
      }
      exception = {
        type: evAttrs['exception.type'],
        message: evAttrs['exception.message'],
        stacktrace: evAttrs['exception.stacktrace'],
      }
      break
    }
  }
  return { operation: span.name, attributes, exception }
}

const SPAN_ATTR_SKIP = new Set([
  'multiplayer.project._id',
  'multiplayer.workspace._id',
  'multiplayer.debug_session._id',
  'multiplayer.integration._id',
])


export const buildIssueContextDoc = (
  issue: Issue,
  release: Release | undefined,
  debugContext: string | undefined,
): string => {
  // Extract span data upfront so we can use it throughout the document
  let parsedCtx: { sessionId?: string; issueSpan?: any; traces?: any[]; logs?: any[] } | undefined
  let spanData: SpanData | undefined
  if (debugContext) {
    try {
      parsedCtx = JSON.parse(debugContext)
      if (parsedCtx?.issueSpan) spanData = extractSpanData(parsedCtx.issueSpan)
    } catch {
      // non-parseable — proceed without span data
    }
  }

  // Prefer span exception data over normalized issue metadata
  const effectiveType = spanData?.exception?.type ?? issue.metadata.type
  const effectiveMessage = spanData?.exception?.message ?? issue.metadata.message
  const effectiveStacktrace = spanData?.exception?.stacktrace ?? issue.metadata.stacktrace

  const lines: string[] = [
    `# Issue: ${issue.title}`,
    '',
    `**Component Hash:** \`${issue.componentHash}\``,
    `**Category:** ${issue.category}`,
    `**Service:** ${issue.service.serviceName}`,
  ]

  if (issue.service.environment) {
    lines.push(`**Environment:** ${issue.service.environment}`)
  }
  if (issue.service.release) {
    lines.push(`**Release Version:** ${issue.service.release}`)
  }

  if (release) {
    lines.push('', '## Release')
    lines.push(`**Version:** ${release.version}`)
    if (release.commitHash) lines.push(`**Commit:** \`${release.commitHash}\``)
    if (release.repositoryUrl) lines.push(`**Repository:** ${release.repositoryUrl}`)
    if (release.releaseNotes) lines.push('', '**Release Notes:**', release.releaseNotes)
  }

  if (effectiveMessage || effectiveType || issue.metadata.filename || issue.metadata.function || issue.metadata.httpMethod) {
    lines.push('', '## Error Details')
    if (effectiveMessage) lines.push(`**Message:** ${effectiveMessage}`)
    if (effectiveType) lines.push(`**Type:** ${effectiveType}`)
    if (issue.metadata.filename) lines.push(`**File:** ${issue.metadata.filename}`)
    if (issue.metadata.function) lines.push(`**Function:** ${issue.metadata.function}`)
    if (issue.metadata.httpMethod && issue.metadata.httpRoute) {
      lines.push(`**HTTP:** ${issue.metadata.httpMethod} ${issue.metadata.httpRoute}`)
    }
    if (issue.metadata.value) lines.push(`**Value:** ${issue.metadata.value}`)
  }

  if (effectiveStacktrace) {
    const label = spanData?.exception?.stacktrace ? '## Stacktrace (from span)' : '## Stacktrace'
    lines.push('', label, '```', effectiveStacktrace, '```')
  }

  if (parsedCtx) {
    lines.push('', '## Debug Session')
    if (parsedCtx.sessionId) lines.push(`**Session ID:** \`${parsedCtx.sessionId}\``)

    if (spanData) {
      lines.push('', '### Issue Span')
      if (spanData.operation) lines.push(`**Operation:** ${spanData.operation}`)
      if (spanData.service) lines.push(`**Service:** ${spanData.service}`)

      // Span attributes — skip internal multiplayer fields and already-shown exception fields
      const attrEntries = Object.entries(spanData.attributes).filter(
        ([k, v]) => v != null && v !== '' && !SPAN_ATTR_SKIP.has(k) && !k.startsWith('exception.'),
      )
      if (attrEntries.length > 0) {
        lines.push('', '**Span Attributes:**')
        for (const [k, v] of attrEntries) {
          lines.push(`- \`${k}\`: ${String(v).slice(0, 500)}`)
        }
      }

      if (spanData.exception) {
        if (spanData.exception.type) lines.push(`**Exception Type:** ${spanData.exception.type}`)
        if (spanData.exception.message) lines.push(`**Exception Message:** ${spanData.exception.message}`)
      }
    }


    if (Array.isArray(parsedCtx.logs) && parsedCtx.logs.length > 0) {
      lines.push('', `### Logs (${parsedCtx.logs.length} entries)`)
      const logLines: string[] = []
      const collectLogs = (items: any[]) => {
        for (const item of items) {
          const scopeLogs = item.scopeLogs ?? item.scope_logs ?? []
          for (const scope of scopeLogs) {
            for (const record of scope.logRecords ?? scope.log_records ?? []) {
              const severity = record.severityText ?? record.severity_text ?? ''
              const body = record.body?.stringValue ?? record.body?.string_value ?? record.body ?? ''
              if (body) logLines.push(`- **[${severity}]** ${String(body).slice(0, 200)}`)
            }
          }
        }
      }
      collectLogs(parsedCtx.logs)
      lines.push(...logLines.slice(0, 30))
      if (logLines.length > 30) lines.push(`  … and ${logLines.length - 30} more log entries`)
    }

    if (Array.isArray(parsedCtx.traces) && parsedCtx.traces.length > 0) {
      lines.push('', '### Raw OTLP Spans', '```json', JSON.stringify(parsedCtx.traces, null, 2), '```')
    }

    if (Array.isArray(parsedCtx.logs) && parsedCtx.logs.length > 0) {
      lines.push('', '### Raw OTLP Logs', '```json', JSON.stringify(parsedCtx.logs, null, 2), '```')
    }
  }

  lines.push('', '---', '*Generated by multiplayer debugging agent*')

  const markdown = lines.join('\n')

  return markdown
}

export { buildIssuePromptFallback }

const readFileSafe = (projectDir: string, filePath: string): string => {
  try {
    const resolved = path.resolve(projectDir, filePath)
    // Security: ensure the resolved path is within the project directory
    if (!resolved.startsWith(path.resolve(projectDir))) {
      return 'Error: Access denied - path outside project directory'
    }
    if (!fs.existsSync(resolved)) {
      return `Error: File not found: ${filePath}`
    }
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(resolved).slice(0, 50)
      return `Directory contents:\n${entries.join('\n')}`
    }
    const content = fs.readFileSync(resolved, 'utf-8')
    if (content.length > MAX_FILE_SIZE) {
      return content.slice(0, MAX_FILE_SIZE) + `\n\n[... truncated at ${MAX_FILE_SIZE} chars ...]`
    }
    return content
  } catch (err: any) {
    return `Error reading file: ${err.message}`
  }
}

const applyPatches = (projectDir: string, patches: FilePatch[]): void => {
  for (const patch of patches) {
    const resolved = path.resolve(projectDir, patch.filePath)
    if (!resolved.startsWith(path.resolve(projectDir))) {
      throw new Error(`Security: patch path ${patch.filePath} is outside project directory`)
    }
    const dir = path.dirname(resolved)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(resolved, patch.newContent, 'utf-8')
  }
}

const openAiTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the content of a file or directory in the project',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path from the project root',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_patch',
      description: 'Write the final list of file patches to fix the issue',
      parameters: {
        type: 'object',
        properties: {
          patches: {
            type: 'array',
            description: 'List of file patches',
            items: {
              type: 'object',
              properties: {
                filePath: { type: 'string' },
                newContent: { type: 'string' },
              },
              required: ['filePath', 'newContent'],
            },
          },
        },
        required: ['patches'],
      },
    },
  },
]

// ─── Shared Claude Code stream processing ─────────────────────────────────────

type PendingToolCall = { id: string; name: string; inputJson: string }
type RunningToolCall = { name: string; input: Record<string, unknown> }

/**
 * Processes a user message from the Claude SDK, extracting tool results and
 * firing the onToolCallResult callback for any completed tool calls.
 */
const processClaudeToolResults = (
  msg: any,
  callbacks: StreamCallbacks,
  runningToolCalls: Map<string, RunningToolCall>,
): void => {
  if (msg.type !== 'user' || !callbacks.onToolCallResult || !Array.isArray(msg.message?.content)) return

  for (const block of msg.message.content) {
    if (block.type !== 'tool_result') continue
    const id = block.tool_use_id as string
    const data = runningToolCalls.get(id)
    if (!data) continue

    const outputContent = Array.isArray(block.content)
      ? block.content.map((c: any) => c.text ?? '').join('')
      : typeof block.content === 'string'
        ? block.content
        : ''

    callbacks.onToolCallResult({
      id,
      ...data,
      status: block.is_error ? 'failed' : 'succeeded',
      output: { content: outputContent },
    })
    runningToolCalls.delete(id)
  }
}

/**
 * Processes a single stream_event from the Claude SDK, updating streaming state
 * and firing progress/tool callbacks. Pass onText to accumulate assistant text.
 */
const processClaudeStreamEvent = (
  event: any,
  callbacks: StreamCallbacks,
  pendingToolCallRef: { current: PendingToolCall | null },
  runningToolCalls: Map<string, RunningToolCall>,
  onText?: (text: string) => void,
): void => {
  if (event.type === 'message_start') {
    callbacks.onTurnStart?.()
    // Flush any tool calls that never received a dedicated tool_result message
    if (callbacks.onToolCallResult) {
      for (const [id, data] of runningToolCalls) {
        callbacks.onToolCallResult({ id, ...data, status: 'succeeded' })
      }
      runningToolCalls.clear()
    }
  } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
    if (callbacks.onToolCall || callbacks.onToolCallResult) {
      pendingToolCallRef.current = {
        id: event.content_block.id,
        name: event.content_block.name,
        inputJson: '',
      }
    }
  } else if (event.type === 'content_block_delta') {
    if (event.delta?.type === 'text_delta') {
      callbacks.onProgress?.(event.delta.text)
      onText?.(event.delta.text)
    } else if (event.delta?.type === 'input_json_delta' && pendingToolCallRef.current) {
      pendingToolCallRef.current.inputJson += event.delta.partial_json ?? ''
    }
  } else if (event.type === 'content_block_stop' && pendingToolCallRef.current) {
    let input: Record<string, unknown>
    try {
      input = pendingToolCallRef.current.inputJson ? JSON.parse(pendingToolCallRef.current.inputJson) : {}
    } catch {
      input = {}
    }
    callbacks.onToolCall?.({
      id: pendingToolCallRef.current.id,
      name: pendingToolCallRef.current.name,
      input,
    })
    if (callbacks.onToolCallResult) {
      runningToolCalls.set(pendingToolCallRef.current.id, {
        name: pendingToolCallRef.current.name,
        input,
      })
    }
    pendingToolCallRef.current = null
  }
}

// ─── OpenAI tool loop ─────────────────────────────────────────────────────────

const runOpenAiLoop = async (
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  projectDir: string,
  abortSignal: AbortSignal | undefined,
  callbacks: StreamCallbacks,
  handleExtraTool?: (name: string, input: Record<string, unknown>) => Promise<string>,
): Promise<{ patches: FilePatch[]; finalContent: string }> => {
  const { onProgress, onToolCall, onToolCallResult, onTurnStart, confirmToolCall } = callbacks
  let filesRead = 0
  let patches: FilePatch[] = []
  let finalContent = ''

  for (let i = 0; i < 20; i++) {
    if (abortSignal?.aborted) {
      onProgress?.('aborted')
      break
    }

    onTurnStart?.()
    onProgress?.(`Thinking (turn ${i + 1})...`)

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: openAiTools,
      tool_choice: 'auto',
    })

    const choice = response.choices[0]
    if (!choice) break

    if (choice.message.content) {
      finalContent += choice.message.content
      onProgress?.(choice.message.content)
    }

    messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)

    if (choice.finish_reason === 'stop') {
      break
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== 'function') continue
        let result: string
        let toolInput: Record<string, unknown> = {}
        let toolStatus: 'succeeded' | 'failed' = 'succeeded'

        if (toolCall.function.name === 'read_file') {
          toolInput = JSON.parse(toolCall.function.arguments) as {
            path: string
          }
          onProgress?.(`[read] ${(toolInput as { path: string }).path}`)
          onToolCall?.({
            id: toolCall.id,
            name: toolCall.function.name,
            input: toolInput,
          })
          filesRead++
          result =
            filesRead <= MAX_FILES_TO_READ
              ? readFileSafe(projectDir, (toolInput as { path: string }).path)
              : 'Error: Maximum file reads reached'
          if (result.startsWith('Error:')) toolStatus = 'failed'
        } else if (toolCall.function.name === 'write_patch') {
          toolInput = JSON.parse(toolCall.function.arguments) as {
            patches: FilePatch[]
          }
          onToolCall?.({
            id: toolCall.id,
            name: toolCall.function.name,
            input: toolInput,
          })

          if (confirmToolCall && CONFIRM_REQUIRED_TOOLS.has('write_patch')) {
            onProgress?.('[patch] Waiting for user confirmation...')
            const { approved, userResponse } = await confirmToolCall(toolCall.id, 'write_patch', toolInput)
            if (!approved) {
              result = userResponse ?? 'Patch rejected by user'
              toolStatus = 'failed'
            } else {
              patches = (toolInput as { patches: FilePatch[] }).patches
              onProgress?.(`[patch] Writing ${patches.length} file(s)`)
              result = `Patches recorded: ${patches.length} file(s)`
            }
          } else {
            patches = (toolInput as { patches: FilePatch[] }).patches
            onProgress?.(`[patch] Writing ${patches.length} file(s)`)
            result = `Patches recorded: ${patches.length} file(s)`
          }
        } else if (handleExtraTool) {
          toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
          onToolCall?.({
            id: toolCall.id,
            name: toolCall.function.name,
            input: toolInput,
          })
          onProgress?.(`[${toolCall.function.name}] fetching...`)
          try {
            result = await handleExtraTool(toolCall.function.name, toolInput)
          } catch (err: any) {
            result = `Error: ${err.message}`
            toolStatus = 'failed'
          }
        } else {
          toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
          onToolCall?.({
            id: toolCall.id,
            name: toolCall.function.name,
            input: toolInput,
          })
          result = `Unknown tool: ${toolCall.function.name}`
          toolStatus = 'failed'
        }

        onToolCallResult?.({
          id: toolCall.id,
          name: toolCall.function.name,
          input: toolInput,
          status: toolStatus,
          output: { content: result },
        })

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }

      if (patches.length > 0) {
        break
      }
    }
  }

  return { patches, finalContent }
}

// ─── OpenAI-compatible implementation ────────────────────────────────────────

const resolveIssueWithOpenAI = async (
  _issue: Issue,
  projectDir: string,
  prompt: string,
  model: string,
  apiKey: string,
  baseUrl: string | undefined,
  abortSignal: AbortSignal | undefined,
  callbacks: StreamCallbacks,
): Promise<FilePatch[]> => {
  const client = new OpenAI({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  })

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildDebuggingSystemPrompt() },
    { role: 'user', content: prompt },
  ]

  const { patches } = await runOpenAiLoop(client, model, messages, projectDir, abortSignal, callbacks)
  return patches
}

// ─── Claude Code implementation ───────────────────────────────────────────────

const runClaudeCodePrompt = async (prompt: string, model?: string): Promise<string> => {
  let text = ''
  for await (const message of query({
    prompt,
    options: {
      cwd: process.cwd(),
      executable: 'node',
      pathToClaudeCodeExecutable: cliPath,
      permissionMode: 'acceptEdits',
      settingSources: [],
      maxTurns: 1,
      ...(model ? { model } : {}),
    },
  })) {
    const msg = message as any
    if (msg.type === 'result' && msg.subtype === 'success') {
      text = msg.result ?? ''
    }
  }
  return text
}

const resolveIssueWithClaudeCode = async (
  _issue: Issue,
  projectDir: string,
  prompt: string,
  model: string | undefined,
  abortSignal: AbortSignal | undefined,
  callbacks: StreamCallbacks,
): Promise<FilePatch[]> => {
  const absProjectDir = path.resolve(projectDir)
  const git = simpleGit(absProjectDir)

  const pendingToolCall: { current: PendingToolCall | null } = {
    current: null,
  }
  const runningToolCalls = new Map<string, RunningToolCall>()

  callbacks.onProgress?.(`[claude] starting (cwd=${absProjectDir}, cli=${cliPath})`)

  // Replace OpenAI-path patch language with direct-edit instructions for Claude Code
  const claudePrompt = prompt
    .replace(
      /please analyze this issue and produce file patches to fix it\. read relevant source files based on the stacktrace and error details above\./gi,
      'Fix the issue by directly editing the relevant source files using the Edit or Write tools. Read the relevant source files based on the stacktrace and error details above, then apply the fix.',
    )

  for await (const message of query({
    prompt: claudePrompt,
    options: {
      cwd: absProjectDir,
      executable: 'node',
      pathToClaudeCodeExecutable: cliPath,
      permissionMode: 'acceptEdits',
      settingSources: [],
      settings: {
        claudeMdExcludes: ['**'],
        permissions: {
          allow: ['Bash(*)'],
        },
      },
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: buildClaudeCodeDebuggingSystemPrompt(absProjectDir),
      },
      maxTurns: 1000,
      includePartialMessages: !!(callbacks.onProgress || callbacks.onToolCall),
      ...(model ? { model } : {}),
      stderr: (data: string) => {
        const line = data.trim()
        if (line) callbacks.onProgress?.(`[claude stderr] ${line}`)
      },
    },
  })) {
    if (abortSignal?.aborted) {
      callbacks.onProgress?.('[aborted]')
      break
    }

    const msg = message as any

    processClaudeToolResults(msg, callbacks, runningToolCalls)

    if (msg.type === 'stream_event') {
      processClaudeStreamEvent(msg.event, callbacks, pendingToolCall, runningToolCalls)
    } else if (callbacks.onProgress) {
      if (msg.type === 'tool_progress') {
        callbacks.onProgress(`[${msg.tool_name}] ${msg.elapsed_time_seconds.toFixed(1)}s...`)
      } else if (msg.type === 'system' && msg.subtype === 'task_progress') {
        callbacks.onProgress(msg.description)
      } else if (msg.type === 'result') {
        callbacks.onProgress(msg.subtype)
      }
    }

    if (message.type === 'result' && message.subtype !== 'success') {
      const msg = message as any
      const errors: string[] = msg.errors ?? []
      const detail = errors.length > 0 ? `\n${errors.join('\n')}` : ''
      const subtypeLabel: Record<string, string> = {
        error_during_execution: 'Error during execution',
        error_max_turns: 'Max turns reached',
        error_max_budget_usd: 'Budget limit exceeded',
        error_max_structured_output_retries: 'Structured output retries exceeded',
      }
      const label = subtypeLabel[msg.subtype] ?? msg.subtype
      throw new Error(`Claude Code process exited: ${label}${detail}`)
    }
  }

  if (abortSignal?.aborted) return []

  const status = await git.status()
  const changedFiles = [...status.modified, ...status.created, ...status.not_added]

  return changedFiles.map((filePath) => ({
    filePath,
    newContent: fs.readFileSync(path.resolve(absProjectDir, filePath), 'utf-8'),
  }))
}

// ─── Continue chat (multi-turn) ───────────────────────────────────────────────

const continueChatWithOpenAI = async (
  history: ConversationMessage[],
  projectDir: string,
  model: string,
  apiKey: string,
  baseUrl: string | undefined,
  abortSignal: AbortSignal | undefined,
  callbacks: StreamCallbacks,
): Promise<string> => {
  const client = new OpenAI({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  })

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildDebuggingSystemPrompt() },
    ...history.map(
      (m) =>
        ({
          role: m.role,
          content: m.content,
        }) as OpenAI.Chat.ChatCompletionMessageParam,
    ),
  ]

  const { finalContent } = await runOpenAiLoop(client, model, messages, projectDir, abortSignal, callbacks)
  return finalContent
}

const continueChatWithClaudeCode = async (
  history: ConversationMessage[],
  projectDir: string,
  model: string | undefined,
  abortSignal: AbortSignal | undefined,
  callbacks: StreamCallbacks,
): Promise<string> => {
  if (!history.length) {
    throw new Error('EMPTY_HISTORY')
  }
  const contextLines = history.slice(0, -1).map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`)
  const lastMessage = history[history.length - 1]

  const prompt =
    contextLines.length > 0
      ? `<conversation_history>\n${contextLines.join('\n\n')}\n</conversation_history>\n\n${lastMessage?.content}`
      : (lastMessage?.content as string)

  let response = ''
  const pendingToolCall: { current: PendingToolCall | null } = {
    current: null,
  }
  const runningToolCalls = new Map<string, RunningToolCall>()

  for await (const message of query({
    prompt,
    options: {
      cwd: projectDir,
      executable: 'node',
      pathToClaudeCodeExecutable: cliPath,
      permissionMode: 'bypassPermissions',
      systemPrompt: buildDebuggingSystemPrompt(projectDir),
      maxTurns: 250,
      includePartialMessages: !!(callbacks.onProgress || callbacks.onToolCall || callbacks.onToolCallResult),
      ...(model ? { model } : {}),
      stderr: (data: string) => {
        const line = data.trim()
        if (line) callbacks.onProgress?.(`[claude stderr] ${line}`)
      },
    },
  })) {
    if (abortSignal?.aborted) {
      callbacks.onProgress?.('[aborted]')
      break
    }

    const msg = message as any

    processClaudeToolResults(msg, callbacks, runningToolCalls)

    if (msg.type === 'stream_event') {
      processClaudeStreamEvent(msg.event, callbacks, pendingToolCall, runningToolCalls, (text) => {
        response += text
      })
    } else if (msg.type === 'result') {
      callbacks.onProgress?.('')
    }
  }

  return response
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const resolveIssue = async (
  issue: Issue,
  projectDir: string,
  prompt: string,
  model: string,
  modelKey: string,
  modelUrl: string | undefined,
  abortSignal: AbortSignal | undefined,
  callbacks: StreamCallbacks,
): Promise<FilePatch[]> => {
  if (model === 'claude-code' || isAnthropicModel(model)) {
    // Claude Code SDK handles tool execution internally — confirmation dialogs are not supported
    const claudeModel = model === 'claude-code' ? undefined : model
    return resolveIssueWithClaudeCode(issue, projectDir, prompt, claudeModel, abortSignal, callbacks)
  }

  const patches = await resolveIssueWithOpenAI(
    issue,
    projectDir,
    prompt,
    model,
    modelKey,
    modelUrl,
    abortSignal,
    callbacks,
  )

  if (patches.length > 0) {
    applyPatches(projectDir, patches)
  }

  return patches
}

export const generatePrContent = async (
  issue: Issue,
  history: ConversationMessage[],
  diffStats: { additions: number; deletions: number },
  model: string,
  modelKey?: string,
  modelUrl?: string,
): Promise<{ title: string; body: string }> => {
  const systemPrompt = PR_GENERATION_SYSTEM_PROMPT

  const conversationContext = history
    .map((m) => `[${m.role}]: ${m.content}`)
    .join('\n\n')
    .slice(0, 4000)

  const userMessage = buildPrUserMessage(issue, conversationContext, diffStats)

  try {
    let text: string
    if (model === 'claude-code' || isAnthropicModel(model)) {
      const claudeModel = model === 'claude-code' ? undefined : model
      text = await runClaudeCodePrompt(`${systemPrompt}\n\n${userMessage}`, claudeModel)
    } else {
      const openai = new OpenAI({
        apiKey: modelKey,
        ...(modelUrl ? { baseURL: modelUrl } : {}),
      })
      const response = await openai.chat.completions.create({
        model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      })
      text = response.choices[0]?.message?.content ?? ''
    }
    const match = text.match(/\{[\s\S]*\}/)

    if (match) {
      const parsed = JSON.parse(match[0]) as { title?: string; body?: string }
      if (parsed.title && parsed.body) {
        return { title: parsed.title, body: parsed.body }
      }
    }
  } catch {
    // Fall through to default
  }

  return {
    title: `fix: ${issue.title}`,
    body: `Fixes issue \`${issue.componentHash}\`.
    \n\nChanges: +${diffStats.additions}/-${diffStats.deletions} lines.
    [issue](${issue.url})
    `,
  }
}

export const continueChat = async (
  history: ConversationMessage[],
  projectDir: string,
  model: string,
  modelKey: string,
  modelUrl: string | undefined,
  abortSignal: AbortSignal | undefined,
  callbacks: StreamCallbacks,
): Promise<string> => {
  if (model === 'claude-code' || isAnthropicModel(model)) {
    const claudeModel = model === 'claude-code' ? undefined : model
    return continueChatWithClaudeCode(history, projectDir, claudeModel, abortSignal, callbacks)
  }
  return continueChatWithOpenAI(history, projectDir, model, modelKey, modelUrl, abortSignal, callbacks)
}
