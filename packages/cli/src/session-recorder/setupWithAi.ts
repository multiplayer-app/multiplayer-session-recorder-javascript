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

async function generateWithClaudeCli(prompt: string, model: string, cwd: string): Promise<string> {
  let responseText = ''

  for await (const message of query({
    prompt,
    options: {
      cwd,
      executable: 'node',
      pathToClaudeCodeExecutable: cliPath,
      permissionMode: 'bypassPermissions',
      maxTurns: 3,
      includePartialMessages: true,
      ...(model ? { model } : {}),
    },
  })) {
    const msg = message as any
    if (msg.type === 'stream_event') {
      const event = msg.event
      if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        responseText += event.delta.text ?? ''
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
    } catch { /* skip unreadable */ }
  }
  return parts.join('\n\n')
}

/** Gather key project files for AI context — broad enough for AI to detect what's really going on */
function gatherProjectContext(stack: DetectedStack): string {
  const files: string[] = ['package.json', 'tsconfig.json']

  // Common entry points for all JS/TS projects
  files.push(
    'src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js',
    'src/index.tsx', 'src/index.ts', 'src/index.jsx', 'src/index.js',
    'src/App.tsx', 'src/App.vue', 'src/App.jsx',
    'src/server.ts', 'src/app.ts', 'server.ts', 'index.ts', 'app.ts',
    'index.js', 'server.js', 'app.js',
  )

  // Framework-specific files
  switch (stack.framework) {
    case 'next':
      files.push('next.config.js', 'next.config.ts', 'next.config.mjs',
        'src/app/layout.tsx', 'app/layout.tsx',
        'src/pages/_app.tsx', 'pages/_app.tsx',
        'src/instrumentation-client.ts', 'instrumentation-client.ts',
        'src/instrumentation.ts', 'instrumentation.ts')
      break
    case 'angular':
      files.push('angular.json', 'src/app/app.config.ts',
        'src/app/app.module.ts', 'src/app/app.component.ts')
      break
    case 'vue':
    case 'nuxt':
      files.push('vite.config.ts', 'vite.config.js', 'nuxt.config.ts', 'app.vue')
      break
    case 'react-native':
    case 'expo':
      files.push('app.json', 'App.tsx', 'App.jsx', 'app/_layout.tsx')
      break
    default:
      break
  }

  // OpenTelemetry config files (critical for backend detection)
  files.push(
    'src/opentelemetry.ts', 'src/opentelemetry.js',
    'src/tracing.ts', 'src/tracing.js',
    'src/instrumentation.ts', 'src/instrumentation.js',
    'opentelemetry.ts', 'opentelemetry.js',
    'tracing.ts', 'tracing.js',
    'otel-collector-config.yaml', 'otel-collector-config.yml',
  )

  // Env files
  files.push('.env', '.env.example', '.env.local')

  // Docker/compose files (may reveal OTel collector setup)
  files.push('docker-compose.yml', 'docker-compose.yaml', 'Dockerfile')

  return readFilesSafe(stack.root, files)
}

// ─── Build prompt ────────────────────────────────────────────────────────────

