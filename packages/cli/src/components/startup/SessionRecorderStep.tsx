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
import {
  generateSetupPlan,
  applySetupPlan,
  classifyStacksWithAi,
  applyClassifications,
  createApiKeysForSetup,
  injectApiKeysIntoPlan,
  type SetupPlan
} from '../../session-recorder/setupWithAi.js'
import { Divider } from '../shared/Divider.js'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | 'scanning' // 1. Detecting stacks (heuristic scan)
  | 'classifying' // 2. AI analyzes which stacks need the SDK
  | 'no-stacks' // 2a. Nothing detected — skip
  | 'already-done' // 2b. All stacks configured (installed / not-needed / covered)
  | 'results' // 3. Showing detected stacks, user picks action
  | 'partial' // 3a. Only frontend or backend found — show with warning
  | 'ai-planning' // 4. AI generating the setup plan for a stack
  | 'preview' // 5. Showing AI-generated plan for user approval
  | 'applying' // 6. Applying the plan + running install
  | 'done' // 7. Setup complete
  | 'error' // ✗ Something went wrong (retry / skip)

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

type Action = 'setup' | 'skip'
type PreviewAction = 'apply' | 'regenerate' | 'skip'

const ACTIONS: { id: Action; label: string; description: string }[] = [
  {
    id: 'setup',
    label: 'Set up SDK',
    description: 'Analyze your project and generate integration changes'
  },
  { id: 'skip', label: 'Skip for now', description: 'You can set this up later' }
]

const PREVIEW_ACTIONS: { id: PreviewAction; label: string }[] = [
  { id: 'apply', label: 'Apply changes' },
  { id: 'regenerate', label: 'Regenerate plan' },
  { id: 'skip', label: 'Skip' }
]

const STEP_TITLE = 'Multiplayer SDK'

type StatusGroup = 'needs-setup' | 'installed' | 'not-needed' | 'covered'
const STATUS_ORDER: StatusGroup[] = ['needs-setup', 'installed', 'covered', 'not-needed']
const STATUS_LABELS: Record<StatusGroup, string> = {
  'needs-setup': 'Needs Setup',
  installed: 'Installed',
  covered: 'Covered by Dependency',
  'not-needed': 'Not Needed'
}
const STATUS_COLORS: Record<StatusGroup, string> = {
  'needs-setup': '#f59e0b',
  installed: '#10b981',
  covered: '#8b5cf6',
  'not-needed': '#6b7280'
}

function getStatusGroup(s: DetectedStack): StatusGroup {
  if (s.sdkRelevance === 'installed' || (!s.sdkRelevance && s.alreadyInstalled)) return 'installed'
  if (s.sdkRelevance === 'not-needed') return 'not-needed'
  if (s.sdkRelevance === 'covered-by-dependency') return 'covered'
  return 'needs-setup'
}

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
      setFrameIndex((i) => (i + 1) % 120)
    }, 90)
    return () => clearInterval(timer)
  }, [])

  const spinner = spinnerFrames[frameIndex % spinnerFrames.length] ?? spinnerFrames[0]
  const pulseText = pulseFrames[Math.floor(frameIndex / 2) % pulseFrames.length] ?? pulseFrames[0]

  const BAR_WIDTH = 28
  const SEGMENT = 6
  const travel = BAR_WIDTH - SEGMENT
  const raw = frameIndex % (travel * 2)
  const pos = raw < travel ? raw : travel * 2 - raw
  const before = pos
  const after = BAR_WIDTH - SEGMENT - (pos || 1)

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
        <text fg='#30363d'>{'─'.repeat(before)}</text>
        <text fg={color}>{'━'.repeat(SEGMENT)}</text>
        <text fg='#30363d'>{'─'.repeat(after)}</text>
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
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
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
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
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

function StackBadge({ stack }: { stack: DetectedStack }): ReactElement {
  const s = stack
  if (s.sdkRelevance === 'installed' || s.alreadyInstalled) {
    return (
      <text flexShrink={0} fg='#10b981'>
        ✓ installed
      </text>
    ) as ReactElement
  }
  if (s.sdkRelevance === 'not-needed') {
    return (
      <text flexShrink={0} fg='#6b7280'>
        SDK not needed
      </text>
    ) as ReactElement
  }
  if (s.sdkRelevance === 'covered-by-dependency') {
    return (
      <text flexShrink={0} fg='#8b5cf6'>
        ✓ covered by dependency
      </text>
    ) as ReactElement
  }
  return (
    <text flexShrink={0} fg='#f59e0b'>
      Needs setup
    </text>
  ) as ReactElement
}

