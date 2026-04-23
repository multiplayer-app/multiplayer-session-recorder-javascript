/**
 * All AI prompts for the CLI — edit this file to tune model behaviour.
 *
 * Sections:
 *  1. Setup / session-recorder prompts  (used in session-recorder/setupWithAi.ts)
 *  2. Debugging agent prompts           (used in services/ai.service.ts)
 *  3. Issue analysis prompts
 *  4. PR generation prompts
 *  5. Chat title prompt
 */

import type { DetectedStack } from './session-recorder/detectStacks.js'
import type { Issue, Release } from './types/index.js'

// ─── 1. Setup / session-recorder ─────────────────────────────────────────────

/** Context carried across multiple stacks set up in one session. */
export interface SetupGenerationContext {
  /** Short summaries of stacks that have ALREADY been set up in this same session */
  priorSummaries?: string[]
  /** Short descriptions of stacks queued to be set up AFTER this one */
  upcomingStacks?: string
}

/**
 * System prompt for the Claude Agent SDK planner. Keeps the agent in a
 * read-only analysis role so its only deliverable is a JSON plan — the CLI
 * owns the write phase.
 */
export const PLANNER_SYSTEM_PROMPT = `You are running in PLANNING MODE for the Multiplayer Session Recorder CLI.

Your only job is to analyze the project and return a JSON plan that the CLI will apply.

STRICT RULES:
- NEVER modify, create, or delete files on disk. The Write, Edit, MultiEdit, and NotebookEdit tools are disabled; do not attempt to use them.
- Do not run shell commands that change repository state (installs, git writes, file moves, etc.). Use Bash only for read-only inspection if needed.
- Use Read, Glob, and Grep freely to understand the project.
- Your final assistant message MUST be a single JSON value that matches the schema in the user prompt — no prose before or after, no markdown code fences.
- If you cannot produce a plan, still return JSON with "confidence": 0 and a "warnings" entry explaining why.`

/** Write-family tools that must not run during planning. */
export const PLANNER_DISALLOWED_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']

