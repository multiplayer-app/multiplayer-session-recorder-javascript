import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'
import cliPath from '@anthropic-ai/claude-agent-sdk/embed'
import crypto from 'crypto'
import type { DetectedStack, SdkRelevance } from './detectStacks.js'
import { getReadmeContent } from './readmes.js'
import { createApiService, type ApiServiceAuth } from '../services/api.service.js'
import {
  PLANNER_SYSTEM_PROMPT,
  PLANNER_DISALLOWED_TOOLS,
  buildSetupPrompt,
  buildClassifyPrompt,
  getSdkSummary,
  type SetupGenerationContext
} from '../prompts.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AiDetectionResult {
  /** What the AI actually found (may differ from heuristic) */
  framework: string
  /** Existing instrumentation found */
  existingSetup: {
    hasOpenTelemetry: boolean
    hasMultiplayerSdk: boolean
    /** Specific OTel packages found (e.g. @opentelemetry/sdk-trace-node) */
    otelPackages: string[]
    /** Existing OTel config file if found */
    otelConfigFile?: string
    /** Existing OTLP exporter endpoint if found (e.g. http://localhost:4318, https://otel.datadog.com) */
    existingOtlpEndpoint?: string
  }
  /** What integration approach the AI recommends */
  approach: 'full-sdk' | 'exporter-only' | 'already-complete' | 'minimal-patch'
  /** Why this approach was chosen */
  reasoning: string
}

export interface SetupPlan {
  /** AI detection results */
  detection: AiDetectionResult
  /** Human-readable summary of what will be done */
  summary: string
  /** Install command to run, or empty string if nothing to install */
  installCommand: string
  /** Files to create or modify, with their content */
  fileChanges: Array<{
    filePath: string
    action: 'create' | 'modify'
    description: string
    content: string
  }>
  /** Environment variables to add */
  envVars: Array<{
    name: string
    value: string
    description: string
  }>
  /** Ordered steps to apply/verify this setup. */
  steps: string[]
  /** Potential risks or manual follow-ups the user should review. */
  warnings: string[]
  /** AI confidence from 0-1 based on available context. */
  confidence: number
}

export interface SetupResult {
  success: boolean
  plan: SetupPlan | null
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isAnthropicModel = (model: string): boolean => model.startsWith('claude')

export type ProgressFn = (status: string) => void

function describeAssistantBlock(block: any): string | null {
  if (!block) return null
  if (block.type === 'text' && typeof block.text === 'string') {
    const line = block.text
      .split('\n')
      .map((l: string) => l.trim())
      .find(Boolean)
    return line ? line.slice(0, 140) : null
  }
  if (block.type === 'tool_use') {
    const name = block.name as string | undefined
    const input = (block.input ?? {}) as Record<string, any>
    switch (name) {
      case 'Read':
        return input.file_path ? `Reading ${path.basename(String(input.file_path))}` : 'Reading file'
      case 'Glob':
        return input.pattern ? `Searching files: ${input.pattern}` : 'Searching files'
      case 'Grep':
        return input.pattern ? `Searching code: ${input.pattern}` : 'Searching code'
      case 'Bash':
        return (
          input.description ?? (input.command ? `Running: ${String(input.command).slice(0, 80)}` : 'Running command')
        )
      case 'Write':
        return input.file_path ? `Writing ${path.basename(String(input.file_path))}` : 'Writing file'
      case 'Edit':
        return input.file_path ? `Editing ${path.basename(String(input.file_path))}` : 'Editing file'
      default:
        return name ? `Running ${name}` : null
    }
  }
  return null
}

/**
 * Ceiling for the setup-plan response. Backend plans (OTel init file + modified
 * entry + .env) are much larger than frontend plans and were occasionally
 * truncated at 8192, producing unparseable JSON.
 */
const SETUP_PLAN_MAX_TOKENS = 16384

async function generateWithClaudeCli(
  prompt: string,
  model: string,
  cwd: string,
  onProgress?: ProgressFn
): Promise<string> {
  let responseText = ''

  for await (const message of query({
    prompt,
    options: {
      cwd,
      executable: 'node',
      pathToClaudeCodeExecutable: cliPath,
      permissionMode: 'bypassPermissions',
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      disallowedTools: PLANNER_DISALLOWED_TOOLS,
      maxTurns: 250,
      includePartialMessages: true,
      ...(model ? { model } : {})
    }
  })) {
    const msg = message as any
    if (msg.type === 'stream_event') {
      const event = msg.event
      if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        responseText += event.delta.text ?? ''
      }
    } else if (msg.type === 'assistant' && onProgress && Array.isArray(msg.message?.content)) {
      for (const block of msg.message.content) {
        const status = describeAssistantBlock(block)
        if (status) onProgress(status)
      }
    } else if (msg.type === 'result' && msg.subtype !== 'success') {
      throw new Error(`Claude Code process exited: ${msg.subtype}`)
    }
  }