function buildSetupPrompt(stack: DetectedStack, readme: string, projectContext: string): string {
  const installedNote = stack.alreadyInstalled
    ? `- NOTE: A Multiplayer SDK is already installed: ${stack.installedSdkPackage}`
    : ''

  return `You are an expert at integrating the Multiplayer Session Recorder SDK.

## Your Task

First ANALYZE the project to understand what's already set up, then generate a setup plan.

## Heuristic Detection (may be incomplete — verify by reading the actual files)
- Framework guess: ${stack.framework}
- Type guess: ${stack.type}
- Recommended SDK: ${stack.sdkPackage}
- Package manager: ${stack.packageManager}
- Language: ${stack.language}
${installedNote}

## Integration Guide (README)
${readme}

## Current Project Files
${projectContext}

## Response Format

Return ONLY a JSON object (no markdown fences, no explanation outside JSON) with this exact structure:

{
  "detection": {
    "framework": "what you actually detected (e.g. 'next-app-router', 'express-with-otel', 'react-vite')",
    "existingSetup": {
      "hasOpenTelemetry": false,
      "hasMultiplayerSdk": false,
      "otelPackages": [],
      "otelConfigFile": null,
      "existingOtlpEndpoint": "the current OTLP endpoint if found (e.g. http://localhost:4318), or null"
    },
    "approach": "full-sdk | exporter-only | already-complete | minimal-patch",
    "reasoning": "Brief explanation of why this approach"
  },
  "summary": "Brief description of what will be done",
  "installCommand": "exact install command, or empty string",
  "fileChanges": [
    {
      "filePath": "relative/path/to/file",
      "action": "create | modify",
      "description": "what this change does",
      "content": "full file content after changes"
    }
  ],
  "envVars": [
    {
      "name": "MULTIPLAYER_API_KEY",
      "value": "your-api-key-here",
      "description": "description"
    }
  ],
  "steps": [
    "Step 1",
    "Step 2"
  ],
  "warnings": [
    "Any caveat that needs user attention"
  ],
  "confidence": 0.85
}

## Integration Approach Rules

1. **If OpenTelemetry is already configured** (e.g. @opentelemetry/sdk-trace-node, @opentelemetry/sdk-trace-web):
   - Check if the OTLP exporter is already pointing to otlp.multiplayer.app (in code, env vars, or OTel collector config)
   - If OTel + Multiplayer endpoint already configured: approach "already-complete" — no SDK package needed
   - If OTel exists but exporter points to a DIFFERENT endpoint (e.g. Datadog, Jaeger, custom collector): approach "exporter-only"
     - Do NOT replace the existing exporter — the user needs their current telemetry pipeline
     - ADD a second OTLP exporter alongside the existing one, pointing to Multiplayer:
       - Traces: https://otlp.multiplayer.app/v1/traces
       - Logs: https://otlp.multiplayer.app/v1/logs
     - Use a CompositeSpanExporter (or multiple exporters in the TracerProvider) so both the existing and Multiplayer exporters run in parallel
     - The Multiplayer exporter needs an authorization header: \`Authorization: Bearer <MULTIPLAYER_API_KEY>\`
     - Add MULTIPLAYER_API_KEY to envVars
     - If the project uses an OTel Collector: add a second OTLP exporter in the collector config pipelines instead of modifying app code
   - Standard OTel OTLP exporters are sufficient — no Multiplayer SDK package, ID generator, or exporter needed for backends

2. **If Multiplayer SDK is already installed** (any @multiplayer-app/session-recorder-* package):
   - Check if it's actually initialized in the code
   - If initialized: approach "already-complete", empty installCommand, no fileChanges
   - If installed but not initialized: approach "minimal-patch", add full init code with all features below

3. **If nothing is set up** (most common case):
   - Use approach "full-sdk"
   - Install the recommended SDK package
   - Follow the README integration guide
   - Generate a PRODUCTION-GRADE integration, not a minimal stub — include ALL applicable features listed below

## Production-Grade Integration Checklist

Generate code that includes ALL applicable features for the detected stack. Do NOT generate a bare-minimum init() call.

### For React / Browser frontends (@multiplayer-app/session-recorder-react or session-recorder-browser):

**Core init with full options:**
- \`application\` — from package.json name
- \`version\` — from package.json version
- \`environment\` — from env var (e.g. NEXT_PUBLIC_ENVIRONMENT or VITE_ENVIRONMENT)
- \`apiKey\` — from env var (NEXT_PUBLIC_MULTIPLAYER_API_KEY or VITE_MULTIPLAYER_API_KEY)
- \`showWidget: true\` — enable the built-in recording widget
- \`showContinuousRecording: true\` — enable continuous recording mode option

**Exception capture — ALWAYS include:**
- \`SessionRecorder.captureException(error)\` integrated into the app's error handling
- For React: wrap the app with \`<ErrorBoundary>\` from the SDK (import { ErrorBoundary } from '@multiplayer-app/session-recorder-react')
- For React 18/19 createRoot: add \`onUncaughtError\`, \`onCaughtError\`, \`onRecoverableError\` callbacks that call \`SessionRecorder.captureException(error)\`
- For Next.js: add error capture in error.tsx / global-error.tsx files

**Navigation tracking — ALWAYS include for SPAs:**
- For React Router: use \`useNavigationRecorder(pathname)\` hook in the root layout
- For Next.js: use \`useNavigationRecorder(pathname)\` with \`usePathname()\` in the root layout
- For Vue Router / Nuxt: use \`SessionRecorder.navigation.record({ path })\` in router afterEach hook

**HTTP instrumentation:**
- \`propagateTraceHeaderCorsUrls\` — set to the app's API backend domains (detect from code if possible, otherwise add a TODO comment)
- \`captureBody: true\`
- \`captureHeaders: true\`

**Privacy / masking — set sensible defaults:**
- \`masking: { maskInputOptions: { password: true }, maskHeadersList: ['authorization', 'cookie', 'x-api-key'] }\`

**Session attributes — if auth/user context is available in the project:**
- Show how to call \`SessionRecorder.setSessionAttributes({ userId, userName })\` where user context is available (e.g. after login, in auth provider)
- Add a TODO comment if user context location is unclear

**Next.js specific:**
- Next.js 15.3+: use \`instrumentation-client.ts\` for early initialization, export \`onRouterTransitionStart\`
- Next.js < 15.3: use dynamic import in a client Providers component
- Always use \`NEXT_PUBLIC_\` prefixed env vars for client-side config

### For Node.js backends (@multiplayer-app/session-recorder-node):

**OpenTelemetry setup — create a dedicated instrumentation file (e.g. src/opentelemetry.ts):**
- Import BEFORE any other code (must be first import in entry file)
- Use \`@opentelemetry/sdk-node\` NodeSDK or manual TracerProvider setup
- Include \`@opentelemetry/auto-instrumentations-node\` for automatic HTTP/Express/etc instrumentation
- Use \`SessionRecorderIdGenerator\` for trace ID generation
- Use \`SessionRecorderHttpTraceExporter\` + \`SessionRecorderHttpLogsExporter\` for direct export, OR configure OTLP exporter to https://otlp.multiplayer.app

**HTTP request/response capture — ALWAYS include:**
- Add \`SessionRecorderHttpInstrumentationHooksNode\` hooks to \`@opentelemetry/instrumentation-http\`:
  - \`requestHook\` with: \`maskHeadersList: ['Authorization', 'cookie', 'x-api-key']\`, \`maxPayloadSizeBytes: 500000\`
  - \`responseHook\` with: \`maskHeadersList: ['set-cookie']\`, \`maxPayloadSizeBytes: 500000\`

**Session recorder init with full options:**
- \`apiKey\` from env var \`MULTIPLAYER_API_KEY\`
- \`traceIdGenerator\` — use \`SessionRecorderIdGenerator\`
- \`resourceAttributes\` with \`componentName\`, \`version\`, \`environment\`

**Session management — set up continuous recording for long-running services:**
- Start with \`SessionType.CONTINUOUS\` for server processes
- Include auto-save on exceptions via span attributes
- Show \`sessionRecorder.start()\` and \`sessionRecorder.stop()\` lifecycle

**Multi-exporter support — if existing OTel exporters found:**
- Chain exporters: keep existing + add Multiplayer exporter
- Use \`SessionRecorderTraceExporterWrapper\` to wrap existing OTLP exporters

## General Rules

- Use environment variables for ALL secrets (API keys, endpoints) — never hardcode
- Use the project's package manager: ${stack.packageManager}
- If modifying an existing file, include the COMPLETE file content after changes
- Set application name and version from package.json
- For backend: if the project already has OTel, ADD a Multiplayer exporter alongside — NEVER remove or replace existing exporters
- Install ALL required peer dependencies (e.g. @opentelemetry/api for frontend, auto-instrumentations for backend)
- Add TypeScript types where the project uses TypeScript

## Quality of Response

- "steps" should be short, imperative, and ordered
- "warnings" should include only actionable caveats (empty array if none)
- "confidence" should reflect certainty from available files (0.0 to 1.0)
- Every fileChange must include complete, runnable code — not stubs or pseudocode
- Include inline comments only where the user needs to customize something (e.g. // TODO: add your API domains)`
}