export function buildSetupPrompt(
  stack: DetectedStack,
  readme: string,
  projectContext: string,
  ctx?: SetupGenerationContext,
): string {
  const installedNote = stack.alreadyInstalled
    ? `- NOTE: A Multiplayer SDK is already installed: ${stack.installedSdkPackage}`
    : ''

  const priorSection = ctx?.priorSummaries?.length
    ? `## Prior Setup Progress (already completed in this session)

The stacks below were set up BEFORE the one you are planning now. Their file changes have been applied. You MUST NOT re-do that work. Use them as context so your plan stays consistent with the rest of the repo.

${ctx.priorSummaries.join('\n\n')}

**Rules based on prior progress:**
- The Multiplayer API keys listed above already exist. Do NOT ask the CLI to create new keys. Always use the \`YOUR_MULTIPLAYER_API_KEY\` placeholder in env files — the CLI injects the right shared key (one for frontend stacks, one for backend stacks — multiple backends share a single backend key).
- If a prior stack is a SIBLING in the same monorepo and wrote a \`.env*\` file there, you still write your own \`.env*\` inside YOUR stack's root (paths you emit are relative to THIS stack's root). Do not try to modify a sibling stack's files.
- Reuse the SAME env var naming convention as prior stacks of the SAME type where it makes sense. For different build tools across stacks (e.g. Vite frontend + Node backend), each stack follows ITS tool's convention — that's expected.
- Do NOT recreate files that a prior stack already owns.

`
    : ''

  const upcomingSection = ctx?.upcomingStacks
    ? `## Upcoming Stacks (will be set up AFTER this one)

Coordinate with these so the final integration is consistent end-to-end:

${ctx.upcomingStacks}

**Rules based on upcoming work:**
- If you are a FRONTEND stack and a BACKEND is upcoming at a known local path, add that backend's typical dev URL pattern to \`propagateTraceHeaderCorsUrls\` (e.g. \`/^http:\\/\\/localhost(:\\d+)?$/\` if you cannot infer the port). Leave a TODO comment for the user to tighten.
- Do NOT perform setup that belongs to an upcoming stack (e.g. don't add backend OTel exporters to a frontend plan).

`
    : ''

  return `You are an expert at integrating the Multiplayer Session Recorder SDK.

## Your Task

First ANALYZE the project to understand what's already set up, then generate a setup plan.

${priorSection}${upcomingSection}

## ⚠ CRITICAL: PRESERVE ALL EXISTING CODE — DO NOT REWRITE FILES

This is the single most important rule. Past failures have all been caused by ignoring it.

You are doing a **SURGICAL INTEGRATION**, not a rewrite. The user's app must keep working exactly as it did before, with Multiplayer added on top.

When modifying an existing file:
- Start from the EXACT current contents shown in "Current Project Files" below.
- Keep every existing import, hook, component, prop, route, handler, side effect, comment, and blank line.
- Add ONLY the lines required for Multiplayer integration (imports, an init/provider call, a wrapper, an exception hook). Nothing else.
- Preserve the file's existing formatting, indentation style, quote style, and import order. Match the surrounding code.
- Do NOT "clean up", refactor, rename, reorder, modernize, simplify, or "improve" anything you weren't asked to. Resist the urge.
- Do NOT remove or replace existing providers, error boundaries, routers, layouts, or framework primitives — wrap or compose with them.
- Do NOT change unrelated logic, types, or business code, even if it looks suboptimal.
- Do NOT delete code you don't recognize. If you're unsure what something does, KEEP IT and integrate around it.
- If the existing file is large, you must still output the COMPLETE file (per the "modify" contract) — but the diff between input and your output must be small and limited to the integration.

If you cannot find the existing file content in "Current Project Files", do NOT invent a "modify" change for it — emit a "create" change for a separate new file (e.g. \`src/multiplayer.ts\`) and instruct the user via "steps" to import it from their entry point. Inventing replacement content for a file you can't see is the most damaging failure mode.

If the integration legitimately requires touching a file that has no obvious safe insertion point, prefer:
1. Creating a new sibling file (provider/wrapper/init module), then
2. Adding ONE import line + ONE call site to the existing file.

## Heuristic Detection (may be incomplete — verify by reading the actual files)
- Framework guess: ${stack.framework}
- Type guess: ${stack.type}
- Recommended SDK: ${stack.sdkPackage}
- Package manager: ${stack.packageManager}
- Language: ${stack.language}
${installedNote}

## Env var conventions (you decide based on the actual framework you detect)
Pick the right env var name and \`.env\` file for the framework you identify. Some common conventions (not exhaustive — if the project uses a different build tool, follow ITS rules):
- Next.js: \`NEXT_PUBLIC_*\` for client-accessible, written to \`.env.local\`
- Vite (React/Vue/Svelte + Vite): \`VITE_*\`, written to \`.env.local\`
- Nuxt: \`NUXT_PUBLIC_*\`, written to \`.env\`
- SvelteKit: \`PUBLIC_*\`, written to \`.env\`
- Expo / React Native (Expo): \`EXPO_PUBLIC_*\`, written to \`.env\`
- Create React App: \`REACT_APP_*\`, written to \`.env\`
- Angular: wire through \`src/environments/environment.ts\` (no magic prefix), written to \`.env\` or the environment file the project already uses
- Node/Python/Go/etc. backends: no prefix, written to \`.env\` (or whatever the project already uses — respect existing conventions)

Rules when choosing:
- Use the prefix that the project's build tool actually exposes to the runtime — otherwise the value won't be readable at runtime.
- If the project already has a \`.env*\` file in context, WRITE TO THE SAME FILENAME the project is already using.
- The env var NAME you pick must be a full identifier (e.g. \`VITE_MULTIPLAYER_API_KEY\`) — when the CLI replaces the placeholder, it expects the value \`YOUR_MULTIPLAYER_API_KEY\` to appear verbatim in the \`.env\` fileChange.

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
      "value": "YOUR_MULTIPLAYER_API_KEY",
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
- \`environment\` — from an env var using the SAME prefix as the API key (per convention). Default to \`'development'\` if unset.
- \`apiKey\` — MUST be read from the env var you chose per the convention section above. Use the runtime read syntax appropriate to the build tool (e.g. \`import.meta.env.VITE_MULTIPLAYER_API_KEY\` for Vite, \`process.env.NEXT_PUBLIC_MULTIPLAYER_API_KEY\` for Next.js).
- \`showWidget: false\` — keep the built-in recording widget hidden by default; users can flip to \`true\` later if they want it rendered on screen
- \`showContinuousRecording: false\` — disable continuous recording mode option

**Exception capture — ALWAYS include:**
- \`SessionRecorder.captureException(error, errorInfo)\` integrated into the app's error handling
- For React: wrap the app with \`<ErrorBoundary>\` from the SDK (import { ErrorBoundary } from '@multiplayer-app/session-recorder-react')
- For React 18/19 createRoot: add \`onUncaughtError\`, \`onCaughtError\`, \`onRecoverableError\` callbacks that call \`SessionRecorder.captureException(error, errorInfo)\`
- For Next.js: add error capture in error.tsx / global-error.tsx files

**Navigation tracking — ALWAYS include for SPAs:**
- For React Router: use \`useNavigationRecorder(pathname)\` hook in the root layout
- For Next.js: use \`useNavigationRecorder(pathname)\` with \`usePathname()\` in the root layout
- For Vue Router / Nuxt: use \`SessionRecorder.navigation.record({ path })\` in router afterEach hook

**HTTP instrumentation:**
- \`propagateTraceHeaderCorsUrls\` — set to the app's API backend domains (detect from code if possible, otherwise add a TODO comment)
- \`captureBody: true\`
- \`captureHeaders: true\`

**Session attributes — if auth/user context is available in the project:**
- Show how to call \`SessionRecorder.setSessionAttributes({ userId, userName })\` where user context is available (e.g. after login, in auth provider)
- Show how to call \`SessionRecorder.setUserAttributes({ type: 'USER', id, userName, userEmail })\` where user context is available (e.g. after login, in auth provider)
- Add a TODO comment if user context location is unclear
- NEVER hardcode real user names, emails, or other personal info in examples — use generic placeholders like \`'user-123'\` / \`'User Name'\` or leave as variable references

**Next.js specific:**
- Next.js 15.3+: use \`instrumentation-client.ts\` for early initialization, export \`onRouterTransitionStart\`
- Next.js < 15.3: use dynamic import in a client Providers component

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
- \`apiKey\` from env var \`MULTIPLAYER_API_KEY\` (server-side, no prefix needed), read via \`process.env.MULTIPLAYER_API_KEY\`
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
- CRITICAL: The \`apiKey\` field in init() MUST always reference an env var (e.g. \`apiKey: process.env.MULTIPLAYER_API_KEY\` or \`apiKey: import.meta.env.VITE_MULTIPLAYER_API_KEY\`). Never inline the literal key.
- Every env var you introduce MUST appear as a fileChange for the right \`.env*\` file for this framework (see the conventions section above). Action "modify" if the file exists in project context, "create" otherwise. PRESERVE all existing entries and comments — only add or update the keys you need.
- Use placeholder value \`YOUR_MULTIPLAYER_API_KEY\` for the Multiplayer API key inside the \`.env*\` fileChange; the CLI will substitute the real generated key after the plan runs. Do NOT put this placeholder anywhere else (not in source code, not in install commands).
- Also list the same env vars in the envVars array (for display/audit), using \`YOUR_MULTIPLAYER_API_KEY\` as the value for the API key.
- Use the project's package manager: ${stack.packageManager}
- If modifying an existing file, include the COMPLETE file content after changes — but the only difference vs. the original MUST be the Multiplayer-specific additions (see the "PRESERVE ALL EXISTING CODE" section above). Never rewrite, refactor, or reformat unrelated code.
- Prefer creating a new dedicated file (e.g. \`src/multiplayer.ts\`, \`src/instrumentation.ts\`) and importing it from the entry point with ONE added line, instead of restructuring an existing file.
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

export function buildClassifyPrompt(stacks: DetectedStack[], sdkSummary: string): string {
  const stackDescriptions = stacks
    .map((s) => {
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
    })
    .join('\n\n')

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

export function getSdkSummary(): string {
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

// ─── 2. Debugging agent ───────────────────────────────────────────────────────

export function buildDebuggingSystemPrompt(workDir?: string): string {
  const dirNote = workDir
    ? `\n\nIMPORTANT: You are operating in the directory: ${workDir}\nAll file reads and edits MUST use paths relative to this directory. Never use absolute paths or navigate outside this directory.`
    : ''
  return `You are an expert software debugging agent. Your task is to analyze a software issue and produce concrete file patches to fix it.

You have access to two tools:
1. read_file: Read the content of a file in the project directory
2. write_patch: Write the final list of file patches that will be applied to fix the issue

When analyzing an issue:
- Read relevant source files based on the stacktrace, service name, filenames mentioned
- Understand the root cause
- Produce minimal, targeted patches
- Only patch files that need to change
- Do not patch test files unless the bug is in a test
- Do not add unnecessary comments or formatting changes

Always call write_patch at the end with the complete list of patches needed.${dirNote}`
}

// ─── 3. Issue analysis ────────────────────────────────────────────────────────

export const ANALYSE_ISSUE_SYSTEM_PROMPT = `You are a software engineering assistant that evaluates bug reports.
Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"fixabilityScore": <0-100>, "severity": "<high|medium|low>"}