  if (!responseText.trim()) {
    throw new Error('Claude Code returned an empty response')
  }

  return responseText
}

/**
 * Build a compact preview of an AI response for error messages. Keeps head
 * and tail so both the intro narration and the (usually broken) ending are
 * visible without dumping thousands of chars into the terminal.
 */
function buildResponsePreview(text: string, max = 300): string {
  const trimmed = text.trim()
  if (!trimmed) return '(empty)'
  if (trimmed.length <= max * 2 + 16) return trimmed
  const omitted = trimmed.length - max * 2
  return `${trimmed.slice(0, max)}\n…[${omitted} chars omitted]…\n${trimmed.slice(-max)}`
}

/**
 * Scan `text` for balanced JSON spans delimited by `open`/`close`. Respects
 * string literals so braces inside `"…"` don't break matching.
 * Returns candidates in the order they appear.
 */
function findBalancedJsonSpans(text: string, open: '{' | '[', close: '}' | ']'): string[] {
  const results: string[] = []
  let depth = 0
  let startIdx = -1
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (c === '\\') {
        escape = true
      } else if (c === '"') {
        inString = false
      }
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === open) {
      if (depth === 0) startIdx = i
      depth++
    } else if (c === close && depth > 0) {
      depth--
      if (depth === 0 && startIdx >= 0) {
        results.push(text.slice(startIdx, i + 1))
        startIdx = -1
      }
    }
  }
  return results
}

/**
 * Extract a JSON value from an AI response. Tolerates markdown fences, leading
 * narration, and multiple `{…}` spans by picking the LAST candidate that
 * actually parses. Returns a typed value on success or a preview on failure.
 */
function extractJson<T>(
  text: string,
  shape: 'object' | 'array'
): { ok: true; value: T } | { ok: false; preview: string } {
  const [open, close]: ['{' | '[', '}' | ']'] = shape === 'object' ? ['{', '}'] : ['[', ']']

  // 1. Last fenced code block — most reliable when present.
  const fenceRe = /```(?:json)?\s*\n?([\s\S]*?)```/g
  let lastFence: string | null = null
  let fenceMatch: RegExpExecArray | null
  while ((fenceMatch = fenceRe.exec(text)) !== null) {
    const inner = fenceMatch[1]
    if (inner !== undefined) lastFence = inner.trim()
  }
  if (lastFence && lastFence.startsWith(open)) {
    try {
      return { ok: true, value: JSON.parse(lastFence) as T }
    } catch {
      /* fall through to balanced scan */
    }
  }

  // 2. Balanced JSON candidates — try the last one first since the plan is
  //    normally the tail of the response.
  const candidates = findBalancedJsonSpans(text, open, close)
  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i]
    if (candidate === undefined) continue
    try {
      return { ok: true, value: JSON.parse(candidate) as T }
    } catch {
      /* try next */
    }
  }

  return { ok: false, preview: buildResponsePreview(text) }
}

function readFilesSafe(root: string, relativePaths: string[]): string {
  const parts: string[] = []
  for (const rel of relativePaths) {
    const abs = path.join(root, rel)
    try {
      if (fs.existsSync(abs)) {
        const content = fs.readFileSync(abs, 'utf-8')
        if (content.length < 50_000) {
          parts.push(`--- ${rel} ---\n${content}`)
        }
      }
    } catch {
      /* skip unreadable */
    }
  }
  return parts.join('\n\n')
}

function addUnique(files: string[], filePath: string): void {
  if (!files.includes(filePath)) files.push(filePath)
}