function normalizePlan(plan: Partial<SetupPlan>): SetupPlan {
  return {
    detection: {
      framework: plan.detection?.framework ?? 'unknown',
      existingSetup: {
        hasOpenTelemetry: plan.detection?.existingSetup?.hasOpenTelemetry ?? false,
        hasMultiplayerSdk: plan.detection?.existingSetup?.hasMultiplayerSdk ?? false,
        otelPackages: plan.detection?.existingSetup?.otelPackages ?? [],
        otelConfigFile: plan.detection?.existingSetup?.otelConfigFile ?? undefined,
        existingOtlpEndpoint: plan.detection?.existingSetup?.existingOtlpEndpoint ?? undefined,
      },
      approach: plan.detection?.approach ?? 'minimal-patch',
      reasoning: plan.detection?.reasoning ?? 'No reasoning provided',
    },
    summary: plan.summary ?? 'No summary provided',
    installCommand: plan.installCommand ?? '',
    fileChanges: Array.isArray(plan.fileChanges) ? plan.fileChanges : [],
    envVars: Array.isArray(plan.envVars) ? plan.envVars : [],
    steps: Array.isArray(plan.steps) ? plan.steps : [],
    warnings: Array.isArray(plan.warnings) ? plan.warnings : [],
    confidence: typeof plan.confidence === 'number' ? Math.max(0, Math.min(1, plan.confidence)) : 0.7,
  }
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

function buildClassifyPrompt(stacks: DetectedStack[], sdkSummary: string): string {
  const stackDescriptions = stacks.map(s => {
    const parts = [
      `- **${s.relativePath}** (${s.label})`,
      `  Package: ${s.packageName ?? 'unknown'}`,
      `  Description: ${s.packageDescription ?? 'none'}`,
      `  Framework: ${s.framework}, Type: ${s.type}`,
      `  SDK installed: ${s.alreadyInstalled ? `yes (${s.installedSdkPackage})` : 'no'}${s.installedSdkPackage === 'otel+otlp.multiplayer.app' ? ' — using standard OTel with Multiplayer OTLP endpoint' : ''}`,
      `  Recommended SDK: ${s.sdkPackage}`,
    ]
    if (s.internalDeps?.length) {
      parts.push(`  Depends on (internal): ${s.internalDeps.join(', ')}`)
    }
    if (s.internalDependents?.length) {
      parts.push(`  Used by (internal): ${s.internalDependents.join(', ')}`)
    }
    return parts.join('\n')
  }).join('\n\n')

  return `You are an expert at analyzing monorepo project structures and understanding which packages need the Multiplayer Session Recorder SDK.

## What is the Multiplayer SDK?

${sdkSummary}

## Detected Stacks

The following packages/apps were detected in a monorepo:

${stackDescriptions}

## Your Task

For EACH detected stack, classify whether it actually needs the Multiplayer Session Recorder SDK.

### Classification Rules

1. **"installed"** — The SDK is already present in this package's dependencies, OR the package has OpenTelemetry configured to export to the Multiplayer OTLP endpoint (otlp.multiplayer.app). No action needed.

2. **"needed"** — This is a deployable application or service that handles HTTP requests, serves a frontend, or runs as a standalone process AND doesn't already have the SDK or OTel+Multiplayer endpoint. These are the packages where session recording should be initialized.

3. **"not-needed"** — This package does NOT need the SDK. Common reasons:
   - It's a shared library/utility (name contains -lib, -shared, -common, -types, -utils)
   - It's a types/interfaces package with no runtime code
   - It's a build tool, config package, or dev dependency
   - It's an infrastructure library (database adapters, message queue clients, etc.) that doesn't handle user sessions
   - It has no server entry point and is not a frontend app

4. **"covered-by-dependency"** — This package depends on (imports from) another internal package that already has the SDK installed. The SDK context (traces, spans) will propagate through OpenTelemetry automatically. The package itself doesn't need a separate SDK installation.

### Important Considerations

- In a monorepo, a shared library that sets up the SDK can propagate tracing to all services that import it
- Libraries that are purely consumed by other packages (have dependents but no server/app entry point) generally don't need the SDK
- Only deployable services and frontend apps need the SDK initialized directly
- If a package's internal dependency already has the SDK, traces will flow through OpenTelemetry context propagation

## Response Format

Return ONLY a JSON array (no markdown fences, no explanation outside JSON):

[
  {
    "relativePath": "path/to/package",
    "sdkRelevance": "needed | installed | not-needed | covered-by-dependency",
    "reason": "Brief explanation"
  }
]

Include an entry for EVERY detected stack.`
}

function getSdkSummary(): string {
  return `The Multiplayer Session Recorder SDK is a full-stack session recording and debugging platform built on OpenTelemetry. It provides:
- Frontend session replays (screen recording, user interactions) via @multiplayer-app/session-recorder-react or session-recorder-browser
- Backend trace correlation via @multiplayer-app/session-recorder-node
- The SDK needs to be initialized in deployable applications (web apps, API servers, standalone services)
- Shared libraries do NOT need to install the SDK — they receive tracing context automatically through OpenTelemetry propagation when consumed by an app that has the SDK
- The SDK packages are: session-recorder-react (React/Next.js), session-recorder-browser (Angular/Vue/Svelte), session-recorder-node (Node.js backends), session-recorder-react-native (mobile)

IMPORTANT for backend services: A backend does NOT need the Multiplayer SDK package if it has standard OpenTelemetry configured to export to the Multiplayer OTLP endpoint:
- Traces: https://otlp.multiplayer.app/v1/traces
- Logs: https://otlp.multiplayer.app/v1/logs
This can be set via environment variable (OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.multiplayer.app) or directly in OTel config code.
If a backend has OTel + the Multiplayer OTLP endpoint, it is fully set up — no Multiplayer ID generator or exporter package needed.`
}

/**
 * Use AI to classify which detected stacks actually need the Multiplayer SDK.
 * Analyzes monorepo relationships, package purposes, and dependency graphs.
 */
export async function classifyStacksWithAi(
  stacks: DetectedStack[],
  model: string,
  modelKey: string,
  modelUrl?: string,
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
          messages: [{ role: 'user', content: prompt }],
        })
        const block = response.content[0]
        responseText = block?.type === 'text' ? block.text : ''
      } else {
        responseText = await generateWithClaudeCli(prompt, model, process.cwd())
      }
    } else {
      const client = new OpenAI({
        apiKey: modelKey,
        ...(modelUrl ? { baseURL: modelUrl } : {}),
      })
      const response = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      responseText = response.choices[0]?.message?.content ?? ''
    }

    // Parse JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return { success: false, classifications: [], error: 'AI did not return valid JSON array' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as StackClassification[]
    if (!Array.isArray(parsed)) {
      return { success: false, classifications: [], error: 'AI response is not an array' }
    }

    // Validate and normalize
    const validRelevances = new Set<SdkRelevance>(['needed', 'installed', 'not-needed', 'covered-by-dependency'])
    const classifications: StackClassification[] = parsed.map(c => ({
      relativePath: String(c.relativePath ?? ''),
      sdkRelevance: validRelevances.has(c.sdkRelevance) ? c.sdkRelevance : 'needed',
      reason: String(c.reason ?? 'No reason provided'),
    }))

    return { success: true, classifications }
  } catch (err: unknown) {
    return {
      success: false,
      classifications: [],
      error: (err as Error).message,
    }
  }
}