fixabilityScore rules:
- 80-100: clear root cause, straightforward fix (stack trace points to specific line, simple logic error)
- 60-79: identifiable issue, fix requires moderate investigation
- 30-59: unclear root cause, complex or risky to fix automatically
- 0-29: insufficient context, infrastructure/environment issue, or too broad to fix safely

severity rules:
- high: crashes, data loss, security issues, complete feature failure
- medium: significant degradation, partial failure, affects many users
- low: minor issues, edge cases, cosmetic problems`

export function buildAnalyseIssueUserMessage(markdown: string): string {
  return `Analyse this issue and return fixabilityScore + severity:\n\n${markdown}`
}

// ─── 4. PR generation ─────────────────────────────────────────────────────────

export const PR_GENERATION_SYSTEM_PROMPT = `You are a developer writing a pull request for a bug fix.
Return a JSON object with exactly two keys: "title" (concise PR title, max 72 chars) and "body" (markdown PR description).
The body must include:
1. **What happened** – the root cause of the issue (error type, message, where it occurred)
2. **Why it happened** – the underlying reason (bad assumption, missing check, race condition, etc.)
3. **What was changed** – the specific fix applied and why it prevents the issue
4. A brief diff summary (files/lines changed)
Use clear markdown with section headers. Do not include any other text outside the JSON.`

export function buildPrUserMessage(
  issue: Issue,
  conversationContext: string,
  diffStats: { additions: number; deletions: number },
): string {
  const issueContext = [
    issue.metadata?.type && `Error type: ${issue.metadata.type}`,
    issue.metadata?.message && `Error message: ${issue.metadata.message}`,
    issue.metadata?.culprit && `Culprit: ${issue.metadata.culprit}`,
    issue.metadata?.stacktrace && `Stack trace:\n${issue.metadata.stacktrace.slice(0, 800)}`,
    issue.service?.serviceName && `Service: ${issue.service.serviceName}`,
    issue.service?.environment && `Environment: ${issue.service.environment}`,
    issue.category && `Category: ${issue.category}`,
  ]
    .filter(Boolean)
    .join('\n')

  return `Generate a pull request title and description for this bug fix:

Issue: ${issue.title}
Component hash: ${issue.componentHash}
Changes: +${diffStats.additions}/-${diffStats.deletions} lines

${issueContext ? `Issue details:\n${issueContext}\n` : ''}
Agent investigation and fix conversation:
${conversationContext || 'No details available.'}`
}

// ─── 5. Chat title ────────────────────────────────────────────────────────────

export function buildChatTitlePrompt(issue: Issue): string {
  return `Generate a concise title (max 60 characters) for a debugging session about this issue.
Service: ${issue.service.serviceName}
Category: ${issue.category}
Title: ${issue.title}
${issue.metadata.message ? `Error: ${issue.metadata.message}` : ''}
Return only the title text, no quotes or explanation.`
}

// ─── 6. Issue context document ────────────────────────────────────────────────

export function buildIssuePromptFallback(
  issue: Issue,
  release?: Release,
  debugContext?: string,
): string {
  const lines: string[] = [
    `# Issue: ${issue.title}`,
    '',
    `**Category:** ${issue.category}`,
    `**Service:** ${issue.service.serviceName}`,
  ]

  if (issue.service.environment) {
    lines.push(`**Environment:** ${issue.service.environment}`)
  }
  if (issue.service.release) {
    lines.push(`**Release:** ${issue.service.release}`)
  }
  if (issue.metadata.message) {
    lines.push('', '## Error Message', '```', issue.metadata.message, '```')
  }
  if (issue.metadata.stacktrace) {
    lines.push('', '## Stacktrace', '```', issue.metadata.stacktrace, '```')
  }
  if (issue.metadata.filename) {
    lines.push('', `**File:** ${issue.metadata.filename}`)
  }
  if (issue.metadata.function) {
    lines.push(`**Function:** ${issue.metadata.function}`)
  }
  if (issue.metadata.httpMethod && issue.metadata.httpRoute) {
    lines.push('', `**HTTP:** ${issue.metadata.httpMethod} ${issue.metadata.httpRoute}`)
  }
  if (issue.metadata.value) {
    lines.push('', `**Value:** ${issue.metadata.value}`)
  }
  if (issue.metadata.type) {
    lines.push(`**Type:** ${issue.metadata.type}`)
  }

  if (release) {
    lines.push('', '## Release')
    lines.push(`**Version:** ${release.version}`)
    if (release.commitHash) lines.push(`**Commit:** ${release.commitHash}`)
    if (release.repositoryUrl) lines.push(`**Repository:** ${release.repositoryUrl}`)
    if (release.releaseNotes) lines.push('', '**Release Notes:**', release.releaseNotes)
  }

  if (debugContext) {
    lines.push('', '## Runtime Debug Context', '```json', debugContext, '```')
  }

  lines.push(
    '',
    'Please analyze this issue and produce file patches to fix it. Read relevant source files to understand the code before making changes.',
  )

  return lines.join('\n')
}