function addEnvFiles(files: string[], root: string): void {
  const conventionalEnvFiles = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.production',
    '.env.production.local',
    '.env.test',
    '.env.test.local',
    '.env.example',
    '.env.local.example'
  ]

  for (const file of conventionalEnvFiles) addUnique(files, file)

  try {
    for (const entry of fs.readdirSync(root)) {
      if (entry === '.env' || entry.startsWith('.env.')) addUnique(files, entry)
    }
  } catch {
    /* skip unreadable directories */
  }
}

/** Gather key project files for AI context — broad enough for AI to detect what's really going on */
function gatherProjectContext(stack: DetectedStack): string {
  const files: string[] = ['package.json', 'tsconfig.json']

  // Common entry points for all JS/TS projects
  files.push(
    'src/main.tsx',
    'src/main.ts',
    'src/main.jsx',
    'src/main.js',
    'src/index.tsx',
    'src/index.ts',
    'src/index.jsx',
    'src/index.js',
    'src/App.tsx',
    'src/App.vue',
    'src/App.jsx',
    'src/server.ts',
    'src/app.ts',
    'server.ts',
    'index.ts',
    'app.ts',
    'index.js',
    'server.js',
    'app.js'
  )

  // Framework-specific files
  switch (stack.framework) {
    case 'next':
      files.push(
        'next.config.js',
        'next.config.ts',
        'next.config.mjs',
        'src/app/layout.tsx',
        'src/app/layout.jsx',
        'app/layout.tsx',
        'app/layout.jsx',
        'src/pages/_app.tsx',
        'src/pages/_app.jsx',
        'pages/_app.tsx',
        'pages/_app.jsx',
        'src/instrumentation-client.ts',
        'src/instrumentation-client.js',
        'instrumentation-client.ts',
        'instrumentation-client.js',
        'src/instrumentation.ts',
        'src/instrumentation.js',
        'instrumentation.ts',
        'instrumentation.js'
      )
      break
    case 'angular':
      files.push('angular.json', 'src/app/app.config.ts', 'src/app/app.module.ts', 'src/app/app.component.ts')
      break
    case 'vue':
    case 'nuxt':
      files.push('vite.config.ts', 'vite.config.js', 'nuxt.config.ts', 'app.vue')
      break
    case 'react-native':
    case 'expo':
      files.push('app.json', 'App.tsx', 'App.jsx', 'app/_layout.tsx', 'app/_layout.jsx')
      break
    default:
      break
  }

  // OpenTelemetry config files (critical for backend detection)
  files.push(
    'src/opentelemetry.ts',
    'src/opentelemetry.js',
    'src/tracing.ts',
    'src/tracing.js',
    'src/instrumentation.ts',
    'src/instrumentation.js',
    'opentelemetry.ts',
    'opentelemetry.js',
    'tracing.ts',
    'tracing.js',
    'otel-collector-config.yaml',
    'otel-collector-config.yml'
  )

  // Env files. Include stack-specific variants so the planner can choose the
  // file this framework actually loads instead of guessing between .env files.
  addEnvFiles(files, stack.root)

  // Docker/compose files (may reveal OTel collector setup)
  files.push('docker-compose.yml', 'docker-compose.yaml', 'Dockerfile')

  return readFilesSafe(stack.root, files)
}

// ─── Build prompt ────────────────────────────────────────────────────────────

// Prompt builders are in ../prompts.ts — edit that file to tune AI behaviour.

