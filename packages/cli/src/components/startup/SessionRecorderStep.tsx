import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton, ScrollBoxRenderable } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import { detectStacks, summarizeDetection, type DetectedStack } from '../../session-recorder/detectStacks.js'
import { generateSetupPlan, applySetupPlan, type SetupPlan } from '../../session-recorder/setupWithAi.js'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | 'scanning'           // Detecting stacks (heuristic)
  | 'results'            // Showing detected stacks, user picks action
  | 'already-done'       // All SDKs already installed
  | 'no-stacks'          // Nothing detected
  | 'partial'            // Only frontend or backend found
  | 'ai-planning'        // AI is generating the setup plan
  | 'preview'            // Showing AI-generated plan for user approval
  | 'applying'           // Applying the plan + running install
  | 'done'               // Setup complete
  | 'error'              // Something went wrong

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clickHandler(handler: () => void) {
  return (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    handler()
  }
}

function typeIcon(type: DetectedStack['type']): string {
  switch (type) {
    case 'frontend': return '🌐'
    case 'backend': return '⚙️'
    case 'fullstack': return '🔗'
    case 'mobile': return '📱'
  }
}

function sdkDisplayName(sdk: DetectedStack['sdkPackage']): string {
  if (sdk.startsWith('@multiplayer-app/')) return sdk
  return `multiplayer ${sdk.replace('multiplayer-', '')} SDK`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SessionRecorderStep({ config, onComplete }: Props): ReactElement {
  const [phase, setPhase] = useState<Phase>('scanning')
  const [stacks, setStacks] = useState<DetectedStack[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [plan, setPlan] = useState<SetupPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applyLog, setApplyLog] = useState<string[]>([])
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  const needsSetup = stacks.filter(s => !s.alreadyInstalled)

  // ─── Actions for results/partial phase ─────────────────────────────────────

  type Action = 'setup' | 'skip'
  const actions: { id: Action; label: string; description: string }[] = [
    { id: 'setup', label: '✓ Set up with AI', description: 'AI will analyze your project and generate integration code' },
    { id: 'skip', label: '→ Skip for now', description: 'You can set this up later' },
  ]

  // ─── Actions for preview phase ─────────────────────────────────────────────

  type PreviewAction = 'apply' | 'regenerate' | 'skip'
  const previewActions: { id: PreviewAction; label: string }[] = [
    { id: 'apply', label: '✓ Apply changes' },
    { id: 'regenerate', label: '↻ Regenerate plan' },
    { id: 'skip', label: '→ Skip' },
  ]

  // ─── Scan on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!config.dir) {
      setPhase('no-stacks')
      return
    }

    const detected = detectStacks(config.dir)
    setStacks(detected)

    if (detected.length === 0) {
      setPhase('no-stacks')
      return
    }

    const summary = summarizeDetection(detected)

    if (summary.allInstalled) {
      setPhase('already-done')
      return
    }

    const onlyFrontend = summary.hasFrontend && !summary.hasBackend
    const onlyBackend = summary.hasBackend && !summary.hasFrontend
    if (onlyFrontend || onlyBackend) {
      setPhase('partial')
      return
    }

    setPhase('results')
  }, [config.dir])

  // ─── AI planning ───────────────────────────────────────────────────────────

  const runAiPlanning = async () => {
    if (!config.model || !config.modelKey || needsSetup.length === 0) {
      setError('AI model not configured — cannot generate setup plan')
      setPhase('error')
      return
    }

    setPhase('ai-planning')
    setError(null)

    // For now, plan for the first stack that needs setup
    // TODO: iterate over all stacks
    const stack = needsSetup[0]!

    // Find README relative to project dir (the CLI ships with SDKs in the monorepo)
    // For deployed CLI, READMEs would be bundled or fetched
    const result = await generateSetupPlan(
      stack,
      config.model,
      config.modelKey,
      config.modelUrl,
    )

    if (result.success && result.plan) {
      setPlan(result.plan)
      setSelectedIndex(0)
      setPhase('preview')
    } else {
      setError(result.error ?? 'Failed to generate setup plan')
      setPhase('error')
    }
  }

  // ─── Apply plan ────────────────────────────────────────────────────────────

  const applyPlan = async () => {
    if (!plan || !config.dir) return
    setPhase('applying')
    const log: string[] = []

    try {
      // 1. Write file changes
      const written = applySetupPlan(plan, config.dir)
      for (const f of written) {
        log.push(`✓ ${f}`)
      }

      // 2. Run install command if needed
      if (plan.installCommand) {
        log.push(`◌ Running: ${plan.installCommand}`)
        setApplyLog([...log])

        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)
        await execAsync(plan.installCommand, { cwd: config.dir, timeout: 120_000 })
        log[log.length - 1] = `✓ ${plan.installCommand}`
      }

      // 3. Note env vars
      if (plan.envVars.length > 0) {
        log.push('')
        log.push('Environment variables to configure:')
        for (const env of plan.envVars) {
          log.push(`  ${env.name}=${env.value}  # ${env.description}`)
        }
      }

      setApplyLog(log)
      setPhase('done')
    } catch (err: unknown) {
      log.push(`✗ ${(err as Error).message}`)
      setApplyLog(log)
      setError((err as Error).message)
      setPhase('error')
    }
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  useKeyboard(({ name }) => {
    if (phase === 'scanning' || phase === 'ai-planning' || phase === 'applying') return

    // Simple continue phases
    if (phase === 'no-stacks' || phase === 'already-done' || phase === 'done') {
      if (name === 'return') {
        onComplete({ sessionRecorderSetupDone: true })
      }
      return
    }

    // Error: retry or skip
    if (phase === 'error') {
      if (name === 'return') {
        void runAiPlanning() // retry
      }
      return
    }

    // Results & partial: navigate action buttons
    if (phase === 'results' || phase === 'partial') {
      if (name === 'up' || name === 'left') {
        setSelectedIndex(i => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex(i => Math.min(actions.length - 1, i + 1))
      } else if (name === 'return') {
        const action = actions[selectedIndex]
        if (action?.id === 'skip') {
          onComplete({ sessionRecorderSetupDone: true })
        } else if (action?.id === 'setup') {
          void runAiPlanning()
        }
      }
      return
    }

    // Preview: navigate preview actions
    if (phase === 'preview') {
      if (name === 'up' || name === 'left') {
        setSelectedIndex(i => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex(i => Math.min(previewActions.length - 1, i + 1))
      } else if (name === 'return') {
        const action = previewActions[selectedIndex]
        if (action?.id === 'apply') {
          void applyPlan()
        } else if (action?.id === 'regenerate') {
          setSelectedIndex(0)
          void runAiPlanning()
        } else if (action?.id === 'skip') {
          onComplete({ sessionRecorderSetupDone: true })
        }
      }
    }
  })

  useLayoutEffect(() => {
    scrollRef.current?.scrollChildIntoView(`action-${selectedIndex}`)
  }, [selectedIndex])

  // ─── Render: Scanning ──────────────────────────────────────────────────────

  if (phase === 'scanning') {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
        <box gap={2}>
          <text fg="#f59e0b">◌</text>
          <text>Scanning project for application stacks...</text>
        </box>
      </box>
    ) as ReactElement
  }

  // ─── Render: No stacks ────────────────────────────────────────────────────

  if (phase === 'no-stacks') {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
        <box gap={2}>
          <text fg="#6b7280">·</text>
          <text>No supported application stacks detected in this directory.</text>
        </box>
        <text attributes={tuiAttrs({ dim: true })}>
          Supported: React, Next.js, Vue, Angular, Svelte, React Native, Express, Fastify, NestJS, Python, Go, Ruby, Java, .NET
        </text>
        <box marginTop={1}>
          <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
        </box>
      </box>
    ) as ReactElement
  }

  // ─── Render: All already installed ─────────────────────────────────────────

  if (phase === 'already-done') {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
        <box gap={2}>
          <text fg="#10b981">✓</text>
          <text fg="#10b981">Session Recorder SDK is already installed</text>
        </box>
        <box flexDirection="column" marginTop={1}>
          {stacks.map((s, i) => (
            <box key={i} gap={2}>
              <text>{typeIcon(s.type)}</text>
              <text fg="#e6edf3">{s.label}</text>
              <text attributes={tuiAttrs({ dim: true })}>({s.relativePath})</text>
              <text fg="#10b981">— {sdkDisplayName(s.sdkPackage)} installed</text>
            </box>
          ))}
        </box>
        <box marginTop={1}>
          <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
        </box>
      </box>
    ) as ReactElement
  }

  // ─── Render: AI Planning ───────────────────────────────────────────────────

  if (phase === 'ai-planning') {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
        <box gap={2}>
          <text fg="#f59e0b">◌</text>
          <text>AI is analyzing your project and generating setup plan...</text>
        </box>
        <text attributes={tuiAttrs({ dim: true })}>
          Reading integration guide + project files for {needsSetup[0]?.label ?? 'detected stack'}
        </text>
      </box>
    ) as ReactElement
  }

  // ─── Render: Preview (AI-generated plan) ───────────────────────────────────

  if (phase === 'preview' && plan) {
    const det = plan.detection
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup — Review Plan</text>

        {/* AI detection results */}
        <box flexDirection="column">
          <box gap={2}>
            <text attributes={tuiAttrs({ dim: true })}>Detected:</text>
            <text fg="#e6edf3">{det.framework}</text>
            <text attributes={tuiAttrs({ dim: true })}>·</text>
            <text fg={det.approach === 'already-complete' ? '#10b981' : '#22d3ee'}>{det.approach}</text>
          </box>
          {det.existingSetup.hasOpenTelemetry && (
            <box gap={2}>
              <text fg="#f59e0b">⚡</text>
              <text fg="#f59e0b">Existing OpenTelemetry found</text>
              <text attributes={tuiAttrs({ dim: true })}>— will add Multiplayer exporter only</text>
            </box>
          )}
          {det.existingSetup.hasMultiplayerSdk && (
            <box gap={2}>
              <text fg="#10b981">✓</text>
              <text fg="#10b981">Multiplayer SDK already present</text>
            </box>
          )}
          <text attributes={tuiAttrs({ dim: true })}>{det.reasoning}</text>
        </box>

        <text fg="#22d3ee">{plan.summary}</text>

        {plan.installCommand && (
          <box marginTop={1}>
            <text attributes={tuiAttrs({ dim: true })}>Install: </text>
            <text fg="#e6edf3">{plan.installCommand}</text>
          </box>
        )}

        <box flexDirection="column" marginTop={1}>
          <text attributes={tuiAttrs({ dim: true })}>File changes:</text>
          {plan.fileChanges.map((change, i) => (
            <box key={i} gap={2}>
              <text fg={change.action === 'create' ? '#10b981' : '#f59e0b'}>
                {change.action === 'create' ? '+' : '~'}
              </text>
              <text fg="#e6edf3">{change.filePath}</text>
              <text attributes={tuiAttrs({ dim: true })}> — {change.description}</text>
            </box>
          ))}
        </box>

        {plan.envVars.length > 0 && (
          <box flexDirection="column" marginTop={1}>
            <text attributes={tuiAttrs({ dim: true })}>Environment variables:</text>
            {plan.envVars.map((env, i) => (
              <box key={i} gap={2}>
                <text fg="#22d3ee">{env.name}</text>
                <text attributes={tuiAttrs({ dim: true })}> — {env.description}</text>
              </box>
            ))}
          </box>
        )}

        {/* Action buttons */}
        <box flexDirection="column" marginTop={1}>
          {previewActions.map((action, i) => {
            const isActive = i === selectedIndex
            const isHovered = hoveredRow === i
            return (
              <box
                key={action.id}
                id={`action-${i}`}
                flexDirection="row"
                height={1}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
                onMouseUp={clickHandler(() => {
                  setSelectedIndex(i)
                  if (action.id === 'apply') void applyPlan()
                  else if (action.id === 'regenerate') void runAiPlanning()
                  else onComplete({ sessionRecorderSetupDone: true })
                })}
                onMouseOver={() => setHoveredRow(i)}
                onMouseOut={() => setHoveredRow(v => v === i ? null : v)}
              >
                <text
                  fg={isActive ? '#10b981' : '#8b949e'}
                  attributes={tuiAttrs({ bold: isActive })}
                >
                  {isActive ? '❯ ' : '  '}{action.label}
                </text>
              </box>
            )
          })}
        </box>

        <box marginTop={1}>
          <text fg="#484f58">↑↓ select · Enter confirm · Esc back</text>
        </box>
      </box>
    ) as ReactElement
  }

  // ─── Render: Applying ──────────────────────────────────────────────────────

  if (phase === 'applying') {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup — Applying</text>
        <box gap={2}>
          <text fg="#f59e0b">◌</text>
          <text>Applying setup plan...</text>
        </box>
        <box flexDirection="column" marginTop={1}>
          {applyLog.map((line, i) => (
            <text key={i} fg={line.startsWith('✗') ? '#ef4444' : line.startsWith('✓') ? '#10b981' : '#e6edf3'}>
              {line}
            </text>
          ))}
        </box>
      </box>
    ) as ReactElement
  }

  // ─── Render: Done ──────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup — Complete</text>
        <box gap={2}>
          <text fg="#10b981">✓</text>
          <text fg="#10b981">Session Recorder SDK has been set up</text>
        </box>
        <box flexDirection="column" marginTop={1}>
          {applyLog.map((line, i) => (
            <text key={i} fg={line.startsWith('✗') ? '#ef4444' : line.startsWith('✓') ? '#10b981' : '#e6edf3'}>
              {line}
            </text>
          ))}
        </box>
        <box marginTop={1}>
          <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
        </box>
      </box>
    ) as ReactElement
  }

  // ─── Render: Error ─────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
        <box gap={2}>
          <text fg="#ef4444">✗</text>
          <text fg="#ef4444">{error}</text>
        </box>
        {applyLog.length > 0 && (
          <box flexDirection="column" marginTop={1}>
            {applyLog.map((line, i) => (
              <text key={i} fg={line.startsWith('✗') ? '#ef4444' : line.startsWith('✓') ? '#10b981' : '#e6edf3'}>
                {line}
              </text>
            ))}
          </box>
        )}
        <text attributes={tuiAttrs({ dim: true })}>Enter retry · Esc back</text>
      </box>
    ) as ReactElement
  }

  // ─── Render: Results / Partial (shared layout) ─────────────────────────────

  const summary = summarizeDetection(stacks)
  const isPartial = phase === 'partial'
  const detectedSide = summary.hasFrontend ? 'frontend' : 'backend'
  const missingSide = summary.hasFrontend ? 'backend' : 'frontend'

  return (
    <box flexDirection="column" gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>

      <text attributes={tuiAttrs({ dim: true })}>Detected stacks in your project:</text>
      <box flexDirection="column">
        {stacks.map((s, i) => (
          <box key={i} gap={2}>
            <text>{typeIcon(s.type)}</text>
            <text fg="#e6edf3" attributes={tuiAttrs({ bold: true })}>{s.label}</text>
            <text attributes={tuiAttrs({ dim: true })}>
              {s.relativePath !== '.' ? `(${s.relativePath})` : ''} — {sdkDisplayName(s.sdkPackage)}
            </text>
            {s.alreadyInstalled
              ? <text fg="#10b981"> ✓ installed</text>
              : <text fg="#f59e0b"> needs setup</text>
            }
          </box>
        ))}
      </box>

      {isPartial && (
        <box marginTop={1} flexDirection="column" gap={0}>
          <text fg="#f59e0b">
            Only {detectedSide} detected. To set up the {missingSide}, run the CLI
          </text>
          <text fg="#f59e0b">
            in the {missingSide} project directory.
          </text>
        </box>
      )}

      {/* Action buttons */}
      <box flexDirection="column" marginTop={1}>
        {actions.map((action, i) => {
          const isActive = i === selectedIndex
          const isHovered = hoveredRow === i
          return (
            <box
              key={action.id}
              id={`action-${i}`}
              flexDirection="row"
              height={1}
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
              onMouseUp={clickHandler(() => {
                setSelectedIndex(i)
                if (action.id === 'skip') {
                  onComplete({ sessionRecorderSetupDone: true })
                } else {
                  void runAiPlanning()
                }
              })}
              onMouseOver={() => setHoveredRow(i)}
              onMouseOut={() => setHoveredRow(v => v === i ? null : v)}
            >
              <text
                fg={isActive ? (action.id === 'setup' ? '#10b981' : '#e6edf3') : '#8b949e'}
                attributes={tuiAttrs({ bold: isActive })}
              >
                {isActive ? '❯ ' : '  '}{action.label}
              </text>
              <text attributes={tuiAttrs({ dim: true })}> — {action.description}</text>
            </box>
          )
        })}
      </box>

      <box marginTop={1}>
        <text fg="#484f58">↑↓ select · Enter confirm · Esc back</text>
      </box>
    </box>
  ) as ReactElement
}
