import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction
} from 'react'
import { useKeyboard } from '@opentui/react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton, ScrollBoxRenderable } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { detectStacks, summarizeDetection, type DetectedStack } from '../../session-recorder/detectStacks.js'
import { generateSetupPlan, applySetupPlan, type SetupPlan } from '../../session-recorder/setupWithAi.js'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | 'scanning' // Detecting stacks (heuristic)
  | 'results' // Showing detected stacks, user picks action
  | 'already-done' // All SDKs already installed
  | 'no-stacks' // Nothing detected
  | 'partial' // Only frontend or backend found
  | 'ai-planning' // AI is generating the setup plan
  | 'preview' // Showing AI-generated plan for user approval
  | 'applying' // Applying the plan + running install
  | 'done' // Setup complete
  | 'error' // Something went wrong

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

type Action = 'setup' | 'skip'
type PreviewAction = 'apply' | 'regenerate' | 'skip'

const ACTIONS: { id: Action; label: string; description: string }[] = [
  {
    id: 'setup',
    label: 'Set up with AI',
    description: 'AI will analyze your project and generate integration code'
  },
  { id: 'skip', label: 'Skip for now', description: 'You can set this up later' }
]

const PREVIEW_ACTIONS: { id: PreviewAction; label: string }[] = [
  { id: 'apply', label: 'Apply changes' },
  { id: 'regenerate', label: 'Regenerate plan' },
  { id: 'skip', label: 'Skip' }
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clickHandler(handler: () => void) {
  return (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    handler()
  }
}

function sdkDisplayName(sdk: DetectedStack['sdkPackage']): string {
  if (sdk.startsWith('@multiplayer-app/')) return sdk
  return `multiplayer ${sdk.replace('multiplayer-', '')} SDK`
}

interface AnimatedLoadingProps {
  title: string
  subtitle?: string
  color?: string
}

function AnimatedLoading({ title, subtitle, color = '#22d3ee' }: AnimatedLoadingProps): ReactElement {
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const pulseFrames = ['Preparing workspace', 'Preparing workspace.', 'Preparing workspace..', 'Preparing workspace...']
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((i) => (i + 1) % spinnerFrames.length)
    }, 85)
    return () => clearInterval(timer)
  }, [])

  const spinner = spinnerFrames[frameIndex] ?? spinnerFrames[0]
  const pulseText = pulseFrames[Math.floor(frameIndex / 2) % pulseFrames.length] ?? pulseFrames[0]
  const barProgress = (frameIndex % 12) + 4

  return (
    <box flexDirection='column' gap={1}>
      <box gap={1} flexDirection='row' alignItems='center'>
        <text fg={color}>{spinner}</text>
        <text fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
          {title}
        </text>
      </box>
      <text attributes={tuiAttrs({ dim: true })}>{subtitle ?? pulseText}</text>
      <box flexDirection='row'>
        <text fg={color}>{'━'.repeat(barProgress)}</text>
        <text fg='#30363d'>{'─'.repeat(28 - barProgress)}</text>
      </box>
    </box>
  ) as ReactElement
}

function ApplyLogView({ applyLog }: { applyLog: string[] }): ReactElement {
  return (
    <box flexDirection='column' marginTop={1}>
      {applyLog.map((line, i) => (
        <text key={i} fg={line.startsWith('✗') ? '#ef4444' : line.startsWith('✓') ? '#10b981' : '#e6edf3'}>
          {line}
        </text>
      ))}
    </box>
  ) as ReactElement
}

function ScanningView(): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
      <box gap={2}>
        <text fg='#f59e0b'>◌</text>
        <text>Scanning project for application stacks...</text>
      </box>
    </box>
  ) as ReactElement
}

function NoStacksView(): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
      <box gap={2}>
        <text fg='#6b7280'>·</text>
        <text>No supported application stacks detected in this directory.</text>
      </box>
      <text attributes={tuiAttrs({ dim: true })}>
        Supported: React, Next.js, Vue, Angular, Svelte, React Native, Express, Fastify, NestJS, Python, Go, Ruby, Java,
        .NET
      </text>
      <box marginTop={1}>
        <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
      </box>
    </box>
  ) as ReactElement
}