function normalizePlan(plan: Partial<SetupPlan>): SetupPlan {
  return {
    detection: {
      framework: plan.detection?.framework ?? 'unknown',
      existingSetup: {
        hasOpenTelemetry: plan.detection?.existingSetup?.hasOpenTelemetry ?? false,
        hasMultiplayerSdk: plan.detection?.existingSetup?.hasMultiplayerSdk ?? false,
        otelPackages: plan.detection?.existingSetup?.otelPackages ?? [],
        otelConfigFile: plan.detection?.existingSetup?.otelConfigFile ?? undefined,
        existingOtlpEndpoint: plan.detection?.existingSetup?.existingOtlpEndpoint ?? undefined
      },
      approach: plan.detection?.approach ?? 'minimal-patch',
      reasoning: plan.detection?.reasoning ?? 'No reasoning provided'
    },
    summary: plan.summary ?? 'No summary provided',
    installCommand: plan.installCommand ?? '',
    fileChanges: Array.isArray(plan.fileChanges) ? plan.fileChanges : [],
    envVars: Array.isArray(plan.envVars) ? plan.envVars : [],
    steps: Array.isArray(plan.steps) ? plan.steps : [],
    warnings: Array.isArray(plan.warnings) ? plan.warnings : [],
    confidence: typeof plan.confidence === 'number' ? Math.max(0, Math.min(1, plan.confidence)) : 0.7
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isEnvFilePath(filePath: string): boolean {
  return path.basename(filePath).startsWith('.env')
}

function isExampleEnvFilePath(filePath: string): boolean {
  return path.basename(filePath).includes('example')
}

function containsApiKeyPlaceholder(content: string): boolean {
  return API_KEY_PLACEHOLDERS.some((placeholder) => content.includes(placeholder))
}

function envFileDefinesPlaceholder(content: string, name: string): boolean {
  const placeholderPattern = `(?:${API_KEY_PLACEHOLDERS.map(escapeRegExp).join('|')})`
  const assignment = new RegExp(
    `(^|\\n)\\s*(?:export\\s+)?${escapeRegExp(name)}\\s*=\\s*(["']?)[^\\n"']*${placeholderPattern}[^\\n"']*\\2`,
    'm'
  )
  return assignment.test(content)
}

function isSdkApiKeyEnvVarName(name: string): boolean {
  return name.includes('MULTIPLAYER_SDK_API_KEY')
}

function isOtelHeadersEnvVarName(name: string): boolean {
  return /^OTEL_EXPORTER_OTLP(?:_(?:TRACES|LOGS))?_HEADERS$/.test(name)
}

function isReservedCliApiKeyEnvVarName(name: string): boolean {
  return name.includes('MULTIPLAYER_API_KEY') && !isSdkApiKeyEnvVarName(name)
}

function validateSetupPlanEnv(plan: SetupPlan): string[] {
  const errors: string[] = []
  const apiKeyEnvVars = plan.envVars.filter(
    (envVar) =>
      (isSdkApiKeyEnvVarName(envVar.name) ||
        isReservedCliApiKeyEnvVarName(envVar.name) ||
        isOtelHeadersEnvVarName(envVar.name)) &&
      containsApiKeyPlaceholder(envVar.value)
  )

  for (const envVar of apiKeyEnvVars) {
    if (isReservedCliApiKeyEnvVarName(envVar.name)) {
      errors.push(
        `AI plan uses ${envVar.name}, but MULTIPLAYER_API_KEY is reserved for the CLI. Use MULTIPLAYER_SDK_API_KEY with any framework-required public prefix instead.`
      )
      continue
    }

    if (isOtelHeadersEnvVarName(envVar.name) && !/^Authorization=/.test(envVar.value)) {
      errors.push(
        `AI plan defines ${envVar.name} with an API key placeholder, but OpenTelemetry header env vars must use Authorization=YOUR_MULTIPLAYER_API_KEY.`
      )
      continue
    }

    const runtimeEnvChange = plan.fileChanges.find(
      (change) =>
        isEnvFilePath(change.filePath) &&
        !isExampleEnvFilePath(change.filePath) &&
        envFileDefinesPlaceholder(change.content, envVar.name)
    )
    const exampleEnvChange = plan.fileChanges.find(
      (change) =>
        isEnvFilePath(change.filePath) &&
        isExampleEnvFilePath(change.filePath) &&
        envFileDefinesPlaceholder(change.content, envVar.name)
    )

    if (!runtimeEnvChange) {
      const exampleHint = exampleEnvChange
        ? ' It only appears in an example env file, which the app will not load at runtime.'
        : ''
      errors.push(
        `AI plan defines ${envVar.name} but does not write ${envVar.name}=YOUR_MULTIPLAYER_API_KEY to a runtime .env file.${exampleHint}`
      )
    }
  }

  for (const change of plan.fileChanges) {
    if (!isEnvFilePath(change.filePath) && containsApiKeyPlaceholder(change.content)) {
      errors.push(
        `AI plan places YOUR_MULTIPLAYER_API_KEY in ${change.filePath}. The placeholder must only be written to runtime .env files so generated keys are not injected into source code.`
      )
    }
  }

  return errors
}

function validateSetupPlanLanguage(plan: SetupPlan, stack: DetectedStack): string[] {
  if (stack.language !== 'javascript') return []

  const createdTypeScriptFiles = plan.fileChanges
    .filter((change) => change.action === 'create' && /\.(ts|tsx)$/.test(change.filePath))
    .map((change) => change.filePath)

  if (createdTypeScriptFiles.length === 0) return []

  return [
    `AI plan creates TypeScript files for a JavaScript stack: ${createdTypeScriptFiles.join(', ')}. Use .js/.jsx files and JavaScript syntax instead.`
  ]
}

function packageHasDependency(root: string, dependencyName: string): boolean {
  try {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }

    return Boolean(
      pkgJson.dependencies?.[dependencyName] ||
      pkgJson.devDependencies?.[dependencyName] ||
      pkgJson.optionalDependencies?.[dependencyName] ||
      pkgJson.peerDependencies?.[dependencyName]
    )
  } catch {
    return false
  }
}

function validateSetupPlanDependencies(plan: SetupPlan, stack: DetectedStack): string[] {
  const usesDotenv = plan.fileChanges.some((change) =>
    /(?:from\s+['"]dotenv['"]|require\(['"]dotenv['"]\)|['"]dotenv\/config['"])/.test(change.content)
  )

  if (!usesDotenv || packageHasDependency(stack.root, 'dotenv') || /\bdotenv\b/.test(plan.installCommand)) {
    return []
  }

  return [
    'AI plan loads dotenv but does not install it. Add dotenv to the installCommand or reuse an existing env loader instead.'
  ]
}

// ─── Stack classification with AI ───────────────────────────────────────────

interface StackClassification {
  /** The relativePath of the stack (used to match back) */
  relativePath: string
  /** AI-determined relevance */
  sdkRelevance: SdkRelevance
  /** Human-readable reason */
  reason: string
}

interface ClassifyResult {
  success: boolean
  classifications: StackClassification[]
  error?: string
}

/**
 * Use AI to classify which detected stacks actually need the Multiplayer SDK.
 * Analyzes monorepo relationships, package purposes, and dependency graphs.
 */
export async function classifyStacksWithAi(
  stacks: DetectedStack[],
  projectDir: string,
  model: string,
  modelKey: string,
  modelUrl?: string,
  onProgress?: ProgressFn
): Promise<ClassifyResult> {
  if (stacks.length === 0) return { success: true, classifications: [] }

  const sdkSummary = getSdkSummary()
  const prompt = buildClassifyPrompt(stacks, sdkSummary)

  try {
    let responseText: string

    if (isAnthropicModel(model)) {
      if (modelKey) {
        const client = new Anthropic({ apiKey: modelKey })
        const response = await client.messages.create({
          model: model === 'claude-code' ? 'claude-sonnet-4-6' : model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        })
        const block = response.content[0]
        responseText = block?.type === 'text' ? block.text : ''
      } else {
        responseText = await generateWithClaudeCli(prompt, model, projectDir, onProgress)
      }
    } else {
      const client = new OpenAI({
        apiKey: modelKey,
        ...(modelUrl ? { baseURL: modelUrl } : {})
      })
      const response = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
      responseText = response.choices[0]?.message?.content ?? ''
    }

    const extracted = extractJson<StackClassification[]>(responseText, 'array')
    if (!extracted.ok) {
      return {
        success: false,
        classifications: [],
        error: `AI did not return a parseable JSON array.\nResponse preview:\n${extracted.preview}`
      }
    }
    const parsed = extracted.value
    if (!Array.isArray(parsed)) {
      return { success: false, classifications: [], error: 'AI response is not an array' }
    }

    // Validate and normalize
    const validRelevances = new Set<SdkRelevance>(['needed', 'installed', 'not-needed', 'covered-by-dependency'])
    const classifications: StackClassification[] = parsed.map((c) => ({
      relativePath: String(c.relativePath ?? ''),
      sdkRelevance: validRelevances.has(c.sdkRelevance) ? c.sdkRelevance : 'needed',
      reason: String(c.reason ?? 'No reason provided')
    }))

    return { success: true, classifications }
  } catch (err: unknown) {
    return {
      success: false,
      classifications: [],
      error: (err as Error).message
    }
  }
}

/**
 * Apply AI classifications back to the detected stacks (mutates in place).
 */
export function applyClassifications(stacks: DetectedStack[], classifications: StackClassification[]): void {
  const classMap = new Map(classifications.map((c) => [c.relativePath, c]))
  for (const stack of stacks) {
    const classification = classMap.get(stack.relativePath)
    if (classification) {
      stack.sdkRelevance = classification.sdkRelevance
      stack.sdkRelevanceReason = classification.reason
    } else {
      // Fallback: use heuristic
      stack.sdkRelevance = stack.alreadyInstalled ? 'installed' : 'needed'
      stack.sdkRelevanceReason = stack.alreadyInstalled ? 'SDK found in dependencies' : 'No AI classification available'
    }
  }
}

// ─── AI call ─────────────────────────────────────────────────────────────────

/**
 * Use the AI model to analyze a detected stack and generate a setup plan.
 * The AI performs deeper detection (existing OTel, existing SDK, integration patterns)
 * beyond what heuristics can do, then generates the appropriate integration code.
 */
export async function generateSetupPlan(
  stack: DetectedStack,
  model: string,
  modelKey: string,
  modelUrl?: string,
  onProgress?: ProgressFn,
  ctx?: SetupGenerationContext
): Promise<SetupResult> {
  const readme = getReadmeContent(stack.sdkPackage, stack.framework)
  const projectContext = gatherProjectContext(stack)
  const prompt = buildSetupPrompt(stack, readme, projectContext, ctx)

  try {
    let responseText: string
    let truncated = false

    if (isAnthropicModel(model)) {
      if (modelKey) {
        const client = new Anthropic({ apiKey: modelKey })
        const response = await client.messages.create({
          model: model === 'claude-code' ? 'claude-sonnet-4-6' : model,
          max_tokens: SETUP_PLAN_MAX_TOKENS,
          messages: [{ role: 'user', content: prompt }]
        })
        const block = response.content[0]
        responseText = block?.type === 'text' ? block.text : ''
        truncated = response.stop_reason === 'max_tokens'
      } else {
        responseText = await generateWithClaudeCli(prompt, model, stack.root, onProgress)
      }
    } else {
      const client = new OpenAI({
        apiKey: modelKey,
        ...(modelUrl ? { baseURL: modelUrl } : {})
      })
      const response = await client.chat.completions.create({
        model,
        max_tokens: SETUP_PLAN_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      })
      responseText = response.choices[0]?.message?.content ?? ''
      truncated = response.choices[0]?.finish_reason === 'length'
    }

    const extracted = extractJson<Partial<SetupPlan>>(responseText, 'object')
    if (!extracted.ok) {
      const reason = truncated
        ? `AI response was truncated at ${SETUP_PLAN_MAX_TOKENS} tokens before a complete JSON plan was emitted.`
        : 'AI did not return a parseable JSON plan.'
      return {
        success: false,
        plan: null,
        error: `${reason}\nResponse preview:\n${extracted.preview}`
      }
    }

    const plan = normalizePlan(extracted.value)
    const envValidationErrors = validateSetupPlanEnv(plan)
    if (envValidationErrors.length > 0) {
      return {
        success: false,
        plan: null,
        error: `AI returned an invalid env-var setup plan:\n${envValidationErrors.map((e) => `- ${e}`).join('\n')}`
      }
    }

    const languageValidationErrors = validateSetupPlanLanguage(plan, stack)
    if (languageValidationErrors.length > 0) {
      return {
        success: false,
        plan: null,
        error: `AI returned an invalid language setup plan:\n${languageValidationErrors.map((e) => `- ${e}`).join('\n')}`
      }
    }

    const dependencyValidationErrors = validateSetupPlanDependencies(plan, stack)
    if (dependencyValidationErrors.length > 0) {
      return {
        success: false,
        plan: null,
        error: `AI returned an invalid dependency setup plan:\n${dependencyValidationErrors.map((e) => `- ${e}`).join('\n')}`
      }
    }

    return { success: true, plan }
  } catch (err: unknown) {
    return {
      success: false,
      plan: null,
      error: (err as Error).message
    }
  }
}

/**
 * Apply a setup plan to the filesystem.
 * Returns list of files that were written.
 */
export function applySetupPlan(plan: SetupPlan, projectRoot: string): string[] {
  const written: string[] = []
  for (const change of plan.fileChanges) {
    const absPath = path.join(projectRoot, change.filePath)
    const dir = path.dirname(absPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(absPath, change.content, 'utf-8')
    written.push(change.filePath)
  }
  return written
}

// ─── API key creation ───────────────────────────────────────────────────────

/** Generate a short random suffix for unique integration names */
function randomSuffix(): string {
  return crypto.randomBytes(3).toString('hex') // e.g. "a1b2c3"
}

/**
 * Placeholder tokens the AI is instructed to use in place of the real API key.
 * These MUST be specific enough not to collide with legitimate identifiers —
 * e.g. bare `MULTIPLAYER_SDK_API_KEY` is a substring of `VITE_MULTIPLAYER_SDK_API_KEY`,
 * which mangled env-var references in generated code.
 */
const API_KEY_PLACEHOLDERS = [
  'YOUR_MULTIPLAYER_API_KEY',
  'your-api-key-here',
  'your_api_key_here',
  '<MULTIPLAYER_SDK_API_KEY>',
  '<MULTIPLAYER_API_KEY>'
]

function replaceApiKeyPlaceholders(value: string, apiKey: string): string {
  let next = value
  for (const placeholder of API_KEY_PLACEHOLDERS) {
    next = next.replaceAll(placeholder, apiKey)
  }
  return next
}

export interface CreatedApiKey {
  name: string
  apiKey: string
  stackType: 'frontend' | 'backend'
}

/**
 * Create Multiplayer OTEL integration API keys for the stacks that need setup.
 * Creates separate keys for frontend and backend stacks.
 */
export async function createApiKeysForSetup(
  stacks: DetectedStack[],
  auth: ApiServiceAuth & { workspace: string; project: string }
): Promise<{ keys: CreatedApiKey[]; errors: string[] }> {
  const api = createApiService(auth)
  const keys: CreatedApiKey[] = []
  const errors: string[] = []

  const needsFrontendKey = stacks.some(
    (s) => s.sdkRelevance === 'needed' && (s.type === 'frontend' || s.type === 'fullstack' || s.type === 'mobile')
  )
  const needsBackendKey = stacks.some((s) => s.sdkRelevance === 'needed' && s.type === 'backend')

  const suffix = randomSuffix()

  if (needsFrontendKey) {
    try {
      const integration = await api.createIntegration(
        auth.workspace,
        auth.project,
        `session-recorder-frontend-${suffix}`
      )
      keys.push({
        name: integration.name,
        apiKey: integration.otel.apiKey,
        stackType: 'frontend'
      })
    } catch (err: unknown) {
      errors.push(`Failed to create frontend API key: ${(err as Error).message}`)
    }
  }

  if (needsBackendKey) {
    try {
      const integration = await api.createIntegration(
        auth.workspace,
        auth.project,
        `session-recorder-backend-${suffix}`
      )
      keys.push({
        name: integration.name,
        apiKey: integration.otel.apiKey,
        stackType: 'backend'
      })
    } catch (err: unknown) {
      errors.push(`Failed to create backend API key: ${(err as Error).message}`)
    }
  }

  return { keys, errors }
}

/**
 * Inject real API keys into a setup plan, replacing placeholder values
 * in envVars and fileChanges content.
 */
export function injectApiKeysIntoPlan(plan: SetupPlan, keys: CreatedApiKey[], stackType: DetectedStack['type']): void {
  // Pick the right key for this stack type
  const key =
    stackType === 'backend' ? keys.find((k) => k.stackType === 'backend') : keys.find((k) => k.stackType === 'frontend')

  if (!key) return

  // Replace in envVars
  for (const envVar of plan.envVars) {
    if (API_KEY_PLACEHOLDERS.some((p) => envVar.value === p || envVar.value.includes(p))) {
      envVar.value = replaceApiKeyPlaceholders(envVar.value, key.apiKey)
    }
  }

  // Replace in fileChanges content
  for (const change of plan.fileChanges) {
    change.content = replaceApiKeyPlaceholders(change.content, key.apiKey)
  }
}
