import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'
import cliPath from '@anthropic-ai/claude-agent-sdk/embed'
import type { DetectedStack } from './detectStacks.js'
import { getReadmeContent } from './readmes.js'

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
      "otelConfigFile": null
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
   - Use approach "exporter-only"
   - DON'T install the full session-recorder SDK
   - Instead: add the Multiplayer exporter and ID generator to the existing OTel setup
   - Import from @multiplayer-app/session-recorder-node or session-recorder-browser as needed
   - Add MultiplayerSpanExporter and MultiplierIdGenerator to the existing tracer provider

2. **If Multiplayer SDK is already installed** (any @multiplayer-app/session-recorder-* package):
   - Check if it's actually initialized in the code
   - If initialized: approach "already-complete", empty installCommand, no fileChanges
   - If installed but not initialized: approach "minimal-patch", just add init code

3. **If nothing is set up** (most common case):
   - Use approach "full-sdk"
   - Install the recommended SDK package
   - Follow the README integration guide exactly
   - Choose the simplest pattern that works for this project

4. **General rules**:
   - Use environment variables for API keys (never hardcode)
   - Use the project's package manager: ${stack.packageManager}
   - If modifying an existing file, include the COMPLETE file content
   - Keep changes minimal
   - Include CORS URL config if a backend API URL pattern is visible
   - Set application name from package.json name field
   - For backend: if the project already has OTel, just add the Multiplayer exporter — don't restructure their setup

5. **Quality of response**:
   - "steps" should be short, imperative, and ordered
   - "warnings" should include only actionable caveats (empty array if none)
   - "confidence" should reflect certainty from available files (0.0 to 1.0)`
}

function normalizePlan(plan: Partial<SetupPlan>): SetupPlan {
  return {
    detection: {
      framework: plan.detection?.framework ?? 'unknown',
      existingSetup: {
        hasOpenTelemetry: plan.detection?.existingSetup?.hasOpenTelemetry ?? false,
        hasMultiplayerSdk: plan.detection?.existingSetup?.hasMultiplayerSdk ?? false,
        otelPackages: plan.detection?.existingSetup?.otelPackages ?? [],
        otelConfigFile: plan.detection?.existingSetup?.otelConfigFile ?? undefined
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