function StackRow({
  stack,
  isLast,
  checkbox
}: {
  stack: DetectedStack
  isLast: boolean
  checkbox?: { checked: boolean; focused: boolean; onToggle: () => void }
}): ReactElement {
  const s = stack
  return (
    <box flexDirection='column'>
      <box
        flexDirection='row'
        gap={2}
        paddingRight={1}
        backgroundColor={checkbox?.focused ? '#161b22' : undefined}
        onMouseUp={checkbox ? clickHandler(checkbox.onToggle) : undefined}
      >
        {checkbox && (
          <text flexShrink={0} fg={checkbox.checked ? '#22d3ee' : '#484f58'}>
            {checkbox.checked ? '[✓]' : '[ ]'}
          </text>
        )}
        <box flexGrow={1} flexShrink={1} flexDirection='column'>
          <box flexDirection='row' gap={1} paddingRight={1}>
            <text flexShrink={0} fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
              {s.relativePath !== '.' ? s.relativePath : s.label}
            </text>
            <box flexGrow={1} flexShrink={1}>
              <text attributes={tuiAttrs({ dim: true })}>
                {s.label} — {sdkDisplayName(s.sdkPackage)}
              </text>
            </box>
          </box>
          {s.sdkRelevanceReason && (s.sdkRelevance === 'not-needed' || s.sdkRelevance === 'covered-by-dependency') && (
            <box flexGrow={1} flexShrink={1}>
              <text attributes={tuiAttrs({ dim: true })} fg='#6b7280'>
                {s.sdkRelevanceReason}
              </text>
            </box>
          )}
        </box>
        <StackBadge stack={s} />
      </box>
      {!isLast && <Divider />}
    </box>
  ) as ReactElement
}

function AlreadyDoneView({ stacks, onContinue }: { stacks: DetectedStack[]; onContinue: () => void }): ReactElement {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <box gap={1} flexDirection='row'>
        <text fg='#10b981'>✓</text>
        <text fg='#10b981'>All detected stacks are configured</text>
      </box>
      <text attributes={tuiAttrs({ dim: true })}>Detected stacks in your project:</text>
      <scrollbox ref={scrollRef} flexGrow={1} scrollY focused={false} style={PREVIEW_SCROLLBAR_STYLE}>
        <box flexDirection='column'>
          {stacks.map((s, i) => (
            <StackRow key={i} stack={s} isLast={i === stacks.length - 1} />
          ))}
        </box>
      </scrollbox>

      <box
        border={true}
        flexShrink={0}
        flexDirection='column'
        borderStyle='rounded'
        borderColor='#30363d'
        overflow={'hidden' as const}
        onMouseUp={clickHandler(onContinue)}
      >
        <box flexDirection='row' paddingLeft={1} paddingRight={1} backgroundColor='#161b22'>
          <box width={3} flexShrink={0}>
            <text fg='#10b981'>→</text>
          </box>
          <box flexGrow={1}>
            <text fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
              Continue
            </text>
          </box>
        </box>
      </box>

      <box>
        <text fg='#484f58'>Enter continue</text>
      </box>
    </box>
  ) as ReactElement
}

function ClassifyingView(): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <AnimatedLoading
        title='Analyzing your project structure'
        subtitle='Determining which packages need the SDK...'
        color='#a78bfa'
      />
      <box>
        <text fg='#484f58'>Esc skip</text>
      </box>
    </box>
  ) as ReactElement
}

function AiPlanningView({ stackLabel }: { stackLabel: string }): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <AnimatedLoading
        title='Preparing your setup plan'
        subtitle={`Reading integration guide + project files for ${stackLabel}`}
        color='#f59e0b'
      />
      <box>
        <text fg='#484f58'>Esc skip</text>
      </box>
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
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE} — Review Plan</text>

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
              <box flexDirection='column'>
                <box flexDirection='row' gap={1}>
                  <text fg='#f59e0b'>⚡</text>
                  <box flexGrow={1} flexShrink={1}>
                    <text fg='#f59e0b'>
                      Existing OpenTelemetry found — will add Multiplayer OTLP exporter alongside existing setup
                    </text>
                  </box>
                </box>
                {det.existingSetup.existingOtlpEndpoint && (
                  <box flexDirection='row' gap={1} paddingLeft={3}>
                    <text attributes={tuiAttrs({ dim: true })}>Current endpoint:</text>
                    <text fg='#e6edf3'>{det.existingSetup.existingOtlpEndpoint}</text>
                  </box>
                )}
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
              {!isLast && <Divider />}
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
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE} — Applying</text>
      <AnimatedLoading title='Applying setup plan' />
      <ApplyLogView applyLog={applyLog} />
    </box>
  ) as ReactElement
}