function AlreadyDoneView({ stacks }: { stacks: DetectedStack[] }): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
      <box gap={2}>
        <text fg='#10b981'>✓</text>
        <text fg='#10b981'>Session Recorder SDK is already installed</text>
      </box>
      <box flexDirection='column' marginTop={1}>
        {stacks.map((s, i) => (
          <box key={i} gap={2}>
            <text fg='#e6edf3'>{s.label}</text>
            <text attributes={tuiAttrs({ dim: true })}>({s.relativePath})</text>
            <text fg='#10b981'>— {sdkDisplayName(s.sdkPackage)} installed</text>
          </box>
        ))}
      </box>
      <box marginTop={1}>
        <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
      </box>
    </box>
  ) as ReactElement
}

function AiPlanningView({ stackLabel }: { stackLabel: string }): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
      <AnimatedLoading
        title='AI is analyzing your project and generating setup plan'
        subtitle={`Reading integration guide + project files for ${stackLabel}`}
        color='#f59e0b'
      />
    </box>
  ) as ReactElement
}

const PREVIEW_SCROLLBAR_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: true,
    trackOptions: {
      foregroundColor: '#22d3ee',
      backgroundColor: '#374151'
    }
  }
}

interface PreviewViewProps {
  plan: SetupPlan
  selectedIndex: number
  hoveredRow: number | null
  setSelectedIndex: (index: number) => void
  setHoveredRow: Dispatch<SetStateAction<number | null>>
  onApply: () => void
  onRegenerate: () => void
  onSkip: () => void
}