/**
 * Apply AI classifications back to the detected stacks (mutates in place).
 */
export function applyClassifications(stacks: DetectedStack[], classifications: StackClassification[]): void {
  const classMap = new Map(classifications.map(c => [c.relativePath, c]))
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
): Promise<SetupResult> {
  const readme = getReadmeContent(stack.sdkPackage, stack.framework)
  const projectContext = gatherProjectContext(stack)
  const prompt = buildSetupPrompt(stack, readme, projectContext)

  try {
    let responseText: string

    if (isAnthropicModel(model)) {
      if (modelKey) {
        const client = new Anthropic({ apiKey: modelKey })
        const response = await client.messages.create({
          model: model === 'claude-code' ? 'claude-sonnet-4-6' : model,
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        })
        const block = response.content[0]
        responseText = block?.type === 'text' ? block.text : ''
      } else {
        responseText = await generateWithClaudeCli(prompt, model, stack.root)
      }
    } else {
      const client = new OpenAI({
        apiKey: modelKey,
        ...(modelUrl ? { baseURL: modelUrl } : {}),
      })
      const response = await client.chat.completions.create({
        model,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      })
      responseText = response.choices[0]?.message?.content ?? ''
    }

    // Parse JSON from response (handle markdown code fences)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, plan: null, error: 'AI did not return valid JSON' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<SetupPlan>
    const plan = normalizePlan(parsed)
    return { success: true, plan }
  } catch (err: unknown) {
    return {
      success: false,
      plan: null,
      error: (err as Error).message,
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

/** Placeholder values the AI uses for API keys in generated code */
const API_KEY_PLACEHOLDERS = [
  'your-api-key-here',
  'your_api_key_here',
  'YOUR_API_KEY',
  'YOUR_MULTIPLAYER_API_KEY',
  '<MULTIPLAYER_API_KEY>',
  'MULTIPLAYER_API_KEY',
]

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
  auth: ApiServiceAuth & { workspace: string; project: string },
): Promise<{ keys: CreatedApiKey[]; errors: string[] }> {
  const api = createApiService(auth)
  const keys: CreatedApiKey[] = []
  const errors: string[] = []

  const needsFrontendKey = stacks.some(
    s => s.sdkRelevance === 'needed' && (s.type === 'frontend' || s.type === 'fullstack' || s.type === 'mobile'),
  )
  const needsBackendKey = stacks.some(
    s => s.sdkRelevance === 'needed' && s.type === 'backend',
  )

  const suffix = randomSuffix()

  if (needsFrontendKey) {
    try {
      const integration = await api.createIntegration(
        auth.workspace,
        auth.project,
        `session-recorder-frontend-${suffix}`,
      )
      keys.push({
        name: integration.name,
        apiKey: integration.otel.apiKey,
        stackType: 'frontend',
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
        `session-recorder-backend-${suffix}`,
      )
      keys.push({
        name: integration.name,
        apiKey: integration.otel.apiKey,
        stackType: 'backend',
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
  const key = stackType === 'backend'
    ? keys.find(k => k.stackType === 'backend')
    : keys.find(k => k.stackType === 'frontend')

  if (!key) return

  // Replace in envVars
  for (const envVar of plan.envVars) {
    if (API_KEY_PLACEHOLDERS.some(p => envVar.value === p || envVar.value.includes(p))) {
      envVar.value = key.apiKey
    }
  }

  // Replace in fileChanges content
  for (const change of plan.fileChanges) {
    for (const placeholder of API_KEY_PLACEHOLDERS) {
      change.content = change.content.replaceAll(placeholder, key.apiKey)
    }
  }
}