function DoneView({ applyLog }: { applyLog: string[] }): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE} — Complete</text>
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
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
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
  selectedStacks: Set<string>
  onToggleStack: (relativePath: string) => void
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
  selectedStacks,
  onToggleStack,
  onSetup,
  onSkip
}: ResultsViewProps): ReactElement {
  const summary = summarizeDetection(stacks)
  const detectedSide = summary.hasFrontend ? 'frontend' : 'backend'
  const missingSide = summary.hasFrontend ? 'backend' : 'frontend'
  const resultsScrollRef = useRef<ScrollBoxRenderable | null>(null)

  // Group stacks by status in display order
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    stacks: stacks.filter((s) => getStatusGroup(s) === status)
  })).filter((g) => g.stacks.length > 0)

  // Build checkable items in display order for cursor mapping
  const checkableInOrder: DetectedStack[] = []
  for (const group of grouped) {
    for (const s of group.stacks) {
      if (getStatusGroup(s) === 'needs-setup') {
        checkableInOrder.push(s)
      }
    }
  }

  const checkableCount = checkableInOrder.length
  const actionIdx = selectedIndex >= checkableCount ? selectedIndex - checkableCount : -1

  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <text attributes={tuiAttrs({ dim: true })} marginBottom={1}>
        Detected stacks in your project:
      </text>
      <scrollbox ref={resultsScrollRef} flexGrow={1} scrollY focused={false} style={PREVIEW_SCROLLBAR_STYLE}>
        <box flexDirection='column'>
          {grouped.map((group, gi) => (
            <box key={group.status} flexDirection='column'>
              <box paddingTop={gi > 0 ? 1 : 0}>
                <text fg={STATUS_COLORS[group.status]} attributes={tuiAttrs({ bold: true, underline: true })}>
                  {STATUS_LABELS[group.status]} ({group.stacks.length})
                </text>
              </box>
              <Divider />
              {group.stacks.map((s, si) => {
                const isCheckable = getStatusGroup(s) === 'needs-setup'
                const checkIdx = isCheckable ? checkableInOrder.indexOf(s) : -1
                const isFocused = checkIdx >= 0 && checkIdx === selectedIndex
                const isChecked = selectedStacks.has(s.relativePath)
                const isLastStack = gi === grouped.length - 1 && si === group.stacks.length - 1

                return (
                  <StackRow
                    key={si}
                    stack={s}
                    isLast={isLastStack}
                    checkbox={
                      isCheckable
                        ? {
                            checked: isChecked,
                            focused: isFocused,
                            onToggle: () => onToggleStack(s.relativePath)
                          }
                        : undefined
                    }
                  />
                )
              })}
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
        border={true}
        flexShrink={0}
        flexDirection='column'
        borderStyle='rounded'
        borderColor='#30363d'
        overflow={'hidden' as const}
      >
        {ACTIONS.map((action, i) => {
          const isDisabled = action.id === 'setup' && selectedStacks.size === 0
          const isActive = actionIdx === i && !isDisabled
          const isHovered = hoveredRow === i
          const isLast = i === ACTIONS.length - 1
          const icon = action.id === 'setup' ? '◆' : '→'
          const iconColor = isDisabled ? '#484f58' : action.id === 'setup' ? '#22d3ee' : '#8b949e'
          return (
            <box
              key={action.id}
              flexDirection='column'
              onMouseUp={
                isDisabled
                  ? undefined
                  : clickHandler(() => {
                      setSelectedIndex(checkableCount + i)
                      if (action.id === 'skip') onSkip()
                      else onSetup()
                    })
              }
              onMouseOver={() => setHoveredRow(i)}
              onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
            >
              <box
                id={`action-${i}`}
                flexDirection='row'
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isActive ? '#161b22' : isHovered && !isDisabled ? '#21262d' : undefined}
              >
                <box width={3} flexShrink={0}>
                  <text fg={iconColor}>{icon}</text>
                </box>
                <box flexDirection='column' flexGrow={1} flexShrink={1}>
                  <text
                    fg={isDisabled ? '#484f58' : isActive ? '#e6edf3' : action.id === 'setup' ? '#c9d1d9' : '#8b949e'}
                    attributes={tuiAttrs({ bold: isActive })}
                  >
                    {action.label}
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text attributes={tuiAttrs({ dim: true })}>
                      {isDisabled ? 'Select at least one stack above' : action.description}
                    </text>
                  </box>
                </box>
              </box>
              {!isLast && <Divider />}
            </box>
          )
        })}
      </box>

      <box>
        <text fg='#484f58'>↑↓ navigate · Space toggle · Enter confirm</text>
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
  const abortRef = useRef<AbortController | null>(null)
  const [selectedStacks, setSelectedStacks] = useState<Set<string>>(new Set())

  const needsSetup = stacks.filter((s) => getStatusGroup(s) === 'needs-setup')
  const selectedForSetup = needsSetup.filter((s) => selectedStacks.has(s.relativePath))

  const toggleStack = (relativePath: string) => {
    setSelectedStacks((prev) => {
      const next = new Set(prev)
      if (next.has(relativePath)) next.delete(relativePath)
      else next.add(relativePath)
      return next
    })
  }

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

    // If we have a model configured and multiple stacks, use AI to classify
    if (config.model && detected.length > 1) {
      setPhase('classifying')
      void runAiClassification(detected)
    } else {
      // Fallback: use heuristic classification
      for (const s of detected) {
        s.sdkRelevance = s.alreadyInstalled ? 'installed' : 'needed'
      }
      setStacks([...detected])
      transitionToResults(detected)
    }
  }, [config.dir])

  const transitionToResults = (classified: DetectedStack[]) => {
    const summary = summarizeDetection(classified)
    // After classification, check if all relevant stacks are installed or not-needed
    const actionable = classified.filter((s) => s.sdkRelevance === 'needed')
    setSelectedStacks(new Set(actionable.map((s) => s.relativePath)))
    if (actionable.length === 0) {
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
  }

  // ─── AI classification ────────────────────────────────────────────────────

  const runAiClassification = async (detected: DetectedStack[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await classifyStacksWithAi(detected, config.model!, config.modelKey ?? '', config.modelUrl)

      if (controller.signal.aborted) return

      if (result.success) {
        applyClassifications(detected, result.classifications)
      } else {
        // Fallback to heuristic on AI failure
        for (const s of detected) {
          s.sdkRelevance = s.alreadyInstalled ? 'installed' : 'needed'
        }
      }

      setStacks([...detected])
      transitionToResults(detected)
    } catch {
      if (controller.signal.aborted) return
      // Fallback to heuristic
      for (const s of detected) {
        s.sdkRelevance = s.alreadyInstalled ? 'installed' : 'needed'
      }
      setStacks([...detected])
      transitionToResults(detected)
    } finally {
      abortRef.current = null
    }
  }

  // ─── AI planning ───────────────────────────────────────────────────────────

  const runAiPlanning = async () => {
    if (!config.model || selectedForSetup.length === 0) {
      setError('Model is not configured or no stacks selected')
      setPhase('error')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setPhase('ai-planning')
    setError(null)

    try {
      // For now, plan for the first selected stack
      // TODO: iterate over all stacks
      const stack = selectedForSetup[0]!

      // Find README relative to project dir (the CLI ships with SDKs in the monorepo)
      // For deployed CLI, READMEs would be bundled or fetched
      const result = await generateSetupPlan(stack, config.model, config.modelKey ?? '', config.modelUrl)

      if (controller.signal.aborted) return

      if (result.success && result.plan) {
        setPlan(result.plan)
        setSelectedIndex(0)
        setPhase('preview')
      } else {
        setError(result.error ?? 'Failed to generate setup plan')
        setPhase('error')
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      setError((err as Error).message)
      setPhase('error')
    } finally {
      abortRef.current = null
    }
  }

  // ─── Apply plan ────────────────────────────────────────────────────────────

  const applyPlan = async () => {
    if (!plan || !config.dir) return
    setPhase('applying')
    const log: string[] = []

    try {
      // 1. Create Multiplayer API keys automatically
      const currentStack = selectedForSetup[0]
      if (config.workspace && config.project && config.apiKey) {
        log.push('◌ Creating Multiplayer API key...')
        setApplyLog([...log])

        const { keys, errors: keyErrors } = await createApiKeysForSetup(needsSetup, {
          url: config.url!,
          apiKey: config.apiKey,
          workspace: config.workspace,
          project: config.project
        })

        for (const err of keyErrors) {
          log.push(`⚠ ${err}`)
        }

        if (keys.length > 0) {
          injectApiKeysIntoPlan(plan, keys, currentStack?.type ?? 'backend')
          for (const k of keys) {
            log[log.length - 1 - keyErrors.length] = `✓ Created ${k.stackType} API key: ${k.name}`
          }
        } else if (keyErrors.length === 0) {
          log[log.length - 1] = '· No API keys needed'
        }

        setApplyLog([...log])
      }

      // 2. Write file changes
      const written = applySetupPlan(plan, config.dir)
      for (const f of written) {
        log.push(`✓ ${f}`)
      }

      // 3. Run install command if needed
      if (plan.installCommand) {
        log.push(`◌ Running: ${plan.installCommand}`)
        setApplyLog([...log])

        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)
        await execAsync(plan.installCommand, { cwd: config.dir, timeout: 120_000 })
        log[log.length - 1] = `✓ ${plan.installCommand}`
      }

      // 4. Note env vars
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
    if (phase === 'scanning' || phase === 'applying') return

    // Allow skipping during AI analysis
    if (phase === 'classifying' || phase === 'ai-planning') {
      if (name === 'escape') {
        abortRef.current?.abort()
        abortRef.current = null
        onComplete({ sessionRecorderSetupDone: true })
      }
      return
    }

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

    // Results & partial: navigate checkboxes + action buttons
    if (phase === 'results' || phase === 'partial') {
      const checkableCount = needsSetup.length
      const totalItems = checkableCount + ACTIONS.length
      if (name === 'up' || name === 'left') {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex((i) => Math.min(totalItems - 1, i + 1))
      } else if (name === 'space') {
        if (selectedIndex < checkableCount) {
          const stack = needsSetup[selectedIndex]
          if (stack) toggleStack(stack.relativePath)
        }
      } else if (name === 'return') {
        if (selectedIndex >= checkableCount) {
          const actionIdx = selectedIndex - checkableCount
          const action = ACTIONS[actionIdx]
          if (action?.id === 'skip') {
            onComplete({ sessionRecorderSetupDone: true })
          } else if (action?.id === 'setup' && selectedForSetup.length > 0) {
            void runAiPlanning()
          }
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

  const handleContinue = () => {
    onComplete({ sessionRecorderSetupDone: true })
  }
  // ─── Render: ordered by phase flow ─────────────────────────────────────────

  switch (phase) {
    case 'scanning':
      return (<ScanningView />) as ReactElement
    case 'classifying':
      return (<ClassifyingView />) as ReactElement
    case 'no-stacks':
      return (<NoStacksView />) as ReactElement
    case 'already-done':
      return (<AlreadyDoneView stacks={stacks} onContinue={handleContinue} />) as ReactElement
    case 'ai-planning':
      return (<AiPlanningView stackLabel={needsSetup[0]?.label ?? 'detected stack'} />) as ReactElement
    case 'preview':
      return plan
        ? ((
            <PreviewView
              plan={plan}
              selectedIndex={selectedIndex}
              hoveredRow={hoveredRow}
              setSelectedIndex={setSelectedIndex}
              setHoveredRow={setHoveredRow}
              onApply={() => void applyPlan()}
              onRegenerate={() => void runAiPlanning()}
              onSkip={handleContinue}
            />
          ) as ReactElement)
        : ((<ScanningView />) as ReactElement)
    case 'applying':
      return (<ApplyingView applyLog={applyLog} />) as ReactElement
    case 'done':
      return (<DoneView applyLog={applyLog} />) as ReactElement
    case 'error':
      return (<ErrorView error={error} applyLog={applyLog} />) as ReactElement
    case 'results':
    case 'partial':
      return (
        <ResultsView
          stacks={stacks}
          isPartial={phase === 'partial'}
          selectedIndex={selectedIndex}
          hoveredRow={hoveredRow}
          setSelectedIndex={setSelectedIndex}
          setHoveredRow={setHoveredRow}
          selectedStacks={selectedStacks}
          onToggleStack={toggleStack}
          onSetup={() => void runAiPlanning()}
          onSkip={handleContinue}
        />
      ) as ReactElement
  }
}