function PreviewView({
  plan,
  selectedIndex,
  hoveredRow,
  setSelectedIndex,
  setHoveredRow,
  onApply,
  onRegenerate,
  onSkip
}: PreviewViewProps): ReactElement {
  const det = plan.detection
  const confidencePercent = Math.round((plan.confidence ?? 0) * 100)
  const previewScrollRef = useRef<ScrollBoxRenderable | null>(null)
  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup — Review Plan</text>

      <scrollbox ref={previewScrollRef} flexGrow={1} scrollY focused={false} style={PREVIEW_SCROLLBAR_STYLE}>
        <box flexDirection='column' gap={1}>
          <box flexDirection='column'>
            <box flexDirection='row' gap={1}>
              <text attributes={tuiAttrs({ dim: true })}>Framework:</text>
              <text fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
                {det.framework}
              </text>
            </box>
            <box flexDirection='row' gap={1}>
              <text attributes={tuiAttrs({ dim: true })}>Approach:</text>
              <text fg={det.approach === 'already-complete' ? '#10b981' : '#22d3ee'}>{det.approach}</text>
            </box>
            <box flexDirection='row' gap={1}>
              <text attributes={tuiAttrs({ dim: true })}>Confidence:</text>
              <text fg={confidencePercent >= 80 ? '#10b981' : confidencePercent >= 60 ? '#f59e0b' : '#ef4444'}>
                {confidencePercent}%
              </text>
            </box>
            {det.existingSetup.hasOpenTelemetry && (
              <box flexDirection='row' gap={1}>
                <text fg='#f59e0b'>⚡</text>
                <box flexGrow={1} flexShrink={1}>
                  <text fg='#f59e0b'>Existing OpenTelemetry found — will add Multiplayer exporter only</text>
                </box>
              </box>
            )}
            {det.existingSetup.hasMultiplayerSdk && (
              <box flexDirection='row' gap={1}>
                <text fg='#10b981'>✓</text>
                <text fg='#10b981'>Multiplayer SDK already present</text>
              </box>
            )}
            <box flexGrow={1} flexShrink={1}>
              <text attributes={tuiAttrs({ dim: true })}>{det.reasoning}</text>
            </box>
          </box>

          <box
            border={true}
            borderStyle='rounded'
            borderColor='#30363d'
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
          >
            <box flexGrow={1} flexShrink={1}>
              <text fg='#22d3ee'>{plan.summary}</text>
            </box>
          </box>

          {plan.installCommand && (
            <box marginTop={1} flexDirection='row' gap={1}>
              <text attributes={tuiAttrs({ dim: true })}>Install:</text>
              <box flexGrow={1} flexShrink={1}>
                <text fg='#e6edf3'>{plan.installCommand}</text>
              </box>
            </box>
          )}

          {plan.steps.length > 0 && (
            <box flexDirection='column' marginTop={1}>
              <text attributes={tuiAttrs({ dim: true })}>Execution plan:</text>
              {plan.steps.map((step, i) => (
                <box key={i} flexDirection='row' gap={1}>
                  <text fg='#22d3ee' flexShrink={0}>
                    {i + 1}.
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text fg='#e6edf3'>{step}</text>
                  </box>
                </box>
              ))}
            </box>
          )}

          <box flexDirection='column' marginTop={1}>
            <text attributes={tuiAttrs({ dim: true })}>File changes ({plan.fileChanges.length}):</text>
            {plan.fileChanges.map((change, i) => (
              <box key={i} flexDirection='row' gap={1}>
                <text flexShrink={0} fg={change.action === 'create' ? '#10b981' : '#f59e0b'}>
                  {change.action === 'create' ? '+' : '~'}
                </text>
                <text flexShrink={0} fg='#e6edf3'>
                  {change.filePath}
                </text>
                <box flexGrow={1} flexShrink={1}>
                  <text attributes={tuiAttrs({ dim: true })}>— {change.description}</text>
                </box>
              </box>
            ))}
          </box>

          {plan.envVars.length > 0 && (
            <box flexDirection='column' marginTop={1}>
              <text attributes={tuiAttrs({ dim: true })}>Environment variables:</text>
              {plan.envVars.map((env, i) => (
                <box key={i} flexDirection='row' gap={1}>
                  <text flexShrink={0} fg='#22d3ee'>
                    {env.name}
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text attributes={tuiAttrs({ dim: true })}>— {env.description}</text>
                  </box>
                </box>
              ))}
            </box>
          )}

          {plan.warnings.length > 0 && (
            <box flexDirection='column' marginTop={1}>
              <text fg='#f59e0b' attributes={tuiAttrs({ bold: true })}>
                Review before applying:
              </text>
              {plan.warnings.map((warning, i) => (
                <box key={i} flexDirection='row' gap={1}>
                  <text flexShrink={0} fg='#f59e0b'>
                    ⚠
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text fg='#f59e0b'>{warning}</text>
                  </box>
                </box>
              ))}
            </box>
          )}
        </box>
      </scrollbox>

      <box
        flexDirection='column'
        border={true}
        flexShrink={0}
        borderStyle='rounded'
        borderColor='#30363d'
        overflow={'hidden' as const}
      >
        {PREVIEW_ACTIONS.map((action, i) => {
          const isActive = i === selectedIndex
          const isHovered = hoveredRow === i
          const isLast = i === PREVIEW_ACTIONS.length - 1
          const icon = action.id === 'apply' ? '✓' : action.id === 'regenerate' ? '↻' : '→'
          const iconColor = action.id === 'apply' ? '#10b981' : action.id === 'regenerate' ? '#22d3ee' : '#8b949e'
          return (
            <box
              key={action.id}
              flexDirection='column'
              onMouseUp={clickHandler(() => {
                setSelectedIndex(i)
                if (action.id === 'apply') onApply()
                else if (action.id === 'regenerate') onRegenerate()
                else onSkip()
              })}
              onMouseOver={() => setHoveredRow(i)}
              onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
            >
              <box
                id={`action-${i}`}
                flexDirection='row'
                height={1}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
              >
                <box width={3} flexShrink={0}>
                  <text fg={iconColor}>{icon}</text>
                </box>
                <box flexGrow={1}>
                  <text fg={isActive ? '#e6edf3' : '#8b949e'} attributes={tuiAttrs({ bold: isActive })}>
                    {action.label}
                  </text>
                </box>
              </box>
              {!isLast && (
                <box height={1} paddingLeft={1} paddingRight={1}>
                  <text fg='#21262d'>{'─'.repeat(999)}</text>
                </box>
              )}
            </box>
          )
        })}
      </box>

      <box>
        <text fg='#484f58'>↑↓ select · Enter confirm · Esc back</text>
      </box>
    </box>
  ) as ReactElement
}

function ApplyingView({ applyLog }: { applyLog: string[] }): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup — Applying</text>
      <AnimatedLoading title='Applying setup plan' />
      <ApplyLogView applyLog={applyLog} />
    </box>
  ) as ReactElement
}

function DoneView({ applyLog }: { applyLog: string[] }): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup — Complete</text>
      <box gap={2}>
        <text fg='#10b981'>✓</text>
        <text fg='#10b981'>Session Recorder SDK has been set up</text>
      </box>
      <ApplyLogView applyLog={applyLog} />
      <box marginTop={1}>
        <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
      </box>
    </box>
  ) as ReactElement
}

function ErrorView({ error, applyLog }: { error: string | null; applyLog: string[] }): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
      <box gap={2}>
        <text fg='#ef4444'>✗</text>
        <text fg='#ef4444'>{error}</text>
      </box>
      {applyLog.length > 0 && <ApplyLogView applyLog={applyLog} />}
      <text attributes={tuiAttrs({ dim: true })}>Enter retry · Esc back</text>
    </box>
  ) as ReactElement
}

interface ResultsViewProps {
  stacks: DetectedStack[]
  isPartial: boolean
  selectedIndex: number
  hoveredRow: number | null
  setSelectedIndex: (index: number) => void
  setHoveredRow: Dispatch<SetStateAction<number | null>>
  onSetup: () => void
  onSkip: () => void
}

function ResultsView({
  stacks,
  isPartial,
  selectedIndex,
  hoveredRow,
  setSelectedIndex,
  setHoveredRow,
  onSetup,
  onSkip
}: ResultsViewProps): ReactElement {
  const summary = summarizeDetection(stacks)
  const detectedSide = summary.hasFrontend ? 'frontend' : 'backend'
  const missingSide = summary.hasFrontend ? 'backend' : 'frontend'
  const resultsScrollRef = useRef<ScrollBoxRenderable | null>(null)

  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>Session Recorder Setup</text>
      <text attributes={tuiAttrs({ dim: true })}>Detected stacks in your project:</text>
      <scrollbox ref={resultsScrollRef} flexGrow={1} scrollY focused={false} style={PREVIEW_SCROLLBAR_STYLE}>
        <box flexDirection='column'>
          {stacks.map((s, i) => (
            <box key={i} flexDirection='column'>
              <box key={i} flexDirection='row' gap={1} paddingRight={1}>
                <text flexShrink={0} fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
                  {s.label}
                </text>
                <box flexGrow={1} flexShrink={1}>
                  <text attributes={tuiAttrs({ dim: true })}>
                    {s.relativePath !== '.' ? `(${s.relativePath})` : ''} — {sdkDisplayName(s.sdkPackage)}
                  </text>
                </box>
                {s.alreadyInstalled ? (
                  <text flexShrink={0} fg='#10b981'>
                    ✓ installed
                  </text>
                ) : (
                  <text flexShrink={0} fg='#f59e0b'>
                    Needs setup
                  </text>
                )}
              </box>
              {!(stacks.length - 1 === i) && (
                <box height={1} paddingLeft={1} paddingRight={1}>
                  <text fg='#21262d'>{'─'.repeat(999)}</text>
                </box>
              )}
            </box>
          ))}

          {isPartial && (
            <box marginTop={1} flexGrow={1} flexShrink={1}>
              <text fg='#f59e0b'>
                Only {detectedSide} detected. To set up the {missingSide}, run the CLI in the {missingSide} project
                directory.
              </text>
            </box>
          )}
        </box>
      </scrollbox>

      <box
        flexDirection='column'
        border={true}
        flexShrink={0}
        borderStyle='rounded'
        borderColor='#30363d'
        overflow={'hidden' as const}
      >
        {ACTIONS.map((action, i) => {
          const isActive = i === selectedIndex
          const isHovered = hoveredRow === i
          const isLast = i === ACTIONS.length - 1
          const icon = action.id === 'setup' ? '◆' : '→'
          const iconColor = action.id === 'setup' ? '#22d3ee' : '#8b949e'
          return (
            <box
              key={action.id}
              flexDirection='column'
              onMouseUp={clickHandler(() => {
                setSelectedIndex(i)
                if (action.id === 'skip') onSkip()
                else onSetup()
              })}
              onMouseOver={() => setHoveredRow(i)}
              onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
            >
              <box
                id={`action-${i}`}
                flexDirection='row'
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
              >
                <box width={3} flexShrink={0}>
                  <text fg={iconColor}>{icon}</text>
                </box>
                <box flexDirection='column' flexGrow={1} flexShrink={1}>
                  <text
                    fg={isActive ? '#e6edf3' : action.id === 'setup' ? '#c9d1d9' : '#8b949e'}
                    attributes={tuiAttrs({ bold: isActive })}
                  >
                    {action.label}
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text attributes={tuiAttrs({ dim: true })}>{action.description}</text>
                  </box>
                </box>
              </box>
              {!isLast && (
                <box height={1} paddingLeft={1} paddingRight={1}>
                  <text fg='#21262d'>{'─'.repeat(999)}</text>
                </box>
              )}
            </box>
          )
        })}
      </box>

      <box>
        <text fg='#484f58'>↑↓ select · Enter confirm · Esc back</text>
      </box>
    </box>
  ) as ReactElement
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

  const needsSetup = stacks.filter((s) => !s.alreadyInstalled)

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
    if (!config.model || needsSetup.length === 0) {
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
    const result = await generateSetupPlan(stack, config.model, config.modelKey ?? '', config.modelUrl)

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
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex((i) => Math.min(ACTIONS.length - 1, i + 1))
      } else if (name === 'return') {
        const action = ACTIONS[selectedIndex]
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
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex((i) => Math.min(PREVIEW_ACTIONS.length - 1, i + 1))
      } else if (name === 'return') {
        const action = PREVIEW_ACTIONS[selectedIndex]
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

  if (phase === 'scanning') return (<ScanningView />) as ReactElement
  if (phase === 'no-stacks') return (<NoStacksView />) as ReactElement
  if (phase === 'already-done') return (<AlreadyDoneView stacks={stacks} />) as ReactElement
  if (phase === 'ai-planning')
    return (<AiPlanningView stackLabel={needsSetup[0]?.label ?? 'detected stack'} />) as ReactElement
  if (phase === 'preview' && plan) {
    return (
      <PreviewView
        plan={plan}
        selectedIndex={selectedIndex}
        hoveredRow={hoveredRow}
        setSelectedIndex={setSelectedIndex}
        setHoveredRow={setHoveredRow}
        onApply={() => void applyPlan()}
        onRegenerate={() => void runAiPlanning()}
        onSkip={() => onComplete({ sessionRecorderSetupDone: true })}
      />
    ) as ReactElement
  }
  if (phase === 'applying') return (<ApplyingView applyLog={applyLog} />) as ReactElement
  if (phase === 'done') return (<DoneView applyLog={applyLog} />) as ReactElement
  if (phase === 'error') return (<ErrorView error={error} applyLog={applyLog} />) as ReactElement

  return (
    <ResultsView
      stacks={stacks}
      isPartial={phase === 'partial'}
      selectedIndex={selectedIndex}
      hoveredRow={hoveredRow}
      setSelectedIndex={setSelectedIndex}
      setHoveredRow={setHoveredRow}
      onSetup={() => void runAiPlanning()}
      onSkip={() => onComplete({ sessionRecorderSetupDone: true })}
    />
  ) as ReactElement
}
